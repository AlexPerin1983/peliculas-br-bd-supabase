import { fireEvent, render, screen } from '@testing-library/react';
import FilmListView from './FilmListView';
import { Film } from '../../types';

const films: Film[] = [
    {
        nome: 'G35',
        preco: 120,
        customFields: { __match_brand: '3M', __match_aliases: 'fumê 35' },
    },
    { nome: 'Blackout', preco: 150, pinned: true, pinnedAt: 10, espessura: 2, customFields: { Cor: 'Preto' } },
    { nome: 'G5', preco: 100 },
];

const baseProps = () => ({
    films,
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onTogglePin: vi.fn(),
    onSaveFilms: vi.fn().mockResolvedValue(undefined),
    onImportTable: vi.fn(),
    onDelete: vi.fn(),
    onOpenGallery: vi.fn(),
});

const cardTitles = () => screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent);

describe('FilmListView', () => {
    beforeEach(() => {
        window.localStorage.setItem('peliculas-view-mode', 'grid');
    });

    it('mostra as fixadas primeiro e o resto em ordem alfabética', () => {
        render(<FilmListView {...baseProps()} />);

        expect(cardTitles()).toEqual(['Blackout', 'G5', 'G35']);
    });

    it('não mostra os campos internos da IA nem "Detalhes" vazio', () => {
        render(<FilmListView {...baseProps()} />);

        expect(screen.queryByText(/__match/i)).not.toBeInTheDocument();
        expect(screen.queryByText('3M')).not.toBeInTheDocument();
        // Só a Blackout tem espessura e campo próprio para detalhar.
        expect(screen.getAllByRole('button', { name: /detalhes/i })).toHaveLength(1);
        expect(screen.getByText('Preto')).toBeInTheDocument();
    });

    it('fixa, desafixa e duplica direto do card', () => {
        const props = baseProps();
        render(<FilmListView {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Fixar G5 no topo' }));
        expect(props.onTogglePin).toHaveBeenCalledWith('G5');

        const unpin = screen.getByRole('button', { name: 'Desafixar Blackout' });
        expect(unpin).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(unpin);
        expect(props.onTogglePin).toHaveBeenCalledWith('Blackout');

        fireEvent.click(screen.getByRole('button', { name: 'Duplicar G35' }));
        expect(props.onDuplicate).toHaveBeenCalledWith(expect.objectContaining({ nome: 'G35' }));
    });

    it('tem as mesmas ações no modo lista', () => {
        window.localStorage.setItem('peliculas-view-mode', 'list');
        const props = baseProps();
        render(<FilmListView {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Duplicar G5' }));
        expect(props.onDuplicate).toHaveBeenCalledWith(expect.objectContaining({ nome: 'G5' }));
        expect(screen.queryByText(/__match/i)).not.toBeInTheDocument();
    });

    it('oferece importar a tabela do fornecedor, inclusive com o catálogo vazio', () => {
        const props = baseProps();
        const { unmount } = render(<FilmListView {...props} />);
        fireEvent.click(screen.getByRole('button', { name: 'Importar tabela' }));
        expect(props.onImportTable).toHaveBeenCalledTimes(1);
        unmount();

        const emptyProps = { ...baseProps(), films: [] };
        render(<FilmListView {...emptyProps} />);
        expect(screen.getByText('Cadastre sua primeira película')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Importar tabela/ }));
        expect(emptyProps.onImportTable).toHaveBeenCalledTimes(1);
    });
});
