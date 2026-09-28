import { describe, expect, it } from 'vitest';
import type { CompanyProposalPortal } from './proposalPortal';
import { buildBonusOfferMessage, buildFollowUpMessage, buildFollowUpQueue, buildFollowUpTimeline, buildFollowUpVariantMessage, buildOfferMessage, describeNextContact, findUnknownFollowUpTags, FOLLOW_UP_VARIANTS, getFollowUpItem, getNegotiationTip, offerDeadline, openedRecently, snoozeDate, summarizeLostProposals, summarizeProposalResults } from './proposalFollowUpQueue';

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

const stepOf = (value: ReturnType<typeof getFollowUpItem>) => (value ? (value.due ? value.step : 'waiting') : value);

describe('Para acompanhar hoje', () => {
    it('não abriu o link: confirmar se recebeu, com a mensagem e o link', () => {
        const item = getFollowUpItem(portal(), NOW);
        expect(stepOf(item)).toBe('not_opened');
        expect(item?.message).toContain('Oi, Carlos!');
        expect(item?.message).toContain('/p/carlos/tok');
        // Enviado hoje ainda não é hora.
        expect(stepOf(getFollowUpItem(portal({ createdAt: at(-0.2) }), NOW))).toBe('waiting');
    });

    it('abriu 3x ou mais: hora de tirar dúvida ou oferecer condição', () => {
        const item = getFollowUpItem(portal({ viewCount: 4, firstViewedAt: at(-4), lastViewedAt: at(-1) }), NOW);
        expect(stepOf(item)).toBe('hot');
        expect(item?.title).toBe('Abriu 4 vezes e não respondeu');
    });

    it('abriu poucas vezes: reforçar o valor depois de 2 dias', () => {
        expect(stepOf(getFollowUpItem(portal({ viewCount: 1, firstViewedAt: at(-4), lastViewedAt: at(-4) }), NOW))).toBe('value');
        expect(stepOf(getFollowUpItem(portal({ viewCount: 1, createdAt: at(-1) }), NOW))).toBe('waiting');
    });

    it('depois de um contato, espera antes de sugerir de novo', () => {
        const contacted = portal({ followUps: [{ id: 1, kind: 'contact', step: 'not_opened', channel: 'whatsapp', created_at: at(-0.5) }] });
        expect(stepOf(getFollowUpItem(contacted, NOW))).toBe('waiting');
        // Mensagem da empresa na conversa também conta como contato.
        const replied = portal({ messages: [{ id: 5, sender_type: 'company', kind: 'message', created_at: at(-0.5) }] });
        expect(stepOf(getFollowUpItem(replied, NOW))).toBe('waiting');
    });

    it('cliente respondeu ou negociou: vem primeiro', () => {
        const item = getFollowUpItem(portal({ viewCount: 2, messages: [{ id: 7, sender_type: 'client', kind: 'negotiation', created_at: at(-0.1) }] }), NOW);
        expect(stepOf(item)).toBe('reply');
        expect(item?.title).toBe('Mandou uma contraproposta');
    });

    it('vencendo em até 2 dias: aviso do prazo', () => {
        const item = getFollowUpItem(portal({ viewCount: 2, lastViewedAt: at(-3), expiresAt: at(1) }), NOW);
        expect(stepOf(item)).toBe('expiring');
        expect(item?.title).toBe('Vence amanhã');
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
        expect(waiting.map(item => item.portal.id)).toEqual(['d']);
    });

    it('vencidas há mais de 30 dias ficam separadas como antigas', () => {
        const { due, stale } = buildFollowUpQueue([
            portal({ id: 'recent', expiresAt: at(-3) }),
            portal({ id: 'old', expiresAt: at(-45) }),
            portal({ id: 'older', expiresAt: at(-90), followUps: [{ id: 1, kind: 'contact', step: 'expired', channel: 'whatsapp', created_at: at(-80) }] }),
        ], NOW);
        expect(due.map(item => item.portal.id)).toEqual(['recent']);
        expect(stale.map(item => [item.portal.id, item.step])).toEqual([['old', 'expired'], ['older', 'close']]);
    });

    it('quem acabou de abrir o link vem logo depois de quem respondeu', () => {
        const { due } = buildFollowUpQueue([
            portal({ id: 'exp', clientId: 1, viewCount: 2, lastViewedAt: at(-3), expiresAt: at(1) }),
            portal({ id: 'now', clientId: 2, viewCount: 1, firstViewedAt: at(-4), lastViewedAt: new Date(NOW - 3 * 60_000).toISOString() }),
            portal({ id: 'rep', clientId: 3, messages: [{ id: 1, sender_type: 'client', kind: 'message', created_at: at(-1) }] }),
        ], NOW);
        expect(due.map(item => item.portal.id)).toEqual(['rep', 'now', 'exp']);
        expect(openedRecently(due[1].portal, NOW)).toBe(true);
        expect(openedRecently(due[2].portal, NOW)).toBe(false);
    });

    it('resumo em reais: em aberto, aprovado no mês (opção escolhida) e fechamento', () => {
        expect(summarizeProposalResults([
            portal({ id: 'a', clientId: 1, proposals: [{ id: 1, name: 'A', total: 1000 }] }),
            portal({ id: 'b', clientId: 2, createdAt: at(-0.1), lastActivityAt: at(-0.1), proposals: [{ id: 2, name: 'B', total: 500 }] }),
            portal({ id: 'c', clientId: 3, expiresAt: at(-40), proposals: [{ id: 3, name: 'C', total: 9999 }] }),
            portal({ id: 'd', clientId: 4, status: 'approved', proposals: [{ id: 41, name: 'Opção 1', total: 800 }, { id: 42, name: 'Opção 2', total: 1200 }], messages: [{ id: 1, sender_type: 'client', kind: 'approved', saved_pdf_id: 42, created_at: at(-2) }] }),
            portal({ id: 'e', clientId: 5, status: 'approved', messages: [{ id: 2, sender_type: 'client', kind: 'approved', created_at: at(-40) }] }),
            portal({ id: 'f', clientId: 6, lostAt: at(-3), lostReason: 'price' }),
        ], NOW)).toEqual({ openValue: 1500, openCount: 2, approvedValue: 1200, approvedCount: 1, decidedCount: 3, wonCount: 2, closeRate: 2 / 3 });
    });

    it('lembrar depois: fica em "Aguardando" até a data; resposta do cliente ou novo contato cancelam', () => {
        const hot = { viewCount: 4, firstViewedAt: at(-4), lastViewedAt: at(-1) };
        const snooze = { id: 9, kind: 'snooze' as const, step: 'hot', remind_at: at(3), note: 'depois do dia 10', created_at: at(-0.5) };

        const snoozed = getFollowUpItem(portal({ ...hot, followUps: [snooze] }), NOW)!;
        expect(snoozed.due).toBe(false);
        expect(snoozed.snoozedUntil).toBe(NOW + 3 * DAY);
        expect(snoozed.dueAt).toBe(NOW + 3 * DAY);

        // Passou a data: volta para "Hoje".
        expect(getFollowUpItem(portal({ ...hot, followUps: [{ ...snooze, remind_at: at(-0.1) }] }), NOW)!.due).toBe(true);
        // O cliente escreveu depois do lembrete: responder agora.
        const replied = getFollowUpItem(portal({ ...hot, followUps: [snooze], messages: [{ id: 1, sender_type: 'client', kind: 'message', created_at: at(-0.1) }] }), NOW)!;
        expect([replied.step, replied.due, replied.snoozedUntil]).toEqual(['reply', true, undefined]);
        // Contato registrado depois do lembrete: vale a regra normal.
        const contacted = getFollowUpItem(portal({ ...hot, followUps: [snooze, { id: 10, kind: 'contact', step: 'hot', channel: 'whatsapp', created_at: at(-0.2) }] }), NOW)!;
        expect(contacted.snoozedUntil).toBeUndefined();
    });

    it('datas do lembrete (9h) e do prazo da condição (fim do dia)', () => {
        const friday = new Date('2026-09-25T15:00:00').getTime();
        expect(snoozeDate('tomorrow', friday)).toEqual(new Date('2026-09-26T09:00:00'));
        expect(snoozeDate('3d', friday)).toEqual(new Date('2026-09-28T09:00:00'));
        expect(snoozeDate('week', friday)).toEqual(new Date('2026-09-28T09:00:00'));
        expect(snoozeDate('2026-10-10', friday)).toEqual(new Date('2026-10-10T09:00:00'));

        expect(offerDeadline('48h', friday)).toEqual(new Date(friday + 2 * DAY));
        expect(offerDeadline('3d', friday)).toEqual(new Date('2026-09-28T23:59:00'));
        expect(offerDeadline('2026-10-02', friday)).toEqual(new Date('2026-10-02T23:59:00'));
    });

    it('mensagem da condição especial com valores, prazo e o mesmo link', () => {
        const message = buildOfferMessage(portal(), { from: 1000, to: 900, discountLabel: '10%', deadline: new Date('2026-10-02T23:59:00') });
        expect(message).toContain('Oi, Carlos!');
        expect(message).toContain(`de ~${(1000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}~ por *${(900).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}* (10% de desconto)`);
        expect(message).toContain('02/10');
        expect(message).toContain('Depois disso, volta ao valor normal.');
        expect(message).toContain('/p/carlos/tok');

        const bonus = buildBonusOfferMessage(portal(), { bonus: 'a remoção da película antiga', deadline: new Date('2026-10-02T23:59:00') });
        expect(bonus).toContain('Mantendo o valor da sua proposta, consigo incluir *a remoção da película antiga* sem custo');
        expect(bonus).toContain('não consigo manter o brinde');
        expect(bonus).toContain('/p/carlos/tok');
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
        const extra = buildFollowUpTimeline(portal({
            followUps: [
                { id: 3, kind: 'offer', note: '10% · de R$ 1.000 por R$ 900', created_at: at(-2) },
                { id: 4, kind: 'snooze', remind_at: new Date('2026-10-05T09:00:00').toISOString(), note: 'depois do dia 5', created_at: at(-1) },
            ],
        }), NOW).map(entry => entry.label);
        expect(extra).toContain('Condição especial oferecida: 10% · de R$ 1.000 por R$ 900');
        expect(extra).toContain('Lembrete para 05/10: depois do dia 5');
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

    it('usa o modelo editado da empresa, com os marcadores preenchidos', () => {
        const message = buildFollowUpMessage('hot', portal({ viewCount: 4 }), NOW, {
            hot: '{{primeiro_nome}}, vi que abriu {{aberturas}}. Valor: {{valor}}. Vale até {{validade}}. {{link}}',
        });
        expect(message).toBe(`Carlos, vi que abriu 4 vezes. Valor: ${(365).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Vale até ${new Date(at(20)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}. http://localhost:3000/p/carlos/tok`);
        // Modelo vazio volta para o padrão.
        expect(buildFollowUpMessage('hot', portal({ viewCount: 4 }), NOW, { hot: '   ' })).toContain('Ficou alguma dúvida na proposta das películas?');
        expect(findUnknownFollowUpTags('Oi {{primeiro_nome}} {{cupom}}')).toEqual(['cupom']);
    });

    it('variações por situação: todas com o link (menos a vencida) e a principal respeita o texto da empresa', () => {
        for (const [step, variants] of Object.entries(FOLLOW_UP_VARIANTS)) {
            expect(variants[0].id).toBe('principal');
            for (const variant of variants) {
                expect(findUnknownFollowUpTags(variant.text)).toEqual([]);
                if (step !== 'expired') expect(variant.text).toContain('{{link}}');
            }
        }
        const hot = portal({ viewCount: 4 });
        expect(buildFollowUpVariantMessage('hot', 'nao', hot, NOW)).toContain('A proposta ficou acima do que você esperava?');
        expect(buildFollowUpVariantMessage('hot', 'principal', hot, NOW, { hot: 'Texto da empresa {{link}}' })).toContain('Texto da empresa');
        expect(buildFollowUpVariantMessage('expired', 'principal', portal(), NOW)).toBe('Oi, Carlos! Você desistiu das películas ou só ficou corrido por aí? 🙂');
        // A pergunta vem na primeira linha (é o que aparece na notificação) e o link fica na última.
        const notOpened = buildFollowUpVariantMessage('not_opened', 'principal', portal(), NOW).split('\n');
        expect(notOpened[0]).toBe('Oi, Carlos! Conseguiu ver a proposta das películas que te mandei?');
        expect(notOpened.at(-1)).toBe('http://localhost:3000/p/carlos/tok');
        // "Vence amanhã (data)", nunca "vale até em 2 dias".
        expect(buildFollowUpVariantMessage('expiring', 'principal', portal({ expiresAt: at(2) }), NOW)).toContain('vence em 2 dias (');
        // "Sem retorno" depois do vencimento: mensagem de despedida.
        expect(buildFollowUpMessage('close', portal(), NOW)).toContain('vou encerrar a sua proposta por aqui');
    });

    it('dica de negociação conforme a situação (contraproposta tem dica própria)', () => {
        expect(getNegotiationTip({ step: 'hot', portal: portal() }).title).toBe('Nomeie a dúvida');
        const reply = portal({ messages: [{ id: 1, sender_type: 'client', kind: 'message', created_at: at(-0.1) }] });
        expect(getNegotiationTip({ step: 'reply', portal: reply }).title).toBe('Entenda antes de responder');
        const counter = portal({ messages: [{ id: 2, sender_type: 'client', kind: 'negotiation', created_at: at(-0.1) }] });
        expect(getNegotiationTip({ step: 'reply', portal: counter }).title).toBe('Não corte o preço de cara');
    });

    it('mostra quando é o próximo contato de quem está aguardando', () => {
        const item = getFollowUpItem(portal({ viewCount: 1, createdAt: at(-1) }), NOW)!;
        expect(item.due).toBe(false);
        expect(describeNextContact(item.dueAt, NOW)).toBe('amanhã');
        // O aviso de vencimento antecipa o próximo contato.
        const soon = getFollowUpItem(portal({ viewCount: 1, createdAt: at(-0.5), expiresAt: at(2.5) }), NOW)!;
        expect(soon.dueAt).toBe(NOW + 0.5 * DAY);
    });
});
