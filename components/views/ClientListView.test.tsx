import { fireEvent, render, screen } from '@testing-library/react';
import ClientListView from './ClientListView';
import { Client, SavedPDF } from '../../types';

const makeClient = (overrides: Partial<Client>): Client => ({
    id: 1,
    nome: 'Cliente',
    telefone: '',
    email: '',
    cpfCnpj: '',
    ...overrides,
});

const baseProps = () => ({
    clients: [
        makeClient({ id: 1, nome: 'Maria Souza', telefone: '11999990000' }),
        makeClient({ id: 2, nome: 'João Lima', telefone: '11888880000' }),
    ],
    pdfs: [] as SavedPDF[],
    isLoading: false,
    onOpenClient: vi.fn(),
    onAddClient: vi.fn(),
    onTogglePin: vi.fn(),
});

describe('ClientListView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lista os clientes e abre a ficha ao tocar', () => {
        const props = baseProps();
        render(<ClientListView {...props} />);

        expect(screen.getByText('Maria Souza')).toBeInTheDocument();
        expect(screen.getByText('João Lima')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Maria Souza'));
        expect(props.onOpenClient).toHaveBeenCalledWith(1);
    });

    it('filtra pela busca', () => {
        const props = baseProps();
        render(<ClientListView {...props} />);

        fireEvent.change(screen.getByPlaceholderText('Buscar cliente pelo nome...'), {
            target: { value: 'maria' },
        });

        expect(screen.getByText('Maria Souza')).toBeInTheDocument();
        expect(screen.queryByText('João Lima')).not.toBeInTheDocument();
    });

    it('fixar não abre a ficha', () => {
        const props = baseProps();
        render(<ClientListView {...props} />);

        fireEvent.click(screen.getAllByLabelText('Fixar cliente no topo')[0]);
        expect(props.onTogglePin).toHaveBeenCalled();
        expect(props.onOpenClient).not.toHaveBeenCalled();
    });

    it('mostra estado vazio e cria cliente', () => {
        const props = { ...baseProps(), clients: [] };
        render(<ClientListView {...props} />);

        expect(screen.getByText('Nenhum cliente ainda')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Adicionar cliente'));
        expect(props.onAddClient).toHaveBeenCalled();
    });

    it('busca a proxima pagina de clientes no servidor', () => {
        const props = {
            ...baseProps(),
            hasMoreServerClients: true,
            onLoadMoreClients: vi.fn().mockResolvedValue(undefined),
        };
        render(<ClientListView {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

        expect(props.onLoadMoreClients).toHaveBeenCalledTimes(1);
    });
});
