// Exclusão de conta pelo próprio usuário (exigência da Google Play e da LGPD).
//
// - Dono da empresa: cancela a assinatura automática, apaga arquivos e todos os dados
//   da empresa (inclusive os criados pelos membros), tira os membros da equipe e
//   apaga o login.
// - Membro da equipe: os registros que ele criou passam para o dono (a empresa não
//   perde clientes/orçamentos), ele sai da equipe e o login dele é apagado.
//
// Só mexe em linhas da própria empresa (filtro por organization_id ou pelos user_id
// do dono e dos membros). Registros de pagamento recebidos da AbacatePay
// (billing_webhook_events) ficam guardados para fins fiscais.
//
// Publicar COM verificação de JWT (sem --no-verify-jwt).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { abacateRequest } from '../_shared/abacate.ts';
import { corsHeaders, createSupabaseAdminClient } from '../_shared/billing.ts';

const CONFIRMATION_WORD = 'EXCLUIR';
const STORAGE_BUCKETS = ['pdfs', 'portfolio', 'avatars'];

// Tabelas com dados da empresa gravados por user_id (do dono ou de um membro).
// A ordem importa: filhos antes dos pais.
const COMPANY_TABLES_BY_USER = [
    'proposal_condition_push_deliveries',
    'proposal_follow_up_history',
    'proposal_option_history',
    'proposal_option_states',
    'client_follow_ups',
    'agenda_push_deliveries',
    'agenda_push_daily_summaries',
    'agenda_push_daily_engagement',
    'consumos',
    'retalhos',
    'bobinas',
    'location_measurements',
    'locations',
    'servicos_prestados',
    'standalone_expenses',
    'fornecedores',
    'proposal_message_templates',
    'agendamentos',
    'saved_pdfs',
    'proposal_options',
    'clients',
    'films',
    'user_info',
];

// Tabelas da empresa ligadas por organization_id. Filhos antes dos pais.
const COMPANY_TABLES_BY_ORG = [
    'proposal_portal_messages',
    'proposal_portal_items',
    'proposal_portal_follow_ups',
    'proposal_portals',
    'proposal_follow_up_history',
    'client_follow_ups',
    'proposal_message_templates',
    'standalone_expenses',
    'whatsapp_outbox',
    'whatsapp_contact_suggestions',
    'whatsapp_connectors',
    'organization_invites',
];

// Dados pessoais do usuário que saem junto com ele, seja dono ou membro.
const PERSONAL_TABLES_BY_USER = [
    'agenda_push_subscriptions',
    'ai_usage_events',
];

// Registros criados pelo membro que passam para o dono da empresa.
const MEMBER_TABLES_TO_REASSIGN = COMPANY_TABLES_BY_USER.filter((table) => table !== 'user_info');

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: corsHeaders });

// Tabela ou coluna que não existe neste banco: pula com aviso em vez de travar a exclusão.
const isMissingRelation = (error: { code?: string; message?: string } | null) => {
    if (!error) return false;
    if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '')) return true;
    return /does not exist|could not find/i.test(error.message ?? '');
};

class Cleanup {
    warnings: string[] = [];

    constructor(private admin: AdminClient) {}

    async deleteIn(table: string, column: string, values: string[]) {
        if (values.length === 0) return;
        const { error } = await this.admin.from(table).delete().in(column, values);
        this.check(error, `apagar ${table}.${column}`);
    }

    async update(table: string, patch: Record<string, unknown>, column: string, value: string) {
        const { error } = await this.admin.from(table).update(patch).eq(column, value);
        this.check(error, `atualizar ${table}.${column}`);
    }

    private check(error: { code?: string; message?: string } | null, step: string) {
        if (!error) return;
        if (isMissingRelation(error)) {
            this.warnings.push(`${step}: ignorado (${error.message})`);
            return;
        }
        throw new Error(`Falha ao ${step}: ${error.message}`);
    }

    async removeStorageFolder(bucket: string, folder: string) {
        const storage = this.admin.storage.from(bucket);
        for (let round = 0; round < 50; round += 1) {
            const { data, error } = await storage.list(folder, { limit: 1000 });
            if (error) {
                this.warnings.push(`listar ${bucket}/${folder}: ${error.message}`);
                return;
            }
            const files = (data ?? []).filter((item) => item.id).map((item) => `${folder}/${item.name}`);
            if (files.length === 0) return;
            const { error: removeError } = await storage.remove(files);
            if (removeError) throw new Error(`Falha ao apagar arquivos de ${bucket}: ${removeError.message}`);
        }
    }
}

const cancelRecurringSubscriptions = async (admin: AdminClient, organizationId: string) => {
    const { data: subscription } = await admin
        .from('subscriptions')
        .select('id')
        .eq('organization_id', organizationId)
        .maybeSingle();
    if (!subscription?.id) return;

    const { data: activations, error } = await admin
        .from('module_activations')
        .select('id, external_subscription_id, cancel_at_period_end, status')
        .eq('subscription_id', subscription.id)
        .eq('is_recurring', true)
        .eq('payment_provider', 'abacatepay')
        .not('external_subscription_id', 'is', null);
    if (error) throw new Error(`Falha ao ler assinaturas: ${error.message}`);

    for (const activation of activations ?? []) {
        if (activation.cancel_at_period_end || ['cancelled', 'canceled', 'expired'].includes(String(activation.status))) {
            continue;
        }
        const response = await abacateRequest<{ data?: { id: string; status: string }; error?: string | null }>(
            'v2',
            '/subscriptions/cancel',
            { method: 'POST', body: { id: activation.external_subscription_id } }
        );
        if (response.data?.status !== 'CANCELLED') {
            throw new Error(response.error || 'A AbacatePay não confirmou o cancelamento da assinatura');
        }
    }
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return jsonResponse({ success: false, error: 'Método não permitido' }, 405);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return jsonResponse({ success: false, error: 'Não autorizado' }, 401);
    }

    try {
        const body = await req.json().catch(() => ({}));
        if (String(body?.confirmation ?? '').trim().toUpperCase() !== CONFIRMATION_WORD) {
            return jsonResponse({ success: false, error: `Digite ${CONFIRMATION_WORD} para confirmar.` }, 400);
        }

        const userClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: { headers: { Authorization: authHeader } },
                auth: { autoRefreshToken: false, persistSession: false },
            }
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
            return jsonResponse({ success: false, error: 'Sessão expirada. Entre de novo e tente outra vez.' }, 401);
        }

        const admin = createSupabaseAdminClient();
        const cleanup = new Cleanup(admin);

        const { data: profile } = await admin
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .maybeSingle();

        let organizationId: string | null = profile?.organization_id ?? null;
        let ownerId: string | null = null;
        if (organizationId) {
            const { data: org } = await admin
                .from('organizations')
                .select('owner_id')
                .eq('id', organizationId)
                .maybeSingle();
            ownerId = org?.owner_id ?? null;
            if (!ownerId) organizationId = null;
        }
        // Empresas que este usuário é dono (normalmente uma só).
        const { data: ownedOrgs } = await admin.from('organizations').select('id').eq('owner_id', user.id);
        const ownedOrgIds = (ownedOrgs ?? []).map((org) => org.id as string);
        const isOwner = ownedOrgIds.length > 0 || !organizationId || ownerId === user.id;

        if (isOwner) {
            if (organizationId && !ownedOrgIds.includes(organizationId) && ownerId === user.id) {
                ownedOrgIds.push(organizationId);
            }

            const { data: members } = ownedOrgIds.length
                ? await admin.from('organization_members').select('user_id').in('organization_id', ownedOrgIds)
                : { data: [] as Array<{ user_id: string }> };
            const memberIds = (members ?? [])
                .map((member) => member.user_id as string)
                .filter((id) => id && id !== user.id);
            const companyUserIds = [user.id, ...memberIds];

            // 1) Para a cobrança antes de apagar qualquer coisa.
            for (const orgId of ownedOrgIds) {
                await cancelRecurringSubscriptions(admin, orgId);
            }

            // 2) Arquivos (PDFs, fotos de trabalhos, avatar).
            for (const bucket of STORAGE_BUCKETS) {
                await cleanup.removeStorageFolder(bucket, user.id);
            }

            // 3) Dados da empresa.
            await cleanup.deleteIn('proposal_portals', 'user_id', companyUserIds);
            for (const table of COMPANY_TABLES_BY_ORG) {
                await cleanup.deleteIn(table, 'organization_id', ownedOrgIds);
            }
            for (const table of COMPANY_TABLES_BY_USER) {
                await cleanup.deleteIn(table, 'user_id', companyUserIds);
            }
            for (const table of PERSONAL_TABLES_BY_USER) {
                await cleanup.deleteIn(table, 'user_id', [user.id]);
            }

            // 4) Equipe: membros perdem o vínculo; a empresa e a assinatura somem.
            for (const orgId of ownedOrgIds) {
                await cleanup.update('profiles', { organization_id: null }, 'organization_id', orgId);
            }
            await cleanup.deleteIn('organization_members', 'organization_id', ownedOrgIds);
            await cleanup.deleteIn('organization_members', 'user_id', [user.id]);
            await cleanup.deleteIn('subscriptions', 'organization_id', ownedOrgIds);
            await cleanup.deleteIn('organizations', 'id', ownedOrgIds);
        } else {
            // Membro: o que ele criou continua na empresa, agora em nome do dono.
            for (const table of MEMBER_TABLES_TO_REASSIGN) {
                await cleanup.update(table, { user_id: ownerId }, 'user_id', user.id);
            }
            for (const table of PERSONAL_TABLES_BY_USER) {
                await cleanup.deleteIn(table, 'user_id', [user.id]);
            }
            await cleanup.deleteIn('organization_members', 'user_id', [user.id]);
            await cleanup.removeStorageFolder('avatars', user.id);
        }

        // 5) Referências sem exclusão em cascata que travariam a remoção do login.
        await cleanup.update('global_measurements', { created_by_user_id: null }, 'created_by_user_id', user.id);
        await cleanup.deleteIn('profiles', 'id', [user.id]);

        const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
        if (deleteUserError) {
            throw new Error(`Falha ao apagar o login: ${deleteUserError.message}`);
        }

        console.log('delete-account ok', { role: isOwner ? 'owner' : 'member', warnings: cleanup.warnings });
        return jsonResponse({ success: true, role: isOwner ? 'owner' : 'member', warnings: cleanup.warnings });
    } catch (error) {
        console.error('delete-account erro', error);
        const message = error instanceof Error ? error.message : 'Erro inesperado';
        return jsonResponse({ success: false, error: message }, 500);
    }
});
