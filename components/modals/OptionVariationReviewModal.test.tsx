import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import OptionVariationReviewModal from './OptionVariationReviewModal';
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

const films: Film[] = ['Jateado Branco', 'Suntek Fumê 20', 'Window Premium', 'Window Blue'].map(nome => ({ nome, preco: 100 }));

const renderModal = (rows = [
    { current: 'Jateado Branco', target: null },
    { current: 'Suntek Fumê 20', target: 'Window Premium' },
]) => {
    const props = { plan: { rows, optionName: '', note: '' }, films, onCancel: vi.fn(), onConfirm: vi.fn() };
    render(<OptionVariationReviewModal {...props} />);
    return props;
};

describe('OptionVariationReviewModal', () => {
    it('mostra o que mantém e o que troca e gera com o nome sugerido', () => {
        const props = renderModal();

        expect(screen.getByLabelText('Película no lugar de Jateado Branco')).toHaveValue('');
        expect(screen.getByLabelText('Película no lugar de Suntek Fumê 20')).toHaveValue('Window Premium');
        expect(screen.getByLabelText('Nome da nova opção')).toHaveValue('Window Premium');

        fireEvent.click(screen.getByRole('button', { name: 'Gerar nova opção' }));
        expect(props.onConfirm).toHaveBeenCalledWith([
            { current: 'Jateado Branco', target: null },
            { current: 'Suntek Fumê 20', target: 'Window Premium' },
        ], 'Window Premium');
    });

    it('trocar a película na lista atualiza o nome, até a pessoa editar o nome', () => {
        renderModal();

        fireEvent.change(screen.getByLabelText('Película no lugar de Jateado Branco'), { target: { value: 'Window Blue' } });
        expect(screen.getByLabelText('Nome da nova opção')).toHaveValue('Window Blue + Window Premium');

        fireEvent.change(screen.getByLabelText('Nome da nova opção'), { target: { value: 'Opção 2' } });
        fireEvent.change(screen.getByLabelText('Película no lugar de Jateado Branco'), { target: { value: '' } });
        expect(screen.getByLabelText('Nome da nova opção')).toHaveValue('Opção 2');
    });

    it('avisa a película que não está no catálogo e só gera com alguma troca', () => {
        const props = renderModal([
            { current: 'Jateado Branco', target: null },
            { current: 'Suntek Fumê 20', target: null, notFound: 'Llumar ATC 35' } as any,
        ]);

        expect(screen.getByText('Não achei "Llumar ATC 35" no catálogo. Escolha na lista.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Gerar nova opção' })).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Película no lugar de Suntek Fumê 20'), { target: { value: 'Window Premium' } });
        expect(screen.queryByText(/Não achei/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Gerar nova opção' }));
        expect(props.onConfirm).toHaveBeenCalledTimes(1);
    });
});
