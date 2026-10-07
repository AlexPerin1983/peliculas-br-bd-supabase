import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FilmImportReviewModal from './FilmImportReviewModal';
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

const candidates: Partial<Film>[] = [
    { nome: 'G5', precoMetroLinear: 50, vtl: 5, customFields: { __match_brand: '3M' } },
    { nome: 'Nano 70', preco: 220, vtl: 70 },
    { nome: 'blackout', precoMetroLinear: 30 },
];
const existing: Film[] = [{ nome: 'Blackout', preco: 150 }];

const renderModal = () => {
    const props = {
        candidates,
        films: existing,
        onClose: vi.fn(),
        onSaveFilms: vi.fn().mockResolvedValue(undefined),
        onDeleteFilms: vi.fn().mockResolvedValue(undefined),
    };
    render(<FilmImportReviewModal {...props} />);
    return props;
};

describe('FilmImportReviewModal', () => {
    beforeEach(() => vi.clearAllMocks());

    it('marca as novas, bloqueia a que já existe e mostra custo e dados', () => {
        renderModal();

        expect(screen.getByText('A IA encontrou 3 películas. As que você já tem ficam como estão. Confira os nomes e informe o preço de venda se já souber.')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Importar G5' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Importar blackout' })).toBeDisabled();
        expect(screen.getByText('Já cadastrada — não será alterada.')).toBeInTheDocument();
        expect(screen.getByText('3M · VTL 5%')).toBeInTheDocument();
        expect(screen.getByText(/Custo: R\$\s50,00 por metro linear/)).toBeInTheDocument();
        expect(screen.getByLabelText('Preço de venda por m² de Nano 70')).toHaveValue('220');
        expect(screen.getByText(/1 película vai entrar sem preço de venda/)).toBeInTheDocument();
    });

    it('importa as marcadas com o preço digitado e o "Desfazer" remove as importadas', async () => {
        const props = renderModal();

        fireEvent.change(screen.getByLabelText('Preço de venda por m² de G5'), { target: { value: '149,90' } });
        expect(screen.queryByText(/sem preço de venda/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Importar 2 películas' }));

        await waitFor(() => expect(props.onSaveFilms).toHaveBeenCalledTimes(1));
        expect(props.onSaveFilms.mock.calls[0][0]).toEqual([
            expect.objectContaining({ nome: 'G5', preco: 149.9, precoMetroLinear: 50, vtl: 5 }),
            expect.objectContaining({ nome: 'Nano 70', preco: 220 }),
        ]);
        expect(props.onClose).toHaveBeenCalled();

        const [message, options] = showToast.mock.calls[0];
        expect(message).toBe('2 películas importadas.');
        options.onAction();
        await waitFor(() => expect(props.onDeleteFilms).toHaveBeenCalledWith(['G5', 'Nano 70']));
    });

    it('deixa desmarcar e não importa nada sem película marcada', () => {
        const props = renderModal();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Importar G5' }));
        expect(screen.getByLabelText('Preço de venda por m² de G5')).toBeDisabled();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Importar Nano 70' }));

        const importButton = screen.getByRole('button', { name: 'Importar 0 películas' });
        expect(importButton).toBeDisabled();
        fireEvent.click(importButton);
        expect(props.onSaveFilms).not.toHaveBeenCalled();
    });
});
