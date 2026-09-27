import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClientHubView from './ClientHubView';
import { Agendamento, Client, SavedPDF } from '../../types';
import { loadCompanyProposalPortals, type CompanyProposalPortal } from '../../src/lib/proposalPortal';
import { getClientFollowUps, getClientNotes, recordClientFollowUp, saveClientNotes } from '../../services/supabaseDb';

vi.mock('../../src/lib/proposalPortal', async importOriginal => ({
    ...(await importOriginal<typeof import('../../src/lib/proposalPortal')>()),
    loadCompanyProposalPortals: vi.fn(),
}));

vi.mock('../../services/supabaseDb', async importOriginal => ({
    ...(await importOriginal<typeof import('../../services/supabaseDb')>()),
    getClientNotes: vi.fn(),
    saveClientNotes: vi.fn(),
    getClientFollowUps: vi.fn(),
    recordClientFollowUp: vi.fn(),
}));

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const client: Client = {
    id: 1,
    nome: 'William Silva',
    telefone: '11999998888',
    email: 'william@exemplo.com',
    cpfCnpj: '',
    logradouro: 'Rua das Flores',
    numero: '12',
    cidade: 'São Paulo',
    uf: 'SP',
};

const makePdf = (overrides: Partial<SavedPDF>): SavedPDF => ({
    id: overrides.id ?? 1,
    clienteId: 1,
    clientName: 'William Silva',
    date: ago(3),
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
    start: ago(-3),
    end: ago(-3),
    serviceStatus: 'scheduled',
    ...overrides,
});

const portal = (overrides: Partial<CompanyProposalPortal> = {}): CompanyProposalPortal => ({
    id: 'p1', token: 'tok', clientId: 1, clientName: 'William Silva', expiresAt: ago(-10), status: 'active', lastActivityAt: ago(1),
    viewCount: 3, proposals: [{ id: 10, name: 'Opção A', total: 1500 }], messages: [], unreadCount: 0, createdAt: ago(2), followUps: [], ...overrides,
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
    onSchedule: vi.fn(),
    onOpenProposals: vi.fn(),
    onTogglePin: vi.fn(),
});

const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

describe('ClientHubView (ficha do cliente)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(loadCompanyProposalPortals).mockResolvedValue([]);
        vi.mocked(getClientNotes).mockResolvedValue('');
        vi.mocked(saveClientNotes).mockResolvedValue(undefined);
        vi.mocked(getClientFollowUps).mockResolvedValue([]);
        vi.mocked(recordClientFollowUp).mockResolvedValue(undefined);
    });

    it('cabeçalho com estágio, ações rápidas e números do cliente', async () => {
        render(<ClientHubView {...baseProps()} pdfs={[
            makePdf({ id: 10, totalPreco: 1500, status: 'approved', proposalOptionId: 99, proposalOptionName: 'Opção A' }),
            makePdf({ id: 11, clienteId: 2, proposalOptionName: 'De outro cliente' }),
        ]} agendamentos={[makeAgendamento({ id: 2, start: ago(1), serviceStatus: 'completed', pdfIds: [10] })]} />);

        const hero = screen.getByRole('region', { name: 'Cliente' });
        expect(within(hero).getByText('William Silva')).toBeInTheDocument();
        expect(within(hero).getByText('Cliente')).toBeInTheDocument();
        expect(within(hero).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/5511999998888');
        expect(within(hero).getByRole('link', { name: 'Ligar' })).toHaveAttribute('href', 'tel:+5511999998888');
        expect(within(hero).getByRole('link', { name: 'Rota' }).getAttribute('href')).toContain('google.com/maps/dir');
        expect(within(hero).getByRole('link', { name: 'E-mail' })).toHaveAttribute('href', 'mailto:william@exemplo.com');
        expect(within(hero).getByText('R$ 1,5 mil')).toBeInTheDocument();
        await waitFor(() => expect(loadCompanyProposalPortals).toHaveBeenCalledWith({ clientId: 1 }));
    });

    it('próximo passo: aprovou e falta agendar', () => {
        const approved = makePdf({ id: 10, totalPreco: 1500, status: 'approved', proposalOptionId: 99, proposalOptionName: 'Opção A' });
        const props = { ...baseProps(), pdfs: [approved] };
        render(<ClientHubView {...props} />);

        const step = screen.getByRole('region', { name: 'Próximo passo' });
        expect(within(step).getByText('Aprovou, falta agendar')).toBeInTheDocument();
        fireEvent.click(within(step).getByRole('button', { name: /Agendar instalação/ }));
        expect(props.onSchedule).toHaveBeenCalledWith({ pdf: approved });
    });

    it('orçamentos agrupados por opção: versões, abrir, status e PDF', async () => {
        let finishDownload: (started: boolean) => void = () => undefined;
        const props = {
            ...baseProps(),
            pdfs: [
                makePdf({ id: 10, date: ago(10), totalPreco: 1400, proposalOptionId: 99, proposalOptionName: 'Opção A' }),
                makePdf({ id: 12, date: ago(2), totalPreco: 1500, proposalOptionId: 99, proposalOptionName: 'Opção A' }),
                makePdf({ id: 13, totalPreco: 800, proposalOptionId: 100, proposalOptionName: 'Opção B' }),
            ],
            onDownloadPdf: vi.fn().mockReturnValue(new Promise<boolean>(resolve => { finishDownload = resolve; })),
        };
        render(<ClientHubView {...props} />);
        openTab(/Orçamentos/);

        expect(screen.getAllByRole('article')).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: /2 versões/ }));
        expect(within(screen.getByRole('list', { name: 'Versões de Opção A' })).getAllByRole('listitem')).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: 'Abrir Opção A' }));
        expect(props.onNavigateToOption).toHaveBeenCalledWith(1, 99);

        fireEvent.click(screen.getAllByRole('button', { name: 'Situação: Pendente' })[0]);
        fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Aprovado' }));
        expect(props.onUpdatePdfStatus).toHaveBeenCalledWith(12, 'approved');

        fireEvent.click(screen.getAllByRole('button', { name: 'Baixar PDF' })[0]);
        expect(props.onDownloadPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }), 'orcamento-12.pdf');
        expect(screen.getByText('Preparando PDF…')).toBeInTheDocument();
        finishDownload(true);
        await waitFor(() => expect(screen.getByText('Download iniciado')).toBeInTheDocument());
    });

    it('link da proposta: mostra o que o cliente fez e abre no Propostas', async () => {
        vi.mocked(loadCompanyProposalPortals).mockResolvedValue([portal()]);
        const props = { ...baseProps(), pdfs: [makePdf({ id: 10, totalPreco: 1500, proposalOptionId: 99, proposalOptionName: 'Opção A' })] };
        render(<ClientHubView {...props} />);

        const step = screen.getByRole('region', { name: 'Próximo passo' });
        await waitFor(() => expect(within(step).getByText('Abriu o link 3 vezes')).toBeInTheDocument());
        fireEvent.click(within(step).getByRole('button', { name: /Acompanhar/ }));
        expect(props.onOpenProposals).toHaveBeenCalledWith('p1');

        openTab(/Orçamentos/);
        fireEvent.click(screen.getByRole('button', { name: /Abriu o link 3 vezes/ }));
        expect(props.onOpenProposals).toHaveBeenCalledTimes(2);
    });

    it('serviços: próximos e histórico, agendar e abrir', () => {
        const upcoming = makeAgendamento({ id: 1, start: ago(-20) });
        const done = makeAgendamento({ id: 2, start: ago(30), serviceStatus: 'completed', valorFinal: 900 });
        const props = { ...baseProps(), agendamentos: [upcoming, done] };
        render(<ClientHubView {...props} />);
        openTab(/Serviços/);

        expect(within(screen.getByRole('region', { name: 'Próximos serviços' })).getByText('Agendado')).toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: 'Histórico de serviços' })).getByText('Concluído')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Agendar serviço/ }));
        expect(props.onSchedule).toHaveBeenCalledWith({ agendamento: { clienteId: 1, clienteNome: 'William Silva' } });

        fireEvent.click(within(screen.getByRole('region', { name: 'Histórico de serviços' })).getByRole('button'));
        expect(props.onEditAgendamento).toHaveBeenCalledWith(done);
    });

    it('observações: carrega, edita e salva', async () => {
        vi.mocked(getClientNotes).mockResolvedValue('Portão azul');
        render(<ClientHubView {...baseProps()} />);

        const notes = await screen.findByDisplayValue('Portão azul');
        fireEvent.change(notes, { target: { value: 'Portão azul, falar com o Sr. João' } });
        fireEvent.click(screen.getByRole('button', { name: /Salvar observações/ }));
        await waitFor(() => expect(saveClientNotes).toHaveBeenCalledWith(1, 'Portão azul, falar com o Sr. João'));
        expect(await screen.findByText('Salvo')).toBeInTheDocument();
    });

    it('dados: endereço, adicionar o que falta e fixar no topo', () => {
        const props = baseProps();
        render(<ClientHubView {...props} client={{ ...client, cpfCnpj: '' }} />);
        openTab(/Dados/);

        const details = screen.getAllByRole('region', { name: 'Dados do cliente' })[0];
        expect(within(details).getByText('Rua das Flores, 12, São Paulo - SP')).toBeInTheDocument();
        fireEvent.click(within(details).getByRole('button', { name: 'Adicionar' }));
        expect(props.onEditClient).toHaveBeenCalled();
        fireEvent.click(within(details).getByRole('button', { name: /Fixar no topo/ }));
        expect(props.onTogglePin).toHaveBeenCalledWith(1);
    });

    it('pós-venda: pede avaliação no Google pelo WhatsApp e registra o pedido', async () => {
        const done = makeAgendamento({ id: 7, start: ago(2), end: ago(2), serviceStatus: 'completed' });
        render(<ClientHubView {...baseProps()} agendamentos={[done]} googleReviewsLink="https://g.page/r/abc/review" companyPhone="(83) 99999-0000" />);

        const step = screen.getByRole('region', { name: 'Próximo passo' });
        expect(within(step).getByText('Serviço concluído: peça a avaliação')).toBeInTheDocument();
        fireEvent.click(within(step).getByRole('button', { name: /Pedir avaliação/ }));

        const sheet = await screen.findByRole('dialog', { name: 'Pedir avaliação no Google' });
        expect((within(sheet).getByLabelText('Mensagem do pós-venda') as HTMLTextAreaElement).value).toContain('https://g.page/r/abc/review');
        const link = within(sheet).getByRole('link', { name: /Enviar no WhatsApp/ });
        expect(decodeURIComponent(link.getAttribute('href') || '')).toContain('https://wa.me/5511999998888?text=');
        fireEvent.click(link);
        await waitFor(() => expect(recordClientFollowUp).toHaveBeenCalledWith(1, 'review_request', { agendamentoId: 7, channel: 'whatsapp' }));
        expect(getClientFollowUps).toHaveBeenCalledTimes(2);
    });

    it('pós-venda: na aba Serviços, pede indicação com o contato da empresa', async () => {
        const done = makeAgendamento({ id: 7, start: ago(20), end: ago(20), serviceStatus: 'completed' });
        vi.mocked(getClientFollowUps).mockResolvedValue([{ id: 1, kind: 'review_request', createdAt: ago(15) }]);
        render(<ClientHubView {...baseProps()} agendamentos={[done]} companyPhone="(83) 99999-0000" />);

        await waitFor(() => expect(screen.getByRole('region', { name: 'Próximo passo' })).toHaveTextContent('Peça uma indicação'));
        openTab(/Serviços/);
        const card = screen.getByRole('region', { name: 'Pós-venda' });
        expect(within(card).getByText(/pedida há 15 dias/)).toBeInTheDocument();
        fireEvent.click(within(card).getByRole('button', { name: /Pedir indicação/ }));
        const sheet = await screen.findByRole('dialog', { name: 'Pedir indicação' });
        expect((within(sheet).getByLabelText('Mensagem do pós-venda') as HTMLTextAreaElement).value).toContain('(83) 99999-0000');
    });

    it('sem orçamento: sugere começar e cria o primeiro', () => {
        const props = baseProps();
        render(<ClientHubView {...props} />);

        expect(screen.getByText('Comece pelo orçamento')).toBeInTheDocument();
        openTab(/Orçamentos/);
        fireEvent.click(screen.getByText('Criar primeiro orçamento'));
        expect(props.onNewProposal).toHaveBeenCalled();
    });

    it('mostra fallback quando não há cliente selecionado', () => {
        render(<ClientHubView {...baseProps()} client={null} />);
        expect(screen.getByText('Nenhum cliente selecionado')).toBeInTheDocument();
    });
});
