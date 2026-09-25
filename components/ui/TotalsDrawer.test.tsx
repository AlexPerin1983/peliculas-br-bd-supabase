import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
            defaultUnitSalePriceLinearMeter: 152,
            rollWidthMeters: 1.52,
            linearSalePriceDefaultSource: 'converted',
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

describe('TotalsDrawer validade da proposta', () => {
    const renderDrawer = (generalDiscount: ProposalDiscount, onUpdate = vi.fn()) => {
        render(<TotalsDrawer
            isOpen
            onClose={vi.fn()}
            totals={totals}
            generalDiscount={generalDiscount}
            onUpdateGeneralDiscount={onUpdate}
            onGeneratePdf={vi.fn()}
            isGeneratingPdf={false}
            defaultValidityDays={30}
        />);
        return onUpdate;
    };

    it('mostra o padrão da empresa e grava uma validade só para a proposta', () => {
        const onUpdate = renderDrawer(baseDiscount);
        const group = screen.getByRole('group', { name: 'Validade da proposta em dias' });
        expect(screen.getByText(/padrão da empresa \(30 dias\)/)).toBeInTheDocument();
        expect(within(group).getByRole('button', { name: '30' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(within(group).getByRole('button', { name: '15' }));
        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ validityDays: 15 }));
    });

    it('aceita outro prazo até 60 dias e volta ao padrão ao escolher o mesmo da empresa', () => {
        const onUpdate = renderDrawer({ ...baseDiscount, validityDays: 45 });
        expect(screen.getByText(/só nesta proposta/)).toBeInTheDocument();
        const input = screen.getByLabelText('Validade em dias');
        expect(input).toHaveValue('45');

        fireEvent.change(input, { target: { value: '90' } });
        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ validityDays: 60 }));
        expect(screen.getByText('máx. 60')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '30' }));
        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ validityDays: undefined }));
    });
});

describe('TotalsDrawer validade em "Outro"', () => {
    it('deixa apagar e digitar um prazo curto sem voltar para o valor anterior', () => {
        const onUpdate = vi.fn();
        render(<TotalsDrawer
            isOpen
            onClose={vi.fn()}
            totals={totals}
            generalDiscount={{ ...baseDiscount, validityDays: 45 }}
            onUpdateGeneralDiscount={onUpdate}
            onGeneratePdf={vi.fn()}
            isGeneratingPdf={false}
            defaultValidityDays={30}
        />);
        const input = screen.getByLabelText('Validade em dias');

        // Apagar não grava nada e o campo continua vazio enquanto digita.
        fireEvent.change(input, { target: { value: '' } });
        expect(input).toHaveValue('');
        expect(onUpdate).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: '5' } });
        expect(input).toHaveValue('5');
        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ validityDays: 5 }));

        // Letras são ignoradas.
        fireEvent.change(input, { target: { value: '5a' } });
        expect(input).toHaveValue('5');
    });
});

describe('TotalsDrawer garantia nesta proposta', () => {
    const warrantyTotals: Totals = {
        ...totals,
        groupedTotals: {
            Jateada: {
                ...totals.groupedTotals!.Jateada,
                catalogWarranty: { garantiaFabricante: 5, garantiaMaoDeObra: 90, garantiaMaoDeObraUnidade: 'dias' },
            },
        },
    };
    const renderDrawer = (generalDiscount: ProposalDiscount, onUpdate = vi.fn()) => {
        const view = render(<TotalsDrawer
            isOpen
            onClose={vi.fn()}
            totals={warrantyTotals}
            generalDiscount={generalDiscount}
            onUpdateGeneralDiscount={onUpdate}
            onGeneratePdf={vi.fn()}
            isGeneratingPdf={false}
        />);
        fireEvent.click(screen.getByRole('button', { name: /Jateada/ }));
        return { onUpdate, ...view };
    };

    it('mostra a garantia do catálogo e grava uma garantia maior só na proposta', () => {
        const { onUpdate } = renderDrawer(baseDiscount);
        expect(screen.getByText(/Catálogo: 5 anos fábrica · 90 dias instalação/)).toBeInTheDocument();
        const fabricante = screen.getByLabelText('Garantia do fabricante em anos');
        expect(fabricante).toHaveValue('5');

        fireEvent.change(fabricante, { target: { value: '10' } });
        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
            filmWarrantyOverrides: { Jateada: { garantiaFabricante: 10 } },
        }));
        expect(onUpdate.mock.lastCall?.[0].filmPriceOverrides).toBeUndefined();

        // Apagar para digitar não grava nada.
        onUpdate.mockClear();
        fireEvent.change(fabricante, { target: { value: '' } });
        expect(fabricante).toHaveValue('');
        expect(onUpdate).not.toHaveBeenCalled();
    });

    it('troca a unidade da instalação e volta ao catálogo', () => {
        const { onUpdate } = renderDrawer({
            ...baseDiscount,
            filmWarrantyOverrides: { Jateada: { garantiaFabricante: 10 } },
        });
        expect(screen.getByTitle('Garantia personalizada nesta proposta')).toHaveTextContent('10a fáb. · 90d inst.');

        const units = screen.getByRole('group', { name: 'Unidade da garantia da instalação' });
        fireEvent.change(screen.getByLabelText('Garantia da instalação'), { target: { value: '120' } });
        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
            filmWarrantyOverrides: { Jateada: { garantiaFabricante: 10, garantiaMaoDeObra: 120, garantiaMaoDeObraUnidade: 'dias' } },
        }));

        // (o drawer é controlado: sem rerender, a instalação salva continua 90)
        fireEvent.click(within(units).getByRole('button', { name: 'anos' }));
        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
            filmWarrantyOverrides: { Jateada: { garantiaFabricante: 10, garantiaMaoDeObra: 90, garantiaMaoDeObraUnidade: 'anos' } },
        }));

        fireEvent.click(screen.getByRole('button', { name: /Usar garantia do catálogo/ }));
        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ filmWarrantyOverrides: undefined }));
    });
});

describe('TotalsDrawer preço personalizado', () => {
    it('permite escolher nos totais quais parcelas irão para o orçamento', () => {
        const onUpdatePaymentConfig = vi.fn();
        const methods = [{ tipo: 'parcelado_com_juros' as const, ativo: true, parcelas_max: 12, juros: 2 }];
        render(<TotalsDrawer
            isOpen
            onClose={vi.fn()}
            totals={totals}
            generalDiscount={baseDiscount}
            onUpdateGeneralDiscount={vi.fn()}
            onGeneratePdf={vi.fn()}
            isGeneratingPdf={false}
            paymentConfig={{ paymentMethods: methods, prazoPagamento: '' }}
            companyPaymentMethods={methods}
            onUpdatePaymentConfig={onUpdatePaymentConfig}
        />);
        fireEvent.click(screen.getByRole('button', { name: '12x com juros' }));
        expect(onUpdatePaymentConfig).toHaveBeenCalledWith(expect.objectContaining({
            paymentMethods: [expect.objectContaining({ selectedInstallments: expect.not.arrayContaining([12]) })],
        }));
    });

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
        const catalogPriceButton = screen.getByRole('button', { name: /Usar preço original do catálogo.*100,00/ });
        expect(catalogPriceButton).toHaveTextContent(/100,00/);
        fireEvent.click(catalogPriceButton);

        await waitFor(() => expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
            filmPriceOverrides: undefined
        })));
    });

    it('mantém acréscimo e desconto editáveis no resumo compacto', () => {
        const onUpdate = vi.fn();
        render(<TotalsDrawer
            isOpen
            onClose={vi.fn()}
            totals={totals}
            generalDiscount={baseDiscount}
            onUpdateGeneralDiscount={onUpdate}
            onGeneratePdf={vi.fn()}
            isGeneratingPdf={false}
        />);

        fireEvent.click(screen.getByRole('button', { name: /Acréscimo e desconto/i }));

        const increaseInput = screen.getByLabelText('Valor do acréscimo embutido');
        const discountInput = screen.getByLabelText('Valor do desconto final');
        expect(increaseInput).toHaveAttribute('inputmode', 'decimal');
        expect(discountInput).toHaveAttribute('inputmode', 'decimal');

        fireEvent.change(increaseInput, { target: { value: '12,34567' } });
        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
            increaseValue: '12,3456',
        }));
    });

    it('explica a conversão automática e permite substituir o preço linear', async () => {
        const onUpdate = vi.fn();
        const linearTotals: Totals = {
            ...totals,
            subtotal: 304,
            priceAfterItemDiscounts: 304,
            finalTotal: 304,
            groupedTotals: {
                Jateada: {
                    ...totals.groupedTotals!.Jateada,
                    filmPricingMode: 'linear',
                    unitSalePriceLinearMeter: 152,
                    linearSaleSubtotal: 304,
                },
            },
        };
        const linearDiscount: ProposalDiscount = {
            ...baseDiscount,
            filmPricingModes: { Jateada: 'linear' },
        };

        render(<TotalsDrawer
            isOpen
            onClose={vi.fn()}
            totals={linearTotals}
            generalDiscount={linearDiscount}
            onUpdateGeneralDiscount={onUpdate}
            onGeneratePdf={vi.fn()}
            isGeneratingPdf={false}
        />);

        fireEvent.click(screen.getByRole('button', { name: /Jateada/ }));
        expect(await screen.findByText(/Padrão convertido:/)).toHaveTextContent(/R\$\s*100,00\/m² × 1,52 m.*R\$\s*152,00\/m/);

        const linearPriceInput = screen.getByLabelText('Venda por metro linear');
        expect(linearPriceInput).toHaveValue(152);
        fireEvent.change(linearPriceInput, { target: { value: '170' } });

        expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
            filmPriceOverrides: { Jateada: { precoVendaMetroLinear: '170' } },
        }));
    });
});
