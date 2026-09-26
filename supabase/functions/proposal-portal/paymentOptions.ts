// Formas de pagamento da proposta. Usado pelo app (tela, PDF e link) e pela função
// proposal-portal, que grava a escolha do cliente na aprovação — os dois precisam
// calcular igual. Sem imports: roda no navegador e no Deno.

export interface PaymentMethodInput {
    tipo: string;
    ativo?: boolean;
    parcelas_max?: number | null;
    // Parcelas oferecidas nesta proposta; ausente = 1..parcelas_max.
    selectedInstallments?: number[];
    juros?: number | null;
    porcentagem?: number | null;
    calculation_mode?: 'monthly_interest' | 'operator_fee';
    operator_fee_rates?: Record<string, number>;
}

export interface PaymentOption {
    methodType: 'pix' | 'boleto' | 'parcelado_sem_juros' | 'parcelado_com_juros';
    installments: number;
    label: string;
    calculationMode: 'cash' | 'no_interest' | 'monthly_interest' | 'operator_fee';
    baseTotal: number;
    customerTotal: number;
    installmentValue: number;
    // Só quando a última parcela é diferente (sem juros: absorve os centavos).
    lastInstallmentValue?: number;
    ratePercent: number;
    discountPercent: number;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const ceilMoney = (value: number) => Math.ceil((value - Number.EPSILON) * 100) / 100;
const clampPercent = (value: unknown) => Math.min(99.99, Math.max(0, Number(value) || 0));
const clampInstallments = (value: unknown) => Math.min(12, Math.max(1, Math.trunc(Number(value) || 1)));

export const getAvailableInstallments = (method: PaymentMethodInput): number[] => {
    const max = clampInstallments(method.parcelas_max);
    const configured = Array.isArray(method.selectedInstallments)
        ? [...new Set(method.selectedInstallments.filter(value => Number.isInteger(value) && value >= 1 && value <= max))].sort((a, b) => a - b)
        : Array.from({ length: max }, (_, index) => index + 1);
    return method.tipo === 'parcelado_com_juros' && method.calculation_mode === 'operator_fee'
        ? configured.filter(value => method.operator_fee_rates?.[String(value)] != null)
        : configured;
};

const buildCashOption = (baseTotal: number, method: PaymentMethodInput): PaymentOption => {
    const discountPercent = clampPercent(method.porcentagem);
    const customerTotal = roundMoney(baseTotal * (1 - discountPercent / 100));
    return {
        methodType: method.tipo as 'pix' | 'boleto',
        installments: 1,
        label: method.tipo === 'pix'
            ? discountPercent > 0 ? `Pix à vista com ${discountPercent}% de desconto` : 'Pix à vista'
            : 'Boleto à vista',
        calculationMode: 'cash',
        baseTotal: roundMoney(baseTotal),
        customerTotal,
        installmentValue: customerTotal,
        ratePercent: 0,
        discountPercent,
    };
};

// Sem juros soma exatamente o valor da proposta: as parcelas são arredondadas
// para cima e a última fica com a diferença (365 em 3x = 121,67 + 121,67 + 121,66).
const buildNoInterestOption = (baseTotal: number, installments: number): PaymentOption => {
    const total = roundMoney(baseTotal);
    const installmentValue = ceilMoney(total / installments);
    const lastInstallmentValue = roundMoney(total - installmentValue * (installments - 1));
    return {
        methodType: 'parcelado_sem_juros',
        installments,
        label: `${installments}x sem juros`,
        calculationMode: 'no_interest',
        baseTotal: total,
        customerTotal: total,
        installmentValue,
        ...(Math.abs(lastInstallmentValue - installmentValue) >= 0.005 ? { lastInstallmentValue } : {}),
        ratePercent: 0,
        discountPercent: 0,
    };
};

const buildOperatorFeeOption = (baseTotal: number, installments: number, rawRate: number): PaymentOption | null => {
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

const buildMonthlyInterestOption = (baseTotal: number, installments: number, rawRate: number): PaymentOption => {
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

export const buildPaymentOptions = (total: unknown, paymentMethods: PaymentMethodInput[] = []): PaymentOption[] => {
    const baseTotal = Math.max(0, Number(total) || 0);
    if (baseTotal <= 0) return [];
    const methods = Array.isArray(paymentMethods) ? paymentMethods : [];

    const options: PaymentOption[] = [];
    const pix = methods.find(method => method.ativo && method.tipo === 'pix');
    const boleto = methods.find(method => method.ativo && method.tipo === 'boleto');
    if (pix) options.push(buildCashOption(baseTotal, pix));
    if (boleto) options.push(buildCashOption(baseTotal, boleto));

    const noInterest = methods.find(method => method.ativo && method.tipo === 'parcelado_sem_juros');
    const noInterestInstallments = noInterest ? getAvailableInstallments(noInterest) : [];
    // Com juros só depois da última parcela sem juros (nunca "3x sem juros" e "3x com juros").
    const noInterestTop = noInterestInstallments.length ? Math.max(...noInterestInstallments) : 0;
    noInterestInstallments.forEach(installments => options.push(buildNoInterestOption(baseTotal, installments)));

    const withInterest = methods.find(method => method.ativo && method.tipo === 'parcelado_com_juros');
    if (withInterest) {
        const mode = withInterest.calculation_mode || 'monthly_interest';
        for (const installments of getAvailableInstallments(withInterest)) {
            if (installments <= noInterestTop) continue;
            if (mode === 'operator_fee') {
                const configuredRate = withInterest.operator_fee_rates?.[String(installments)];
                if (configuredRate == null) continue;
                const option = buildOperatorFeeOption(baseTotal, installments, Number(configuredRate));
                if (option) options.push(option);
            } else {
                options.push(buildMonthlyInterestOption(baseTotal, installments, Number(withInterest.juros) || 0));
            }
        }
    }
    return options;
};
