import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TotalsDrawer } from './TotalsDrawer';
import type { ProposalDiscount, Totals } from '../../types';

vi.mock('vaul', () => ({
    Drawer: {
        Root: ({ open, children }: any) => open ? <>{children}</> : null,
        Portal: ({ children }: any) => <>{children}</>,
        Overlay: (props: any) => <div {...props} />,
        Content: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    }
}));

const totals: Totals = {
    totalM2: 2,
    subtotal: 200,
    totalItemDiscount: 0,
    priceAfterItemDiscounts: 200,
    generalDiscountAmount: 0,
    generalIncreaseAmount: 0,
    generalFinalDiscountAmount: 0,
    finalTotal: 200,
    totalQuantity: 1,
    totalLinearMeters: 2,
    linearMeterCost: 50,
    totalMaterial: 200,
    totalLabor: 70,
    operationalExpenses: 0,
    estimatedMaterialCost: 50,
    estimatedTotalCost: 50,
    estimatedProfit: 150,
    estimatedMarginPercentage: 75,
    pricingMode: 'complete',
    groupedTotals: {
        Jateada: {
            filmName: 'Jateada',
            totalM2: 2,
            totalLinearMeters: 2,
            totalMaterial: 200,
            totalLabor: 70,
            totalLinearMeterCost: 50,
            unitPriceMaterial: 100,
            unitPriceLabor: 35,
            unitPriceLinearMeter: 25,
            filmPricingMode: 'area',
            unitSalePriceLinearMeter: 0,
            linearSaleSubtotal: 0,
            catalogUnitPriceMaterial: 100,
            catalogUnitPriceLabor: 35,
            catalogUnitPriceLinearMeter: 25,
            catalogUnitSalePriceLinearMeter: 80,
        }
    }
};

const baseDiscount: ProposalDiscount = {
    value: '',
    type: 'fixed',
    pricingMode: 'complete'
};

describe('TotalsDrawer preço personalizado', () => {
    it('edita somente a proposta e oferece restauração do catálogo', async () => {
        const onUpdate = vi.fn();
        const props = {
            isOpen: true,
            onClose: vi.fn(),
            totals,
            generalDiscount: baseDiscount,
            onUpdateGeneralDiscount: onUpdate,
            onGeneratePdf: vi.fn(),
            isGeneratingPdf: false,
        };
        const { rerender } = render(<TotalsDrawer {...props} />);

        expect(screen.queryByLabelText('Preço de venda por m²')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Jateada/ }));
        const priceInput = await screen.findByLabelText('Preço de venda por m²');
        expect(priceInput).toHaveValue(100);
        fireEvent.change(priceInput, { target: { value: '85' } });

        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
            filmPriceOverrides: { Jateada: { preco: '85' } }
        }));

        const customizedDiscount: ProposalDiscount = {
            ...baseDiscount,
            filmPriceOverrides: { Jateada: { preco: '85' } }
        };
        rerender(<TotalsDrawer {...props} generalDiscount={customizedDiscount} />);

        expect(screen.getByText('Preço personalizado neste orçamento')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Gerar e salvar PDF' })).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Restaurar Preço de venda por m² do catálogo'));

        await waitFor(() => expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
            filmPriceOverrides: undefined
        })));
    });
});
