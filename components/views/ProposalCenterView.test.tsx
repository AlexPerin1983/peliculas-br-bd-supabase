import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyProposalPortal } from '../../src/lib/proposalPortal';
import {
    loadCompanyProposalPortals,
    markCompanyProposalPortalRead,
    markProposalPortalLost,
    recordProposalFollowUp,
    reopenProposalPortal,
    sendCompanyProposalMessage,
    setProposalOfferDeadline,
    snoozeProposalFollowUp,
} from '../../src/lib/proposalPortal';
import { deleteProposalMessageTemplate, getClientById, getFollowUpMessageTemplates, getSavedPdfById, saveFollowUpMessageTemplate } from '../../services/supabaseDb';
import { applyProposalFollowUp } from '../../services/proposalFollowUp';
import { consumeBackButton } from '../../src/lib/backButton';
import ProposalCenterView from './ProposalCenterView';

vi.mock('../../services/supabaseClient', async importOriginal => {
    const actual = await importOriginal<typeof import('../../services/supabaseClient')>();
    const channel: any = { on: () => channel, subscribe: () => channel };
    Object.assign(actual.supabase, { channel: () => channel, removeChannel: async () => undefined });
    return actual;
});

vi.mock('../../src/lib/proposalPortal', async importOriginal => ({
    ...(await importOriginal<typeof import('../../src/lib/proposalPortal')>()),
    loadCompanyProposalPortals: vi.fn(),
    recordProposalFollowUp: vi.fn(),
    markProposalPortalLost: vi.fn(),
    reopenProposalPortal: vi.fn(),
    markCompanyProposalPortalRead: vi.fn(),
    sendCompanyProposalMessage: vi.fn(),
    snoozeProposalFollowUp: vi.fn(),
    setProposalOfferDeadline: vi.fn(),
}));

vi.mock('../../services/proposalFollowUp', () => ({ applyProposalFollowUp: vi.fn() }));

vi.mock('../../services/supabaseDb', () => ({
    getFollowUpMessageTemplates: vi.fn(),
    saveFollowUpMessageTemplate: vi.fn(),
    deleteProposalMessageTemplate: vi.fn(),
    getSavedPdfById: vi.fn(),
    getClientById: vi.fn(),
}));

vi.mock('./AgendaPushReminderControl', () => ({ default: () => null }));

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

let nextClient = 100;
const portal = (overrides: Partial<CompanyProposalPortal> = {}): CompanyProposalPortal => ({
    id: 'p1',
    token: 'tok123',
    clientId: 1,
    clientName: 'Carlos Lima',
    clientPhone: '(85) 99999-1234',
    expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
    status: 'active',
    lastActivityAt: ago(4),
    viewCount: 4,
    firstViewedAt: ago(3),
    lastViewedAt: ago(1),
    proposals: [{ id: 10, name: 'Opção 1', total: 365 }],
    messages: [],
    unreadCount: 0,
    createdAt: ago(4),
    followUps: [],
    ...overrides,
});
// Outro cliente (cada um vira uma linha).
const other = (id: string, clientName: string, overrides: Partial<CompanyProposalPortal> = {}) =>
    portal({ id, token: `t-${id}`, clientId: nextClient++, clientName, ...overrides });

const setup = async (portals: CompanyProposalPortal[]) => {
    vi.mocked(loadCompanyProposalPortals).mockResolvedValue(portals);
    const onOpenHistory = vi.fn();
    render(<ProposalCenterView onOpenHistory={onOpenHistory} />);
    await screen.findByRole('tab', { name: /^Hoje/ });
    await waitFor(() => expect(screen.queryByText('Carregando…')).not.toBeInTheDocument());
    return { onOpenHistory };
};

const openClient = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
    return screen.getByRole('dialog', { name: `Proposta de ${name}` });
};

const hrefText = (element: HTMLElement) => decodeURIComponent(element.getAttribute('href') || '');

describe('Central de propostas', () => {
    beforeEach(() => {
        nextClient = 100;
        window.history.replaceState(null, '', '/');
        vi.mocked(recordProposalFollowUp).mockReset().mockResolvedValue(undefined);
        vi.mocked(markProposalPortalLost).mockReset().mockResolvedValue(undefined);
        vi.mocked(reopenProposalPortal).mockReset().mockResolvedValue(undefined);
        vi.mocked(markCompanyProposalPortalRead).mockReset().mockResolvedValue(undefined);
        vi.mocked(sendCompanyProposalMessage).mockReset().mockResolvedValue(undefined);
        vi.mocked(snoozeProposalFollowUp).mockReset().mockResolvedValue(undefined);
        vi.mocked(setProposalOfferDeadline).mockReset().mockResolvedValue(undefined);
        vi.mocked(getFollowUpMessageTemplates).mockReset().mockResolvedValue([]);
        vi.mocked(saveFollowUpMessageTemplate).mockReset();
        vi.mocked(deleteProposalMessageTemplate).mockReset().mockResolvedValue(undefined);
    });

    it('uma linha por cliente: links repetidos viram "outros links" na ficha', async () => {
        await setup([
            portal({ id: 'old', token: 'old', createdAt: ago(20), lastActivityAt: ago(20), lastViewedAt: ago(19) }),
            portal(),
        ]);

        expect(screen.getAllByRole('button', { name: /^Carlos Lima/ })).toHaveLength(1);
        const sheet = openClient('Carlos Lima');
        expect(within(sheet).getByText('Outros links deste cliente (1)')).toBeInTheDocument();
        fireEvent.click(within(sheet).getByRole('button', { name: 'Ver' }));
        expect(within(sheet).getByText(/Você está vendo um link anterior/)).toBeInTheDocument();
    });

    it('WhatsApp direto na linha, com a mensagem e o mesmo link', async () => {
        await setup([portal()]);

        const link = screen.getByRole('link', { name: 'WhatsApp para Carlos Lima' });
        expect(hrefText(link)).toContain('https://wa.me/5585999991234');
        expect(hrefText(link)).toContain('Oi, Carlos!');
        expect(hrefText(link)).toContain('/p/carlos/tok123');
        fireEvent.click(link);
        await waitFor(() => expect(recordProposalFollowUp).toHaveBeenCalledWith('p1', 'hot', 'whatsapp'));
    });

    it('ficha: edita e troca a mensagem, registra ligação e marca como perdida', async () => {
        await setup([portal()]);
        const sheet = openClient('Carlos Lima');

        expect(within(sheet).getByText('Abriu 4 vezes e não respondeu')).toBeInTheDocument();
        fireEvent.click(within(sheet).getByRole('button', { name: /Editar/ }));
        fireEvent.change(within(sheet).getByLabelText('Mensagem para Carlos Lima'), { target: { value: 'Carlos, fechamos por R$ 340?' } });
        expect(hrefText(within(sheet).getByRole('link', { name: /Enviar no WhatsApp/ }))).toContain('Carlos, fechamos por R$ 340?');
        fireEvent.change(within(sheet).getByLabelText('Trocar mensagem'), { target: { value: 'value:principal' } });
        expect(hrefText(within(sheet).getByRole('link', { name: /Enviar no WhatsApp/ }))).toContain('O que achou da proposta das películas?');
        // Variação com a pergunta do "não".
        fireEvent.change(within(sheet).getByLabelText('Trocar mensagem'), { target: { value: 'hot:nao' } });
        expect(hrefText(within(sheet).getByRole('link', { name: /Enviar no WhatsApp/ }))).toContain('A proposta ficou acima do que você esperava?');
        // Dica de negociação da situação.
        fireEvent.click(within(sheet).getByRole('button', { name: /Dica de negociação: Nomeie a dúvida/ }));
        expect(within(sheet).getByText(/parece que o valor pesou/)).toBeInTheDocument();

        fireEvent.click(within(sheet).getByRole('button', { name: /Já falei/ }));
        await waitFor(() => expect(recordProposalFollowUp).toHaveBeenCalledWith('p1', 'hot', 'call'));

        fireEvent.click(within(sheet).getByRole('button', { name: /Perdida/ }));
        expect(within(sheet).getByRole('button', { name: 'Marcar como perdida' })).toBeDisabled();
        fireEvent.click(within(within(sheet).getByRole('group', { name: 'Motivo da perda' })).getByRole('button', { name: 'Preço' }));
        fireEvent.change(within(sheet).getByLabelText('Observação da perda'), { target: { value: 'achou caro' } });
        fireEvent.click(within(sheet).getByRole('button', { name: 'Marcar como perdida' }));
        await waitFor(() => expect(markProposalPortalLost).toHaveBeenCalledWith('p1', 'price', 'achou caro'));
    });

    it('ficha: conversa no link, marca como lida e responde', async () => {
        await setup([portal({ unreadCount: 1, messages: [{ id: 1, sender_type: 'client', kind: 'message', body: 'Tem desconto?', created_at: ago(0.1) }] })]);

        expect(screen.getByText('“Tem desconto?”')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Responder Carlos Lima' }));
        const sheet = screen.getByRole('dialog', { name: 'Proposta de Carlos Lima' });
        await waitFor(() => expect(markCompanyProposalPortalRead).toHaveBeenCalledWith('p1'));
        expect(within(sheet).getByRole('region', { name: 'Conversa no link' })).toHaveTextContent('Tem desconto?');

        fireEvent.change(within(sheet).getByLabelText('Responder no link da proposta'), { target: { value: 'Faço 5% à vista.' } });
        fireEvent.click(within(sheet).getByRole('button', { name: 'Enviar resposta' }));
        await waitFor(() => expect(sendCompanyProposalMessage).toHaveBeenCalledWith('p1', 'Faço 5% à vista.'));
    });

    it('ficha: lembrar depois guarda a data escolhida (às 9h) e a anotação', async () => {
        await setup([portal()]);
        const sheet = openClient('Carlos Lima');

        fireEvent.click(within(sheet).getByRole('button', { name: /Lembrar depois/ }));
        fireEvent.click(within(within(sheet).getByRole('group', { name: 'Quando lembrar' })).getByRole('button', { name: 'Em 3 dias' }));
        fireEvent.change(within(sheet).getByLabelText('Anotação do lembrete'), { target: { value: 'depois do dia 10' } });
        fireEvent.click(within(sheet).getByRole('button', { name: 'Salvar lembrete' }));

        await waitFor(() => expect(snoozeProposalFollowUp).toHaveBeenCalledWith('p1', 'hot', expect.any(Date), 'depois do dia 10'));
        const remindAt = vi.mocked(snoozeProposalFollowUp).mock.calls[0][2] as Date;
        expect(remindAt.getHours()).toBe(9);
        expect(Math.round((remindAt.getTime() - Date.now()) / 86_400_000)).toBeGreaterThanOrEqual(2);
    });

    it('ficha: oferece condição especial com prazo e manda no WhatsApp', async () => {
        vi.mocked(getSavedPdfById).mockResolvedValue({ id: 10, clienteId: 1, date: ago(4), totalPreco: 1000, totalM2: 5, nomeArquivo: 'p.pdf' });
        vi.mocked(getClientById).mockResolvedValue({ id: 1, nome: 'Carlos Lima', telefone: '(85) 99999-1234', email: '', cpfCnpj: '' });
        vi.mocked(applyProposalFollowUp).mockReset().mockResolvedValue({} as never);
        await setup([portal()]);
        const sheet = openClient('Carlos Lima');

        fireEvent.click(within(sheet).getByRole('button', { name: /Oferecer condição/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Condição especial' });
        await waitFor(() => expect(within(dialog).getByText((content) => content.replace(/\s/g, ' ') === 'R$ 900,00')).toBeInTheDocument());
        fireEvent.click(within(within(dialog).getByRole('group', { name: 'Prazo da condição' })).getByRole('button', { name: '3 dias' }));
        fireEvent.click(within(dialog).getByRole('button', { name: /Aplicar condição/ }));

        await waitFor(() => expect(applyProposalFollowUp).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }), expect.objectContaining({ id: 1 }), '10', 'percentage'));
        expect(setProposalOfferDeadline).toHaveBeenCalledWith('p1', expect.any(Date), expect.stringContaining('10%'));
        const deadline = vi.mocked(setProposalOfferDeadline).mock.calls[0][1] as Date;
        expect([deadline.getHours(), deadline.getMinutes()]).toEqual([23, 59]);

        const link = await within(dialog).findByRole('link', { name: /Enviar no WhatsApp/ });
        expect(hrefText(link)).toContain('(10% de desconto)');
        expect(hrefText(link)).toContain('/p/carlos/tok123');
        fireEvent.click(link);
        await waitFor(() => expect(recordProposalFollowUp).toHaveBeenCalledWith('p1', 'hot', 'whatsapp'));
    });

    it('ficha: oferece brinde sem baixar o preço (vai para a conversa do link)', async () => {
        vi.mocked(getSavedPdfById).mockResolvedValue({ id: 10, clienteId: 1, date: ago(4), totalPreco: 1000, totalM2: 5, nomeArquivo: 'p.pdf' });
        vi.mocked(getClientById).mockResolvedValue({ id: 1, nome: 'Carlos Lima', telefone: '(85) 99999-1234', email: '', cpfCnpj: '' });
        vi.mocked(applyProposalFollowUp).mockReset();
        await setup([portal()]);
        const sheet = openClient('Carlos Lima');

        fireEvent.click(within(sheet).getByRole('button', { name: /Oferecer condição/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Condição especial' });
        fireEvent.click(within(within(dialog).getByRole('group', { name: 'Tipo de condição' })).getByRole('button', { name: /Brinde/ }));
        fireEvent.click(within(within(dialog).getByRole('group', { name: 'Escolha o brinde' })).getByRole('button', { name: 'Garantia estendida' }));
        fireEvent.click(within(dialog).getByRole('button', { name: /Aplicar condição/ }));

        await waitFor(() => expect(setProposalOfferDeadline).toHaveBeenCalledWith('p1', expect.any(Date), expect.stringContaining('Brinde: garantia estendida')));
        expect(sendCompanyProposalMessage).toHaveBeenCalledWith('p1', expect.stringContaining('incluímos garantia estendida sem custo'));
        expect(applyProposalFollowUp).not.toHaveBeenCalled();
        const link = await within(dialog).findByRole('link', { name: /Enviar no WhatsApp/ });
        expect(hrefText(link)).toContain('Mantendo o valor da sua proposta, consigo incluir *garantia estendida* sem custo');
    });

    it('ficha: histórico da proposta', async () => {
        await setup([portal({ followUps: [{ id: 3, kind: 'contact', step: 'value', channel: 'whatsapp', created_at: ago(2) }] })]);
        const sheet = openClient('Carlos Lima');
        fireEvent.click(within(sheet).getByRole('button', { name: /Histórico da proposta/ }));
        const history = within(sheet).getByRole('list', { name: 'Histórico de Carlos Lima' });
        expect(within(history).getByText(/Link enviado/)).toBeInTheDocument();
        expect(within(history).getByText(/Você mandou mensagem \(reforço de valor\)/)).toBeInTheDocument();
    });

    it('filtra por situação, mostra 10 por vez e busca sem acento', async () => {
        const notOpened = Array.from({ length: 12 }, (_, index) => other(`n${index}`, `Cliente ${index}`, { viewCount: 0, firstViewedAt: null, lastViewedAt: null }));
        await setup([portal(), other('j', 'José Alves', { viewCount: 0, firstViewedAt: null, lastViewedAt: null }), ...notOpened]);

        const filters = screen.getByRole('group', { name: 'Filtrar por situação' });
        expect(within(filters).getByRole('button', { name: 'Todas 14' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('article')).toHaveLength(10);
        fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais (4)' }));
        expect(screen.getAllByRole('article')).toHaveLength(14);

        fireEvent.click(within(filters).getByRole('button', { name: 'Interessados 1' }));
        expect(screen.getAllByRole('article')).toHaveLength(1);

        // A busca vale para todas as situações.
        fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'jose' } });
        expect(screen.getByRole('tab', { name: 'Hoje (1)' })).toBeInTheDocument();
        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.getByRole('button', { name: /^José Alves/ })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Encerradas (0)' }));
        expect(screen.getByText('"jose" não está nesta aba. Veja as outras abas.')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'ninguém' } });
        expect(screen.getByText('Nenhum cliente encontrado para "ninguém".')).toBeInTheDocument();
    });

    it('antigas: vencidas há mais de 30 dias saem de "Hoje" e dá para encerrar todas (com desfazer)', async () => {
        await setup([portal(), other('o1', 'Antigo Um', { expiresAt: ago(40) }), other('o2', 'Antigo Dois', { expiresAt: ago(60) })]);

        expect(screen.getByRole('tab', { name: 'Hoje (1)' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Antigas 2' }));
        expect(screen.getByRole('button', { name: /^Antigo Um/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Encerrar as 2 como perdidas/ }));
        await waitFor(() => expect(markProposalPortalLost).toHaveBeenCalledWith(['o1', 'o2'], 'no_response', 'Vencida há mais de 30 dias'));
        expect(await screen.findByText('2 propostas antigas encerradas como perdidas.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
        await waitFor(() => expect(reopenProposalPortal).toHaveBeenCalledWith(['o1', 'o2']));
    });

    it('aguardando mostra o próximo contato; encerradas separa aprovadas, recusadas e perdidas', async () => {
        await setup([
            other('w', 'Ana Souza', { createdAt: ago(0.1), lastActivityAt: ago(0.1), viewCount: 0, firstViewedAt: null, lastViewedAt: null }),
            other('a', 'Bia Rocha', { status: 'approved', messages: [{ id: 9, sender_type: 'client', kind: 'approved', created_at: ago(1) }] }),
            other('r', 'Caio Dias', { status: 'rejected' }),
            other('l', 'Davi Melo', { lostAt: ago(2), lostReason: 'trust' }),
        ]);

        expect(screen.getByText(/Nada para hoje. 1 cliente está aguardando o momento certo./)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'Aguardando (1)' }));
        expect(screen.getByText('Próximo contato: amanhã')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Encerradas (3)' }));
        const filters = screen.getByRole('group', { name: 'Filtrar encerradas' });
        expect(within(filters).getByRole('button', { name: 'Aprovadas 1' })).toBeInTheDocument();
        expect(screen.getByText(/^Aprovada em/)).toBeInTheDocument();
        expect(screen.getByText(/^Perdida: confiança/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Reabrir/ }));
        await waitFor(() => expect(reopenProposalPortal).toHaveBeenCalledWith('l'));
    });

    it('notificação abre a ficha do cliente (inclusive pelo endereço)', async () => {
        window.history.replaceState(null, '', '/?tab=proposals&proposalPortal=p1');
        await setup([portal()]);
        expect(screen.getByRole('dialog', { name: 'Proposta de Carlos Lima' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(window.location.search).toBe('?tab=proposals');

        act(() => { window.dispatchEvent(new CustomEvent('proposal-portal-open', { detail: { portalId: 'p1' } })); });
        expect(screen.getByRole('dialog', { name: 'Proposta de Carlos Lima' })).toBeInTheDocument();
    });

    it('menu fixo: "Respostas" mostra quem respondeu e "Novo link" vai ao Histórico', async () => {
        const { onOpenHistory } = await setup([
            portal(),
            other('c', 'Ana Souza', { messages: [{ id: 1, sender_type: 'client', kind: 'negotiation', created_at: ago(0.1) }] }),
        ]);
        const menu = screen.getByRole('navigation', { name: 'Menu das propostas' });

        fireEvent.click(within(menu).getByRole('button', { name: 'Respostas' }));
        expect(within(menu).getByRole('button', { name: 'Respostas' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.getByText('Mandou uma contraproposta')).toBeInTheDocument();

        fireEvent.click(within(menu).getByRole('button', { name: 'Novo link' }));
        expect(onOpenHistory).toHaveBeenCalled();
    });

    it('mensagens da empresa: salva a alterada e apaga a que voltou ao padrão', async () => {
        vi.mocked(getFollowUpMessageTemplates).mockResolvedValue([{ id: 4, step: 'value', text: 'Texto antigo {{link}}' }]);
        vi.mocked(saveFollowUpMessageTemplate).mockResolvedValue({ id: 5, step: 'hot', text: 'x' });
        await setup([portal()]);
        await waitFor(() => expect(getFollowUpMessageTemplates).toHaveBeenCalled());

        fireEvent.click(within(screen.getByRole('navigation', { name: 'Menu das propostas' })).getByRole('button', { name: 'Mensagens' }));
        const hot = await screen.findByLabelText('Mensagem: Abriu várias vezes');
        fireEvent.change(hot, { target: { value: 'Oi {{primeiro_nome}}!' } });
        fireEvent.click(within(screen.getByRole('group', { name: 'Marcadores para Abriu várias vezes' })).getByRole('button', { name: 'Link da proposta' }));
        expect((hot as HTMLTextAreaElement).value).toContain('{{link}}');

        fireEvent.click(within(screen.getByRole('region', { name: 'Reforço de valor' })).getByRole('button', { name: /Restaurar padrão/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Salvar mensagens' }));

        await waitFor(() => expect(saveFollowUpMessageTemplate).toHaveBeenCalledWith('hot', 'Abriu várias vezes', expect.stringContaining('{{link}}'), undefined));
        expect(deleteProposalMessageTemplate).toHaveBeenCalledWith(4);
    });

    it('resumo em reais no topo', async () => {
        await setup([
            portal(),
            other('a', 'Bia Rocha', { status: 'approved', proposals: [{ id: 5, name: 'Opção 1', total: 2500 }], messages: [{ id: 9, sender_type: 'client', kind: 'approved', saved_pdf_id: 5, created_at: new Date().toISOString() }] }),
        ]);
        const summary = screen.getByRole('region', { name: 'Resumo das propostas' });
        expect(within(summary).getByText('R$ 365')).toBeInTheDocument();
        expect(within(summary).getByText('1 cliente')).toBeInTheDocument();
        expect(within(summary).getByText('R$ 2,5 mil')).toBeInTheDocument();
        expect(within(summary).getByText('1 proposta')).toBeInTheDocument();
        expect(within(summary).getByText('100%')).toBeInTheDocument();
        expect(within(summary).getByText('1 de 1 · 90 dias')).toBeInTheDocument();
    });

    it('"Abriu agora" quando o cliente acabou de abrir o link', async () => {
        await setup([portal({ lastViewedAt: new Date(Date.now() - 2 * 60_000).toISOString() })]);
        expect(screen.getByText('Abriu agora')).toBeInTheDocument();
        const sheet = openClient('Carlos Lima');
        expect(within(sheet).getByText('Abriu agora')).toBeInTheDocument();
    });

    it('botão voltar do celular fecha a ficha', async () => {
        await setup([portal()]);
        expect(consumeBackButton()).toBe(false);
        openClient('Carlos Lima');
        act(() => { expect(consumeBackButton()).toBe(true); });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('usa a mensagem salva pela empresa', async () => {
        vi.mocked(getFollowUpMessageTemplates).mockResolvedValue([{ id: 9, step: 'hot', text: '{{primeiro_nome}}, abriu {{aberturas}}! {{link}}' }]);
        await setup([portal()]);
        await waitFor(() => expect(hrefText(screen.getByRole('link', { name: 'WhatsApp para Carlos Lima' }))).toContain('Carlos, abriu 4 vezes!'));
    });
});
