export interface ProposalConditionFields {
    conditionOriginalValue?: number | null;
    conditionFinalValue?: number | null;
    conditionDiscountAmount?: number | null;
    conditionDiscountPercent?: number | null;
    conditionExpiresAt?: string | null;
}

export interface ProposalConditionSnapshot {
    originalValue: number;
    finalValue: number;
    discountAmount: number;
    discountPercent?: number;
    expiresAt: string;
    expired: boolean;
    remainingMs: number;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const getProposalCondition = (
    proposal: ProposalConditionFields | null | undefined,
    now = Date.now()
): ProposalConditionSnapshot | null => {
    if (!proposal?.conditionExpiresAt) return null;

    const originalValue = Number(proposal.conditionOriginalValue || 0);
    const finalValue = Number(proposal.conditionFinalValue || 0);
    const discountAmount = Number(proposal.conditionDiscountAmount || Math.max(0, originalValue - finalValue));
    const expiresAtMs = new Date(proposal.conditionExpiresAt).getTime();

    if (
        !Number.isFinite(expiresAtMs)
        || originalValue <= 0
        || finalValue < 0
        || discountAmount <= 0
        || finalValue >= originalValue
    ) return null;

    const remainingMs = Math.max(0, expiresAtMs - now);
    const storedPercent = Number(proposal.conditionDiscountPercent);
    const discountPercent = Number.isFinite(storedPercent) && storedPercent > 0
        ? storedPercent
        : (discountAmount / originalValue) * 100;

    return {
        originalValue,
        finalValue,
        discountAmount,
        discountPercent,
        expiresAt: proposal.conditionExpiresAt,
        expired: remainingMs === 0,
        remainingMs,
    };
};

export const formatConditionExpiry = (expiresAt: string) => new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
}).format(new Date(expiresAt));

export const buildProposalReactivationMessages = (params: {
    clientName: string;
    finalValue: number;
    discountAmount: number;
    expiresAt: string;
}) => {
    const firstName = params.clientName.trim().split(/\s+/)[0] || 'Olá';
    const value = currency.format(params.finalValue);
    const savings = currency.format(params.discountAmount);
    const expiry = formatConditionExpiry(params.expiresAt);

    return [
        {
            label: 'Lembrete gentil',
            text: `${firstName}, deixei reservada para você a condição de ${value}, com uma economia de ${savings}, até ${expiry}. Se tiver alguma dúvida, posso ajudar por aqui.`,
        },
        {
            label: 'Vence em breve',
            text: `${firstName}, passando para lembrar que a sua condição especial de ${value} vence em ${expiry}. A economia reservada é de ${savings}. Quer que eu esclareça algum ponto antes disso?`,
        },
        {
            label: 'Condição prorrogada',
            text: `${firstName}, consegui prorrogar sua condição de ${value}, com economia de ${savings}, até ${expiry}. O link da proposta já está atualizado.`,
        },
    ];
};
