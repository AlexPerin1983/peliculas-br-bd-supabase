import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyProposalPortal } from '../src/lib/proposalPortal';
import { markProposalPortalLost, recordProposalFollowUp, reopenProposalPortal } from '../src/lib/proposalPortal';
import { deleteProposalMessageTemplate, getFollowUpMessageTemplates, saveFollowUpMessageTemplate } from '../services/supabaseDb';
import ProposalFollowUpQueue from './ProposalFollowUpQueue';

vi.mock('../src/lib/proposalPortal', async importOriginal => ({
    ...(await importOriginal<typeof import('../src/lib/proposalPortal')>()),
    recordProposalFollowUp: vi.fn(),
    markProposalPortalLost: vi.fn(),
    reopenProposalPortal: vi.fn(),
}));

vi.mock('../services/supabaseDb', () => ({
    getFollowUpMessageTemplates: vi.fn(),
    saveFollowUpMessageTemplate: vi.fn(),
    deleteProposalMessageTemplate: vi.fn(),
}));

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

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

const whatsappText = () => decodeURIComponent(screen.getByRole('link', { name: /Enviar no WhatsApp/ }).getAttribute('href') || '');

describe('ProposalFollowUpQueue', () => {
    beforeEach(() => {
        vi.mocked(recordProposalFollowUp).mockReset().mockResolvedValue(undefined);
        vi.mocked(markProposalPortalLost).mockReset().mockResolvedValue(undefined);
        vi.mocked(reopenProposalPortal).mockReset().mockResolvedValue(undefined);
        vi.mocked(getFollowUpMessageTemplates).mockReset().mockResolvedValue([]);
        vi.mocked(saveFollowUpMessageTemplate).mockReset();
        vi.mocked(deleteProposalMessageTemplate).mockReset().mockResolvedValue(undefined);
    });

    it('mostra a sugestão e abre o WhatsApp com a mensagem e o mesmo link', () => {
        render(<ProposalFollowUpQueue portals={[portal()]} onChanged={vi.fn()} />);

        expect(screen.getByRole('tab', { name: 'Hoje (1)' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Abriu 4 vezes e não respondeu')).toBeInTheDocument();
        expect(whatsappText()).toContain('https://wa.me/5585999991234');
        expect(whatsappText()).toContain('Oi, Carlos!');
        expect(whatsappText()).toContain('/p/carlos/tok123');

        fireEvent.click(screen.getByRole('link', { name: /Enviar no WhatsApp/ }));
        expect(recordProposalFollowUp).toHaveBeenCalledWith('p1', 'hot', 'whatsapp');
    });

    it('edita a mensagem antes de enviar e troca por outro modelo', () => {
        render(<ProposalFollowUpQueue portals={[portal()]} onChanged={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
        fireEvent.change(screen.getByLabelText('Mensagem para Carlos Lima'), { target: { value: 'Carlos, fechamos por R$ 340?' } });
        expect(whatsappText()).toContain('Carlos, fechamos por R$ 340?');

        fireEvent.change(screen.getByLabelText('Trocar mensagem'), { target: { value: 'value' } });
        expect(whatsappText()).toContain('A instalação tem garantia');
    });

    it('usa a mensagem salva pela empresa', async () => {
        vi.mocked(getFollowUpMessageTemplates).mockResolvedValue([{ id: 9, step: 'hot', text: '{{primeiro_nome}}, abriu {{aberturas}}! {{link}}' }]);
        render(<ProposalFollowUpQueue portals={[portal()]} onChanged={vi.fn()} />);
        await waitFor(() => expect(whatsappText()).toContain('Carlos, abriu 4 vezes!'));
    });

    it('registra ligação e marca como perdida com motivo (com desfazer)', async () => {
        const onChanged = vi.fn();
        render(<ProposalFollowUpQueue portals={[portal()]} onChanged={onChanged} />);

        fireEvent.click(screen.getByRole('button', { name: /Já falei/ }));
        await waitFor(() => expect(recordProposalFollowUp).toHaveBeenCalledWith('p1', 'hot', 'call'));

        fireEvent.click(screen.getByRole('button', { name: /Perdida/ }));
        const reasons = screen.getByRole('group', { name: 'Motivo da perda' });
        expect(screen.getByRole('button', { name: 'Marcar como perdida' })).toBeDisabled();
        fireEvent.click(within(reasons).getByRole('button', { name: 'Preço' }));
        fireEvent.change(screen.getByLabelText('Observação da perda'), { target: { value: 'achou caro' } });
        fireEvent.click(screen.getByRole('button', { name: 'Marcar como perdida' }));
        await waitFor(() => expect(markProposalPortalLost).toHaveBeenCalledWith('p1', 'price', 'achou caro'));
        expect(await screen.findByText('Proposta de Carlos Lima marcada como perdida.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
        await waitFor(() => expect(reopenProposalPortal).toHaveBeenCalledWith('p1'));
        expect(onChanged).toHaveBeenCalled();
    });

    it('abas: aguardando mostra o próximo contato; perdidas permite reabrir', async () => {
        render(<ProposalFollowUpQueue portals={[
            portal({ id: 'w', clientName: 'Ana Souza', createdAt: ago(0.1), viewCount: 0, firstViewedAt: null, lastViewedAt: null }),
            portal({ id: 'l', clientName: 'Bruno Reis', lostAt: ago(2), lostReason: 'trust' }),
        ]} onChanged={vi.fn()} />);

        expect(screen.getByText(/Nada para hoje. 1 proposta está aguardando o momento certo./)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Aguardando (1)' }));
        expect(screen.getByText('Ana Souza')).toBeInTheDocument();
        expect(screen.getByText('Próximo contato: amanhã')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Perdidas (1)' }));
        expect(screen.getByText(/Confiança ·/)).toBeInTheDocument();
        expect(screen.getByText('confiança')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Reabrir/ }));
        await waitFor(() => expect(reopenProposalPortal).toHaveBeenCalledWith('l'));
    });

    it('cliente respondeu: abre a conversa', () => {
        const listener = vi.fn();
        window.addEventListener('proposal-portal-open', listener);
        render(<ProposalFollowUpQueue portals={[portal({ messages: [{ id: 1, sender_type: 'client', kind: 'message', body: 'Tem desconto?', created_at: ago(0.1) }] })]} onChanged={vi.fn()} />);

        expect(screen.getByText('Respondeu e aguarda você')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Abrir conversa/ }));
        expect(listener).toHaveBeenCalled();
        window.removeEventListener('proposal-portal-open', listener);
    });

    it('edita as mensagens da empresa: salva a alterada e apaga a que voltou ao padrão', async () => {
        vi.mocked(getFollowUpMessageTemplates).mockResolvedValue([{ id: 4, step: 'value', text: 'Texto antigo {{link}}' }]);
        vi.mocked(saveFollowUpMessageTemplate).mockResolvedValue({ id: 5, step: 'hot', text: 'x' });
        render(<ProposalFollowUpQueue portals={[portal()]} onChanged={vi.fn()} />);
        await waitFor(() => expect(getFollowUpMessageTemplates).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: /Mensagens/ }));
        const hot = await screen.findByLabelText('Mensagem: Abriu várias vezes');
        fireEvent.change(hot, { target: { value: 'Oi {{primeiro_nome}}!' } });
        fireEvent.click(within(screen.getByRole('group', { name: 'Marcadores para Abriu várias vezes' })).getByRole('button', { name: 'Link da proposta' }));
        expect((hot as HTMLTextAreaElement).value).toContain('{{link}}');

        const valueSection = screen.getByRole('region', { name: 'Reforço de valor' });
        fireEvent.click(within(valueSection).getByRole('button', { name: /Restaurar padrão/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Salvar mensagens' }));

        await waitFor(() => expect(saveFollowUpMessageTemplate).toHaveBeenCalledWith('hot', 'Abriu várias vezes', expect.stringContaining('{{link}}'), undefined));
        expect(deleteProposalMessageTemplate).toHaveBeenCalledWith(4);
    });

    it('lista compacta: o primeiro já vem aberto e os outros abrem ao tocar', () => {
        render(<ProposalFollowUpQueue portals={[
            portal(),
            portal({ id: 'p2', token: 'tok2', clientName: 'Ana Souza', viewCount: 0, firstViewedAt: null, lastViewedAt: null }),
        ]} onChanged={vi.fn()} />);

        expect(screen.getAllByRole('link', { name: /Enviar no WhatsApp/ })).toHaveLength(1);
        expect(screen.getByRole('link', { name: 'WhatsApp para Ana Souza' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Ana Souza/ }));
        expect(screen.getByRole('button', { name: /Ana Souza/ })).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(screen.getByRole('link', { name: 'WhatsApp para Carlos Lima' }));
        expect(recordProposalFollowUp).toHaveBeenCalledWith('p1', 'hot', 'whatsapp');
    });

    it('filtra por situação e mostra 10 por vez', () => {
        const notOpened = Array.from({ length: 12 }, (_, index) => portal({ id: `n${index}`, token: `t${index}`, clientName: `Cliente ${index}`, viewCount: 0, firstViewedAt: null, lastViewedAt: null }));
        render(<ProposalFollowUpQueue portals={[portal(), ...notOpened]} onChanged={vi.fn()} />);

        const filters = screen.getByRole('group', { name: 'Filtrar por situação' });
        expect(within(filters).getByRole('button', { name: 'Todas 13' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('article')).toHaveLength(10);
        fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais (3)' }));
        expect(screen.getAllByRole('article')).toHaveLength(13);

        fireEvent.click(within(filters).getByRole('button', { name: 'Interessados 1' }));
        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
    });

    it('antigas: vencidas há mais de 30 dias saem de "Hoje" e dá para encerrar todas (com desfazer)', async () => {
        render(<ProposalFollowUpQueue portals={[
            portal(),
            portal({ id: 'o1', clientName: 'Antigo Um', expiresAt: ago(40) }),
            portal({ id: 'o2', clientName: 'Antigo Dois', expiresAt: ago(60) }),
        ]} onChanged={vi.fn()} />);

        expect(screen.getByRole('tab', { name: 'Hoje (1)' })).toBeInTheDocument();
        expect(screen.queryByText('Antigo Um')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Antigas 2' }));
        expect(screen.getByText('Antigo Um')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Encerrar as 2 como perdidas/ }));
        await waitFor(() => expect(markProposalPortalLost).toHaveBeenCalledWith(['o1', 'o2'], 'no_response', 'Vencida há mais de 30 dias'));
        expect(await screen.findByText('2 propostas antigas encerradas como perdidas.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
        await waitFor(() => expect(reopenProposalPortal).toHaveBeenCalledWith(['o1', 'o2']));
    });

    it('busca pelo nome do cliente (sem acento)', () => {
        const others = Array.from({ length: 6 }, (_, index) => portal({ id: `x${index}`, token: `x${index}`, clientName: `Cliente ${index}` }));
        render(<ProposalFollowUpQueue portals={[portal({ id: 'j', clientName: 'José Alves' }), ...others]} onChanged={vi.fn()} />);

        expect(screen.getByRole('tab', { name: 'Hoje (7)' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'jose' } });
        expect(screen.getByRole('tab', { name: 'Hoje (1)' })).toBeInTheDocument();
        expect(screen.getByText('José Alves')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'ninguém' } });
        expect(screen.getByText('Nenhum cliente encontrado para "ninguém".')).toBeInTheDocument();
    });

    it('mostra a linha do tempo da proposta', () => {
        render(<ProposalFollowUpQueue portals={[portal({ followUps: [{ id: 3, kind: 'contact', step: 'value', channel: 'whatsapp', created_at: ago(2) }] })]} onChanged={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Histórico da proposta/ }));
        const history = screen.getByRole('list', { name: 'Histórico de Carlos Lima' });
        expect(within(history).getByText(/Link enviado/)).toBeInTheDocument();
        expect(within(history).getByText(/Você mandou mensagem \(reforço de valor\)/)).toBeInTheDocument();
    });
});
