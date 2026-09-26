import type {
    PaymentMethod,
    PaymentMethods,
    ProposalPaymentChoice,
    ProposalPaymentSelection,
} from '../../types';
import {
    buildPaymentOptions,
    getAvailableInstallments as getSharedAvailableInstallments,
} from '../../supabase/functions/proposal-portal/paymentOptions';

// A conta fica em supabase/functions/proposal-portal/paymentOptions.ts, compartilhada
// com o servidor que grava a escolha do cliente: tela, PDF, link e aprovação batem.

export const getAvailableInstallments = (method: PaymentMethod): number[] => getSharedAvailableInstallments(method);

export const buildProposalPaymentOptions = (
    total: number,
    paymentMethods: PaymentMethods = [],
): ProposalPaymentSelection[] => buildPaymentOptions(total, paymentMethods);

export const resolveProposalPaymentChoice = (
    total: number,
    paymentMethods: PaymentMethods,
    choice: ProposalPaymentChoice,
): ProposalPaymentSelection | null =>
    buildProposalPaymentOptions(total, paymentMethods).find(option =>
        option.methodType === choice.methodType && option.installments === choice.installments
    ) || null;
