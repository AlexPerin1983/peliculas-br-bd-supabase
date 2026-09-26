import { describe, expect, it } from 'vitest';
import type { CompanyProposalPortal } from './proposalPortal';
import { buildFollowUpQueue, buildFollowUpTimeline, getFollowUpItem, summarizeLostProposals } from './proposalFollowUpQueue';

const NOW = new Date('2026-09-26T12:00:00Z').getTime();
const DAY = 86_400_000;
const at = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString();

const portal = (overrides: Partial<CompanyProposalPortal> = {}): CompanyProposalPortal => ({
    id: 'p1',
    token: 'tok',
    clientId: 1,
    clientName: 'Carlos Lima',
    expiresAt: at(20),
    status: 'active',
    lastActivityAt: at(-5),
    viewCount: 0,
    proposals: [{ id: 10, name: 'Opção 1', total: 365 }],
    messages: [],
    unreadCount: 0,
    createdAt: at(-5),
    followUps: [],
    ...overrides,
});

const stepOf = (value: ReturnType<typeof getFollowUpItem>) => (value && value !== 'waiting' ? value.step : value);

describe('Para acompanhar hoje', () => {
    it('não abriu o link: confirmar se recebeu, com a mensagem e o link', () => {
        const item = getFollowUpItem(portal(), NOW);
        expect(stepOf(item)).toBe('not_opened');
        expect(item !== 'waiting' && item?.message).toContain('Oi, Carlos!');
        expect(item !== 'waiting' && item?.message).toContain('/p/carlos/tok');
        // Enviado hoje ainda não é hora.
        expect(getFollowUpItem(portal({ createdAt: at(-0.2) }), NOW)).toBe('waiting');
    });

    it('abriu 3x ou mais: hora de tirar dúvida ou oferecer condição', () => {
        const item = getFollowUpItem(portal({ viewCount: 4, firstViewedAt: at(-4), lastViewedAt: at(-1) }), NOW);
        expect(stepOf(item)).toBe('hot');
        expect(item !== 'waiting' && item?.title).toBe('Abriu 4 vezes e não respondeu');
    });

    it('abriu poucas vezes: reforçar o valor depois de 2 dias', () => {
        expect(stepOf(getFollowUpItem(portal({ viewCount: 1, firstViewedAt: at(-4), lastViewedAt: at(-4) }), NOW))).toBe('value');
        expect(getFollowUpItem(portal({ viewCount: 1, createdAt: at(-1) }), NOW)).toBe('waiting');
    });

    it('depois de um contato, espera antes de sugerir de novo', () => {
        const contacted = portal({ followUps: [{ id: 1, kind: 'contact', step: 'not_opened', channel: 'whatsapp', created_at: at(-0.5) }] });
        expect(getFollowUpItem(contacted, NOW)).toBe('waiting');
        // Mensagem da empresa na conversa também conta como contato.
        const replied = portal({ messages: [{ id: 5, sender_type: 'company', kind: 'message', created_at: at(-0.5) }] });
        expect(getFollowUpItem(replied, NOW)).toBe('waiting');
    });

    it('cliente respondeu ou negociou: vem primeiro', () => {
        const item = getFollowUpItem(portal({ viewCount: 2, messages: [{ id: 7, sender_type: 'client', kind: 'negotiation', created_at: at(-0.1) }] }), NOW);
        expect(stepOf(item)).toBe('reply');
        expect(item !== 'waiting' && item?.title).toBe('Mandou uma contraproposta');
    });

    it('vencendo em até 2 dias: aviso do prazo', () => {
        const item = getFollowUpItem(portal({ viewCount: 2, lastViewedAt: at(-3), expiresAt: at(1) }), NOW);
        expect(stepOf(item)).toBe('expiring');
        expect(item !== 'waiting' && item?.title).toBe('Vence amanhã');
    });

    it('vencida: renovar; sem retorno depois do contato: encerrar como perdida', () => {
        expect(stepOf(getFollowUpItem(portal({ expiresAt: at(-1) }), NOW))).toBe('expired');
        const afterContact = portal({ expiresAt: at(-6), followUps: [{ id: 2, kind: 'contact', step: 'expired', channel: 'whatsapp', created_at: at(-4) }] });
        expect(stepOf(getFollowUpItem(afterContact, NOW))).toBe('close');
    });

    it('aprovada, recusada ou perdida saem da lista', () => {
        expect(getFollowUpItem(portal({ status: 'approved' }), NOW)).toBeNull();
        expect(getFollowUpItem(portal({ status: 'rejected' }), NOW)).toBeNull();
        expect(getFollowUpItem(portal({ lostAt: at(-1), lostReason: 'price' }), NOW)).toBeNull();
    });

    it('ordena pelo mais urgente e conta os que aguardam', () => {
        const { due, waiting } = buildFollowUpQueue([
            portal({ id: 'a' }),
            portal({ id: 'b', viewCount: 5, lastViewedAt: at(-1) }),
            portal({ id: 'c', messages: [{ id: 1, sender_type: 'client', kind: 'message', created_at: at(-1) }] }),
            portal({ id: 'd', createdAt: at(-0.1) }),
        ], NOW);
        expect(due.map(item => item.portal.id)).toEqual(['c', 'b', 'a']);
        expect(waiting).toBe(1);
    });

    it('linha do tempo em ordem, com contatos e perda', () => {
        const timeline = buildFollowUpTimeline(portal({
            viewCount: 3,
            firstViewedAt: at(-4),
            lastViewedAt: at(-2),
            followUps: [
                { id: 1, kind: 'contact', step: 'hot', channel: 'whatsapp', created_at: at(-1) },
                { id: 2, kind: 'lost', reason: 'price', created_at: at(-0.5) },
            ],
        }), NOW);
        expect(timeline.map(entry => entry.label)).toEqual([
            'Link enviado',
            'Abriu pela primeira vez',
            'Última abertura (3 vezes no total)',
            'Você mandou mensagem (dúvida ou condição)',
            'Marcada como perdida: Preço',
        ]);
    });

    it('resume as perdidas e o motivo mais comum', () => {
        expect(summarizeLostProposals([
            portal({ id: 'a', lostAt: at(-2), lostReason: 'price' }),
            portal({ id: 'b', lostAt: at(-5), lostReason: 'price' }),
            portal({ id: 'c', lostAt: at(-3), lostReason: 'trust' }),
            portal({ id: 'd', lostAt: at(-60), lostReason: 'trust' }),
        ], NOW)).toEqual({ count: 3, topReason: 'Preço' });
    });
});
