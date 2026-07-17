export interface AbacateWebhookEventPayload {
    id: string;
    event: string;
    data?: {
        transparent?: {
            id?: string;
            externalId?: string | null;
            amount?: number | null;
            paidAmount?: number | null;
            metadata?: {
                activationId?: string | null;
            } | null;
        };
        checkout?: {
            id?: string;
            externalId?: string | null;
            amount?: number | null;
            paidAmount?: number | null;
        };
        subscription?: {
            id?: string;
            amount?: number | null;
        };
        payment?: {
            id?: string;
            externalId?: string | null;
            amount?: number | null;
            paidAmount?: number | null;
        };
        customer?: {
            id?: string | null;
        } | null;
    };
}

export interface ActivationLookupResult {
    id: string;
    subscription_id: string;
    module_id: string;
    status?: string | null;
    expires_at?: string | null;
    is_recurring?: boolean | null;
}

export interface CurrentActivationSnapshot {
    payment_reference?: string | null;
    external_invoice_id?: string | null;
    external_checkout_session_id?: string | null;
    payment_confirmed_at?: string | null;
    expires_at?: string | null;
}

export interface WebhookActionActivate {
    type: 'activate';
    paymentMethod: 'pix' | 'card';
    isRecurring: boolean;
    amountCents: number;
    checkoutId?: string | null;
    subscriptionId?: string | null;
    paymentId?: string | null;
    customerId?: string | null;
}

export interface WebhookActionCancel {
    type: 'cancel';
    subscriptionId?: string | null;
    checkoutId?: string | null;
    paymentId?: string | null;
}

export interface WebhookActionIgnore {
    type: 'ignore';
}

export type WebhookAction =
    | WebhookActionActivate
    | WebhookActionCancel
    | WebhookActionIgnore;

export function classifyAbacateWebhookAction(
    event: AbacateWebhookEventPayload,
    activation: ActivationLookupResult | null
): WebhookAction {
    if (!activation) {
        return { type: 'ignore' };
    }

    switch (event.event) {
        case 'transparent.completed':
            if (activation.status !== 'pending') {
                return { type: 'ignore' };
            }

            return {
                type: 'activate',
                paymentMethod: 'pix',
                isRecurring: false,
                amountCents:
                    event.data?.transparent?.paidAmount ||
                    event.data?.transparent?.amount ||
                    0,
                checkoutId: event.data?.transparent?.id || null,
                paymentId: event.data?.transparent?.id || null,
                customerId: event.data?.customer?.id || null
            };

        case 'checkout.completed':
            if (activation.status !== 'pending') {
                return { type: 'ignore' };
            }

            if (activation.is_recurring) {
                return { type: 'ignore' };
            }

            return {
                type: 'activate',
                paymentMethod: 'pix',
                isRecurring: false,
                amountCents:
                    event.data?.checkout?.paidAmount ||
                    event.data?.checkout?.amount ||
                    0,
                checkoutId: event.data?.checkout?.id || null,
                paymentId: event.data?.checkout?.id || null,
                customerId: event.data?.customer?.id || null
            };

        case 'subscription.completed':
            if (activation.status !== 'pending') {
                return { type: 'ignore' };
            }

            return {
                type: 'activate',
                paymentMethod: 'card',
                isRecurring: true,
                amountCents:
                    event.data?.payment?.paidAmount ||
                    event.data?.payment?.amount ||
                    event.data?.subscription?.amount ||
                    0,
                checkoutId: event.data?.checkout?.id || null,
                subscriptionId: event.data?.subscription?.id || null,
                paymentId: event.data?.payment?.id || null,
                customerId: event.data?.customer?.id || null
            };

        case 'subscription.renewed':
            if (activation.status !== 'active') {
                return { type: 'ignore' };
            }

            return {
                type: 'activate',
                paymentMethod: 'card',
                isRecurring: true,
                amountCents:
                    event.data?.payment?.paidAmount ||
                    event.data?.payment?.amount ||
                    event.data?.subscription?.amount ||
                    0,
                checkoutId: event.data?.checkout?.id || null,
                subscriptionId: event.data?.subscription?.id || null,
                paymentId: event.data?.payment?.id || null,
                customerId: event.data?.customer?.id || null
            };

        case 'subscription.cancelled':
            return {
                type: 'cancel',
                subscriptionId: event.data?.subscription?.id || null,
                checkoutId: event.data?.checkout?.id || null,
                paymentId: event.data?.payment?.id || null
            };

        default:
            return { type: 'ignore' };
    }
}

export function shouldSkipDuplicateAbacatePayment(
    currentActivation: CurrentActivationSnapshot | null | undefined,
    paymentReference: string | null | undefined
) {
    if (!currentActivation?.payment_confirmed_at || !paymentReference) {
        return false;
    }

    return [
        currentActivation.payment_reference,
        currentActivation.external_invoice_id,
        currentActivation.external_checkout_session_id
    ]
        .filter(Boolean)
        .includes(paymentReference);
}

export function calculateNextSemiannualExpiry(params: {
    currentActivationExpiresAt?: string | null;
    latestActiveExpiresAt?: string | null;
    nowIso?: string;
}) {
    const now = params.nowIso ? new Date(params.nowIso) : new Date();
    const effectiveCurrentExpiresAt =
        params.latestActiveExpiresAt || params.currentActivationExpiresAt || null;
    const currentExpiry = effectiveCurrentExpiresAt
        ? new Date(effectiveCurrentExpiresAt)
        : null;
    const baseDate =
        currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const nextDate = new Date(baseDate);
    // Datas de cobranca chegam em UTC. Usar setMonth() aplica o fuso local do
    // runtime e pode recuar um dia (por exemplo, 01/12 vira 31/05 no Brasil).
    nextDate.setUTCMonth(nextDate.getUTCMonth() + 6);
    return nextDate.toISOString();
}
