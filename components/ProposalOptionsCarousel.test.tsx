import { fireEvent, render, screen } from '@testing-library/react';
import ProposalOptionsCarousel from './ProposalOptionsCarousel';
import { ProposalOption } from '../types';

const buildOption = (overrides: Partial<ProposalOption> = {}): ProposalOption => ({
    id: 1,
    name: 'Opcao 1',
    measurements: [
        {
            id: 10,
            largura: '1',
            altura: '1',
            quantidade: 1,
            ambiente: '',
            tipoAplicacao: '',
            pelicula: 'Blackout',
            active: true,
        },
    ],
    generalDiscount: { value: '', type: 'percentage', pricingMode: 'complete' },
    ...overrides,
});

const baseHandlers = () => ({
    onSelectOption: vi.fn(),
    onAddOption: vi.fn(),
    onRenameOption: vi.fn(),
    onDeleteOption: vi.fn(),
    onOpenPaymentConfig: vi.fn(),
    onOpenExpenses: vi.fn(),
    onSelectPricingMode: vi.fn(),
    onSwipeDirectionChange: vi.fn(),
});

describe('ProposalOptionsCarousel', () => {
    beforeAll(() => {
        Element.prototype.scrollTo = vi.fn();
    });

    it('usa a primeira pelicula como nome visual da opcao padrao', () => {
        const handlers = baseHandlers();

        render(
            <ProposalOptionsCarousel
                options={[buildOption()]}
                activeOptionId={1}
                hasActivePaymentOverride={false}
                hasActiveExpenses={false}
                showPricingMode={false}
                {...handlers}
            />
        );

        expect(screen.getByText('Blackout')).toBeInTheDocument();
        expect(screen.queryByText('Opcao 1')).not.toBeInTheDocument();
    });

    it('abre as acoes secundarias no menu de tres pontos', () => {
        const handlers = baseHandlers();

        render(
            <ProposalOptionsCarousel
                options={[buildOption()]}
                activeOptionId={1}
                hasActivePaymentOverride={false}
                hasActiveExpenses={false}
                showPricingMode={false}
                {...handlers}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /abrir acoes da opcao blackout/i }));

        expect(screen.getByRole('dialog', { name: /acoes da opcao blackout/i })).toBeInTheDocument();
        expect(screen.getByText('Renomear opcao')).toBeInTheDocument();
        expect(screen.getByText('Pagamento')).toBeInTheDocument();
        expect(screen.getByText('Gastos')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Pagamento'));

        expect(handlers.onOpenPaymentConfig).toHaveBeenCalledTimes(1);
    });
});
