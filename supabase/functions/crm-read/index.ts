// CRM para o atendimento de WhatsApp (Conversa Bridge Ai): propostas de um
// telefone, agenda de um intervalo de datas e, com permissão própria, salvar o
// cliente que a IA terminou de qualificar (nunca altera cliente existente).
//
// Autenticação: cabeçalho x-crm-key com uma chave da tabela crm_read_keys.
// Só o SHA-256 da chave fica no banco, e a chave diz qual é a empresa.
// Publicar com --no-verify-jwt: quem chama é o servidor do atendimento, não um
// usuário do app. Ver docs/integracoes/conversa-bridge-leitura.md.
// Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (já presentes nas funções);
// VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY para o aviso no celular (os mesmos do proposal-portal).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { handleCrmRead } from './crmReadHandler.ts';

Deno.serve(async (request) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
        return new Response(JSON.stringify({ error: 'Serviço indisponível.' }), {
            status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    return handleCrmRead(request, {
        findKey: async (tokenHash) => {
            const { data, error } = await admin.rpc('crm_read_key_lookup', { p_token_hash: tokenHash });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            return row?.organization_id
                ? { keyId: row.key_id, organizationId: row.organization_id, scopes: Array.isArray(row.scopes) ? row.scopes : [] }
                : null;
        },
        loadProposals: async (organizationId, phone) => {
            const { data, error } = await admin.rpc('crm_read_proposals', { p_organization_id: organizationId, p_phone: phone });
            if (error) throw error;
            return data ?? { clients: [], portals: [], items: [], pdfs: [] };
        },
        loadAgenda: async (organizationId, fromIso, toIso) => {
            const { data, error } = await admin.rpc('crm_read_agenda', { p_organization_id: organizationId, p_from: fromIso, p_to: toIso });
            if (error) throw error;
            return data ?? { events: [], working_hours: null };
        },
        saveClient: async (keyId, organizationId, input) => {
            const { data, error } = await admin.rpc('crm_save_client_with_draft', {
                p_key_id: keyId,
                p_organization_id: organizationId,
                p_phone: input.phone,
                p_name: input.name,
                p_bairro: input.bairro,
                p_cidade: input.cidade,
                p_notes: input.notes,
                p_measurements: input.measurements.length ? input.measurements : null,
                p_film: input.film,
            });
            if (error) {
                const message = error.message ?? '';
                if (message.includes('Limite de cadastros')) return { ok: false, reason: 'limit' };
                if (message.includes('sem permissão')) return { ok: false, reason: 'forbidden' };
                throw error;
            }
            return {
                ok: true, clientId: Number(data.client_id), name: String(data.name ?? ''), created: data.created === true,
                draft: data.draft === 'criado' || data.draft === 'ja_existia' ? data.draft : 'sem_medidas',
            };
        },
        notifyCompany: async (organizationId, push) => {
            const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
            const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
            if (!publicKey || !privateKey) throw new Error('vapid');
            webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:suporte@filmstec.shop', publicKey, privateKey);

            const { data: subscriptions, error } = await admin.from('agenda_push_subscriptions')
                .select('id, endpoint, p256dh, auth')
                .eq('organization_id', organizationId)
                .eq('enabled', true);
            if (error) throw error;
            const payload = JSON.stringify({
                ...push,
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                requireInteraction: true,
                actions: [{ action: 'open-clients', title: 'Ver clientes' }],
            });
            await Promise.all((subscriptions ?? []).map(async (subscription: { id: string; endpoint: string; p256dh: string; auth: string }) => {
                try {
                    await webpush.sendNotification(
                        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
                        payload,
                        { TTL: 24 * 60 * 60, urgency: 'high' },
                    );
                } catch (pushError) {
                    // Aparelho que não recebe mais avisos: desliga, como o proposal-portal faz.
                    const status = (pushError as { statusCode?: number })?.statusCode;
                    if (status === 404 || status === 410) {
                        await admin.from('agenda_push_subscriptions')
                            .update({ enabled: false, updated_at: new Date().toISOString() })
                            .eq('id', subscription.id);
                    }
                }
            }));
        },
        logError: (code) => console.error(`crm-read: ${code}`),
    });
});
