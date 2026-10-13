// Ponte do WhatsApp conectado: o painel que envia as mensagens (hoje, o painel
// local da empresa) busca a fila e informa o resultado por aqui.
//
// Autenticação: cabeçalho x-bridge-key com a chave da conexão da empresa. Só o
// SHA-256 da chave fica no banco (whatsapp_connectors.token_hash). Publicar com
// --no-verify-jwt: quem chama não é um usuário do app.
// Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (já presentes nas funções).
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BRIDGE_KEY_HEADER, isPlausibleBridgeKey, normalizeBridgeSettings, parseBridgeCommand, sha256Hex } from './bridgeLogic.ts';
import { getFollowUpItem } from './followUpCore.ts';
import {
    PIPELINE_FOLLOW_UP_COLUMNS, PIPELINE_ITEM_COLUMNS, PIPELINE_LOOKBACK_DAYS, PIPELINE_MESSAGE_COLUMNS, PIPELINE_PORTAL_COLUMNS,
    type PipelineRows, buildPipeline, templatesByStep, toCorePortal,
} from './pipeline.ts';

// Links das propostas sempre no endereço oficial do app.
const APP_ORIGIN = 'https://app.filmstec.shop';
// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, any, any>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

// Mensagens de erro do banco (RAISE EXCEPTION) já são escritas para a empresa.
const rpcError = (error: { message?: string } | null) =>
    json({ error: error?.message?.slice(0, 300) || 'Não foi possível concluir.' }, 409);

// Listas grandes em partes, para a URL da consulta não passar do limite.
const inChunks = async <T>(ids: unknown[], load: (chunk: unknown[]) => PromiseLike<{ data: T[] | null; error: unknown }>) => {
    const rows: T[] = [];
    for (let index = 0; index < ids.length; index += 100) {
        const { data, error } = await load(ids.slice(index, index + 100));
        if (error) throw error;
        rows.push(...(data || []));
    }
    return rows;
};

const rowsOrThrow = <T>({ data, error }: { data: T[] | null; error: unknown }) => {
    if (error) throw error;
    return data || [];
};

// Propostas da empresa que podem estar no quadro, com tudo que o cálculo precisa.
const loadPipelineRows = async (admin: Admin, organizationId: string, portalId?: string): Promise<PipelineRows> => {
    let query = admin.from('proposal_portals').select(PIPELINE_PORTAL_COLUMNS)
        .eq('organization_id', organizationId).neq('status', 'revoked').is('lost_at', null);
    if (portalId) query = query.eq('id', portalId);
    else {
        const cutoff = new Date(Date.now() - PIPELINE_LOOKBACK_DAYS * 86_400_000).toISOString();
        query = query.or(`expires_at.gte.${cutoff},last_activity_at.gte.${cutoff}`);
    }
    const { data: portals, error } = await query.order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    if (!portals?.length) return { portals: [], clients: [], items: [], messages: [], followUps: [], templates: [], queued: [] };

    const portalIds = portals.map((row: any) => row.id);
    const clientIds = [...new Set(portals.map((row: any) => row.client_id))];
    const { data: organization } = await admin.from('organizations').select('owner_id').eq('id', organizationId).maybeSingle();
    // Modelos do "Para acompanhar hoje": os da empresa e, nos antigos sem empresa, os do dono.
    const templateFilter = organization?.owner_id
        ? `organization_id.eq.${organizationId},and(organization_id.is.null,user_id.eq.${organization.owner_id})`
        : `organization_id.eq.${organizationId}`;

    const [clients, items, messages, followUps, templates, queued] = await Promise.all([
        inChunks(clientIds, chunk => admin.from('clients').select('id, nome, telefone').in('id', chunk)),
        inChunks(portalIds, chunk => admin.from('proposal_portal_items').select(PIPELINE_ITEM_COLUMNS).in('portal_id', chunk)),
        inChunks(portalIds, chunk => admin.from('proposal_portal_messages').select(PIPELINE_MESSAGE_COLUMNS).in('portal_id', chunk).order('created_at')),
        inChunks(portalIds, chunk => admin.from('proposal_portal_follow_ups').select(PIPELINE_FOLLOW_UP_COLUMNS).in('portal_id', chunk).order('created_at')),
        admin.from('proposal_message_templates').select('id, follow_up_step, body').not('follow_up_step', 'is', null).or(templateFilter).then(rowsOrThrow),
        admin.from('whatsapp_outbox').select('id, portal_id, step, status').eq('organization_id', organizationId)
            .eq('kind', 'proposal_follow_up').in('status', ['pending', 'sending']).then(rowsOrThrow),
    ]);
    return { portals, clients, items, messages, followUps, templates, queued } as PipelineRows;
};

const loadSettings = async (admin: Admin, connectorId: string) => {
    const { data, error } = await admin.from('whatsapp_connectors').select('settings').eq('id', connectorId).single();
    if (error) throw error;
    return normalizeBridgeSettings(data?.settings);
};

Deno.serve(async (request) => {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return json({ error: 'Serviço indisponível.' }, 500);

    const key = request.headers.get(BRIDGE_KEY_HEADER);
    if (!isPlausibleBridgeKey(key)) return json({ error: 'Chave da conexão ausente ou inválida.' }, 401);

    let payload: unknown;
    try { payload = await request.json(); } catch { return json({ error: 'Pedido inválido.' }, 400); }
    const command = parseBridgeCommand(payload);
    if ('invalid' in command) return json({ error: command.invalid }, 400);

    const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: connector, error: connectorError } = await admin
        .from('whatsapp_connectors')
        .select('id, organization_id, channel, created_by')
        .eq('token_hash', await sha256Hex(key))
        .eq('enabled', true)
        .maybeSingle();
    if (connectorError) return json({ error: 'Serviço indisponível.' }, 500);
    if (!connector || connector.channel !== 'local_panel') return json({ error: 'Chave da conexão inválida ou desligada.' }, 401);

    const org = connector.organization_id;
    switch (command.action) {
        case 'hello': {
            const { data, error } = await admin.rpc('whatsapp_bridge_touch', { p_connector_id: connector.id });
            return error ? rpcError(error) : json(data);
        }
        case 'pending': {
            await admin.rpc('whatsapp_bridge_touch', { p_connector_id: connector.id });
            const { data, error } = await admin.rpc('whatsapp_bridge_pending', { p_organization_id: org, p_limit: command.limit });
            return error ? rpcError(error) : json({ items: data ?? [] });
        }
        case 'claim': {
            const { data, error } = await admin.rpc('whatsapp_bridge_claim', { p_organization_id: org, p_id: command.id });
            return error ? rpcError(error) : json(data);
        }
        case 'report': {
            const { data, error } = await admin.rpc('whatsapp_bridge_report', {
                p_organization_id: org,
                p_id: command.id,
                p_status: command.status,
                p_error: command.error,
                p_provider_message_id: command.providerMessageId,
            });
            return error ? rpcError(error) : json(data);
        }
        case 'settings_get':
            try { return json({ settings: await loadSettings(admin, connector.id) }); }
            catch { return json({ error: 'Serviço indisponível.' }, 500); }
        case 'settings_set': {
            const { error } = await admin.from('whatsapp_connectors').update({ settings: command.settings }).eq('id', connector.id);
            return error ? json({ error: 'Não foi possível salvar os ajustes.' }, 500) : json({ settings: command.settings });
        }
        case 'pipeline': {
            try {
                const settings = await loadSettings(admin, connector.id);
                const rows = await loadPipelineRows(admin, org);
                const now = Date.now();
                const cards = buildPipeline(rows, now, { origin: APP_ORIGIN, cadence: settings.cadence, timeZone: settings.timeZone });
                return json({ now, settings, cards });
            } catch {
                return json({ error: 'Não foi possível carregar as propostas.' }, 500);
            }
        }
        case 'follow_up_enqueue': {
            // Confere de novo, na hora, se a proposta ainda está nesse passo: o quadro do painel pode estar desatualizado.
            let message: string | null;
            try {
                const settings = await loadSettings(admin, connector.id);
                const rows = await loadPipelineRows(admin, org, command.portalId);
                const portal = rows.portals[0];
                if (!portal) return json({ error: 'Esta proposta não está mais em acompanhamento.' }, 409);
                const item = getFollowUpItem(toCorePortal(portal, rows), Date.now(), {
                    origin: APP_ORIGIN, templates: templatesByStep(rows.templates), cadence: settings.cadence, timeZone: settings.timeZone,
                });
                if (!item || item.step !== command.step) return json({ error: 'A proposta mudou de etapa. Atualize o quadro.' }, 409);
                message = command.message ?? item.message;
            } catch {
                return json({ error: 'Não foi possível conferir a proposta.' }, 500);
            }
            const { data, error } = await admin.rpc('whatsapp_bridge_enqueue_follow_up', {
                p_organization_id: org,
                p_portal_id: command.portalId,
                p_step: command.step,
                p_message: message,
                p_created_by: connector.created_by,
            });
            return error ? rpcError(error) : json(data);
        }
        case 'client_phones': {
            if (!command.phones.length) return json({ clients: {} });
            const { data, error } = await admin.rpc('whatsapp_bridge_client_phones', { p_organization_id: org, p_phones: command.phones });
            return error ? rpcError(error) : json({ clients: data ?? {} });
        }
        case 'client_create': {
            const { data, error } = await admin.rpc('whatsapp_bridge_create_client', { p_organization_id: org, p_name: command.name, p_phone: command.phone });
            return error ? rpcError(error) : json(data);
        }
        case 'supplier_phones': {
            if (!command.phones.length) return json({ suppliers: {} });
            const { data, error } = await admin.rpc('whatsapp_bridge_supplier_phones', { p_organization_id: org, p_phones: command.phones });
            return error ? rpcError(error) : json({ suppliers: data ?? {} });
        }
        case 'supplier_create': {
            const { data, error } = await admin.rpc('whatsapp_bridge_create_supplier', { p_organization_id: org, p_name: command.name, p_phone: command.phone });
            return error ? rpcError(error) : json(data);
        }
        case 'triage_upsert': {
            if (!command.items.length) return json({ received: 0 });
            const { data, error } = await admin.rpc('whatsapp_bridge_triage_upsert', { p_organization_id: org, p_items: command.items });
            return error ? rpcError(error) : json(data);
        }
        case 'triage_decisions': {
            const { data, error } = await admin.rpc('whatsapp_bridge_triage_decisions', { p_organization_id: org });
            return error ? rpcError(error) : json({ decisions: data ?? [] });
        }
        case 'triage_ack': {
            if (!command.ids.length) return json({ acked: 0 });
            const { data, error } = await admin.rpc('whatsapp_bridge_triage_ack', { p_organization_id: org, p_ids: command.ids });
            return error ? rpcError(error) : json(data);
        }
        // Dados da empresa para a IA do painel (catálogo, pagamento, horário...). Sem custos nem chaves.
        case 'company_profile': {
            const { data, error } = await admin.rpc('whatsapp_bridge_company_profile', { p_organization_id: org });
            return error ? rpcError(error) : json({ profile: data ?? {} });
        }
        // Atualizações do painel local: a versão mais nova publicada e o pacote dela.
        // O painel confere a assinatura (feita por quem publica) antes de instalar.
        case 'update_check': {
            const { data, error } = await admin.from('whatsapp_panel_releases')
                .select('version, sha256, signature, size_bytes, notes, created_at')
                .eq('active', true).order('id', { ascending: false }).limit(1).maybeSingle();
            return error ? json({ error: 'Serviço indisponível.' }, 500) : json({ release: data ?? null });
        }
        case 'update_download': {
            const { data, error } = await admin.from('whatsapp_panel_releases')
                .select('version, sha256, signature, package_base64')
                .eq('version', command.version).eq('active', true).maybeSingle();
            if (error) return json({ error: 'Serviço indisponível.' }, 500);
            return data ? json(data) : json({ error: 'Esta versão não está mais disponível. Procure a atualização de novo.' }, 404);
        }
    }
});
