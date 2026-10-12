import { describe, expect, it } from 'vitest';
import { getFollowUpItem as appFollowUpItem, type FollowUpTemplates } from './proposalFollowUpQueue';
import type { CompanyProposalPortal } from './proposalPortal';
import {
    DEFAULT_CADENCE, boardColumn, connectedRemindersSent, getFollowUpItem as coreFollowUpItem, normalizeCadence,
} from '../../supabase/functions/whatsapp-bridge/followUpCore';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-10-12T15:00:00-03:00').getTime();
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const portal = (overrides: Partial<CompanyProposalPortal> = {}): CompanyProposalPortal => ({
    id: 'p1', token: 'a'.repeat(48), clientId: 7, clientName: 'Mariana Souza', expiresAt: at(10 * DAY), status: 'active',
    lastActivityAt: at(-HOUR), viewCount: 0, proposals: [{ id: 1, name: 'Opção A', total: 2439 }], messages: [], unreadCount: 0,
    createdAt: at(-2 * HOUR), followUps: [], ...overrides,
});

const scenarios: Array<[string, CompanyProposalPortal]> = [
    ['enviada agora, não abriu', portal()],
    ['não abriu há 2 dias', portal({ createdAt: at(-2 * DAY) })],
    ['abriu 1 vez', portal({ viewCount: 1, lastViewedAt: at(-HOUR) })],
    ['abriu 1 vez há 3 dias', portal({ viewCount: 1, createdAt: at(-4 * DAY), lastViewedAt: at(-3 * DAY) })],
    ['abriu 4 vezes, interesse novo', portal({ viewCount: 4, lastViewedAt: at(-30 * 60_000) })],
    ['abriu 4 vezes, já contatado depois', portal({ viewCount: 4, lastViewedAt: at(-3 * DAY), followUps: [{ id: 1, kind: 'contact', step: 'hot', channel: 'whatsapp', created_at: at(-2 * DAY) }] })],
    ['cliente respondeu no link', portal({ messages: [{ id: 1, sender_type: 'client', kind: 'message', body: 'Oi', created_at: at(-HOUR) } as any] })],
    ['contraproposta', portal({ messages: [{ id: 1, sender_type: 'client', kind: 'negotiation', body: 'Faz por 2 mil?', created_at: at(-HOUR) } as any] })],
    ['vence amanhã', portal({ viewCount: 2, lastViewedAt: at(-DAY), expiresAt: at(DAY) })],
    ['venceu sem contato', portal({ createdAt: at(-10 * DAY), expiresAt: at(-DAY), status: 'expired' })],
    ['venceu e já avisou (despedida)', portal({ createdAt: at(-10 * DAY), expiresAt: at(-3 * DAY), followUps: [{ id: 2, kind: 'contact', step: 'expired', channel: 'whatsapp', created_at: at(-2 * DAY) }] })],
    ['lembrar depois ativo', portal({ createdAt: at(-3 * DAY), followUps: [{ id: 3, kind: 'snooze', step: 'not_opened', created_at: at(-HOUR), remind_at: at(2 * DAY) }] })],
    ['aprovada', portal({ status: 'approved', messages: [{ id: 1, sender_type: 'client', kind: 'approved', created_at: at(-DAY) } as any] })],
    ['perdida', portal({ lostAt: at(-DAY), lostReason: 'price' })],
];

const pick = (item: any) => item && ({ step: item.step, priority: item.priority, title: item.title, hint: item.hint, message: item.message, dueAt: item.dueAt, due: item.due, snoozedUntil: item.snoozedUntil });

describe('núcleo do acompanhamento no WhatsApp conectado', () => {
    const origin = window.location.origin;
    const templates: FollowUpTemplates = { not_opened: 'Oi {{primeiro_nome}}, viu a proposta de {{valor}}? {{link}}', hot: 'Ficou dúvida, {{ primeiro_nome }}? Vence {{quando_vence}}.' };

    for (const [label, item] of scenarios) {
        it(`dá o mesmo resultado que o app: ${label}`, () => {
            expect(pick(coreFollowUpItem(item as any, NOW, { origin }))).toEqual(pick(appFollowUpItem(item, NOW)));
            expect(pick(coreFollowUpItem(item as any, NOW, { origin, templates }))).toEqual(pick(appFollowUpItem(item, NOW, templates)));
        });
    }

    it('com tempos menores, o lembrete de quem não abriu vem antes', () => {
        const item = portal({ createdAt: at(-3 * HOUR) });
        expect(coreFollowUpItem(item as any, NOW, { origin })?.due).toBe(false);
        const fast = coreFollowUpItem(item as any, NOW, { origin, cadence: { ...DEFAULT_CADENCE, notOpenedMin: 120 } });
        expect(fast?.step).toBe('not_opened');
        expect(fast?.due).toBe(true);
        expect(fast?.dueAt).toBe(NOW - HOUR);
    });

    it('abriu várias vezes: espera o tempo escolhido depois da última abertura', () => {
        const item = portal({ viewCount: 3, lastViewedAt: at(-10 * 60_000) });
        const waiting = coreFollowUpItem(item as any, NOW, { origin, cadence: { ...DEFAULT_CADENCE, hotMin: 30 } });
        expect(waiting?.due).toBe(false);
        expect(waiting?.dueAt).toBe(NOW + 20 * 60_000);
    });

    it('coloca cada proposta na coluna certa do quadro', () => {
        const column = (item: CompanyProposalPortal) => boardColumn(item as any, coreFollowUpItem(item as any, NOW, { origin }), NOW);
        expect(column(portal())).toBe('sent');
        expect(column(portal({ createdAt: at(-2 * DAY) }))).toBe('no_reply');
        expect(column(scenarios[6][1])).toBe('replied');
        expect(column(scenarios[8][1])).toBe('deadline');
        expect(column(scenarios[9][1])).toBe('deadline');
        expect(column(scenarios[12][1])).toBe('won');
        expect(column(scenarios[13][1])).toBe(null);
        expect(column(portal({ createdAt: at(-60 * DAY), expiresAt: at(-40 * DAY), status: 'expired' }))).toBe(null);
    });

    it('conta só os lembretes por WhatsApp e limpa tempos inválidos', () => {
        expect(connectedRemindersSent(portal({ followUps: [
            { id: 1, kind: 'contact', channel: 'whatsapp', created_at: at(-DAY) },
            { id: 2, kind: 'contact', channel: 'call', created_at: at(-DAY) },
            { id: 3, kind: 'snooze', remind_at: at(DAY), created_at: at(-DAY) },
        ] }) as any)).toBe(1);
        expect(normalizeCadence({ notOpenedMin: -5, valueMin: 'x', hotMin: 30.4, expiringWindowMin: 99_999_999 })).toEqual({
            notOpenedMin: 0, valueMin: DEFAULT_CADENCE.valueMin, hotMin: 30, expiringWindowMin: 30 * 24 * 60, closeMin: DEFAULT_CADENCE.closeMin,
        });
    });
});
