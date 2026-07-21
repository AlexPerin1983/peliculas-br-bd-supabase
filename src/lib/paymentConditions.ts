import type {
    PaymentMethod,
    PaymentMethods,
    ProposalPaymentChoice,
    ProposalPaymentSelection,
} from '../../types';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const ceilMoney = (value: number) => Math.ceil((value - Number.EPSILON) * 100) / 100;
const clampPercent = (value: unknown) => Math.min(99.99, Math.max(0, Number(value) || 0));
const clampInstallments = (value: unknown) => Math.min(12, Math.max(1, Math.trunc(Number(value) || 1)));

const buildCashSelection = (baseTotal: number, method: PaymentMethod): ProposalPaymentSelection => {
    const discountPercent = clampPercent(method.porcentagem);
    const customerTotal = roundMoney(baseTotal * (1 - discountPercent / 100));
    const label = method.tipo === 'pix'
        ? discountPercent > 0 ? `Pix à vista com ${discountPercent}% de desconto` : 'Pix à vista'
        : 'Boleto à vista';
    return {
        methodType: method.tipo as 'pix' | 'boleto',
        installments: 1,
        label,
        calculationMode: 'cash',
        baseTotal: roundMoney(baseTotal),
        customerTotal,
        installmentValue: customerTotal,
        ratePercent: 0,
        discountPercent,
    };
};

const buildNoInterestSelection = (baseTotal: number, installments: number): ProposalPaymentSelection => {
    const installmentValue = ceilMoney(baseTotal / installments);
    return {
        methodType: 'parcelado_sem_juros',
        installments,
        label: `${installments}x sem juros`,
        calculationMode: 'no_interest',
        baseTotal: roundMoney(baseTotal),
        customerTotal: roundMoney(installmentValue * installments),
        installmentValue,
        ratePercent: 0,
        discountPercent: 0,
    };
};

const buildOperatorFeeSelection = (baseTotal: number, installments: number, rawRate: number): ProposalPaymentSelection | null => {
    const ratePercent = clampPercent(rawRate);
    if (ratePercent >= 100) return null;
    const installmentValue = ceilMoney((baseTotal / (1 - ratePercent / 100)) / installments);
    return {
        methodType: 'parcelado_com_juros',
        installments,
        label: `${installments}x no cartão`,
        calculationMode: 'operator_fee',
        baseTotal: roundMoney(baseTotal),
        customerTotal: roundMoney(installmentValue * installments),
        installmentValue,
        ratePercent,
        discountPercent: 0,
    };
};

const buildMonthlyInterestSelection = (baseTotal: number, installments: number, rawRate: number): ProposalPaymentSelection => {
    const ratePercent = Math.max(0, Number(rawRate) || 0);
    const monthlyRate = ratePercent / 100;
    const power = Math.pow(1 + monthlyRate, installments);
    const rawInstallment = monthlyRate > 0
        ? baseTotal * (monthlyRate * power) / (power - 1)
        : baseTotal / installments;
    const installmentValue = ceilMoney(rawInstallment);
    return {
        methodType: 'parcelado_com_juros',
        installments,
        label: `${installments}x no cartão`,
        calculationMode: 'monthly_interest',
        baseTotal: roundMoney(baseTotal),
        customerTotal: roundMoney(installmentValue * installments),
        installmentValue,
        ratePercent,
        discountPercent: 0,
    };
};

export const buildProposalPaymentOptions = (
    total: number,
    paymentMethods: PaymentMethods = [],
): ProposalPaymentSelection[] => {
    const baseTotal = Math.max(0, Number(total) || 0);
    if (baseTotal <= 0) return [];

    const options: ProposalPaymentSelection[] = [];
    const pix = paymentMethods.find(method => method.ativo && method.tipo === 'pix');
    const boleto = paymentMethods.find(method => method.ativo && method.tipo === 'boleto');
    if (pix) options.push(buildCashSelection(baseTotal, pix));
    if (boleto) options.push(buildCashSelection(baseTotal, boleto));

    const noInterest = paymentMethods.find(method => method.ativo && method.tipo === 'parcelado_sem_juros');
    const noInterestMax = noInterest ? clampInstallments(noInterest.parcelas_max) : 0;
    if (noInterest) {
        for (let installments = 1; installments <= noInterestMax; installments += 1) {
            options.push(buildNoInterestSelection(baseTotal, installments));
        }
    }

    const withInterest = paymentMethods.find(method => method.ativo && method.tipo === 'parcelado_com_juros');
    if (withInterest) {
        const max = clampInstallments(withInterest.parcelas_max);
        const mode = withInterest.calculation_mode || 'monthly_interest';
        for (let installments = 1; installments <= max; installments += 1) {
            if (installments <= noInterestMax) continue;
            if (mode === 'operator_fee') {
                const configuredRate = withInterest.operator_fee_rates?.[String(installments)];
                if (configuredRate == null) continue;
                const option = buildOperatorFeeSelection(baseTotal, installments, Number(configuredRate));
                if (option) options.push(option);
            } else {
                options.push(buildMonthlyInterestSelection(baseTotal, installments, Number(withInterest.juros) || 0));
            }
        }
    }
    return options;
};

export const resolveProposalPaymentChoice = (
    total: number,
    paymentMethods: PaymentMethods,
    choice: ProposalPaymentChoice,
): ProposalPaymentSelection | null =>
    buildProposalPaymentOptions(total, paymentMethods).find(option =>
        option.methodType === choice.methodType && option.installments === choice.installments
    ) || null;
