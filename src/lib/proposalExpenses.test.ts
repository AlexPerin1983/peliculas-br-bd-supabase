import {
    calculateFuelExpenseAmount,
    normalizeProposalExpenses,
    summarizeProposalExpenses
} from './proposalExpenses';

describe('proposalExpenses', () => {
    it('calcula combustivel por preco, consumo e km rodados', () => {
        expect(calculateFuelExpenseAmount({
            fuelPricePerLiter: '6,20',
            consumptionKmPerLiter: '10',
            distanceKm: '35'
        })).toBeCloseTo(21.7);
    });

    it('usa o calculo de combustivel como valor de locomocao quando nao ha valor manual', () => {
        const expenses = normalizeProposalExpenses([
            {
                id: 'transport',
                category: 'transport',
                amount: '',
                fuelDetails: {
                    fuelPricePerLiter: '6,20',
                    consumptionKmPerLiter: '10',
                    distanceKm: '35'
                }
            }
        ]);

        expect(expenses).toEqual([
            expect.objectContaining({
                id: 'transport',
                category: 'transport',
                amount: '21.7',
                fuelDetails: expect.objectContaining({
                    calculatedAmount: 21.7
                })
            })
        ]);
    });

    it('soma combustivel calculado no resumo por categoria', () => {
        const summary = summarizeProposalExpenses([
            {
                id: 'transport',
                category: 'transport',
                amount: '',
                fuelDetails: {
                    fuelPricePerLiter: '6,20',
                    consumptionKmPerLiter: '10',
                    distanceKm: '35'
                }
            }
        ]);

        expect(summary.total).toBeCloseTo(21.7);
        expect(summary.byCategory).toEqual([
            expect.objectContaining({
                category: 'transport',
                total: 21.7
            })
        ]);
    });
});
