import { describe, expect, it } from 'vitest';
import {
    calculateNextSemiannualExpiry,
    classifyAbacateWebhookAction,
    shouldSkipDuplicateAbacatePayment,
    type ActivationLookupResult,
    type AbacateWebhookEventPayload
} from '../supabase/functions/_shared/abacate-billing-logic';

const baseActivation: ActivationLookupResult = {
    id: 'act_1',
    subscription_id: 'sub_local_1',
    module_id: 'qr_servicos',
    status: 'pending',
    expires_at: null,
    is_recurring: false
};

describe('abacate webhook billing logic', () => {
    it('classifies transparent.completed as pix activation', () => {
        const event: AbacateWebhookEventPayload = {
            id: 'evt_1',
            event: 'transparent.completed',
            data: {
                transparent: {
                    id: 'pix_1',
                    amount: 3900,
                    paidAmount: 3900
                },
                customer: { id: 'cust_1' }
            }
        };

        expect(classifyAbacateWebhookAction(event, baseActivation)).toEqual({
            type: 'activate',
            paymentMethod: 'pix',
            isRecurring: false,
            amountCents: 3900,
            checkoutId: 'pix_1',
            paymentId: 'pix_1',
            customerId: 'cust_1'
        });
    });

    it('ignores checkout.completed for recurring activations', () => {
        const event: AbacateWebhookEventPayload = {
            id: 'evt_2',
            event: 'checkout.completed',
            data: {
                checkout: {
                    id: 'bill_1',
                    amount: 3900
                }
            }
        };

        expect(
            classifyAbacateWebhookAction(event, {
                ...baseActivation,
                is_recurring: true
            })
        ).toEqual({ type: 'ignore' });
    });

    it('classifies subscription.completed as recurring card activation', () => {
        const event: AbacateWebhookEventPayload = {
            id: 'evt_3',
            event: 'subscription.completed',
            data: {
                checkout: { id: 'bill_2' },
                subscription: { id: 'subs_1', amount: 3900 },
                payment: { id: 'card_1', amount: 3900 },
                customer: { id: 'cust_2' }
            }
        };

        expect(
            classifyAbacateWebhookAction(event, {
                ...baseActivation,
                is_recurring: true
            })
        ).toEqual({
            type: 'activate',
            paymentMethod: 'card',
            isRecurring: true,
            amountCents: 3900,
            checkoutId: 'bill_2',
            subscriptionId: 'subs_1',
            paymentId: 'card_1',
            customerId: 'cust_2'
        });
    });

    it('classifies subscription.renewed as recurring card activation', () => {
        const event: AbacateWebhookEventPayload = {
            id: 'evt_4',
            event: 'subscription.renewed',
            data: {
                subscription: { id: 'subs_renew', amount: 3900 },
                payment: { id: 'card_renew', paidAmount: 3900 }
            }
        };

        expect(
            classifyAbacateWebhookAction(event, {
                ...baseActivation,
                status: 'active',
                is_recurring: true
            })
        ).toEqual({
            type: 'activate',
            paymentMethod: 'card',
            isRecurring: true,
            amountCents: 3900,
            checkoutId: null,
            subscriptionId: 'subs_renew',
            paymentId: 'card_renew',
            customerId: null
        });
    });

    it('classifies subscription.cancelled as cancel action', () => {
        const event: AbacateWebhookEventPayload = {
            id: 'evt_5',
            event: 'subscription.cancelled',
            data: {
                checkout: { id: 'bill_cancel' },
                subscription: { id: 'subs_cancel' },
                payment: { id: 'card_cancel' }
            }
        };

        expect(
            classifyAbacateWebhookAction(event, {
                ...baseActivation,
                is_recurring: true
            })
        ).toEqual({
            type: 'cancel',
            subscriptionId: 'subs_cancel',
            checkoutId: 'bill_cancel',
            paymentId: 'card_cancel'
        });
    });

    it('skips duplicated payment references already confirmed', () => {
        expect(
            shouldSkipDuplicateAbacatePayment(
                {
                    payment_reference: 'card_123',
                    external_invoice_id: 'card_123',
                    external_checkout_session_id: 'bill_123',
                    payment_confirmed_at: '2026-04-09T19:00:00.000Z'
                },
                'card_123'
            )
        ).toBe(true);
    });

    it('does not skip when no payment was confirmed yet', () => {
        expect(
            shouldSkipDuplicateAbacatePayment(
                {
                    payment_reference: 'card_123',
                    payment_confirmed_at: null
                },
                'card_123'
            )
        ).toBe(false);
    });

    it('extends from the latest active expiry when there is prepaid time left', () => {
        expect(
            calculateNextSemiannualExpiry({
                currentActivationExpiresAt: '2026-10-09T00:00:00.000Z',
                latestActiveExpiresAt: '2026-12-01T00:00:00.000Z',
                nowIso: '2026-04-09T00:00:00.000Z'
            })
        ).toBe('2027-06-01T00:00:00.000Z');
    });

    it('starts from now when there is no active paid period to preserve', () => {
        expect(
            calculateNextSemiannualExpiry({
                currentActivationExpiresAt: null,
                latestActiveExpiresAt: null,
                nowIso: '2026-04-09T00:00:00.000Z'
            })
        ).toBe('2026-10-09T00:00:00.000Z');
    });
});
