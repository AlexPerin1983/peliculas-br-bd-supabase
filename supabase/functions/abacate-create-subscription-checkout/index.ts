import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { abacateRequest } from '../_shared/abacate.ts';
import {
    corsHeaders,
    createSupabaseAdminClient,
    resolveBillingOrganizationAccess
} from '../_shared/billing.ts';

interface SubscriptionCheckoutRequest {
    moduleId: string;
    successUrl?: string;
    cancelUrl?: string;
}

interface AbacateSubscriptionCheckoutResponse {
    data?: {
        id: string;
        url: string;
    };
    error?: string | null;
}

interface AbacateSubscriptionListResponse {
    data?: Array<{
        id: string;
        url?: string;
        status?: string;
    }>;
    error?: string | null;
}

const PRODUCTION_SUBSCRIPTION_PRODUCT_IDS: Record<string, string> = {
    pacote_completo: 'prod_MAqbktMQUkkBxD1Kx0TRyQT0',
    estoque: 'prod_BgkWFzLFaaz3yAHjtyegnAxu',
    qr_servicos: 'prod_a41xKWjZBqQNbQezMq4BKr1e',
    colaboradores: 'prod_3GtbmfGEE2T24bC5um4QU3ga',
    ia_ocr: 'prod_B6YQQWpHCQTMAMULQbaAQKKw',
    personalizacao: 'prod_d2Q6UQmDuu4xEKRRkWuJzKK4',
    locais_global: 'prod_w32uHTA5DQ3PgHrRQBPkgsH0',
    corte_inteligente: 'prod_K6qUFqk0ReENFfHtpcdJt6m6',
    ilimitado: 'prod_gMcdswNPsxf2e2pbm41rDe0D'
};

function resolveSubscriptionProductId(
    moduleId: string,
    databaseProductId: string | null | undefined
): string | null {
    const apiKey = Deno.env.get('ABACATE_API_KEY') ?? '';
    if (apiKey.startsWith('abc_prod_')) {
        return PRODUCTION_SUBSCRIPTION_PRODUCT_IDS[moduleId] || null;
    }

    return databaseProductId || null;
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

        const body = (await req.json()) as SubscriptionCheckoutRequest;

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
            .select(
                'id, name, description, price_monthly, validity_months, abacate_subscription_product_id'
            )
            .eq('id', body.moduleId)
            .single();

        if (moduleError || !module) {
            throw new Error('Modulo nao encontrado');
        }

        const subscriptionProductId = resolveSubscriptionProductId(
            body.moduleId,
            module.abacate_subscription_product_id
        );

        if (!subscriptionProductId) {
            throw new Error(
                'Este modulo ainda nao possui produto recorrente configurado no AbacatePay'
            );
        }

        const { data: existingActivation } = await supabaseAdmin
            .from('module_activations')
            .select('id, status, is_recurring, payment_provider, cancel_at_period_end')
            .eq('subscription_id', localSubscription.id)
            .eq('module_id', body.moduleId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (
            existingActivation?.status === 'active' &&
            existingActivation?.is_recurring &&
            existingActivation?.payment_provider === 'abacatepay' &&
            !existingActivation?.cancel_at_period_end
        ) {
            throw new Error('Este modulo ja possui assinatura recorrente ativa');
        }

        const { data: existingPendingActivation } = await supabaseAdmin
            .from('module_activations')
            .select('id, external_checkout_session_id, payment_reference')
            .eq('subscription_id', localSubscription.id)
            .eq('module_id', body.moduleId)
            .eq('status', 'pending')
            .eq('payment_provider', 'abacatepay')
            .eq('is_recurring', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingPendingActivation?.id) {
            const checkoutId =
                existingPendingActivation.external_checkout_session_id ||
                existingPendingActivation.payment_reference;

            if (checkoutId) {
                try {
                    const existingCheckoutResponse =
                        await abacateRequest<AbacateSubscriptionListResponse>(
                            'v2',
                            `/subscriptions/list?id=${encodeURIComponent(checkoutId)}`
                        );
                    const existingCheckout = existingCheckoutResponse.data?.[0];

                    if (existingCheckout?.status === 'PAID' || existingCheckout?.status === 'ACTIVE') {
                        throw new Error(
                            'Esta assinatura ja foi concluida. Aguarde alguns segundos e atualize a pagina.'
                        );
                    }

                    if (existingCheckout?.status === 'PENDING' && existingCheckout?.url) {
                        return new Response(
                            JSON.stringify({
                                success: true,
                                url: existingCheckout.url,
                                sessionId: existingCheckout.id,
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
                        error.message.includes('Esta assinatura ja foi concluida')
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
                payment_method: 'card',
                payment_amount: module.price_monthly,
                billing_cycle: 'semiannual',
                payment_provider: 'abacatepay',
                is_recurring: true,
                cancel_at_period_end: false
            })
            .select('id')
            .single();

        if (activationError || !activation) {
            throw new Error(activationError?.message || 'Erro ao preparar ativacao');
        }

        const returnUrl =
            body.cancelUrl ||
            `${new URL(req.url).origin}?billing=abacate-cancelled&module_id=${encodeURIComponent(body.moduleId)}`;
        const completionUrl =
            body.successUrl ||
            `${new URL(req.url).origin}?billing=abacate-success&mode=subscription&module_id=${encodeURIComponent(body.moduleId)}`;

        const abacateResponse =
            await abacateRequest<AbacateSubscriptionCheckoutResponse>(
                'v2',
                '/subscriptions/create',
                {
                    method: 'POST',
                    body: {
                        items: [
                            {
                                id: subscriptionProductId,
                                quantity: 1
                            }
                        ],
                        methods: ['CARD'],
                        externalId: activation.id,
                        returnUrl,
                        completionUrl,
                        metadata: {
                            activationId: activation.id,
                            moduleId: body.moduleId,
                            subscriptionId: localSubscription.id,
                            organizationId,
                            billingMode: 'subscription'
                        }
                    }
                }
            );

        if (!abacateResponse.data?.url || !abacateResponse.data.id) {
            throw new Error('Checkout de assinatura nao retornou URL valida');
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
                url: abacateResponse.data.url,
                sessionId: abacateResponse.data.id
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
