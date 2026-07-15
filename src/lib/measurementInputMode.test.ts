import {
    formatCentimeterDigitsAsMeters,
    metersValueToCentimeterDigits,
    normalizeMeasurementInput,
} from './measurementInputMode';

describe('measurementInputMode', () => {
    it('converte centimetros digitados sem separador para metros', () => {
        expect(formatCentimeterDigitsAsMeters('152')).toBe('1.52');
        expect(formatCentimeterDigitsAsMeters('80')).toBe('0.80');
    });

    it('reconstroi os digitos em centimetros de uma medida salva', () => {
        expect(metersValueToCentimeterDigits('1,52')).toBe('152');
        expect(metersValueToCentimeterDigits('0,80')).toBe('80');
    });

    it('normaliza a entrada conforme o modo escolhido', () => {
        expect(normalizeMeasurementInput('152', 'centimeters')).toBe('1,52');
        expect(normalizeMeasurementInput('1,52', 'centimeters')).toBe('1,52');
        expect(normalizeMeasurementInput('152', 'meters')).toBe('152');
    });
});
