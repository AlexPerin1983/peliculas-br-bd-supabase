import { fireEvent, render, screen } from '@testing-library/react';
import ProposalExpensesModal from './ProposalExpensesModal';
import { Totals } from '../../types';

const baseTotals: Totals = {
    totalM2: 0,
    subtotal: 0,
    totalItemDiscount: 0,
    generalDiscountAmount: 0,
    finalTotal: 100,
    totalQuantity: 0,
    priceAfterItemDiscounts: 100,
    totalLinearMeters: 0,
    linearMeterCost: 0,
    totalMaterial: 0,
    totalLabor: 0,
    operationalExpenses: 0,
    expensesByCategory: [],
    estimatedMaterialCost: 0,
    estimatedTotalCost: 0,
    estimatedProfit: 100,
    estimatedMarginPercentage: 100,
    pricingMode: 'complete'
};

describe('ProposalExpensesModal', () => {
    it('calcula locomocao por combustivel e salva no gasto da proposta', () => {
        const onSave = vi.fn();

        render(
            <ProposalExpensesModal
                isOpen
                onClose={vi.fn()}
                onSave={onSave}
                expenses={[]}
                totals={baseTotals}
            />
        );

        fireEvent.change(screen.getByLabelText('Preco/L'), { target: { value: '6' } });
        fireEvent.change(screen.getByLabelText('Km/L'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Km rodados'), { target: { value: '30' } });

        expect(screen.getByLabelText('Locomoção')).toHaveValue('18');

        fireEvent.click(screen.getByRole('button', { name: 'Salvar gastos' }));

        expect(onSave).toHaveBeenCalledWith([
            expect.objectContaining({
                category: 'transport',
                amount: '18',
                description: expect.stringContaining('Combustivel: 30 km | 10 km/L'),
                fuelDetails: expect.objectContaining({
                    fuelPricePerLiter: '6',
                    consumptionKmPerLiter: '10',
                    distanceKm: '30',
                    calculatedAmount: 18
                })
            })
        ]);
    });

    it('reabre com combustivel salvo e registra alteracoes novas', () => {
        const onSave = vi.fn();
        const savedExpenses = [
            {
                id: 'transport-saved',
                category: 'transport' as const,
                amount: '18',
                description: 'Combustivel: 30 km | 10 km/L | R$ 6,00/L',
                fuelDetails: {
                    fuelPricePerLiter: '6',
                    consumptionKmPerLiter: '10',
                    distanceKm: '30',
                    calculatedAmount: 18
                }
            }
        ];

        const { rerender } = render(
            <ProposalExpensesModal
                isOpen={false}
                onClose={vi.fn()}
                onSave={onSave}
                expenses={savedExpenses}
                totals={baseTotals}
            />
        );

        rerender(
            <ProposalExpensesModal
                isOpen
                onClose={vi.fn()}
                onSave={onSave}
                expenses={savedExpenses}
                totals={baseTotals}
            />
        );

        expect(screen.getByLabelText('Preco/L')).toHaveValue('6');
        expect(screen.getByLabelText('Km/L')).toHaveValue('10');
        expect(screen.getByLabelText('Km rodados')).toHaveValue('30');
        expect(screen.getByLabelText('Locomoção')).toHaveValue('18');

        fireEvent.change(screen.getByLabelText('Km rodados'), { target: { value: '40' } });

        expect(screen.getByLabelText('Locomoção')).toHaveValue('24');

        fireEvent.click(screen.getByRole('button', { name: 'Salvar gastos' }));

        expect(onSave).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 'transport-saved',
                category: 'transport',
                amount: '24',
                description: expect.stringContaining('Combustivel: 40 km | 10 km/L'),
                fuelDetails: expect.objectContaining({
                    fuelPricePerLiter: '6',
                    consumptionKmPerLiter: '10',
                    distanceKm: '40',
                    calculatedAmount: 24
                })
            })
        ]);
    });
});
