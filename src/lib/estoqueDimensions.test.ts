import { describe, expect, it } from 'vitest';
import {
    calculateAreaM2FromCentimeters,
    formatMetersFromCentimeters,
    normalizeLegacyRetalhoDimensions,
    normalizeLegacyCentimeterValue,
    parseFlexibleCentimeterInput,
    parseFlexibleMeterInput
} from './estoqueDimensions';

describe('estoqueDimensions', () => {
    it('aceita metros com ponto ou virgula e converte para centimetros', () => {
        expect(parseFlexibleCentimeterInput('1,52')).toBe(152);
        expect(parseFlexibleCentimeterInput('0.55')).toBeCloseTo(55, 5);
    });

    it('mantem centimetros inteiros como centimetros', () => {
        expect(parseFlexibleCentimeterInput('152')).toBe(152);
        expect(parseFlexibleCentimeterInput(55)).toBe(55);
    });

    it('normaliza valores legados pequenos salvos como se fossem centimetros', () => {
        expect(normalizeLegacyCentimeterValue(1.52)).toBe(152);
        expect(normalizeLegacyCentimeterValue(0.55)).toBeCloseTo(55, 5);
        expect(normalizeLegacyCentimeterValue(152)).toBe(152);
    });

    it('normaliza retalhos legados apenas quando a area antiga indica erro de unidade', () => {
        const normalizedLegacyRetalho = normalizeLegacyRetalhoDimensions(1.52, 0.55, 0.0000836);
        expect(normalizedLegacyRetalho.larguraCm).toBeCloseTo(152, 5);
        expect(normalizedLegacyRetalho.comprimentoCm).toBeCloseTo(55, 5);

        expect(normalizeLegacyRetalhoDimensions(8.5, 9.5, 0.008075)).toEqual({
            larguraCm: 8.5,
            comprimentoCm: 9.5
        });
    });

    it('formata centimetros como metros para exibicao', () => {
        expect(formatMetersFromCentimeters(152)).toBe('1,52');
        expect(formatMetersFromCentimeters(55)).toBe('0,55');
    });

    it('normaliza entrada de metros para bobinas', () => {
        expect(parseFlexibleMeterInput('30')).toBe(30);
        expect(parseFlexibleMeterInput('30,5')).toBe(30.5);
    });

    it('calcula area usando as dimensoes em centimetros', () => {
        expect(calculateAreaM2FromCentimeters(152, 55)).toBeCloseTo(0.836, 5);
    });
});
