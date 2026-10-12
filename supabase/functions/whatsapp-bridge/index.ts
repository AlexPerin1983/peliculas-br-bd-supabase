// Ponte do WhatsApp conectado: o painel que envia as mensagens (hoje, o painel
// local da empresa) busca a fila e informa o resultado por aqui.
//
// Autenticação: cabeçalho x-bridge-key com a chave da conexão da empresa. Só o
// SHA-256 da chave fica no banco (whatsapp_connectors.token_hash). Publicar com
// --no-verify-jwt: quem chama não é um usuário do app.
// Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (já presentes nas funções).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BRIDGE_KEY_HEADER, isPlausibleBridgeKey, parseBridgeCommand, sha256Hex } from './bridgeLogic.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

// Mensagens de erro do banco (RAISE EXCEPTION) já são escritas para a empresa.
const rpcError = (error: { message?: string } | null) =>
    json({ error: error?.message?.slice(0, 300) || 'Não foi possível concluir.' }, 409);

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
        .select('id, organization_id, channel')
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
    }
});
