import { describe, expect, it } from 'vitest';
import type { Agendamento, Client, SavedPDF } from '../../types';
import type { CompanyProposalPortal } from './proposalPortal';
import {
    buildClientMapsUrl,
    buildClientTimeline,
    clientInitials,
    formatMoneyShort,
    getClientNextStep,
    groupClientProposals,
    needsReactivation,
    relativeDays,
    summarizeClient,
} from './clientInsights';

const NOW = new Date('2026-09-27T12:00:00').getTime();
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW + days * DAY).toISOString();

const client: Client = { id: 1, nome: 'Carlos Lima Souza', telefone: '(85) 99999-1234', email: '', cpfCnpj: '', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Fortaleza', uf: 'CE' };

const pdf = (overrides: Partial<SavedPDF>): SavedPDF => ({
    id: 1, clienteId: 1, date: at(-5), totalPreco: 1000, totalM2: 5, nomeArquivo: 'x.pdf', status: 'pending', proposalOptionId: 10, proposalOptionName: 'Opção 1', ...overrides,
});
const service = (overrides: Partial<Agendamento>): Agendamento => ({
    id: 1, clienteId: 1, clienteNome: 'Carlos', start: at(-10), end: at(-10), serviceStatus: 'completed', ...overrides,
});
const portal = (overrides: Partial<CompanyProposalPortal>): CompanyProposalPortal => ({
    id: 'p1', token: 't', clientId: 1, clientName: 'Carlos', expiresAt: at(10), status: 'active', lastActivityAt: at(-2), viewCount: 0,
    proposals: [{ id: 1, name: 'Opção 1', total: 1000 }], messages: [], unreadCount: 0, createdAt: at(-4), followUps: [], ...overrides,
});

describe('cliente 360', () => {
    it('agrupa as versões pela opção e guarda a aprovada', () => {
        const groups = groupClientProposals([
            pdf({ id: 1, date: at(-10), totalPreco: 900 }),
            pdf({ id: 2, date: at(-3), totalPreco: 950 }),
            pdf({ id: 3, proposalOptionId: 11, proposalOptionName: 'Opção 2', date: at(-8), status: 'approved', totalPreco: 1500 }),
        ]);
        expect(groups.map(group => [group.name, group.versions.length, group.latest.id, group.approved?.id ?? null])).toEqual([
            ['Opção 1', 2, 2, null],
            ['Opção 2', 1, 3, 3],
        ]);
    });

    it('resume valores e estágio: fechado, em aberto, serviços e recorrente', () => {
        const summary = summarizeClient(client, [
            pdf({ id: 1, status: 'approved', totalPreco: 1500, date: at(-40) }),
            pdf({ id: 2, proposalOptionId: 11, totalPreco: 700 }),
            pdf({ id: 3, proposalOptionId: 12, totalPreco: 9999, date: at(-300) }),
        ], [
            service({ id: 1, pdfIds: [1] }),
            service({ id: 2, start: at(-100), valorFinal: 450 }),
            service({ id: 3, start: at(3), serviceStatus: 'scheduled' }),
        ], [], NOW);

        expect(summary.closedValue).toBe(1950);
        expect(summary.openValue).toBe(700);
        expect(summary.servicesDone).toBe(2);
        expect(summary.upcoming?.id).toBe(3);
        expect(summary.stage).toBe('recurring');
        expect(summary.since).toBe(new Date(at(-300)).getTime());
    });

    it('estágios: novo, em negociação e inativo', () => {
        expect(summarizeClient(client, [], [], [], NOW).stage).toBe('new');
        expect(summarizeClient(client, [pdf({})], [], [], NOW).stage).toBe('negotiating');
        expect(summarizeClient({ ...client, lastUpdated: at(-400) }, [pdf({ date: at(-400) })], [], [], NOW).stage).toBe('inactive');
    });

    it('próximo passo: resposta no link vem antes de tudo', () => {
        const summary = summarizeClient(client, [pdf({})], [service({ start: at(2), serviceStatus: 'scheduled' })], [], NOW);
        const step = getClientNextStep(client, summary, [service({ start: at(2), serviceStatus: 'scheduled' })], [
            portal({ messages: [{ id: 1, sender_type: 'client', kind: 'message', body: 'Tem desconto?', created_at: at(-0.1) }] }),
        ], NOW);
        expect(step).toMatchObject({ title: 'Respondeu no link da proposta', detail: '“Tem desconto?”', action: { type: 'open_portal', portalId: 'p1' } });
    });

    it('próximo passo: instalação marcada, aprovado sem agenda e orçamento esperando', () => {
        const upcoming = service({ id: 5, start: at(1), serviceStatus: 'scheduled' });
        const withService = summarizeClient(client, [pdf({})], [upcoming], [], NOW);
        expect(getClientNextStep(client, withService, [upcoming], [], NOW)).toMatchObject({ title: 'Instalação marcada', action: { type: 'open_agendamento' } });

        const approved = pdf({ id: 7, status: 'approved', date: at(-3) });
        const toSchedule = summarizeClient(client, [approved], [], [], NOW);
        expect(getClientNextStep(client, toSchedule, [], [], NOW)).toMatchObject({ title: 'Aprovou, falta agendar', action: { type: 'schedule', pdf: approved } });

        const waiting = summarizeClient(client, [pdf({})], [], [], NOW);
        expect(getClientNextStep(client, waiting, [], [], NOW)).toMatchObject({ title: 'Orçamento esperando resposta', action: { type: 'follow_up' } });
        // Com link: mostra o que o cliente fez nele.
        expect(getClientNextStep(client, waiting, [], [portal({ viewCount: 3 })], NOW)).toMatchObject({ title: 'Abriu o link 3 vezes', action: { type: 'open_portal', portalId: 'p1' } });
    });

    it('próximo passo: reativar cliente antigo e começar pelo orçamento', () => {
        const old = [service({ start: at(-250), valorFinal: 800 })];
        const step = getClientNextStep(client, summarizeClient(client, [], old, [], NOW), old, [], NOW);
        expect(step).toMatchObject({ title: 'Hora de reativar', action: { type: 'whatsapp' } });
        expect(step?.action.type === 'whatsapp' && step.action.message).toContain('Oi, Carlos!');

        expect(getClientNextStep(client, summarizeClient(client, [], [], [], NOW), [], [], NOW)).toMatchObject({ action: { type: 'new_proposal' } });
    });

    it('para reativar: com telefone, nada em andamento e parado há mais de 90 dias', () => {
        const old = [service({ start: at(-120) })];
        expect(needsReactivation(client, summarizeClient(client, [], old, [], NOW), NOW)).toBe(true);
        expect(needsReactivation({ ...client, telefone: '' }, summarizeClient(client, [], old, [], NOW), NOW)).toBe(false);
        expect(needsReactivation(client, summarizeClient(client, [], [service({ start: at(-20) })], [], NOW), NOW)).toBe(false);
    });

    it('linha do tempo junta orçamentos, link e serviços, do mais recente ao mais antigo', () => {
        const timeline = buildClientTimeline(
            [pdf({ date: at(-5) })],
            [service({ start: at(-1), valorFinal: 1000 })],
            [portal({ createdAt: at(-4), firstViewedAt: at(-3), messages: [{ id: 1, sender_type: 'client', kind: 'approved', created_at: at(-2) }] })],
            NOW,
        );
        expect(timeline.map(entry => entry.title)).toEqual(['Serviço concluído', 'Aprovou pelo link', 'Abriu o link da proposta', 'Link da proposta enviado', 'Orçamento Opção 1']);
    });

    it('ajudantes de contato e datas', () => {
        expect(clientInitials('Carlos Lima Souza')).toBe('CS');
        expect(clientInitials('Ana')).toBe('AN');
        expect(buildClientMapsUrl(client)).toContain(encodeURIComponent('Rua A, 10, Centro, Fortaleza - CE'));
        expect(buildClientMapsUrl({ ...client, logradouro: '', numero: '', bairro: '', cidade: '', uf: '' })).toBeNull();
        expect(relativeDays(NOW, NOW)).toBe('hoje');
        expect(relativeDays(NOW - 3 * DAY, NOW)).toBe('há 3 dias');
        expect(relativeDays(NOW - 70 * DAY, NOW)).toBe('há 2 meses');
        // Valor curto para cartões estreitos.
        const normalize = (value: string) => value.replace(/\s/g, ' ');
        expect([149.3, 4200, 154_799.6].map(value => normalize(formatMoneyShort(value)))).toEqual(['R$ 149,30', 'R$ 4,2 mil', 'R$ 155 mil']);
    });
});
