import type { MeasurementPriceAdjustment, ProposalAdjustmentOperation } from '../../types';

export interface CalculatedMeasurementPriceAdjustment {
    operation: ProposalAdjustmentOperation;
    amount: number;
    discountAmount: number;
    increaseAmount: number;
    finalPrice: number;
}

export const getMeasurementAdjustmentInputs = (adjustment?: MeasurementPriceAdjustment) => {
    const legacyOperation = getMeasurementAdjustmentOperation(adjustment);
    return {
        discount: {
            value: adjustment?.discountValue ?? (legacyOperation === 'discount' ? adjustment?.value : '') ?? '',
            type: adjustment?.discountType ?? (legacyOperation === 'discount' ? adjustment?.type : undefined) ?? 'percentage',
        },
        increase: {
            value: adjustment?.increaseValue ?? (legacyOperation === 'increase' ? adjustment?.value : '') ?? '',
            type: adjustment?.increaseType ?? (legacyOperation === 'increase' ? adjustment?.type : undefined) ?? 'percentage',
        },
    } as const;
};

export const parseMeasurementAdjustmentValue = (value: string | number | undefined | null) => (
    Math.max(0, parseFloat(String(value ?? '').replace(',', '.')) || 0)
);

export const getMeasurementAdjustmentOperation = (
    adjustment?: MeasurementPriceAdjustment
): ProposalAdjustmentOperation => (
    adjustment?.operation === 'increase' ? 'increase' : 'discount'
);

export const calculateMeasurementPriceAdjustment = (
    basePrice: number,
    adjustment?: MeasurementPriceAdjustment
): CalculatedMeasurementPriceAdjustment => {
    const safeBasePrice = Math.max(0, Number.isFinite(basePrice) ? basePrice : 0);
    const inputs = getMeasurementAdjustmentInputs(adjustment);
    const increaseValue = parseMeasurementAdjustmentValue(inputs.increase.value);
    const increaseAmount = inputs.increase.type === 'percentage'
        ? safeBasePrice * (increaseValue / 100)
        : increaseValue;
    const priceAfterIncrease = safeBasePrice + increaseAmount;
    const discountValue = parseMeasurementAdjustmentValue(inputs.discount.value);
    const discountAmount = Math.min(priceAfterIncrease, inputs.discount.type === 'percentage'
        ? priceAfterIncrease * (discountValue / 100)
        : discountValue);
    const operation = discountAmount > 0 ? 'discount' : increaseAmount > 0 ? 'increase' : getMeasurementAdjustmentOperation(adjustment);

    return {
        operation,
        amount: operation === 'increase' ? increaseAmount : discountAmount,
        discountAmount,
        increaseAmount,
        finalPrice: priceAfterIncrease - discountAmount,
    };
};
