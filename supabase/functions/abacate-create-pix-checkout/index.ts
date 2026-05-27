import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { abacateRequest } from '../_shared/abacate.ts';
import {
    corsHeaders,
    createSupabaseAdminClient,
    resolveBillingOrganizationAccess
} from '../_shared/billing.ts';

interface PixCheckoutRequest {
    moduleId: string;
    successUrl?: string;
    cancelUrl?: string;
}

interface AbacateBillingResponse {
    data?: {
        id: string;
        url: string;
        amount?: number;
        status?: string;
        devMode?: boolean;
        expiresAt?: string | null;
    };
    error?: string | null;
}

interface AbacateCheckoutListResponse {
    data?: Array<{
        id: string;
        url?: string;
        amount?: number;
        status?: string;
        devMode?: boolean;
        expiresAt?: string | null;
    }>;
    error?: string | null;
}

const PRODUCTION_ONE_TIME_PRODUCT_IDS: Record<string, string> = {
    pacote_completo: 'prod_A1RjN4Dh0ZKaybPzaMCeprhT',
    estoque: 'prod_NYFm5rMErCJxRHYHn04BjyRh',
    qr_servicos: 'prod_5YCqrAKxpwdgmX0SUe0YnwjN',
    colaboradores: 'prod_mkg4RZnq4NYn32GgUMaxNUHW',
    ia_ocr: 'prod_bAp1fHhSmwhg6GBQFhhDKpJW',
    personalizacao: 'prod_MwbBmYX3dSDHAdCRafJEgEXA',
    locais_global: 'prod_twGG5zZzncrrtnFE0AHsrbqz',
    corte_inteligente: 'prod_EEMsXsYqNPSbyrJdKMjABbns',
    ilimitado: 'prod_Lt2wqPAjGZREPY2USdXwrXMW'
};

function isProductionAbacateKey(): boolean {
    return (Deno.env.get('ABACATE_API_KEY') ?? '').startsWith('abc_prod_');
}

function resolveOneTimeProductId(moduleId: string): string | null {
    if (isProductionAbacateKey()) {
        return PRODUCTION_ONE_TIME_PRODUCT_IDS[moduleId] || null;
    }

    return null;
}

async function markPendingActivationCancelled(
    supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
    activationId: string
) {
    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
        .from('module_activations')
        .update({
            status: 'cancelled',
            updated_at: nowIso
        })
        .eq('id', activationId);

    if (error) {
        throw new Error(error.message);
    }
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

        const body = (await req.json()) as PixCheckoutRequest;

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
            throw new Error('Voce nao tem permissao para contratar modulos');
        }

        if (!['owner', 'admin'].includes(member.role)) {
            throw new Error('Somente o owner ou admin da organizacao pode contratar');
        }

        const { data: localSubscription, error: subscriptionError } = await supabaseClient
            .from('subscriptions')
            .select('id')
            .eq('organization_id', organizationId)
            .single();

        if (subscriptionError || !localSubscription) {
            throw new Error('Assinatura local nao encontrada');
        }

        const { data: module, error: moduleError } = await supabaseClient
            .from('subscription_modules')
            .select('id, name, description, price_monthly, validity_months')
            .eq('id', body.moduleId)
            .single();

        if (moduleError || !module) {
            throw new Error('Modulo nao encontrado');
        }

        const oneTimeProductId = resolveOneTimeProductId(body.moduleId);
        if (!oneTimeProductId) {
            throw new Error(
                'Este modulo ainda nao possui produto avulso configurado no AbacatePay'
            );
        }

        const { data: existingPendingActivation } = await supabaseAdmin
            .from('module_activations')
            .select('id, external_checkout_session_id, payment_reference')
            .eq('subscription_id', localSubscription.id)
            .eq('module_id', body.moduleId)
            .eq('status', 'pending')
            .eq('payment_provider', 'abacatepay')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingPendingActivation?.id) {
            const checkoutId =
                existingPendingActivation.external_checkout_session_id ||
                existingPendingActivation.payment_reference;

            if (checkoutId) {
                try {
                    const existingChargeResponse =
                        await abacateRequest<AbacateCheckoutListResponse>(
                            'v2',
                            `/checkouts/list?id=${encodeURIComponent(checkoutId)}`
                        );
                    const existingCharge = existingChargeResponse.data?.[0];

                    if (existingCharge?.status === 'PAID') {
                        throw new Error(
                            'Este pagamento ja foi concluido. Aguarde alguns segundos e toque em verificar status.'
                        );
                    }

                    if (existingCharge?.status === 'PENDING' && existingCharge?.url) {
                        return new Response(
                            JSON.stringify({
                                success: true,
                                sessionId: existingCharge.id,
                                url: existingCharge.url,
                                status: existingCharge.status,
                                amount: existingCharge.amount,
                                expiresAt: existingCharge.expiresAt || null,
                                devMode: Boolean(existingCharge.devMode),
                                reusedPending: true
                            }),
                            {
                                headers: corsHeaders,
                                status: 200
                            }
                        );
                    }
                } catch (error) {
                    if (
                        error instanceof Error &&
                        error.message.includes('Este pagamento ja foi concluido')
                    ) {
                        throw error;
                    }
                }
            }

            await markPendingActivationCancelled(supabaseAdmin, existingPendingActivation.id);
        }

        const { data: activation, error: activationError } = await supabaseAdmin
            .from('module_activations')
            .insert({
                subscription_id: localSubscription.id,
                module_id: body.moduleId,
                status: 'pending',
                payment_method: 'pix',
                payment_amount: module.price_monthly,
                billing_cycle: 'semiannual',
                payment_provider: 'abacatepay',
                is_recurring: false,
                cancel_at_period_end: false
            })
            .select('id')
            .single();

        if (activationError || !activation) {
            throw new Error(activationError?.message || 'Erro ao preparar ativacao');
        }

        let abacateResponse: AbacateBillingResponse;

        try {
            abacateResponse = await abacateRequest<AbacateBillingResponse>(
                'v2',
                '/checkouts/create',
                {
                    method: 'POST',
                    body: {
                        methods: ['PIX', 'CARD'],
                        items: [
                            {
                                id: oneTimeProductId,
                                quantity: 1
                            }
                        ],
                        returnUrl:
                            body.cancelUrl ||
                            `${new URL(req.url).origin}?billing=abacate-cancelled&mode=pix&module_id=${encodeURIComponent(body.moduleId)}`,
                        completionUrl:
                            body.successUrl ||
                            `${new URL(req.url).origin}?billing=abacate-success&mode=pix&module_id=${encodeURIComponent(body.moduleId)}`,
                        metadata: {
                            activationId: activation.id,
                            moduleId: body.moduleId,
                            subscriptionId: localSubscription.id,
                            organizationId,
                            billingMode: 'one_time_checkout'
                        },
                        externalId: activation.id
                    }
                }
            );
        } catch (error) {
            await markPendingActivationCancelled(supabaseAdmin, activation.id);
            throw error;
        }

        if (isProductionAbacateKey() && abacateResponse.data?.devMode) {
            await markPendingActivationCancelled(supabaseAdmin, activation.id);
            throw new Error(
                'A AbacatePay retornou um checkout em modo de teste. Verifique se o Dev mode foi realmente desativado na conta de producao.'
            );
        }

        if (!abacateResponse.data?.id || !abacateResponse.data.url) {
            await markPendingActivationCancelled(supabaseAdmin, activation.id);
            throw new Error('Checkout avulso nao retornou uma URL valida');
        }

        const { error: updateActivationError } = await supabaseAdmin
            .from('module_activations')
            .update({
                external_checkout_session_id: abacateResponse.data.id,
                payment_reference: abacateResponse.data.id,
                payment_provider: 'abacatepay',
                updated_at: new Date().toISOString()
            })
            .eq('id', activation.id);

        if (updateActivationError) {
            throw new Error(updateActivationError.message);
        }

        return new Response(
            JSON.stringify({
                success: true,
                sessionId: abacateResponse.data.id,
                url: abacateResponse.data.url,
                status: abacateResponse.data.status,
                amount: abacateResponse.data.amount,
                expiresAt: abacateResponse.data.expiresAt || null,
                devMode: isProductionAbacateKey()
                    ? false
                    : Boolean(abacateResponse.data.devMode)
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
