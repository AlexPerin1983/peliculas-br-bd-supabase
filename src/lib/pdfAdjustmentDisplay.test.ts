import { buildPdfAdjustmentDisplay } from './pdfAdjustmentDisplay';
import type { Film, Measurement } from '../../types';

const films: Film[] = [
    { nome: 'Blackout', preco: 100 },
    { nome: 'Premium', preco: 200 }
];

const buildMeasurement = (overrides: Partial<Measurement>): Measurement => ({
    id: 1,
    largura: '1',
    altura: '1',
    quantidade: 1,
    ambiente: 'Sala',
    tipoAplicacao: 'Interna',
    pelicula: 'Blackout',
    active: true,
    ...overrides
});

describe('buildPdfAdjustmentDisplay', () => {
    it('embute acrescimo geral nos itens do PDF por area', () => {
        const measurements = [
            buildMeasurement({ id: 1, largura: '2', altura: '1', pelicula: 'Blackout' }),
            buildMeasurement({ id: 2, largura: '1', altura: '1', pelicula: 'Premium' })
        ];

        const display = buildPdfAdjustmentDisplay({
            measurements,
            films,
            pricingMode: 'complete',
            generalAdjustment: { operation: 'increase' },
            totals: {
                subtotal: 400,
                totalItemDiscount: 0,
                generalDiscountAmount: 90,
                finalTotal: 490
            }
        });

        expect(display.embedsGeneralIncrease).toBe(true);
        expect(display.lineItems[0].embeddedIncreaseAmount).toBeCloseTo(60);
        expect(display.lineItems[1].embeddedIncreaseAmount).toBeCloseTo(30);
        expect(display.lineItems[0].displayFinalItemPrice).toBeCloseTo(260);
        expect(display.lineItems[1].displayFinalItemPrice).toBeCloseTo(230);
        expect(display.summarySubtotal).toBeCloseTo(490);
        expect(display.summaryFinalTotal).toBeCloseTo(490);
    });

    it('mantem desconto geral separado quando nao e acrescimo', () => {
        const display = buildPdfAdjustmentDisplay({
            measurements: [buildMeasurement({ id: 1 })],
            films,
            pricingMode: 'complete',
            generalAdjustment: { operation: 'discount' },
            totals: {
                subtotal: 100,
                totalItemDiscount: 0,
                generalDiscountAmount: 10,
                finalTotal: 90
            }
        });

        expect(display.embedsGeneralIncrease).toBe(false);
        expect(display.lineItems[0].displayFinalItemPrice).toBeCloseTo(100);
        expect(display.summarySubtotal).toBeCloseTo(100);
        expect(display.summaryFinalTotal).toBeCloseTo(90);
    });

    it('preserva coerencia com desconto percentual do item', () => {
        const display = buildPdfAdjustmentDisplay({
            measurements: [
                buildMeasurement({
                    id: 1,
                    discount: { value: '10', type: 'percentage' }
                })
            ],
            films,
            pricingMode: 'complete',
            generalAdjustment: { operation: 'increase' },
            totals: {
                subtotal: 100,
                totalItemDiscount: 10,
                generalDiscountAmount: 9,
                finalTotal: 99
            }
        });

        expect(display.lineItems[0].displayFinalItemPrice).toBeCloseTo(99);
        expect(display.lineItems[0].displayBasePrice).toBeCloseTo(110);
        expect(display.lineItems[0].displayItemDiscountAmount).toBeCloseTo(11);
        expect(display.summarySubtotal).toBeCloseTo(110);
        expect(display.summaryItemDiscount).toBeCloseTo(11);
    });

    it('embute acrescimo e mantem desconto final separado', () => {
        const display = buildPdfAdjustmentDisplay({
            measurements: [buildMeasurement({ id: 1, largura: '2', altura: '1' })],
            films,
            pricingMode: 'complete',
            generalAdjustment: {
                operation: 'discount'
            },
            totals: {
                subtotal: 200,
                totalItemDiscount: 0,
                generalDiscountAmount: 25,
                generalIncreaseAmount: 50,
                generalFinalDiscountAmount: 25,
                finalTotal: 225
            }
        });

        expect(display.embedsGeneralIncrease).toBe(true);
        expect(display.lineItems[0].embeddedIncreaseAmount).toBeCloseTo(50);
        expect(display.lineItems[0].displayFinalItemPrice).toBeCloseTo(250);
        expect(display.summarySubtotal).toBeCloseTo(250);
        expect(display.summaryFinalTotal).toBeCloseTo(225);
    });

    it('fecha centavos do rateio no total do acrescimo', () => {
        const measurements = [1, 2, 3].map(id => buildMeasurement({ id }));

        const display = buildPdfAdjustmentDisplay({
            measurements,
            films,
            pricingMode: 'complete',
            generalAdjustment: { operation: 'increase' },
            totals: {
                subtotal: 300,
                totalItemDiscount: 0,
                generalDiscountAmount: 10,
                finalTotal: 310
            }
        });

        const embeddedTotal = display.lineItems.reduce((sum, item) => sum + item.embeddedIncreaseAmount, 0);
        expect(embeddedTotal).toBeCloseTo(10);
        expect(display.lineItems.map(item => item.embeddedIncreaseAmount)).toEqual([3.34, 3.33, 3.33]);
    });
});
