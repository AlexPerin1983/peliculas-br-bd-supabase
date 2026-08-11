import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
        hasMoreServerPdfs?: boolean;
        onLoadMoreServerPdfs?: () => Promise<void>;
        onOpenInAgenda?: (agendamento: Agendamento) => void;
        onDeleteMany?: (pdfIds: number[]) => Promise<void>;
    } = {}
) => render(
    <FeedbackProvider>
        <PdfHistoryView
            pdfs={pdfs}
            clients={options.clients || [client]}
            agendamentos={options.agendamentos || []}
            films={[]}
            googleReviewsLink={options.googleReviewsLink}
            hasMoreServerPdfs={options.hasMoreServerPdfs}
            onLoadMoreServerPdfs={options.onLoadMoreServerPdfs}
            onDelete={vi.fn()}
            onDeleteMany={options.onDeleteMany || vi.fn().mockResolvedValue(undefined)}
            onDownload={vi.fn()}
            onUpdateStatus={vi.fn()}
            onSchedule={vi.fn()}
            onOpenInAgenda={options.onOpenInAgenda || vi.fn()}
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
        vi.stubGlobal('ResizeObserver', class {
            observe() {}
            unobserve() {}
            disconnect() {}
        });
    });
    it('abre diretamente na agenda uma proposta aprovada que ja esta agendada', () => {
        const onOpenInAgenda = vi.fn();
        const agendamento: Agendamento = {
            id: 77,
            pdfId: 30,
            clienteId: 1,
            clienteNome: 'William',
            start: '2026-05-25T18:00:00.000Z',
            end: '2026-05-25T20:00:00.000Z',
        };

        renderHistory(
            [
                makePdf({
                    id: 30,
                    status: 'approved',
                    proposalOptionName: 'Proposta agendada',
                }),
                makePdf({
                    id: 31,
                    status: 'approved',
                    proposalOptionName: 'Proposta sem agenda',
                }),
            ],
            {
                agendamentos: [agendamento],
                onOpenInAgenda,
            }
        );

        const shortcut = screen.getByRole('button', { name: 'Abrir agendamento na agenda' });
        fireEvent.click(shortcut);

        expect(onOpenInAgenda).toHaveBeenCalledTimes(1);
        expect(onOpenInAgenda).toHaveBeenCalledWith(agendamento);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
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

    it('busca a proxima pagina no servidor ao clicar em Carregar mais', () => {
        const onLoadMoreServerPdfs = vi.fn().mockResolvedValue(undefined);
        renderHistory([makePdf({ id: 20 })], {
            hasMoreServerPdfs: true,
            onLoadMoreServerPdfs,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

        expect(onLoadMoreServerPdfs).toHaveBeenCalledTimes(1);
    });

    it('mostra orcamentos pelo nome salvo no PDF enquanto os clientes ainda carregam', () => {
        renderHistory(
            [makePdf({ id: 35, clientName: 'Cliente do PDF', proposalOptionName: 'Opção recuperada' })],
            { clients: [] }
        );

        expect(screen.getAllByText('Cliente do PDF').length).toBeGreaterThan(0);
        expect(screen.queryByText('Nenhum orçamento neste período')).not.toBeInTheDocument();
    });

    it('mantem a busca visivel e encontra cliente por telefone sem pontuacao', () => {
        const secondClient: Client = {
            id: 2,
            nome: 'Mariana Costa',
            telefone: '(83) 98888-1234',
            email: 'mariana@example.com',
            cpfCnpj: '',
        };

        renderHistory(
            [
                makePdf({ id: 36 }),
                makePdf({ id: 37, clienteId: 2, clientName: secondClient.nome, proposalOptionName: 'Fachada comercial' }),
            ],
            { clients: [client, secondClient] }
        );

        const search = screen.getByRole('searchbox', { name: 'Buscar no histórico' });
        expect(search).toBeVisible();

        fireEvent.change(search, { target: { value: '83988881234' } });

        expect(screen.getAllByText('Mariana Costa').length).toBeGreaterThan(0);
        expect(screen.queryByText('William')).not.toBeInTheDocument();
        expect(screen.getByText('1 cliente encontrado')).toBeInTheDocument();
    });

    it('organiza os clientes por maior valor', () => {
        const secondClient: Client = {
            id: 2,
            nome: 'Ana Beatriz',
            telefone: '',
            email: '',
            cpfCnpj: '',
        };
        const { container } = renderHistory(
            [
                makePdf({ id: 38, totalPreco: 900 }),
                makePdf({ id: 39, clienteId: 2, clientName: secondClient.nome, totalPreco: 5200 }),
            ],
            { clients: [client, secondClient] }
        );

        fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar histórico' }), {
            target: { value: 'highest' },
        });

        const clientHeadings = Array.from(container.querySelectorAll('h3')).map(heading => heading.textContent);
        expect(clientHeadings.slice(0, 2)).toEqual(['Ana Beatriz', 'William']);
    });

    it('oferece criar link e exclusao em massa dentro das opcoes no mobile', async () => {
        const onDeleteMany = vi.fn().mockResolvedValue(undefined);
        renderHistory(
            [
                makePdf({ id: 40, proposalOptionName: 'Opção 1' }),
                makePdf({ id: 41, proposalOptionName: 'Opção 2' }),
            ],
            { onDeleteMany }
        );

        fireEvent.click(screen.getByRole('button', { name: /William/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Selecionar todas as opções' }));

        expect(screen.getByRole('button', { name: 'Criar link' })).toBeInTheDocument();
        expect(screen.getAllByText('2 selecionados').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Excluir 2' }));
            await Promise.resolve();
        });

        expect(onDeleteMany).toHaveBeenCalledWith([40, 41]);
    });

    it('mantem o botao de voltar das opcoes abaixo da area nativa do iPhone', () => {
        renderHistory([
            makePdf({ id: 42, proposalOptionName: 'Opção protegida' }),
        ]);

        fireEvent.click(screen.getByRole('button', { name: /William/i }));

        const optionsDialog = screen.getByRole('dialog', { name: 'Opções de William' });
        expect(optionsDialog).toHaveClass('pt-[env(safe-area-inset-top,0px)]');
        const closeButton = within(optionsDialog).getByRole('button', { name: 'Fechar' });
        expect(closeButton).toHaveClass('h-11', 'w-11', 'touch-manipulation');
    });

    it('mantem o resumo financeiro abaixo da area nativa do iPhone', () => {
        renderHistory([
            makePdf({ id: 43, proposalOptionName: 'Opção do resumo' }),
        ]);

        fireEvent.click(screen.getByRole('button', { name: /Resumo do periodo/i }));

        const summaryDialog = screen.getByRole('dialog', { name: 'Resumo do periodo' });
        expect(summaryDialog).toHaveClass('pt-[env(safe-area-inset-top,0px)]');
        const closeButton = within(summaryDialog).getByRole('button', {
            name: 'Fechar resumo do periodo',
        });
        expect(closeButton).toHaveClass('h-11', 'w-11', 'touch-manipulation');
    });
});
