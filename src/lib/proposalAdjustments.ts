import type { ProposalDiscount } from '../../types';

export type ProposalAdjustmentKind = 'discount' | 'increase';

export interface ProposalAdjustmentInput {
    value: string;
    type: 'percentage' | 'fixed';
}

export interface ProposalAdjustmentInputs {
    discount: ProposalAdjustmentInput;
    increase: ProposalAdjustmentInput;
}

export interface ProposalAdjustmentAmounts {
    generalIncreaseAmount: number;
    generalFinalDiscountAmount: number;
    generalDiscountAmount: number;
}

export const normalizeAdjustmentInputValue = (value: string | number | undefined | null) => {
    const cleanValue = String(value ?? '')
        .replace(/\./g, ',')
        .replace(/[^0-9,]/g, '');
    const [integerPart, ...decimalParts] = cleanValue.split(',');

    if (decimalParts.length === 0) {
        return integerPart;
    }

    return `${integerPart},${decimalParts.join('')}`;
};

export const parseAdjustmentNumber = (value: string | number | undefined | null) => (
    parseFloat(String(value ?? '').replace(',', '.')) || 0
);

const resolveAdjustmentType = (type: unknown): 'percentage' | 'fixed' => (
    type === 'fixed' ? 'fixed' : 'percentage'
);

export const getProposalAdjustmentInputs = (generalDiscount: ProposalDiscount): ProposalAdjustmentInputs => {
    const legacyOperation = generalDiscount.operation === 'increase' ? 'increase' : 'discount';
    const hasExplicitDiscount = generalDiscount.discountValue !== undefined || generalDiscount.discountType !== undefined;
    const hasExplicitIncrease = generalDiscount.increaseValue !== undefined || generalDiscount.increaseType !== undefined;

    return {
        discount: {
            value: normalizeAdjustmentInputValue(
                hasExplicitDiscount
                    ? generalDiscount.discountValue
                    : legacyOperation === 'discount'
                        ? generalDiscount.value
                        : ''
            ),
            type: resolveAdjustmentType(
                hasExplicitDiscount
                    ? generalDiscount.discountType
                    : legacyOperation === 'discount'
                        ? generalDiscount.type
                        : 'fixed'
            ),
        },
        increase: {
            value: normalizeAdjustmentInputValue(
                hasExplicitIncrease
                    ? generalDiscount.increaseValue
                    : legacyOperation === 'increase'
                        ? generalDiscount.value
                        : ''
            ),
            type: resolveAdjustmentType(
                hasExplicitIncrease
                    ? generalDiscount.increaseType
                    : legacyOperation === 'increase'
                        ? generalDiscount.type
                        : 'fixed'
            ),
        },
    };
};

export const calculateAdjustmentAmount = (
    input: ProposalAdjustmentInput,
    baseAmount: number
) => {
    const value = parseAdjustmentNumber(input.value);
    if (value <= 0) return 0;

    if (input.type === 'percentage') {
        return Math.max(0, baseAmount) * (value / 100);
    }

    return value;
};

export const calculateProposalAdjustmentAmounts = (
    generalDiscount: ProposalDiscount,
    baseAmount: number
): ProposalAdjustmentAmounts => {
    const inputs = getProposalAdjustmentInputs(generalDiscount);
    const generalIncreaseAmount = calculateAdjustmentAmount(inputs.increase, baseAmount);
    const baseAfterIncrease = Math.max(0, baseAmount + generalIncreaseAmount);
    const generalFinalDiscountAmount = calculateAdjustmentAmount(inputs.discount, baseAfterIncrease);

    return {
        generalIncreaseAmount,
        generalFinalDiscountAmount,
        // Backward-compatible amount for screens that still expect one adjustment number.
        generalDiscountAmount: generalFinalDiscountAmount > 0
            ? generalFinalDiscountAmount
            : generalIncreaseAmount,
    };
};

export const updateProposalAdjustmentInput = (
    generalDiscount: ProposalDiscount,
    kind: ProposalAdjustmentKind,
    input: Partial<ProposalAdjustmentInput>
): ProposalDiscount => {
    const currentInputs = getProposalAdjustmentInputs(generalDiscount);
    const nextInput = {
        ...currentInputs[kind],
        ...input,
    };
    const discountInput = kind === 'discount' ? nextInput : currentInputs.discount;
    const increaseInput = kind === 'increase' ? nextInput : currentInputs.increase;

    return {
        ...generalDiscount,
        operation: kind,
        value: nextInput.value,
        type: nextInput.type,
        discountValue: discountInput.value,
        discountType: discountInput.type,
        increaseValue: increaseInput.value,
        increaseType: increaseInput.type,
    };
};
