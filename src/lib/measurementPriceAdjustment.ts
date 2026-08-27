import type { MeasurementPriceAdjustment, ProposalAdjustmentOperation } from '../../types';

export interface CalculatedMeasurementPriceAdjustment {
    operation: ProposalAdjustmentOperation;
    amount: number;
    finalPrice: number;
}

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
    const operation = getMeasurementAdjustmentOperation(adjustment);
    const value = parseMeasurementAdjustmentValue(adjustment?.value);
    const amount = adjustment?.type === 'percentage'
        ? safeBasePrice * (value / 100)
        : value;

    return {
        operation,
        amount,
        finalPrice: operation === 'increase'
            ? safeBasePrice + amount
            : Math.max(0, safeBasePrice - amount),
    };
};
