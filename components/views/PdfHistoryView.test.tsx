import { fireEvent, render, screen, within } from '@testing-library/react';
import PdfHistoryView from './PdfHistoryView';
import { FeedbackProvider } from '../../src/contexts/FeedbackContext';
import { Agendamento, Client, SavedPDF } from '../../types';

const client: Client = {
    id: 1,
    nome: 'William',
    telefone: '',
    email: '',
    cpfCnpj: '',
};

const makePdf = (overrides: Partial<SavedPDF>): SavedPDF => ({
    id: overrides.id || 1,
    clienteId: 1,
    clientName: 'William',
    date: '2026-05-20T12:00:00.000Z',
    totalPreco: 0,
    totalM2: 1,
    nomeArquivo: `orcamento-${overrides.id || 1}.pdf`,
    status: 'pending',
    ...overrides,
});

const renderHistory = (
    pdfs: SavedPDF[],
    options: {
        clients?: Client[];
        agendamentos?: Agendamento[];
        googleReviewsLink?: string;
    } = {}
) => render(
    <FeedbackProvider>
        <PdfHistoryView
            pdfs={pdfs}
            clients={options.clients || [client]}
            agendamentos={options.agendamentos || []}
            films={[]}
            googleReviewsLink={options.googleReviewsLink}
            onDelete={vi.fn()}
            onDownload={vi.fn()}
            onUpdateStatus={vi.fn()}
            onSchedule={vi.fn()}
            onGenerateCombinedPdf={vi.fn()}
            onNavigateToOption={vi.fn()}
        />
    </FeedbackProvider>
);

describe('PdfHistoryView', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-23T12:00:00.000Z'));
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('calcula pipeline real por oportunidade sem somar alternativas do mesmo cliente', () => {
        renderHistory([
            makePdf({ id: 1, totalPreco: 1000, proposalOptionName: 'Opção 1' }),
            makePdf({ id: 2, totalPreco: 1500, proposalOptionName: 'Opção 2', status: 'approved' }),
            makePdf({ id: 3, totalPreco: 2000, proposalOptionName: 'Opção 3' }),
        ]);

        fireEvent.click(screen.getByRole('button', { name: /ver indicadores/i }));

        expect(screen.getAllByText('Pipeline real').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/R\$\s*1\.500,00/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/R\$\s*4\.500,00/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/R\$\s*3\.000,00 em alternativas/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/1 oportunidade \/ 3 opções/).length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /abrir filtro de data/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /pendentes:\s*2/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /aprovados:\s*1/i })).toBeInTheDocument();
    });

    it('mostra fila de avaliacao apenas para aprovados com contato e agenda ja vencida', () => {
        const clientWithPhone: Client = {
            ...client,
            telefone: '(83) 99999-0000',
        };
        const futureClient: Client = {
            id: 2,
            nome: 'Cliente Futuro',
            telefone: '(83) 98888-0000',
            email: '',
            cpfCnpj: '',
        };

        renderHistory(
            [
                makePdf({ id: 10, clienteId: 1, status: 'approved', proposalOptionName: 'Servico feito' }),
                makePdf({ id: 11, clienteId: 2, clientName: 'Cliente Futuro', status: 'approved', proposalOptionName: 'Servico futuro' }),
            ],
            {
                clients: [clientWithPhone, futureClient],
                googleReviewsLink: 'https://g.page/r/Ca0B0lo4FAFjEBM/review',
                agendamentos: [
                    {
                        id: 99,
                        pdfId: 11,
                        clienteId: 2,
                        clienteNome: 'Cliente Futuro',
                        start: '2026-05-24T12:00:00.000Z',
                        end: '2026-05-24T14:00:00.000Z',
                    }
                ],
            }
        );

        const panelTitle = screen.getByText('Fila de avaliacao');
        const panel = panelTitle.closest('section');

        expect(panel).not.toBeNull();
        expect(within(panel as HTMLElement).getByText('1 para pedir')).toBeInTheDocument();
        expect(within(panel as HTMLElement).getAllByText('William').length).toBeGreaterThan(0);
        expect(within(panel as HTMLElement).queryByText('Cliente Futuro')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /pendentes:\s*0/i }));

        expect(screen.queryByText('Fila de avaliacao')).not.toBeInTheDocument();
    });
});
