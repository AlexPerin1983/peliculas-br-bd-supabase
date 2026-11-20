// Leitura do CRM pelo atendimento de WhatsApp (Conversa Bridge Ai). Só leitura:
// propostas de um telefone e agenda de um intervalo de datas.
//
// Autenticação: cabeçalho x-crm-key com uma chave de leitura (crm_read_keys).
// Só o SHA-256 da chave fica no banco, e a chave diz qual é a empresa.
// Publicar com --no-verify-jwt: quem chama é o servidor do atendimento, não um
// usuário do app. Ver docs/integracoes/conversa-bridge-leitura.md.
// Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (já presentes nas funções).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
        logError: (code) => console.error(`crm-read: ${code}`),
    });
});
