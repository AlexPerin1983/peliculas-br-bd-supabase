import { describe, expect, it } from 'vitest';

import { normalizeAdjustmentInputValue } from './proposalAdjustments';

describe('normalizeAdjustmentInputValue', () => {
    it('mantém somente quatro casas decimais', () => {
        expect(normalizeAdjustmentInputValue('12,34567')).toBe('12,3456');
        expect(normalizeAdjustmentInputValue('12.34567')).toBe('12,3456');
    });

    it('preserva a digitação parcial e remove caracteres inválidos', () => {
        expect(normalizeAdjustmentInputValue('85,')).toBe('85,');
        expect(normalizeAdjustmentInputValue('R$ 85,50')).toBe('85,50');
    });
});
