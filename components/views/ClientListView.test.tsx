import { fireEvent, render, screen, within } from '@testing-library/react';
import ClientListView from './ClientListView';
import { Agendamento, Client, SavedPDF } from '../../types';

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const makeClient = (overrides: Partial<Client>): Client => ({
    id: 1,
    nome: 'Cliente',
    telefone: '',
    email: '',
    cpfCnpj: '',
    ...overrides,
});

const makePdf = (overrides: Partial<SavedPDF>): SavedPDF => ({
    id: 1, clienteId: 1, date: ago(3), totalPreco: 1000, totalM2: 1, nomeArquivo: 'x.pdf', status: 'pending', proposalOptionId: 1, ...overrides,
});

const baseProps = () => ({
    clients: [
        makeClient({ id: 1, nome: 'Maria Souza', telefone: '11999990000' }),
        makeClient({ id: 2, nome: 'João Lima', telefone: '11888880000' }),
    ],
    pdfs: [] as SavedPDF[],
    agendamentos: [] as Agendamento[],
    isLoading: false,
    onOpenClient: vi.fn(),
    onAddClient: vi.fn(),
    onTogglePin: vi.fn(),
});

const names = () => screen.getAllByRole('listitem').map(item => within(item).getAllByRole('button')[0].textContent || '');

describe('ClientListView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lista os clientes e abre a ficha ao tocar', () => {
        const props = baseProps();
        render(<ClientListView {...props} />);

        expect(screen.getByText('Maria Souza')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Maria Souza'));
        expect(props.onOpenClient).toHaveBeenCalledWith(1);
    });

    it('busca por nome (sem acento) ou por telefone', () => {
        render(<ClientListView {...baseProps()} />);
        const search = screen.getByLabelText('Buscar cliente');

        fireEvent.change(search, { target: { value: 'joao' } });
        expect(screen.getByText('João Lima')).toBeInTheDocument();
        expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument();

        fireEvent.change(search, { target: { value: '99999' } });
        expect(screen.getByText('Maria Souza')).toBeInTheDocument();
        expect(screen.queryByText('João Lima')).not.toBeInTheDocument();
    });

    it('filtros: em negociação, clientes, para reativar e fixados', () => {
        render(<ClientListView {...baseProps()}
            clients={[
                makeClient({ id: 1, nome: 'Negociando', telefone: '11999990000' }),
                makeClient({ id: 2, nome: 'Fechado', telefone: '11888880000' }),
                makeClient({ id: 3, nome: 'Sumido', telefone: '11777770000', pinned: true }),
            ]}
            pdfs={[makePdf({ id: 1, clienteId: 1 }), makePdf({ id: 2, clienteId: 2, status: 'approved', proposalOptionId: 2 })]}
            agendamentos={[{ id: 9, clienteId: 3, clienteNome: 'Sumido', start: ago(200), end: ago(200), serviceStatus: 'completed' }]}
        />);

        const filters = screen.getByRole('group', { name: 'Filtrar clientes' });
        fireEvent.click(within(filters).getByRole('button', { name: 'Em negociação 1' }));
        expect(names()).toEqual([expect.stringContaining('Negociando')]);
        fireEvent.click(within(filters).getByRole('button', { name: 'Clientes 1' }));
        expect(names()).toEqual([expect.stringContaining('Fechado')]);
        fireEvent.click(within(filters).getByRole('button', { name: 'Para reativar 1' }));
        expect(names()).toEqual([expect.stringContaining('Sumido')]);
        fireEvent.click(within(filters).getByRole('button', { name: 'Fixados 1' }));
        expect(names()).toEqual([expect.stringContaining('Sumido')]);
    });

    it('mostra o estágio e o valor em aberto na linha', () => {
        render(<ClientListView {...baseProps()} pdfs={[makePdf({ clienteId: 1, totalPreco: 4200 })]} />);
        const row = screen.getByText('Maria Souza').closest('li')!;
        expect(within(row).getByText('Em negociação')).toBeInTheDocument();
        expect(within(row).getByText('R$ 4,2 mil em aberto')).toBeInTheDocument();
        expect(within(row).getByRole('link', { name: 'WhatsApp de Maria Souza' })).toHaveAttribute('href', 'https://wa.me/5511999990000');
    });

    it('ordena pela atividade mais recente (fixados primeiro) e muda a ordem', () => {
        render(<ClientListView {...baseProps()}
            clients={[
                makeClient({ id: 1, nome: 'Bruna', telefone: '1' }),
                makeClient({ id: 2, nome: 'Aline', telefone: '2' }),
                makeClient({ id: 3, nome: 'Carla', telefone: '3', pinned: true }),
            ]}
            pdfs={[makePdf({ clienteId: 1, date: ago(20) }), makePdf({ id: 2, clienteId: 2, date: ago(1), proposalOptionId: 2 })]}
        />);
        const order = () => names().map(name => ['Carla', 'Aline', 'Bruna'].find(first => name.includes(first)));
        expect(order()).toEqual(['Carla', 'Aline', 'Bruna']);

        // No celular, tocar na ordem alterna: atividade → nome → valor.
        fireEvent.click(screen.getByRole('button', { name: /Ordem: Atividade recente/ }));
        expect(order()).toEqual(['Carla', 'Aline', 'Bruna']);
        fireEvent.change(screen.getByLabelText('Ordenar clientes'), { target: { value: 'value' } });
        expect(order()).toEqual(['Carla', 'Bruna', 'Aline']);
    });

    it('fixar não abre a ficha', () => {
        const props = baseProps();
        render(<ClientListView {...props} />);

        fireEvent.click(screen.getAllByLabelText('Fixar cliente no topo')[0]);
        expect(props.onTogglePin).toHaveBeenCalled();
        expect(props.onOpenClient).not.toHaveBeenCalled();
    });

    it('mostra estado vazio e cria cliente (também pelo menu)', () => {
        const props = { ...baseProps(), clients: [] };
        render(<ClientListView {...props} />);

        expect(screen.getByText('Nenhum cliente ainda')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Adicionar cliente'));
        fireEvent.click(within(screen.getByRole('navigation', { name: 'Menu dos clientes' })).getByRole('button', { name: 'Novo cliente' }));
        expect(props.onAddClient).toHaveBeenCalledTimes(2);
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
