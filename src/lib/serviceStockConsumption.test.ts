import { describe, expect, it } from 'vitest';
import { Measurement, SavedPDF } from '../../types';
import {
    buildServiceStockPlans,
    calculateStockPlanForRoll,
    normalizeStockFilmName,
} from './serviceStockConsumption';

const measurement = (overrides: Partial<Measurement> = {}): Measurement => ({
    id: 1,
    largura: '1',
    altura: '1',
    quantidade: 1,
    ambiente: 'Sala',
    tipoAplicacao: 'Vidro',
    pelicula: 'Blackout',
    active: true,
    ...overrides,
});

const pdf = (id: number, measurements: Measurement[], overrides: Partial<SavedPDF> = {}): SavedPDF => ({
    id,
    clienteId: 1,
    date: '2026-08-07',
    totalPreco: 100,
    totalM2: 1,
    nomeArquivo: `proposta-${id}.pdf`,
    measurements,
    generalDiscount: { value: 0, type: 'none' },
    ...overrides,
});

describe('serviceStockConsumption', () => {
    it('agrupa filmes de varias propostas, mantem ids unicos e deduplica o mesmo PDF', () => {
        const firstPdf = pdf(10, [
            measurement({ id: 1, pelicula: 'Blackout' }),
            measurement({ id: 2, pelicula: 'Ceramica' }),
        ]);
        const duplicatePdf = pdf(10, [measurement({ id: 99, pelicula: 'Nao deve entrar' })]);
        const secondPdf = pdf(11, [measurement({ id: 3, pelicula: 'Blackout' })]);

        const plans = buildServiceStockPlans([firstPdf, duplicatePdf, secondPdf]);

        expect(plans.map((plan) => plan.filmName)).toEqual(['Blackout', 'Ceramica']);
        expect(plans[0].sourcePdfIds).toEqual([10, 11]);
        expect(plans[0].pieces).toHaveLength(2);
        expect(plans.flatMap((plan) => plan.pieces.map((piece) => piece.id))
            .some((pieceId) => pieceId.includes('measurement:99'))).toBe(false);
    });

    it('expande quantidade com ids deterministas', () => {
        const linked = [pdf(7, [measurement({ id: 42, quantidade: 3 })])];

        const first = buildServiceStockPlans(linked)[0];
        const second = buildServiceStockPlans(linked)[0];

        expect(first.pieces.map((piece) => piece.id)).toEqual([
            'pdf:7:measurement:42:row:0:piece:1',
            'pdf:7:measurement:42:row:0:piece:2',
            'pdf:7:measurement:42:row:0:piece:3',
        ]);
        expect(second.pieces.map((piece) => piece.id)).toEqual(first.pieces.map((piece) => piece.id));
        expect(first.defaultCalculation.totalPieceCount).toBe(3);
    });

    it('ignora medidas inativas ou invalidas', () => {
        const plans = buildServiceStockPlans([pdf(1, [
            measurement({ id: 1, active: false }),
            measurement({ id: 2, largura: '0' }),
            measurement({ id: 3, altura: 'abc' }),
            measurement({ id: 4, quantidade: 0 }),
            measurement({ id: 5, pelicula: '   ' }),
            measurement({ id: 6, pelicula: 'Valida' }),
        ])]);

        expect(plans).toHaveLength(1);
        expect(plans[0].filmName).toBe('Valida');
        expect(plans[0].pieces).toHaveLength(1);
    });

    it('considera ativa uma medida legada sem o campo active', () => {
        const legacyMeasurement = measurement({ id: 7, pelicula: 'Legada' });
        delete (legacyMeasurement as Partial<Measurement>).active;

        const plans = buildServiceStockPlans([pdf(1, [legacyMeasurement])]);

        expect(plans).toHaveLength(1);
        expect(plans[0].filmName).toBe('Legada');
        expect(plans[0].pieces).toHaveLength(1);
    });

    it('ignora toda proposta configurada somente como mao de obra', () => {
        const plans = buildServiceStockPlans([
            pdf(1, [measurement()], {
                generalDiscount: { value: 0, type: 'none', pricingMode: 'labor_only' },
            }),
            pdf(2, [measurement({ pelicula: 'Completa' })]),
        ]);

        expect(plans.map((plan) => plan.filmName)).toEqual(['Completa']);
        expect(plans[0].sourcePdfIds).toEqual([2]);
    });

    it('conta medidas com retalho ja consumido sem planejar nova baixa', () => {
        const plans = buildServiceStockPlans([pdf(5, [
            measurement({
                id: 1,
                quantidade: 2,
                estoqueUso: {
                    tipo: 'retalho',
                    retalhoId: 90,
                    filmId: 'Blackout',
                    larguraCm: 100,
                    comprimentoCm: 100,
                    codigoQr: 'RET-90',
                    consumidoEm: '2026-08-07T10:00:00.000Z',
                },
            }),
            measurement({ id: 2, quantidade: 1 }),
        ])]);

        expect(plans[0].alreadyConsumedPieces).toBe(2);
        expect(plans[0].pieces).toHaveLength(1);
        expect(plans[0].sourcePdfIds).toEqual([5]);
    });

    it('normaliza caixa, espacos e acentos preservando o primeiro nome exibido', () => {
        const plans = buildServiceStockPlans([
            pdf(1, [measurement({ pelicula: '  Película   Fumê  ' })]),
            pdf(2, [measurement({ pelicula: 'pelicula fume' })]),
        ]);

        expect(normalizeStockFilmName(' PELÍCULA  FÚME ')).toBe('pelicula fume');
        expect(plans).toHaveLength(1);
        expect(plans[0].filmName).toBe('Película Fumê');
        expect(plans[0].normalizedFilmName).toBe('pelicula fume');
        expect(plans[0].sourcePdfIds).toEqual([1, 2]);
    });

    it('usa configuracao de corte por PDF e recalcula ao trocar a largura da bobina', () => {
        const plan = buildServiceStockPlans([pdf(3, [
            measurement({ id: 1, largura: '1', altura: '1' }),
            measurement({ id: 2, largura: '1', altura: '1' }),
        ], {
            generalDiscount: {
                value: 0,
                type: 'none',
                filmCuttingSettings: {
                    Blackout: {
                        rollWidthCm: 200,
                        bladeWidthMm: 0,
                        respectGrain: true,
                    },
                },
            },
        })])[0];

        expect(plan.cuttingSources[0]).toMatchObject({
            defaultRollWidthCm: 200,
            bladeWidthMm: 0,
            respectGrain: true,
        });
        expect(plan.defaultCalculation.rollWidthCm).toBe(200);
        expect(plan.defaultCalculation.totalLinearMeters).toBe(1);

        const narrowerRoll = calculateStockPlanForRoll(plan, 100);
        expect(narrowerRoll.rollWidthCm).toBe(100);
        expect(narrowerRoll.totalLinearMeters).toBe(2);
        expect(narrowerRoll.unplacedPieceCount).toBe(0);
    });

    it('reporta pecas maiores que a bobina e nunca zera metragem de um corte valido', () => {
        const plan = buildServiceStockPlans([pdf(9, [
            measurement({ id: 1, largura: '1,60', altura: '1,70' }),
            measurement({ id: 2, largura: '0,001', altura: '0,001' }),
        ], {
            generalDiscount: {
                value: 0,
                type: 'none',
                filmCuttingSettings: {
                    Blackout: {
                        rollWidthCm: 152,
                        bladeWidthMm: 0,
                        respectGrain: false,
                    },
                },
            },
        })])[0];

        expect(plan.defaultCalculation.unplacedPieceCount).toBe(1);
        expect(plan.defaultCalculation.placedPieceCount).toBe(1);
        expect(plan.defaultCalculation.totalLinearMeters).toBeGreaterThan(0);
    });
});
