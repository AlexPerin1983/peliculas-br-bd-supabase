import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { abacateRequest } from '../_shared/abacate.ts';
import {
    corsHeaders,
    createSupabaseAdminClient,
    resolveBillingOrganizationAccess
} from '../_shared/billing.ts';

interface CancelSubscriptionRequest {
    moduleId: string;
}

interface AbacateSubscription {
    data?: {
        id: string;
        status: string;
    };
    error?: string | null;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (req.method !== 'POST') {
            throw new Error('Metodo nao permitido');
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Nao autorizado');
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: authHeader }
                },
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
        const supabaseAdmin = createSupabaseAdminClient();

        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        if (!user) {
            throw new Error('Usuario nao autenticado');
        }

        const body = (await req.json()) as CancelSubscriptionRequest;

        if (!body.moduleId) {
            throw new Error('moduleId obrigatorio');
        }

        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (profileError || !profile?.organization_id) {
            throw new Error('Organizacao nao encontrada');
        }

        const organizationId = profile.organization_id as string;

        const member = await resolveBillingOrganizationAccess(
            supabaseClient,
            organizationId,
            user.id
        );

        if (!member || member.status !== 'active') {
            throw new Error('Voce nao tem permissao para gerenciar cobranca');
        }

        if (!['owner', 'admin'].includes(member.role)) {
            throw new Error('Somente o owner ou admin da organizacao pode cancelar');
        }

        const { data: localSubscription, error: subscriptionError } = await supabaseClient
            .from('subscriptions')
            .select('id')
            .eq('organization_id', organizationId)
            .single();

        if (subscriptionError || !localSubscription) {
            throw new Error('Assinatura local nao encontrada');
        }

        const { data: activation, error: activationError } = await supabaseAdmin
            .from('module_activations')
            .select(
                'id, status, expires_at, payment_provider, external_subscription_id, cancel_at_period_end'
            )
            .eq('subscription_id', localSubscription.id)
            .eq('module_id', body.moduleId)
            .eq('is_recurring', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (activationError || !activation) {
            throw new Error('Ativacao nao encontrada para este modulo');
        }

        if (activation.payment_provider !== 'abacatepay' || !activation.external_subscription_id) {
            throw new Error('Este modulo nao possui assinatura automatica cancelavel');
        }

        if (activation.cancel_at_period_end) {
            return new Response(
                JSON.stringify({
                    success: true,
                    cancelAtPeriodEnd: true,
                    expiresAt: activation.expires_at
                }),
                {
                    headers: corsHeaders,
                    status: 200
                }
            );
        }

        const response = await abacateRequest<AbacateSubscription>('v2', '/subscriptions/cancel', {
            method: 'POST',
            body: {
                id: activation.external_subscription_id
            }
        });

        if (!response.data?.id || response.data.status !== 'CANCELLED') {
            throw new Error(response.error || 'A AbacatePay nao confirmou o cancelamento');
        }

        const nowIso = new Date().toISOString();
        const expiresAt = activation.expires_at || null;
        const isStillActive = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;

        const { error: updateError } = await supabaseAdmin
            .from('module_activations')
            .update({
                status: isStillActive ? 'active' : 'cancelled',
                cancel_at_period_end: true,
                cancellation_requested_at: nowIso,
                updated_at: nowIso
            })
            .eq('id', activation.id);

        if (updateError) {
            throw new Error(updateError.message);
        }

        const { error: refreshError } = await supabaseAdmin.rpc(
            'refresh_subscription_active_modules',
            {
                p_subscription_id: localSubscription.id
            }
        );

        if (refreshError) {
            throw new Error(refreshError.message);
        }

        return new Response(
            JSON.stringify({
                success: true,
                cancelAtPeriodEnd: true,
                expiresAt
            }),
            {
                headers: corsHeaders,
                status: 200
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            }),
            {
                headers: corsHeaders,
                status: 400
            }
        );
    }
});
