// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BRIDGE_SETTINGS, normalizeBridgeSettings, parseBridgeCommand } from '../../supabase/functions/whatsapp-bridge/bridgeLogic';
import { getFollowUpItem } from '../../supabase/functions/whatsapp-bridge/followUpCore';
import { buildPipeline, phoneDigits, templatesByStep, type PipelineRows } from '../../supabase/functions/whatsapp-bridge/pipeline';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-10-12T15:00:00-03:00').getTime();
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const ORIGIN = 'https://app.filmstec.shop';
const PORTAL_ID = '11111111-2222-4333-8444-555555555555';

const rows = (overrides: Partial<PipelineRows> = {}, portal: Record<string, unknown> = {}): PipelineRows => ({
    portals: [{ id: PORTAL_ID, token: 'a'.repeat(48), client_id: 7, expires_at: at(10 * DAY), status: 'active', view_count: 0, created_at: at(-2 * DAY), last_viewed_at: null, lost_at: null, ...portal }],
    clients: [{ id: 7, nome: 'Mariana Souza', telefone: '(83) 99999-8888' }],
    items: [{ portal_id: PORTAL_ID, saved_pdf_id: 3, position: 0, condition_final_value: null, saved_pdfs: { proposal_option_name: 'Opção A', total_preco: 2439, follow_up_revision: 0 } }],
    messages: [],
    followUps: [],
    templates: [],
    queued: [],
    ...overrides,
});

describe('quadro do funil no WhatsApp conectado', () => {
    it('monta o cartão com o número no formato do WhatsApp, o valor e a mensagem com o link', () => {
        const [card] = buildPipeline(rows(), NOW, { origin: ORIGIN });
        expect(card).toMatchObject({ portalId: PORTAL_ID, clientName: 'Mariana Souza', phone: '5583999998888', column: 'no_reply', step: 'not_opened', due: true, total: 2439, remindersSent: 0, queued: null });
        expect(card.message).toContain(`${ORIGIN}/p/mariana/${'a'.repeat(48)}`);
    });

    it('usa o modelo mais recente que a empresa salvou para o passo', () => {
        const templates = [
            { id: 2, follow_up_step: 'not_opened', body: 'Novo: {{primeiro_nome}}' },
            { id: 1, follow_up_step: 'not_opened', body: 'Antigo' },
            { id: 3, follow_up_step: 'hot', body: '   ' },
        ];
        expect(templatesByStep(templates)).toEqual({ not_opened: 'Novo: {{primeiro_nome}}' });
        expect(buildPipeline(rows({ templates }), NOW, { origin: ORIGIN })[0].message).toBe('Novo: Mariana');
    });

    it('mostra quando o lembrete já está na fila e quantos já saíram pelo WhatsApp', () => {
        const [card] = buildPipeline(rows({
            queued: [{ id: 9, portal_id: PORTAL_ID, step: 'not_opened', status: 'pending' }],
            followUps: [{ portal_id: PORTAL_ID, kind: 'contact', step: 'not_opened', channel: 'whatsapp', created_at: at(-3 * DAY) }],
        }), NOW, { origin: ORIGIN });
        expect(card.queued).toEqual({ id: 9, step: 'not_opened', status: 'pending' });
        expect(card.remindersSent).toBe(1);
    });

    it('tira do quadro as perdidas e as revogadas e põe quem respondeu primeiro', () => {
        const second = { id: 'b', token: 'b'.repeat(48), client_id: 7, expires_at: at(10 * DAY), status: 'active', view_count: 1, created_at: at(-HOUR), last_viewed_at: at(-HOUR), lost_at: null };
        const data = rows({ messages: [{ portal_id: 'b', sender_type: 'client', kind: 'message', created_at: at(-10 * 60_000) }] });
        data.portals.push(second, { ...second, id: 'c', status: 'revoked' }, { ...second, id: 'd', lost_at: at(-DAY) });
        expect(buildPipeline(data, NOW, { origin: ORIGIN }).map(card => [card.portalId, card.column])).toEqual([['b', 'replied'], [PORTAL_ID, 'no_reply']]);
    });

    it('no fuso da empresa, a validade não muda de dia à noite', () => {
        const night = new Date('2026-10-12T22:30:00-03:00').getTime();
        const portal = { expires_at: '2026-10-13T23:59:00-03:00', view_count: 2, last_viewed_at: at(-DAY) };
        const [card] = buildPipeline(rows({}, portal), night, { origin: ORIGIN, timeZone: 'America/Sao_Paulo' });
        expect(card.step).toBe('expiring');
        expect(card.title).toBe('Vence amanhã');
        expect(card.message).toContain('(13/10)');
    });

    it('lê o telefone do cadastro igual ao banco', () => {
        expect(phoneDigits('(83) 99999-8888')).toBe('5583999998888');
        expect(phoneDigits('+55 83 99999-8888')).toBe('5583999998888');
        expect(phoneDigits('083 3333-4444')).toBe('558333334444');
        expect(phoneDigits('12345')).toBe(null);
        expect(phoneDigits(null)).toBe(null);
    });

    it('a etapa conferida na hora do envio é a mesma do quadro', () => {
        const data = rows();
        const [card] = buildPipeline(data, NOW, { origin: ORIGIN });
        const portal = { ...data.portals[0] };
        expect(getFollowUpItem({ id: portal.id, token: portal.token, clientId: 7, clientName: 'Mariana Souza', status: 'active', expiresAt: portal.expires_at as string, createdAt: portal.created_at as string, viewCount: 0, messages: [], followUps: [], proposals: [{ id: 3, name: 'Opção A', total: 2439 }] }, NOW, { origin: ORIGIN })?.step).toBe(card.step);
    });
});

describe('ajustes e ações novas da ponte', () => {
    it('começa pedindo aprovação em tudo, de segunda a sábado, das 8h às 19h', () => {
        expect(normalizeBridgeSettings(undefined)).toEqual(DEFAULT_BRIDGE_SETTINGS);
        expect(DEFAULT_BRIDGE_SETTINGS.auto).toEqual({ not_opened: false, hot: false, value: false, expiring: false, expired: false, close: false });
    });

    it('limpa ajustes inválidos sem perder os válidos', () => {
        const settings = normalizeBridgeSettings({
            cadence: { notOpenedMin: 30 },
            auto: { not_opened: true, hot: 'sim', reply: true },
            hours: { start: 20, end: 9, days: [0, 6, 6, 9, 'x'] },
            maxReminders: 50,
            timeZone: 'Lugar/Inexistente',
            labels: { sent: '12', won: 'x'.repeat(41), outra: '3' },
        });
        expect(settings.cadence.notOpenedMin).toBe(30);
        expect(settings.auto).toMatchObject({ not_opened: true, hot: false });
        expect(settings.auto).not.toHaveProperty('reply');
        expect(settings.hours).toEqual({ start: 8, end: 19, days: [0, 6] });
        expect(settings.maxReminders).toBe(3);
        expect(settings.timeZone).toBe('America/Sao_Paulo');
        expect(settings.labels).toEqual({ sent: '12' });
    });

    it('lê os pedidos de lembrete, ajustes e clientes', () => {
        expect(parseBridgeCommand({ action: 'pipeline' })).toEqual({ action: 'pipeline' });
        expect(parseBridgeCommand({ action: 'follow_up_enqueue', portalId: PORTAL_ID.toUpperCase(), step: 'hot', message: '  Oi  ' }))
            .toEqual({ action: 'follow_up_enqueue', portalId: PORTAL_ID, step: 'hot', message: 'Oi' });
        expect(parseBridgeCommand({ action: 'follow_up_enqueue', portalId: PORTAL_ID, step: 'reply' })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'follow_up_enqueue', portalId: 'x', step: 'hot' })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'settings_set', settings: [] })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'client_phones', phones: ['5583999998888', '5583999998888', '123', 7] }))
            .toEqual({ action: 'client_phones', phones: ['5583999998888'] });
        expect(parseBridgeCommand({ action: 'client_create', name: '  Ana   Paula ', phone: '5583999998888' }))
            .toEqual({ action: 'client_create', name: 'Ana Paula', phone: '5583999998888' });
        expect(parseBridgeCommand({ action: 'client_create', name: ' ', phone: '5583999998888' })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'client_create', name: 'Ana', phone: '83999998888' })).toHaveProperty('invalid');
    });

    it('lê as sugestões da triagem e recusa a lista se alguma vier estragada', () => {
        const command = parseBridgeCommand({ action: 'triage_upsert', items: [
            { contact_key: '5583999998888', phone: '5583999998888', name: '  Kleidson ', category: 'novo_cliente', confidence: 1.4, source: 'jev', snippet: 'Coloca blackout?', last_message_at: 1760300000.7 },
            { contact_key: '145399998888777@lid', category: 'pessoal', status: 'approved', confidence: 'x', supplier_id: 'nada', client_id: -3 },
        ] });
        expect(command).toEqual({ action: 'triage_upsert', items: [
            { contact_key: '5583999998888', phone: '5583999998888', name: 'Kleidson', category: 'novo_cliente', confidence: 1, source: 'jev', snippet: 'Coloca blackout?', last_message_at: 1760300000, status: 'pending', client_id: null, supplier_id: null },
            { contact_key: '145399998888777@lid', phone: null, name: null, category: 'pessoal', confidence: null, source: null, snippet: null, last_message_at: null, status: 'approved', client_id: null, supplier_id: null },
        ] });
        expect(parseBridgeCommand({ action: 'triage_upsert', items: [{ contact_key: '5583999998888', category: 'vip' }] })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'triage_upsert', items: [{ contact_key: "1' OR 1=1", category: 'pessoal' }] })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'triage_upsert', items: [{ contact_key: '5583999998888', category: 'pessoal', status: 'perdido' }] })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'triage_decisions' })).toEqual({ action: 'triage_decisions' });
        expect(parseBridgeCommand({ action: 'triage_ack', ids: [3, 4] })).toEqual({ action: 'triage_ack', ids: [3, 4] });
        expect(parseBridgeCommand({ action: 'triage_ack', ids: [3, '4'] })).toHaveProperty('invalid');
    });

    it('lê os pedidos de fornecedor com as mesmas regras do cliente', () => {
        expect(parseBridgeCommand({ action: 'supplier_phones', phones: ['5581999998888', '5581999998888', 'x'] }))
            .toEqual({ action: 'supplier_phones', phones: ['5581999998888'] });
        expect(parseBridgeCommand({ action: 'supplier_create', name: ' Somma   Films ', phone: '5581999998888' }))
            .toEqual({ action: 'supplier_create', name: 'Somma Films', phone: '5581999998888' });
        expect(parseBridgeCommand({ action: 'supplier_create', name: '', phone: '5581999998888' })).toEqual({ invalid: 'Informe o nome do fornecedor.' });
        expect(parseBridgeCommand({ action: 'supplier_create', name: 'Somma', phone: '81999998888' })).toHaveProperty('invalid');
        expect(parseBridgeCommand({ action: 'supplier_phones', phones: 'x' })).toHaveProperty('invalid');
    });
});
