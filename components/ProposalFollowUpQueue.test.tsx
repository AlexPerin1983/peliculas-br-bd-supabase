import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyProposalPortal } from '../src/lib/proposalPortal';
import { markProposalPortalLost, recordProposalFollowUp, reopenProposalPortal } from '../src/lib/proposalPortal';
import ProposalFollowUpQueue from './ProposalFollowUpQueue';

vi.mock('../src/lib/proposalPortal', async importOriginal => ({
    ...(await importOriginal<typeof import('../src/lib/proposalPortal')>()),
    recordProposalFollowUp: vi.fn(),
    markProposalPortalLost: vi.fn(),
    reopenProposalPortal: vi.fn(),
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

describe('ProposalFollowUpQueue', () => {
    beforeEach(() => {
        vi.mocked(recordProposalFollowUp).mockReset().mockResolvedValue(undefined);
        vi.mocked(markProposalPortalLost).mockReset().mockResolvedValue(undefined);
        vi.mocked(reopenProposalPortal).mockReset().mockResolvedValue(undefined);
    });

    it('mostra a sugestão e abre o WhatsApp com a mensagem e o mesmo link', () => {
        const onChanged = vi.fn();
        render(<ProposalFollowUpQueue portals={[portal()]} onChanged={onChanged} />);

        expect(screen.getByText('Para acompanhar hoje (1)')).toBeInTheDocument();
        expect(screen.getByText('Abriu 4 vezes e não respondeu')).toBeInTheDocument();
        const whatsapp = screen.getByRole('link', { name: /Enviar no WhatsApp/ });
        const href = decodeURIComponent(whatsapp.getAttribute('href') || '');
        expect(href).toContain('https://wa.me/5585999991234');
        expect(href).toContain('Oi, Carlos!');
        expect(href).toContain('/p/carlos/tok123');

        fireEvent.click(whatsapp);
        expect(recordProposalFollowUp).toHaveBeenCalledWith('p1', 'hot', 'whatsapp');
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

    it('cliente respondeu: abre a conversa; sem pendências mostra "nada para hoje"', () => {
        const listener = vi.fn();
        window.addEventListener('proposal-portal-open', listener);
        const { rerender } = render(<ProposalFollowUpQueue portals={[portal({ messages: [{ id: 1, sender_type: 'client', kind: 'message', body: 'Tem desconto?', created_at: ago(0.1) }] })]} onChanged={vi.fn()} />);

        expect(screen.getByText('Respondeu e aguarda você')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Abrir conversa/ }));
        expect(listener).toHaveBeenCalled();
        window.removeEventListener('proposal-portal-open', listener);

        rerender(<ProposalFollowUpQueue portals={[portal({ createdAt: ago(0.1), viewCount: 0, firstViewedAt: null, lastViewedAt: null })]} onChanged={vi.fn()} />);
        expect(screen.getByText(/Nada para hoje. 1 proposta está aguardando o momento certo./)).toBeInTheDocument();
    });

    it('lista as perdidas com o motivo e permite reabrir', async () => {
        render(<ProposalFollowUpQueue portals={[portal({ lostAt: ago(2), lostReason: 'trust' })]} onChanged={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /Perdidas \(1\)/ }));
        expect(screen.getByText(/Confiança ·/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Reabrir/ }));
        await waitFor(() => expect(reopenProposalPortal).toHaveBeenCalledWith('p1'));
    });

    it('mostra a linha do tempo da proposta', () => {
        render(<ProposalFollowUpQueue portals={[portal({ followUps: [{ id: 3, kind: 'contact', step: 'value', channel: 'whatsapp', created_at: ago(2) }] })]} onChanged={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Histórico da proposta/ }));
        const history = screen.getByRole('list', { name: 'Histórico de Carlos Lima' });
        expect(within(history).getByText(/Link enviado/)).toBeInTheDocument();
        expect(within(history).getByText(/Você mandou mensagem \(reforço de valor\)/)).toBeInTheDocument();
    });
});
