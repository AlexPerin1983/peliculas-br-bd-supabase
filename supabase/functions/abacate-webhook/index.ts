import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, createSupabaseAdminClient } from '../_shared/billing.ts';
import { verifyAbacateWebhookSignature } from '../_shared/abacate.ts';
import {
    calculateNextSemiannualExpiry,
    classifyAbacateWebhookAction,
    shouldSkipDuplicateAbacatePayment,
    type AbacateWebhookEventPayload
} from '../_shared/abacate-billing-logic.ts';

interface AbacateWebhookEvent extends AbacateWebhookEventPayload {}

async function upsertWebhookEvent(
    eventId: string,
    eventType: string,
    payload: unknown
) {
    const admin = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin
        .from('billing_webhook_events')
        .select('id, status')
        .eq('provider', 'abacatepay')
        .eq('event_id', eventId)
        .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (!existing) {
        const { error: insertError } = await admin.from('billing_webhook_events').insert({
            provider: 'abacatepay',
            event_id: eventId,
            event_type: eventType,
            status: 'received',
            payload
        });

        if (insertError) throw new Error(insertError.message);
        return { alreadyProcessed: false };
    }

    if (existing.status === 'processed') {
        return { alreadyProcessed: true };
    }

    const { error: updateError } = await admin
        .from('billing_webhook_events')
        .update({
            event_type: eventType,
            status: 'received',
            error_message: null,
            payload,
            processed_at: null
        })
        .eq('id', existing.id);

    if (updateError) throw new Error(updateError.message);
    return { alreadyProcessed: false };
}

async function markWebhookEvent(
    eventId: string,
    status: 'processed' | 'ignored' | 'failed',
    errorMessage?: string
) {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
        .from('billing_webhook_events')
        .update({
            status,
            error_message: errorMessage || null,
            processed_at: new Date().toISOString()
        })
        .eq('provider', 'abacatepay')
        .eq('event_id', eventId);

    if (error) throw new Error(error.message);
}

async function resolveActivation(params: {
    activationId?: string | null;
    checkoutId?: string | null;
    paymentExternalId?: string | null;
    subscriptionId?: string | null;
}) {
    const admin = createSupabaseAdminClient();

    if (params.activationId) {
        const { data } = await admin
            .from('module_activations')
            .select('id, subscription_id, module_id, status, expires_at, is_recurring')
            .eq('id', params.activationId)
            .maybeSingle();

        if (data) return data;
    }

    if (params.subscriptionId) {
        const { data } = await admin
            .from('module_activations')
            .select('id, subscription_id, module_id, status, expires_at, is_recurring')
            .eq('external_subscription_id', params.subscriptionId)
            .maybeSingle();

        if (data) return data;
    }

    if (params.checkoutId) {
        const { data } = await admin
            .from('module_activations')
            .select('id, subscription_id, module_id, status, expires_at, is_recurring')
            .eq('external_checkout_session_id', params.checkoutId)
            .maybeSingle();

        if (data) return data;
    }

    if (params.paymentExternalId) {
        const { data } = await admin
            .from('module_activations')
            .select('id, subscription_id, module_id, status, expires_at, is_recurring')
            .eq('id', params.paymentExternalId)
            .maybeSingle();

        if (data) return data;
    }

    return null;
}

async function recordPaymentHistory(params: {
    subscriptionId: string;
    moduleId: string;
    activationId: string;
    amount: number;
    paymentProvider: 'abacatepay';
    paymentMethod: string;
    providerPaymentId: string | null;
    reference: string | null;
    confirmedAt: string;
}) {
    const admin = createSupabaseAdminClient();
    const paymentHistoryPayload = {
        subscription_id: params.subscriptionId,
        module_id: params.moduleId,
        activation_id: params.activationId,
        amount: params.amount,
        payment_provider: params.paymentProvider,
        provider_payment_id: params.providerPaymentId,
        payment_method: params.paymentMethod,
        status: 'confirmed',
        confirmed_at: params.confirmedAt,
        pix_code: params.paymentMethod === 'pix' ? params.reference : null
    };

    const query = admin.from('payment_history').upsert(paymentHistoryPayload, {
        onConflict: 'payment_provider,provider_payment_id',
        ignoreDuplicates: false
    });

    const { error } = params.providerPaymentId
        ? await query
        : await admin.from('payment_history').insert(paymentHistoryPayload);

    if (error) throw new Error(error.message);
}

async function activateOrRenewModule(params: {
    activationId: string;
    localSubscriptionId: string;
    moduleId: string;
    currentExpiresAt?: string | null;
    amountCents: number;
    paymentMethod: 'pix' | 'card';
    checkoutId?: string | null;
    subscriptionId?: string | null;
    paymentId?: string | null;
    customerId?: string | null;
    isRecurring: boolean;
}) {
    const admin = createSupabaseAdminClient();
    const paymentReference =
        params.paymentId || params.checkoutId || params.subscriptionId || null;
    const { data: currentActivation, error: currentActivationError } = await admin
        .from('module_activations')
        .select(
            'payment_reference, external_invoice_id, external_checkout_session_id, payment_confirmed_at, expires_at'
        )
        .eq('id', params.activationId)
        .single();

    if (currentActivationError) throw new Error(currentActivationError.message);

    if (shouldSkipDuplicateAbacatePayment(currentActivation, paymentReference)) {
        return;
    }

    const { data: latestActiveActivation, error: latestActiveActivationError } = await admin
        .from('module_activations')
        .select('expires_at')
        .eq('subscription_id', params.localSubscriptionId)
        .eq('module_id', params.moduleId)
        .eq('status', 'active')
        .neq('id', params.activationId)
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestActiveActivationError) throw new Error(latestActiveActivationError.message);

    const now = new Date();
    const nextExpiry = calculateNextSemiannualExpiry({
        latestActiveExpiresAt: latestActiveActivation?.expires_at || null,
        currentActivationExpiresAt:
            currentActivation?.expires_at || params.currentExpiresAt || null,
        nowIso: now.toISOString()
    });
    const confirmedAt = now.toISOString();

    const { error: updateError } = await admin
        .from('module_activations')
        .update({
            status: 'active',
            activated_at: confirmedAt,
            expires_at: nextExpiry,
            payment_amount: params.amountCents / 100,
            payment_method: params.paymentMethod,
            payment_reference: paymentReference,
            payment_confirmed_at: confirmedAt,
            payment_provider: 'abacatepay',
            external_checkout_session_id: params.checkoutId || null,
            external_subscription_id: params.subscriptionId || null,
            external_invoice_id: params.paymentId || null,
            external_customer_id: params.customerId || null,
            billing_cycle: 'semiannual',
            is_recurring: params.isRecurring,
            cancel_at_period_end: false,
            cancellation_requested_at: null,
            updated_at: confirmedAt
        })
        .eq('id', params.activationId);

    if (updateError) throw new Error(updateError.message);

    if (params.customerId) {
        const { error: subscriptionUpdateError } = await admin
            .from('subscriptions')
            .update({ abacate_customer_id: params.customerId })
            .eq('id', params.localSubscriptionId);

        if (subscriptionUpdateError) throw new Error(subscriptionUpdateError.message);
    }

    await recordPaymentHistory({
        subscriptionId: params.localSubscriptionId,
        moduleId: params.moduleId,
        activationId: params.activationId,
        amount: params.amountCents / 100,
        paymentProvider: 'abacatepay',
        paymentMethod: params.paymentMethod,
        providerPaymentId: paymentReference,
        reference: params.paymentId || params.checkoutId || params.subscriptionId || null,
        confirmedAt
    });

    const { error: refreshError } = await admin.rpc('refresh_subscription_active_modules', {
        p_subscription_id: params.localSubscriptionId
    });

    if (refreshError) throw new Error(refreshError.message);
}

async function markRecurringCancellation(params: {
    activationId: string;
    localSubscriptionId: string;
    subscriptionId?: string | null;
    checkoutId?: string | null;
    paymentId?: string | null;
}) {
    const admin = createSupabaseAdminClient();

    const { data: activation, error: activationError } = await admin
        .from('module_activations')
        .select('expires_at')
        .eq('id', params.activationId)
        .single();

    if (activationError) throw new Error(activationError.message);

    const expiresAt = activation.expires_at as string | null;
    const isStillActive = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;

    const { error: updateError } = await admin
        .from('module_activations')
        .update({
            status: isStillActive ? 'active' : 'cancelled',
            cancel_at_period_end: true,
            cancellation_requested_at: new Date().toISOString(),
            external_subscription_id: params.subscriptionId || null,
            external_checkout_session_id: params.checkoutId || null,
            external_invoice_id: params.paymentId || null,
            payment_provider: 'abacatepay',
            updated_at: new Date().toISOString()
        })
        .eq('id', params.activationId);

    if (updateError) throw new Error(updateError.message);

    const { error: refreshError } = await admin.rpc('refresh_subscription_active_modules', {
        p_subscription_id: params.localSubscriptionId
    });

    if (refreshError) throw new Error(refreshError.message);
}

async function dispatchEvent(event: AbacateWebhookEvent) {
    const activation = await resolveActivation({
        activationId: event.data?.transparent?.metadata?.activationId || null,
        checkoutId:
            event.data?.transparent?.id ||
            event.data?.checkout?.id ||
            null,
        paymentExternalId:
            event.data?.transparent?.externalId ||
            event.data?.payment?.externalId ||
            event.data?.checkout?.externalId ||
            null,
        subscriptionId: event.data?.subscription?.id || null
    });

    const action = classifyAbacateWebhookAction(event, activation as never);

    switch (action.type) {
        case 'activate':
            if (!activation) return false;

            await activateOrRenewModule({
                activationId: activation.id as string,
                localSubscriptionId: activation.subscription_id as string,
                moduleId: activation.module_id as string,
                currentExpiresAt: activation.expires_at as string | null,
                amountCents: action.amountCents,
                paymentMethod: action.paymentMethod,
                checkoutId: action.checkoutId || null,
                subscriptionId: action.subscriptionId || null,
                paymentId: action.paymentId || null,
                customerId: action.customerId || null,
                isRecurring: action.isRecurring
            });

            return true;
        case 'cancel':
            if (!activation) return false;

            await markRecurringCancellation({
                activationId: activation.id as string,
                localSubscriptionId: activation.subscription_id as string,
                subscriptionId: action.subscriptionId || null,
                checkoutId: action.checkoutId || null,
                paymentId: action.paymentId || null
            });

            return true;
        default:
            return false;
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method === 'GET') {
        return new Response(JSON.stringify({ success: true, message: 'Webhook online' }), {
            status: 200,
            headers: corsHeaders
        });
    }

    const url = new URL(req.url);
    const secret = url.searchParams.get('webhookSecret');
    const envSecret = Deno.env.get('ABACATE_WEBHOOK_SECRET');
    const signatureHeader = req.headers.get('X-Webhook-Signature');
    const rawBody = await req.text();

    try {
        if (envSecret && secret !== envSecret) {
            throw new Error('Secret invalido');
        }

        const signatureIsValid = await verifyAbacateWebhookSignature(
            rawBody,
            signatureHeader
        );

        if (!signatureIsValid) {
            throw new Error('Assinatura do webhook invalida');
        }

        const event = JSON.parse(rawBody) as AbacateWebhookEvent;
        const eventState = await upsertWebhookEvent(event.id, event.event, event);

        if (eventState.alreadyProcessed) {
            return new Response(JSON.stringify({ success: true, duplicate: true }), {
                headers: corsHeaders,
                status: 200
            });
        }

        const handled = await dispatchEvent(event);
        await markWebhookEvent(event.id, handled ? 'processed' : 'ignored');

        return new Response(JSON.stringify({ success: true, handled }), {
            headers: corsHeaders,
            status: 200
        });
    } catch (error) {
        try {
            const parsed = JSON.parse(rawBody) as { id?: string };
            if (parsed.id) {
                await markWebhookEvent(
                    parsed.id,
                    'failed',
                    error instanceof Error ? error.message : 'Erro desconhecido'
                );
            }
        } catch {
            // ignore parsing failures while reporting errors
        }

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
