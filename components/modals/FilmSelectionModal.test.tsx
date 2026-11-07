import { fireEvent, render, screen } from '@testing-library/react';
import FilmSelectionModal from './FilmSelectionModal';

const film = (nome: string, preco: number, pinned = false) => ({ nome, preco, maoDeObra: 0, pinned }) as any;
const films = [film('Suntek', 320, true), film('Blackout', 25), film('Carbono', 150)];
const baseProps = () => ({
    isOpen: true,
    onClose: vi.fn(),
    films,
    onSelect: vi.fn(),
    onAddNewFilm: vi.fn(),
    onEditFilm: vi.fn(),
    onDeleteFilm: vi.fn(),
    onTogglePin: vi.fn(),
});

describe('FilmSelectionModal', () => {
    it('sem marcar várias, tocar escolhe a película e fecha', () => {
        const props = baseProps();
        render(<FilmSelectionModal {...props} />);

        fireEvent.click(screen.getByText('Blackout'));

        expect(props.onSelect).toHaveBeenCalledWith('Blackout');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('marca várias películas e gera uma opção para cada, na ordem marcada', () => {
        const props = baseProps();
        const onSelectMultiple = vi.fn();
        render(<FilmSelectionModal {...props} onSelectMultiple={onSelectMultiple} />);

        const confirm = screen.getByRole('button', { name: 'Marque as películas' });
        expect(confirm).toBeDisabled();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Carbono' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Suntek' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Blackout' }));
        // Desmarcar tira da lista.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Blackout' }));

        expect(screen.getByRole('checkbox', { name: 'Carbono' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('checkbox', { name: 'Blackout' })).toHaveAttribute('aria-checked', 'false');
        expect(props.onSelect).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Gerar 2 opções' }));

        expect(onSelectMultiple).toHaveBeenCalledWith(['Carbono', 'Suntek']);
    });
});
