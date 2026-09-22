import { describe, expect, it } from 'vitest';
import { calculateMeasurementPriceAdjustment, getMeasurementAdjustmentInputs } from './measurementPriceAdjustment';

describe('calculateMeasurementPriceAdjustment', () => {
    it('aplica o desconto depois do acréscimo e mantém os dois valores separados', () => {
        const adjustment = {
            value: '20', type: 'percentage' as const, operation: 'discount' as const,
            increaseValue: '10', increaseType: 'percentage' as const,
            discountValue: '20', discountType: 'percentage' as const,
        };
        expect(calculateMeasurementPriceAdjustment(100, adjustment)).toMatchObject({
            increaseAmount: 10, discountAmount: 22, finalPrice: 88,
        });
    });

    it('lê ajustes antigos sem alterar sua operação', () => {
        expect(getMeasurementAdjustmentInputs({ value: '10', type: 'fixed', operation: 'increase' })).toMatchObject({
            increase: { value: '10', type: 'fixed' }, discount: { value: '', type: 'percentage' },
        });
        expect(calculateMeasurementPriceAdjustment(100, { value: '10', type: 'fixed' }).finalPrice).toBe(90);
    });
});
