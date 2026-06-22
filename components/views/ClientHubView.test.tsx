import { fireEvent, render, screen } from '@testing-library/react';
import ClientHubView from './ClientHubView';
import { Agendamento, Client, SavedPDF } from '../../types';

const client: Client = {
    id: 1,
    nome: 'William Silva',
    telefone: '11999998888',
    email: '',
    cpfCnpj: '',
    cidade: 'São Paulo',
    uf: 'SP',
};

const makePdf = (overrides: Partial<SavedPDF>): SavedPDF => ({
    id: overrides.id ?? 1,
    clienteId: 1,
    clientName: 'William Silva',
    date: '2026-05-20T12:00:00.000Z',
    totalPreco: 0,
    totalM2: 1,
    nomeArquivo: `orcamento-${overrides.id ?? 1}.pdf`,
    status: 'pending',
    ...overrides,
});

const makeAgendamento = (overrides: Partial<Agendamento>): Agendamento => ({
    id: 1,
    clienteId: 1,
    clienteNome: 'William Silva',
    start: '2026-07-01T13:00:00.000Z',
    end: '2026-07-01T15:00:00.000Z',
    serviceStatus: 'scheduled',
    ...overrides,
});

const baseProps = () => ({
    client,
    pdfs: [] as SavedPDF[],
    agendamentos: [] as Agendamento[],
    onNavigateToOption: vi.fn(),
    onDownloadPdf: vi.fn(),
    onUpdatePdfStatus: vi.fn(),
    onEditAgendamento: vi.fn(),
    onEditClient: vi.fn(),
    onNewProposal: vi.fn(),
    onBack: vi.fn(),
});

describe('ClientHubView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mostra a ficha com cabeçalho, orçamentos e agendamentos do cliente', () => {
        const props = {
            ...baseProps(),
            pdfs: [
                makePdf({ id: 10, totalPreco: 1500, status: 'approved', proposalOptionId: 99, proposalOptionName: 'Opção A' }),
                makePdf({ id: 11, clienteId: 2, proposalOptionName: 'De outro cliente' }),
            ],
            agendamentos: [makeAgendamento({})],
        };

        render(<ClientHubView {...props} />);

        expect(screen.getByText('William Silva')).toBeInTheDocument();
        expect(screen.getByText('Opção A')).toBeInTheDocument();
        // Valor formatado em BRL (card do orçamento e total aprovado).
        expect(screen.getAllByText((content) => content.includes('1.500,00')).length).toBeGreaterThan(0);
        // Só conta o orçamento deste cliente, não o do clienteId 2.
        expect(screen.queryByText('De outro cliente')).not.toBeInTheDocument();
        // Status do agendamento.
        expect(screen.getByText('Agendado')).toBeInTheDocument();
    });

    it('navega para a opção ao clicar em Abrir', () => {
        const props = {
            ...baseProps(),
            pdfs: [makePdf({ id: 10, totalPreco: 1500, proposalOptionId: 99, proposalOptionName: 'Opção A' })],
        };

        render(<ClientHubView {...props} />);
        fireEvent.click(screen.getByText('Abrir'));

        expect(props.onNavigateToOption).toHaveBeenCalledWith(1, 99);
    });

    it('mostra estado vazio e cria novo orçamento', () => {
        const props = baseProps();
        render(<ClientHubView {...props} />);

        expect(screen.getByText('Nenhum orçamento ainda')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Criar primeiro orçamento'));
        expect(props.onNewProposal).toHaveBeenCalled();
    });

    it('mostra fallback quando não há cliente selecionado', () => {
        const props = { ...baseProps(), client: null };
        render(<ClientHubView {...props} />);
        expect(screen.getByText('Nenhum cliente selecionado')).toBeInTheDocument();
    });
});
