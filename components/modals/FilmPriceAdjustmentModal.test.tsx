import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FilmPriceAdjustmentModal from './FilmPriceAdjustmentModal';
import { Film } from '../../types';

vi.mock('../ui/Modal', () => ({
    default: ({ title, children, footer }: { title: ReactNode; children: ReactNode; footer?: ReactNode }) => (
        <section>
            <h1>{title}</h1>
            {children}
            <footer>{footer}</footer>
        </section>
    ),
}));

const showToast = vi.fn();
vi.mock('../../src/contexts/FeedbackContext', () => ({
    useFeedback: () => ({ showAlert: vi.fn(), showToast }),
}));

const films: Film[] = [
    { nome: 'G5', preco: 100, maoDeObra: 20, customFields: { __match_brand: '3M' } },
    { nome: 'G20', preco: 95, customFields: { __match_brand: 'SunTek' } },
    { nome: 'Sem preço', preco: 0 },
];

const renderModal = () => {
    const props = { films, onClose: vi.fn(), onSaveFilms: vi.fn().mockResolvedValue(undefined) };
    render(<FilmPriceAdjustmentModal {...props} />);
    return props;
};

describe('FilmPriceAdjustmentModal', () => {
    beforeEach(() => vi.clearAllMocks());

    it('mostra a prévia e reajusta só as películas com preço', async () => {
        const props = renderModal();

        expect(screen.getByText('Sem valor para reajustar')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Reajustar Sem preço' })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'Reajustar 2 películas' }));

        await waitFor(() => expect(props.onSaveFilms).toHaveBeenCalledTimes(1));
        expect(props.onSaveFilms.mock.calls[0][0]).toEqual([
            expect.objectContaining({ nome: 'G5', preco: 110, maoDeObra: 20 }),
            expect.objectContaining({ nome: 'G20', preco: 104.5 }),
        ]);
        expect(props.onClose).toHaveBeenCalled();
    });

    it('o "Desfazer" do aviso salva os preços anteriores', async () => {
        const props = renderModal();
        fireEvent.click(screen.getByRole('button', { name: 'Reajustar 2 películas' }));
        await waitFor(() => expect(showToast).toHaveBeenCalled());

        const [message, options] = showToast.mock.calls[0];
        expect(message).toBe('Preços de 2 películas reajustados.');
        expect(options.actionLabel).toBe('Desfazer');

        options.onAction();
        await waitFor(() => expect(props.onSaveFilms).toHaveBeenCalledTimes(2));
        expect(props.onSaveFilms.mock.calls[1][0]).toEqual([
            expect.objectContaining({ nome: 'G5', preco: 100 }),
            expect.objectContaining({ nome: 'G20', preco: 95 }),
        ]);
    });

    it('reduz, arredonda, filtra por marca e deixa desmarcar', async () => {
        const props = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Reduzir' }));
        fireEvent.change(screen.getByLabelText('Percentual'), { target: { value: '15' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Mão de obra' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Arredondar para reais inteiros' }));

        fireEvent.click(screen.getByRole('button', { name: '3M' }));
        expect(screen.queryByText('G20')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reajustar 1 película' }));

        await waitFor(() => expect(props.onSaveFilms).toHaveBeenCalledTimes(1));
        expect(props.onSaveFilms.mock.calls[0][0]).toEqual([
            expect.objectContaining({ nome: 'G5', preco: 85, maoDeObra: 17 }),
        ]);
    });

    it('não aplica com percentual inválido nem com tudo desmarcado', () => {
        renderModal();

        fireEvent.change(screen.getByLabelText('Percentual'), { target: { value: '0' } });
        expect(screen.getByText(/Informe um aumento entre 0,1% e 300%/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reajustar 0 películas' })).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Percentual'), { target: { value: '10' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Reajustar G5' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Reajustar G20' }));
        expect(screen.getByRole('button', { name: 'Reajustar 0 películas' })).toBeDisabled();
    });
});
