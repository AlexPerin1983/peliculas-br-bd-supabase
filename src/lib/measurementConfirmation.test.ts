import { describe, expect, it } from 'vitest';
import type { UIMeasurement } from '../../types';
import { buildMeasurementConfirmationMessage, getMeasurementsForConfirmation } from './measurementConfirmation';

const measurement = (overrides: Partial<UIMeasurement> = {}): UIMeasurement => ({
    id: 1,
    largura: '1,01',
    altura: '1,52',
    quantidade: 3,
    ambiente: 'Parede 1',
    tipoAplicacao: '',
    pelicula: 'Carbono Prime',
    active: true,
    ...overrides,
});

describe('measurementConfirmation', () => {
    it('monta uma mensagem de conferência completa sem incluir preços', () => {
        const measurements = [
            measurement(),
            measurement({ id: 2, largura: '1.24', altura: '1.20', quantidade: 2, ambiente: 'Parede 2' }),
            measurement({ id: 3, largura: '1,28', altura: '0,79', quantidade: 1, ambiente: 'Parede 2 - parte menor' }),
        ];

        const message = buildMeasurementConfirmationMessage({ clientName: 'Maria', measurements });

        expect(message).toContain('Olá, Maria!');
        expect(message).toContain('1. Parede 1');
        expect(message).toContain('Medida: 1,01 × 1,52 m');
        expect(message).toContain('Quantidade: 3 peças');
        expect(message).toContain('*Total:* 6 peças • 8,59 m²');
        expect(message).toContain('responda *Confirmo*');
        expect(message).not.toMatch(/R\$|preço|valor|desconto/i);
    });

    it('ignora medidas inativas, sem dimensões ou sem quantidade', () => {
        const measurements = [
            measurement(),
            measurement({ id: 2, active: false }),
            measurement({ id: 3, largura: '0' }),
            measurement({ id: 4, quantidade: 0 }),
        ];

        expect(getMeasurementsForConfirmation(measurements)).toHaveLength(1);
    });

    it('retorna texto vazio quando não há medidas válidas', () => {
        expect(buildMeasurementConfirmationMessage({
            measurements: [measurement({ active: false })],
        })).toBe('');
    });
});
