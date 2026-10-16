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
    | { action: 'client_phones' | 'supplier_phones'; phones: string[] }
    | { action: 'client_create' | 'supplier_create'; name: string; phone: string }
    | { action: 'triage_upsert'; items: TriageItem[] }
    | { action: 'triage_decisions' }
    | { action: 'triage_ack'; ids: number[] }
    | { action: 'update_check' }
    | { action: 'update_download'; version: string }
    | { action: 'company_profile' }
    // Estagiária IA do painel: cliente, proposta, PDF e link (só as propostas que ela criou).
    | { action: 'intern_context'; phone: string | null }
    | { action: 'intern_client_save'; phone: string; name: string; fields: InternClientFields }
    | { action: 'intern_proposal_save'; clientId: number; savedPdfId: number | null; proposal: InternProposal }
    | { action: 'intern_proposal_pdf'; savedPdfId: number; pdf: Uint8Array }
    | { action: 'intern_proposal_delete'; savedPdfId: number };

export const INTERN_CLIENT_FIELDS = ['email', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'] as const;
export type InternClientFields = Partial<Record<typeof INTERN_CLIENT_FIELDS[number], string>>;
export interface InternMeasurement {
    id: number; largura: string; altura: string; quantidade: number; ambiente: string; tipoAplicacao: string; pelicula: string; active: boolean;
    discount: { type: 'percentage' | 'fixed'; value: string };
}
export interface InternProposal {
    total_preco: number; total_m2: number; subtotal: number; general_discount_amount: number;
    general_discount: Record<string, string | number>; measurements: InternMeasurement[];
    nome_arquivo: string; proposal_option_name: string; payment_config: Record<string, unknown> | null;
    /** Opção nova no link que a estagiária já criou para o cliente (várias opções na mesma página). */
    portal_id: string | null;
}
// PDF de até 6 MB (em base64, um pouco mais).
export const INTERN_PDF_MAX_BYTES = 6_000_000;

// Versão do painel local (ex.: 2026.10.13.0915-eee5197), como o pacote de instalação traz.
export const PANEL_RELEASE_VERSION = /^[0-9A-Za-z._-]{3,40}$/;

// Triagem no app: o que a IA do painel separou em cada conversa.
export const TRIAGE_CATEGORIES = ['novo_cliente', 'agendar', 'orcamento', 'pos_venda', 'fornecedor', 'pessoal', 'nao_cliente'] as const;
export type TriageCategory = typeof TRIAGE_CATEGORIES[number];
export type TriageStatus = 'pending' | 'approved' | 'discarded' | 'auto_approved';
const TRIAGE_STATUSES: TriageStatus[] = ['pending', 'approved', 'discarded', 'auto_approved'];
export interface TriageItem {
    contact_key: string;
    phone: string | null;
    name: string | null;
    category: TriageCategory;
    confidence: number | null;
    source: string | null;
    snippet: string | null;
    last_message_at: number | null;
    status: TriageStatus;
    client_id: number | null;
    supplier_id: string | null;
}
const CONTACT_KEY = /^[0-9]{5,20}(@lid)?$/;

// Uma sugestão do painel, limpa; null quando não serve.
export const parseTriageItem = (value: unknown): TriageItem | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (typeof item.contact_key !== 'string' || !CONTACT_KEY.test(item.contact_key)) return null;
    if (!TRIAGE_CATEGORIES.includes(item.category as TriageCategory)) return null;
    const status = item.status === undefined ? 'pending' : item.status;
    if (!TRIAGE_STATUSES.includes(status as TriageStatus)) return null;
    const confidence = typeof item.confidence === 'number' && Number.isFinite(item.confidence) ? Math.min(Math.max(item.confidence, 0), 1) : null;
    const lastMessageAt = typeof item.last_message_at === 'number' && Number.isFinite(item.last_message_at) && item.last_message_at > 0 ? Math.floor(item.last_message_at) : null;
    return {
        contact_key: item.contact_key,
        phone: typeof item.phone === 'string' && PHONE.test(item.phone) ? item.phone : null,
        name: optionalText(item.name, 120),
        category: item.category as TriageCategory,
        confidence: confidence === null ? null : Math.round(confidence * 1000) / 1000,
        source: optionalText(item.source, 20),
        snippet: optionalText(item.snippet, 600),
        last_message_at: lastMessageAt,
        status: status as TriageStatus,
        client_id: positiveId(item.client_id),
        supplier_id: typeof item.supplier_id === 'string' && UUID.test(item.supplier_id) ? item.supplier_id.toLowerCase() : null,
    };
};

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

// ---- Estagiária IA: o que o painel manda para cadastrar e montar a proposta ----
const money = (value: unknown, max = 10_000_000): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value * 100) / 100 : null;
const DIMENSION = /^\d{1,3}(,\d{1,3})?$/;
const parseInternMeasurement = (value: unknown): InternMeasurement | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    const id = positiveId(item.id);
    const quantidade = typeof item.quantidade === 'number' && Number.isInteger(item.quantidade) && item.quantidade >= 1 && item.quantidade <= 1000 ? item.quantidade : null;
    const pelicula = optionalText(item.pelicula, 120);
    if (!id || !quantidade || !pelicula || typeof item.largura !== 'string' || !DIMENSION.test(item.largura) || typeof item.altura !== 'string' || !DIMENSION.test(item.altura)) return null;
    const discount = item.discount && typeof item.discount === 'object' ? item.discount as Record<string, unknown> : {};
    return {
        id, largura: item.largura, altura: item.altura, quantidade, pelicula,
        ambiente: optionalText(item.ambiente, 80) || 'Desconhecido', tipoAplicacao: optionalText(item.tipoAplicacao, 80) || 'Desconhecido', active: item.active !== false,
        discount: { type: discount.type === 'fixed' ? 'fixed' : 'percentage', value: typeof discount.value === 'string' && /^\d{0,7}(,\d{0,4})?$/.test(discount.value) ? discount.value : '0' },
    };
};
const GENERAL_DISCOUNT_KEYS = ['value', 'type', 'operation', 'discountValue', 'discountType', 'increaseValue', 'increaseType', 'pricingMode'];
export const parseInternProposal = (value: unknown): InternProposal | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const body = value as Record<string, unknown>;
    if (JSON.stringify(body).length > 200_000) return null;
    const totals = [money(body.total_preco), money(body.total_m2, 100_000), money(body.subtotal), money(body.general_discount_amount)];
    if (totals.some((total) => total === null)) return null;
    if (!Array.isArray(body.measurements) || !body.measurements.length || body.measurements.length > 200) return null;
    const measurements = body.measurements.map(parseInternMeasurement);
    if (measurements.some((item) => item === null)) return null;
    const discountInput = body.general_discount && typeof body.general_discount === 'object' && !Array.isArray(body.general_discount) ? body.general_discount as Record<string, unknown> : {};
    const general_discount: Record<string, string | number> = {};
    for (const key of GENERAL_DISCOUNT_KEYS) {
        const entry = discountInput[key];
        if (typeof entry === 'string' && entry.length <= 40) general_discount[key] = entry;
        else if (typeof entry === 'number' && Number.isFinite(entry)) general_discount[key] = entry;
    }
    const payment = body.payment_config && typeof body.payment_config === 'object' && !Array.isArray(body.payment_config) ? body.payment_config as Record<string, unknown> : null;
    return {
        total_preco: totals[0]!, total_m2: totals[1]!, subtotal: totals[2]!, general_discount_amount: totals[3]!, general_discount,
        measurements: measurements as InternMeasurement[], nome_arquivo: optionalText(body.nome_arquivo, 200) || 'Orçamento.pdf',
        proposal_option_name: optionalText(body.proposal_option_name, 80) || 'Opção 1', payment_config: payment,
        portal_id: typeof body.portal_id === 'string' && UUID.test(body.portal_id) ? body.portal_id.toLowerCase() : null,
    };
};
const base64Bytes = (value: unknown): Uint8Array | null => {
    if (typeof value !== 'string' || value.length > Math.ceil(INTERN_PDF_MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
    try {
        const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
        // Começa com %PDF: não aceita outro tipo de arquivo.
        return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 ? bytes : null;
    } catch { return null; }
};

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
        case 'client_phones':
        case 'supplier_phones': {
            if (!Array.isArray(body.phones)) return { invalid: 'Lista de telefones inválida.' };
            const phones = [...new Set(body.phones.filter((phone): phone is string => typeof phone === 'string' && PHONE.test(phone)))];
            if (phones.length > 1000) return { invalid: 'Telefones demais de uma vez (até 1.000).' };
            return { action: body.action, phones };
        }
        case 'client_create':
        case 'supplier_create': {
            const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
            if (!name) return { invalid: body.action === 'client_create' ? 'Informe o nome do cliente.' : 'Informe o nome do fornecedor.' };
            if (typeof body.phone !== 'string' || !PHONE.test(body.phone)) return { invalid: 'Telefone inválido.' };
            return { action: body.action, name, phone: body.phone };
        }
        case 'triage_upsert': {
            if (!Array.isArray(body.items) || body.items.length > 300) return { invalid: 'Lista de sugestões inválida (até 300).' };
            const items = body.items.map(parseTriageItem);
            if (items.some((item) => item === null)) return { invalid: 'Sugestão inválida na lista.' };
            return { action: 'triage_upsert', items: items as TriageItem[] };
        }
        case 'triage_decisions':
            return { action: 'triage_decisions' };
        case 'triage_ack': {
            if (!Array.isArray(body.ids) || body.ids.length > 100) return { invalid: 'Lista inválida.' };
            const ids = body.ids.map(positiveId);
            if (ids.some((id) => id === null)) return { invalid: 'Lista inválida.' };
            return { action: 'triage_ack', ids: ids as number[] };
        }
        case 'update_check':
            return { action: 'update_check' };
        case 'update_download':
            if (typeof body.version !== 'string' || !PANEL_RELEASE_VERSION.test(body.version)) return { invalid: 'Versão inválida.' };
            return { action: 'update_download', version: body.version };
        case 'company_profile':
            return { action: 'company_profile' };
        case 'intern_context':
            if (body.phone !== undefined && body.phone !== null && (typeof body.phone !== 'string' || !PHONE.test(body.phone))) return { invalid: 'Telefone inválido.' };
            return { action: 'intern_context', phone: typeof body.phone === 'string' ? body.phone : null };
        case 'intern_client_save': {
            const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
            if (!name) return { invalid: 'Informe o nome do cliente.' };
            if (typeof body.phone !== 'string' || !PHONE.test(body.phone)) return { invalid: 'Telefone inválido.' };
            const input = body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields) ? body.fields as Record<string, unknown> : {};
            const fields: InternClientFields = {};
            for (const key of INTERN_CLIENT_FIELDS) { const text = optionalText(input[key], 160); if (text) fields[key] = text; }
            return { action: 'intern_client_save', phone: body.phone, name, fields };
        }
        case 'intern_proposal_save': {
            const clientId = positiveId(body.clientId);
            if (!clientId) return { invalid: 'Cliente inválido.' };
            const savedPdfId = body.savedPdfId === null || body.savedPdfId === undefined ? null : positiveId(body.savedPdfId);
            if (body.savedPdfId !== null && body.savedPdfId !== undefined && !savedPdfId) return { invalid: 'Proposta inválida.' };
            const proposal = parseInternProposal(body.proposal);
            if (!proposal) return { invalid: 'Dados da proposta inválidos.' };
            return { action: 'intern_proposal_save', clientId, savedPdfId, proposal };
        }
        case 'intern_proposal_pdf': {
            const savedPdfId = positiveId(body.savedPdfId);
            const pdf = base64Bytes(body.pdfBase64);
            if (!savedPdfId) return { invalid: 'Proposta inválida.' };
            if (!pdf) return { invalid: 'PDF inválido (até 6 MB).' };
            return { action: 'intern_proposal_pdf', savedPdfId, pdf };
        }
        case 'intern_proposal_delete': {
            const savedPdfId = positiveId(body.savedPdfId);
            return savedPdfId ? { action: 'intern_proposal_delete', savedPdfId } : { invalid: 'Proposta inválida.' };
        }
        default:
            return { invalid: 'Ação desconhecida.' };
    }
};
