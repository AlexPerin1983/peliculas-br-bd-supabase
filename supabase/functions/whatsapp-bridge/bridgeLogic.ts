// Regras puras da ponte do WhatsApp conectado (sem Deno nem Supabase), para
// serem testadas no Vitest e usadas pela função whatsapp-bridge.
import { type CadenceSettings, normalizeCadence } from './followUpCore.ts';

export const BRIDGE_KEY_HEADER = 'x-bridge-key';

export type BridgeReportStatus = 'sent' | 'failed' | 'pending' | 'canceled';

export type BridgeCommand =
    | { action: 'hello' }
    | { action: 'pending'; limit: number }
    | { action: 'claim'; id: number }
    | { action: 'report'; id: number; status: BridgeReportStatus; error: string | null; providerMessageId: string | null }
    | { action: 'pipeline' }
    | { action: 'follow_up_enqueue'; portalId: string; step: FollowUpSendStep; message: string | null }
    | { action: 'settings_get' }
    | { action: 'settings_set'; settings: BridgeSettings }
    | { action: 'client_phones'; phones: string[] }
    | { action: 'client_create'; name: string; phone: string };

// Passos do acompanhamento que viram mensagem automática ("reply" é conversa: a empresa responde).
export type FollowUpSendStep = 'not_opened' | 'hot' | 'value' | 'expiring' | 'expired' | 'close';
export const FOLLOW_UP_SEND_STEPS: FollowUpSendStep[] = ['not_opened', 'hot', 'value', 'expiring', 'expired', 'close'];

// Colunas do quadro que podem ter uma etiqueta no WhatsApp.
export type LabelSlot = 'new_contact' | 'schedule' | 'replied' | 'no_reply' | 'deadline' | 'sent' | 'after_sale' | 'won';
export const LABEL_SLOTS: LabelSlot[] = ['new_contact', 'schedule', 'replied', 'no_reply', 'deadline', 'sent', 'after_sale', 'won'];

// Ajustes do funil, por conexão (= por empresa). Padrão: tudo pede aprovação.
export interface BridgeSettings {
    cadence: CadenceSettings;
    auto: Record<FollowUpSendStep, boolean>;
    hours: { start: number; end: number; days: number[] }; // days: 0 = domingo
    maxReminders: number;
    timeZone: string;
    labels: Partial<Record<LabelSlot, string>>;
}

export const DEFAULT_BRIDGE_SETTINGS: BridgeSettings = {
    cadence: normalizeCadence({}),
    auto: { not_opened: false, hot: false, value: false, expiring: false, expired: false, close: false },
    hours: { start: 8, end: 19, days: [1, 2, 3, 4, 5, 6] },
    maxReminders: 3,
    timeZone: 'America/Sao_Paulo',
    labels: {},
};

const isTimeZone = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(value)) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
};
const hour = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 24 ? value : fallback;

export const normalizeBridgeSettings = (value: unknown): BridgeSettings => {
    const input = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, any>;
    const auto = { ...DEFAULT_BRIDGE_SETTINGS.auto };
    for (const step of FOLLOW_UP_SEND_STEPS) if (typeof input.auto?.[step] === 'boolean') auto[step] = input.auto[step];
    let start = hour(input.hours?.start, DEFAULT_BRIDGE_SETTINGS.hours.start);
    let end = hour(input.hours?.end, DEFAULT_BRIDGE_SETTINGS.hours.end);
    if (end <= start) ({ start, end } = DEFAULT_BRIDGE_SETTINGS.hours);
    const days = Array.isArray(input.hours?.days)
        ? [...new Set(input.hours.days.filter((day: unknown) => Number.isInteger(day) && (day as number) >= 0 && (day as number) <= 6) as number[])].sort()
        : DEFAULT_BRIDGE_SETTINGS.hours.days;
    const labels: Partial<Record<LabelSlot, string>> = {};
    for (const slot of LABEL_SLOTS) {
        const id = input.labels?.[slot];
        if (typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,40}$/.test(id)) labels[slot] = id;
    }
    const max = input.maxReminders;
    return {
        cadence: normalizeCadence(input.cadence),
        auto,
        hours: { start, end, days },
        maxReminders: typeof max === 'number' && Number.isInteger(max) && max >= 1 && max <= 10 ? max : DEFAULT_BRIDGE_SETTINGS.maxReminders,
        timeZone: isTimeZone(input.timeZone) ? input.timeZone : DEFAULT_BRIDGE_SETTINGS.timeZone,
        labels,
    };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^[0-9]{12,15}$/;

const REPORT_STATUSES: BridgeReportStatus[] = ['sent', 'failed', 'pending', 'canceled'];

// A chave do painel é gerada com 32 bytes aleatórios (hex ou base64url).
export const isPlausibleBridgeKey = (key: unknown): key is string =>
    typeof key === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(key);

export const sha256Hex = async (value: string): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const positiveId = (value: unknown): number | null =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

const optionalText = (value: unknown, max: number): string | null =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

// Recusa com o motivo. Não se chama "error" para não se confundir com o
// campo error do resultado de envio (report).
export type BridgeRejection = { invalid: string };

export const parseBridgeCommand = (payload: unknown): BridgeCommand | BridgeRejection => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { invalid: 'Pedido inválido.' };
    const body = payload as Record<string, unknown>;
    switch (body.action) {
        case 'hello':
            return { action: 'hello' };
        case 'pending': {
            const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) ? Math.floor(body.limit) : 100;
            return { action: 'pending', limit: Math.min(Math.max(limit, 1), 200) };
        }
        case 'claim': {
            const id = positiveId(body.id);
            return id ? { action: 'claim', id } : { invalid: 'Pedido sem identificação.' };
        }
        case 'report': {
            const id = positiveId(body.id);
            if (!id) return { invalid: 'Pedido sem identificação.' };
            if (!REPORT_STATUSES.includes(body.status as BridgeReportStatus)) return { invalid: 'Situação inválida.' };
            return {
                action: 'report',
                id,
                status: body.status as BridgeReportStatus,
                error: optionalText(body.error, 500),
                providerMessageId: optionalText(body.providerMessageId, 200),
            };
        }
        case 'pipeline':
            return { action: 'pipeline' };
        case 'follow_up_enqueue': {
            if (typeof body.portalId !== 'string' || !UUID.test(body.portalId)) return { invalid: 'Proposta sem identificação.' };
            if (!FOLLOW_UP_SEND_STEPS.includes(body.step as FollowUpSendStep)) return { invalid: 'Etapa inválida.' };
            const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null;
            if (message && message.length > 4000) return { invalid: 'Mensagem longa demais (até 4.000 caracteres).' };
            return { action: 'follow_up_enqueue', portalId: body.portalId.toLowerCase(), step: body.step as FollowUpSendStep, message };
        }
        case 'settings_get':
            return { action: 'settings_get' };
        case 'settings_set':
            if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) return { invalid: 'Ajustes inválidos.' };
            return { action: 'settings_set', settings: normalizeBridgeSettings(body.settings) };
        case 'client_phones': {
            if (!Array.isArray(body.phones)) return { invalid: 'Lista de telefones inválida.' };
            const phones = [...new Set(body.phones.filter((phone): phone is string => typeof phone === 'string' && PHONE.test(phone)))];
            if (phones.length > 1000) return { invalid: 'Telefones demais de uma vez (até 1.000).' };
            return { action: 'client_phones', phones };
        }
        case 'client_create': {
            const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
            if (!name) return { invalid: 'Informe o nome do cliente.' };
            if (typeof body.phone !== 'string' || !PHONE.test(body.phone)) return { invalid: 'Telefone inválido.' };
            return { action: 'client_create', name, phone: body.phone };
        }
        default:
            return { invalid: 'Ação desconhecida.' };
    }
};
