// Regras puras da leitura do CRM pelo atendimento (Conversa Bridge Ai), sem Deno
// nem Supabase, para serem testadas no Vitest e usadas pela função crm-read.
//
// Só leitura: propostas de um telefone e agenda de um intervalo. A empresa vem
// sempre da chave (crm_read_keys), nunca do pedido.
import { resolvePortalPricing } from '../proposal-portal/followUpPricing.ts';
import { buildPaymentOptions } from '../proposal-portal/paymentOptions.ts';

export const CRM_KEY_HEADER = 'x-crm-key';
// pbr_ro_ + 32 bytes aleatórios em base64url (43 caracteres).
export const CRM_KEY_PATTERN = /^pbr_ro_[A-Za-z0-9_-]{43}$/;
export const CRM_TIME_ZONE = 'America/Sao_Paulo';
// Brasília sem horário de verão desde 2019.
const OFFSET = '-03:00';
const OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;
export const MAX_AGENDA_DAYS = 31;
const MIN_FREE_MINUTES = 30;
const DEFAULT_EVENT_MINUTES = 60;

export type CrmScope = 'proposals:read' | 'agenda:read' | 'clients:create'
    | 'agenda:create' | 'proposals:write' | 'proposals:send';

export interface SaveClientInput {
    phone: string;
    // Nome limpo, ou null quando o que veio não serve (só emojis, iniciais...).
    name: string | null;
    bairro: string | null;
    cidade: string | null;
    summary: string | null;
    // Medidas no formato do app ("1,20"), para o rascunho do orçamento. Vazio = sem rascunho.
    measurements: DraftMeasurement[];
    film: string | null;
}

export interface DraftMeasurement {
    largura: string;
    altura: string;
    quantidade: number;
    ambiente: string | null;
}

// Medida em metros (aceita "1,20", "1.2", 1.2) ou em centímetros quando passa de 20 ("120").
// Fora de 5 cm a 20 m: não serve. Devolve no formato do app: "1,20".
export const draftDimension = (value: unknown): string | null => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const match = String(value).trim().replace(/\s+/g, '').replace(',', '.').match(/^\d+(?:\.\d+)?$/);
    if (!match) return null;
    let meters = Number(match[0]);
    if (meters > 20 && meters <= 2000) meters /= 100;
    if (!Number.isFinite(meters) || meters < 0.05 || meters > 20) return null;
    return meters.toFixed(2).replace('.', ',');
};

export const parseDraftMeasurements = (value: unknown): DraftMeasurement[] | { invalid: string } => {
    if (value == null) return [];
    if (!Array.isArray(value)) return { invalid: 'O campo "medidas" precisa ser uma lista.' };
    if (value.length > 30) return { invalid: 'No máximo 30 medidas por cliente.' };
    const out: DraftMeasurement[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return { invalid: 'Medida inválida.' };
        const row = item as Record<string, unknown>;
        const largura = draftDimension(row.largura);
        const altura = draftDimension(row.altura);
        if (!largura || !altura) return { invalid: 'Medida inválida: envie largura e altura em metros (ex.: 1,20).' };
        const quantity = row.quantidade == null ? 1 : Number(row.quantidade);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) return { invalid: 'Quantidade inválida (de 1 a 50).' };
        const local = typeof row.local === 'string' ? row.local.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
        out.push({ largura, altura, quantidade: quantity, ambiente: local || null });
    }
    return out;
};

export type CrmCommand =
    | { action: 'propostas'; phone: string }
    | { action: 'agenda'; from: string; to: string }
    | ({ action: 'cliente_salvar' } & SaveClientInput);

export const isPlausibleCrmKey = (key: unknown): key is string =>
    typeof key === 'string' && CRM_KEY_PATTERN.test(key);

export const sha256Hex = async (value: string): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

// Mesmo número que whatsapp_phone_digits() no banco: até 11 dígitos é nacional e recebe o 55.
export const phoneDigits = (phone: unknown): string | null => {
    if (typeof phone !== 'string' && typeof phone !== 'number') return null;
    const digits = String(phone).replace(/\D/g, '').replace(/^0+/, '');
    if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
    return /^\d{12,15}$/.test(digits) ? digits : null;
};

const ALLOWED_FIELDS: Record<CrmCommand['action'], string[]> = {
    propostas: ['action', 'telefone'],
    agenda: ['action', 'de', 'ate'],
    cliente_salvar: ['action', 'telefone', 'nome', 'bairro', 'cidade', 'resumo', 'medidas', 'pelicula'],
};

// Nome do WhatsApp ou o que o cliente disse: tira emojis, símbolos e letras
// "decoradas" (𝓡𝓸𝓼𝓮 vira Rose). Devolve null quando sobra pouco para ser um nome
// (ex.: "♠❤♣♦", "s.a"): aí o atendimento pergunta o nome ou fica o provisório.
export const cleanClientName = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const cleaned = value
        .normalize('NFKC')
        .replace(/[^\p{L}\p{M}\s'-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120)
        .trim();
    const letters = cleaned.replace(/[^\p{L}]/gu, '');
    const hasRealWord = cleaned.split(' ').some(word => word.replace(/[^\p{L}]/gu, '').length >= 3);
    return letters.length >= 3 && hasRealWord ? cleaned : null;
};

export const provisionalClientName = (phone: string) => `Cliente WhatsApp final ${phone.slice(-4)}`;

const cleanLine = (value: unknown, max: number): string | null => {
    if (typeof value !== 'string') return null;
    const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
    return text || null;
};

// Observação gravada no cadastro, com a data de Brasília.
export const clientNotes = (summary: string | null, now: number) => {
    const day = new Date(now - OFFSET_MS).toISOString().slice(0, 10).split('-').reverse().join('/');
    return `Veio do WhatsApp (IA) em ${day}${summary ? `: ${summary}` : '.'}`.slice(0, 1000);
};
// Campos que pareceriam escolher a empresa: recusados com uma mensagem clara.
const COMPANY_FIELDS = /^(company|organization|organisation|empresa|org|tenant)(_?id)?$/i;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayNumber = (value: string): number | null => {
    const match = DATE_PATTERN.exec(value);
    if (!match) return null;
    const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    // Recusa datas que não existem (ex.: 2026-02-30).
    return new Date(ms).toISOString().slice(0, 10) === value ? ms / DAY_MS : null;
};

export const parseCrmCommand = (payload: unknown): CrmCommand | { invalid: string } => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { invalid: 'Pedido inválido.' };
    const body = payload as Record<string, unknown>;
    const keys = Object.keys(body);
    const companyField = keys.find(key => COMPANY_FIELDS.test(key));
    if (companyField) return { invalid: `A empresa vem da chave de acesso; não envie "${companyField}".` };

    const action = body.action;
    if (action !== 'propostas' && action !== 'agenda' && action !== 'cliente_salvar') {
        return { invalid: 'Ação desconhecida. Use "propostas", "agenda", "cliente_salvar", "agenda_criar", "proposta_gerar", "proposta_atualizar", "proposta_consultar" ou "proposta_enviar".' };
    }
    const extra = keys.find(key => !ALLOWED_FIELDS[action].includes(key));
    if (extra) return { invalid: `Campo não aceito: "${extra.slice(0, 40)}".` };

    if (action === 'propostas') {
        const phone = phoneDigits(body.telefone);
        return phone ? { action, phone } : { invalid: 'Telefone inválido. Envie só os dígitos, com DDD.' };
    }

    if (action === 'cliente_salvar') {
        const phone = phoneDigits(body.telefone);
        if (!phone) return { invalid: 'Telefone inválido. Envie só os dígitos, com DDD.' };
        for (const field of ['nome', 'bairro', 'cidade', 'resumo', 'pelicula']) {
            if (body[field] != null && typeof body[field] !== 'string') return { invalid: `O campo "${field}" precisa ser texto.` };
        }
        if (typeof body.resumo === 'string' && body.resumo.length > 800) return { invalid: 'Resumo grande demais (máximo 800 caracteres).' };
        const measurements = parseDraftMeasurements(body.medidas);
        if (!Array.isArray(measurements)) return measurements;
        return {
            action,
            phone,
            name: cleanClientName(body.nome),
            bairro: cleanLine(body.bairro, 80),
            cidade: cleanLine(body.cidade, 80),
            measurements,
            film: cleanLine(body.pelicula, 80),
            summary: cleanLine(body.resumo, 800),
        };
    }

    const from = typeof body.de === 'string' ? body.de : '';
    const to = typeof body.ate === 'string' ? body.ate : '';
    const fromDay = dayNumber(from);
    const toDay = dayNumber(to);
    if (fromDay == null || toDay == null) return { invalid: 'Datas inválidas. Use "de" e "ate" no formato AAAA-MM-DD.' };
    if (toDay < fromDay) return { invalid: 'A data "ate" precisa ser igual ou depois de "de".' };
    if (toDay - fromDay + 1 > MAX_AGENDA_DAYS) return { invalid: `Consulte no máximo ${MAX_AGENDA_DAYS} dias por vez.` };
    return { action, from, to };
};

export const requiredScope = (command: CrmCommand): CrmScope =>
    command.action === 'propostas' ? 'proposals:read'
        : command.action === 'agenda' ? 'agenda:read'
            : 'clients:create';

// Aviso no celular da empresa quando o atendimento salva um cliente.
export const saveClientPush = (result: { clientId: number; name: string; created: boolean }, bairro: string | null) => ({
    title: result.created ? 'Novo cliente pronto para orçamento' : 'Cliente pediu orçamento de novo',
    body: `${result.name.slice(0, 80)}${bairro ? ` (${bairro})` : ''}, pelo WhatsApp.`,
    tag: `crm-client-${result.clientId}`,
    url: `/?tab=client&cliente=${result.clientId}`,
});

// Início do primeiro dia e início do dia seguinte ao último, no horário de Brasília.
export const agendaRange = (from: string, to: string) => ({
    fromIso: new Date(`${from}T00:00:00${OFFSET}`).toISOString(),
    toIso: new Date(Date.parse(`${to}T00:00:00${OFFSET}`) + DAY_MS).toISOString(),
});

const time = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
};

// Data e hora de Brasília, ex.: 2026-11-24T14:00-03:00.
export const localIso = (ms: number) => `${new Date(ms - OFFSET_MS).toISOString().slice(0, 16)}${OFFSET}`;
const localIsoOrNull = (value: unknown) => {
    const ms = time(value);
    return ms == null ? null : localIso(ms);
};

const money = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
};

const firstName = (name: unknown) => String(name ?? '').trim().split(/\s+/)[0]?.slice(0, 40) || null;

// ---------------------------------------------------------------- propostas

export interface ProposalRows {
    clients: Array<{ id: number; nome: string | null; bairro?: string | null; cidade?: string | null }>;
    portals: any[];
    items: any[];
    pdfs: any[];
    company?: { payment_methods?: any[]; prazo_pagamento?: string | null; proposal_validity_days?: number | null } | null;
}

export interface PaymentOut {
    forma: string;
    descricao: string;
    parcelas: number;
    valor_parcela: number;
    total: number;
}

export interface ProposalOptionOut {
    id: number;
    nome: string | null;
    versao: number;
    situacao_orcamento: 'pendente' | 'aprovado' | 'revisado' | 'nao_informada';
    recomendada: boolean;
    escolhida: boolean;
    peliculas: string[];
    area_m2: number | null;
    valor_total: number;
    condicao_especial: {
        valor_original: number | null;
        valor_final: number | null;
        desconto_valor: number | null;
        desconto_percentual: number | null;
        valida_ate: string | null;
    } | null;
    pagamento: { prazo: string | null; opcoes: PaymentOut[]; origem: 'proposta' | 'padrao_empresa' | 'nao_configurado' };
    emitida_em: string | null;
    valida_ate: string | null;
}

export type ProposalSituation =
    | 'aguardando_resposta' | 'em_negociacao' | 'aprovada' | 'recusada' | 'vencida' | 'perdida' | 'sem_link';

export interface ProposalOut {
    id: string;
    tipo: 'link' | 'orcamentos_sem_link';
    cliente_ref: number;
    situacao: ProposalSituation;
    criada_em: string | null;
    valida_ate: string | null;
    visualizacoes: number | null;
    ultima_visualizacao_em: string | null;
    decisao_em: string | null;
    opcao_recomendada_id: number | null;
    opcao_escolhida_id: number | null;
    // O CRM não guarda prazo de instalação (o PDF diz "a ser definido em comum acordo").
    prazo_instalacao: null;
    opcoes: ProposalOptionOut[];
}

export interface ProposalsResponse {
    encontrado: boolean;
    // Bairro e cidade do próprio cliente (do cadastro), nunca rua, número ou CEP.
    clientes: Array<{ ref: number; primeiro_nome: string | null; bairro: string | null; cidade: string | null }>;
    propostas: ProposalOut[];
    avisos: string[];
}

const PDF_STATUS: Record<string, ProposalOptionOut['situacao_orcamento']> = {
    pending: 'pendente', approved: 'aprovado', revised: 'revisado',
};

const portalSituation = (portal: any, now: number): ProposalSituation => {
    if (portal.lost_at) return 'perdida';
    if (portal.status === 'approved') return 'aprovada';
    if (portal.status === 'rejected') return 'recusada';
    if (portal.status === 'expired') return 'vencida';
    const expiresAt = time(portal.expires_at);
    if (expiresAt != null && expiresAt <= now) return 'vencida';
    return portal.status === 'negotiating' ? 'em_negociacao' : 'aguardando_resposta';
};

const paymentFor = (total: number, pdf: any, company: ProposalRows['company']): ProposalOptionOut['pagamento'] => {
    const own = pdf?.payment_config;
    const ownMethods = Array.isArray(own?.paymentMethods) ? own.paymentMethods : null;
    const companyMethods = Array.isArray(company?.payment_methods) ? company!.payment_methods : [];
    const methods = ownMethods ?? companyMethods;
    const origem = ownMethods ? 'proposta' : companyMethods.length ? 'padrao_empresa' : 'nao_configurado';
    const prazo = (typeof own?.prazoPagamento === 'string' && own.prazoPagamento.trim())
        || (company?.prazo_pagamento ?? null);
    return {
        prazo: prazo ? String(prazo).slice(0, 300) : null,
        origem,
        opcoes: buildPaymentOptions(total, methods).map(option => ({
            forma: option.methodType,
            descricao: option.label,
            parcelas: option.installments,
            valor_parcela: option.installmentValue,
            total: option.customerTotal,
        })),
    };
};

const shapeOption = (
    pdf: any, item: any | null, portal: any | null, company: ProposalRows['company'],
): ProposalOptionOut => {
    const pricing = item && portal ? resolvePortalPricing(pdf, item, portal.expires_at) : null;
    const hasCondition = pricing != null && pricing.conditionFinalValue != null;
    const total = money(hasCondition ? pricing!.conditionFinalValue : pdf.total_preco) ?? 0;
    const id = Number(pdf.id);
    return {
        id,
        nome: pdf.proposal_option_name ? String(pdf.proposal_option_name).slice(0, 120) : null,
        versao: Math.max(0, Number(pdf.follow_up_revision) || 0) + 1,
        situacao_orcamento: PDF_STATUS[pdf.status] ?? 'nao_informada',
        recomendada: portal?.highlighted_pdf_id != null && Number(portal.highlighted_pdf_id) === id,
        escolhida: portal?.decision_pdf_id != null && Number(portal.decision_pdf_id) === id && portal.status === 'approved',
        peliculas: Array.isArray(pdf.films) ? pdf.films.filter((film: unknown) => typeof film === 'string' && film.trim()).slice(0, 20) : [],
        area_m2: money(pdf.total_m2),
        valor_total: total,
        condicao_especial: hasCondition ? {
            valor_original: money(pricing!.conditionOriginalValue),
            valor_final: money(pricing!.conditionFinalValue),
            desconto_valor: money(pricing!.conditionDiscountAmount),
            desconto_percentual: money(pricing!.conditionDiscountPercent),
            valida_ate: localIsoOrNull(pricing!.conditionExpiresAt),
        } : null,
        pagamento: paymentFor(total, pdf, company),
        emitida_em: localIsoOrNull(pdf.date),
        valida_ate: localIsoOrNull(pdf.expiration_date),
    };
};

export const shapeProposals = (rows: ProposalRows, now: number): ProposalsResponse => {
    const clients = Array.isArray(rows?.clients) ? rows.clients : [];
    const portals = Array.isArray(rows?.portals) ? rows.portals : [];
    const items = Array.isArray(rows?.items) ? rows.items : [];
    const pdfs = Array.isArray(rows?.pdfs) ? rows.pdfs : [];
    const clientIds = new Set(clients.map(client => Number(client.id)));
    const pdfById = new Map(pdfs.filter(pdf => clientIds.has(Number(pdf.client_id))).map(pdf => [Number(pdf.id), pdf]));
    const avisos: string[] = [];

    const propostas: ProposalOut[] = [];
    const inPortal = new Set<number>();
    for (const portal of portals) {
        if (!clientIds.has(Number(portal.client_id))) continue;
        const portalItems = items
            .filter(item => item.portal_id === portal.id)
            .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
        const opcoes = portalItems.flatMap(item => {
            const pdf = pdfById.get(Number(item.saved_pdf_id));
            if (!pdf || Number(pdf.client_id) !== Number(portal.client_id)) return [];
            inPortal.add(Number(pdf.id));
            return [shapeOption(pdf, item, portal, rows.company)];
        });
        if (!opcoes.length) continue;
        const escolhida = opcoes.find(option => option.escolhida);
        const recomendada = opcoes.find(option => option.recomendada);
        propostas.push({
            id: `link:${portal.id}`,
            tipo: 'link',
            cliente_ref: Number(portal.client_id),
            situacao: portalSituation(portal, now),
            criada_em: localIsoOrNull(portal.created_at),
            valida_ate: localIsoOrNull(portal.expires_at),
            visualizacoes: Number(portal.view_count) || 0,
            ultima_visualizacao_em: localIsoOrNull(portal.last_viewed_at),
            decisao_em: localIsoOrNull(portal.decision_at),
            opcao_recomendada_id: recomendada?.id ?? null,
            opcao_escolhida_id: escolhida?.id ?? null,
            prazo_instalacao: null,
            opcoes,
        });
    }

    // Orçamentos que não foram enviados por link: um grupo por cliente.
    for (const client of clients) {
        const loose = pdfs
            .filter(pdf => Number(pdf.client_id) === Number(client.id) && !inPortal.has(Number(pdf.id)))
            .sort((a, b) => Number(b.id) - Number(a.id));
        if (!loose.length) continue;
        propostas.push({
            id: `orcamentos:${client.id}`,
            tipo: 'orcamentos_sem_link',
            cliente_ref: Number(client.id),
            situacao: 'sem_link',
            criada_em: localIsoOrNull(loose[loose.length - 1].date),
            valida_ate: null,
            visualizacoes: null,
            ultima_visualizacao_em: null,
            decisao_em: null,
            opcao_recomendada_id: null,
            opcao_escolhida_id: null,
            prazo_instalacao: null,
            opcoes: loose.map(pdf => shapeOption(pdf, null, null, rows.company)),
        });
    }

    if (clients.length > 1) avisos.push('Mais de um cadastro com este telefone; confira o cliente_ref antes de responder.');
    if (propostas.length) avisos.push('O CRM não guarda prazo de instalação: não informe um prazo sem confirmar com a equipe.');

    return {
        encontrado: clients.length > 0,
        clientes: clients.map(client => ({
            ref: Number(client.id),
            primeiro_nome: firstName(client.nome),
            bairro: client.bairro ? String(client.bairro).trim().slice(0, 80) || null : null,
            cidade: client.cidade ? String(client.cidade).trim().slice(0, 80) || null : null,
        })),
        propostas,
        avisos,
    };
};

// ---------------------------------------------------------------- agenda

export interface AgendaRows {
    events: Array<{ start: string; end: string | null; event_type: string | null; service_status: string | null; bairro: string | null; cidade: string | null }>;
    working_hours: { start?: unknown; end?: unknown; days?: unknown } | null;
}

export interface AgendaResponse {
    fuso: string;
    de: string;
    ate: string;
    horario_trabalho: { inicio: string; fim: string; dias_semana: number[] } | null;
    ocupados: Array<{ inicio: string; fim: string; tipo: string; situacao: string; bairro: string | null; cidade: string | null }>;
    livres: Array<{ inicio: string; fim: string }> | null;
    avisos: string[];
}

const EVENT_TYPES: Record<string, string> = {
    consulta: 'visita_orcamento', instalacao: 'instalacao', variado: 'variado', outro: 'outro',
};
const EVENT_STATUS: Record<string, string> = {
    scheduled: 'agendado', completed: 'concluido', partial: 'parcial',
};

const HOUR_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutesOf = (value: unknown) => {
    const match = typeof value === 'string' ? HOUR_PATTERN.exec(value.trim()) : null;
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const normalizeWorkingHours = (value: AgendaRows['working_hours']) => {
    if (!value || typeof value !== 'object') return null;
    const start = minutesOf(value.start);
    const end = minutesOf(value.end);
    const days = Array.isArray(value.days)
        ? [...new Set(value.days.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
        : [];
    if (start == null || end == null || end <= start || !days.length) return null;
    return { start, end, days, inicio: String(value.start).trim(), fim: String(value.end).trim() };
};

type Interval = { start: number; end: number };

// Janelas do horário de trabalho menos os compromissos marcados, a partir de agora.
export const freeSlots = (
    from: string, to: string, hours: NonNullable<ReturnType<typeof normalizeWorkingHours>>, busy: Interval[], now: number,
): Interval[] => {
    const firstDay = Date.parse(`${from}T00:00:00${OFFSET}`);
    const lastDay = Date.parse(`${to}T00:00:00${OFFSET}`);
    const sortedBusy = [...busy].sort((a, b) => a.start - b.start);
    const slots: Interval[] = [];
    for (let day = firstDay; day <= lastDay; day += DAY_MS) {
        // day é meia-noite de Brasília (03:00 UTC): o dia da semana em UTC é o mesmo.
        const weekday = new Date(day).getUTCDay();
        if (!hours.days.includes(weekday)) continue;
        let cursor = Math.max(day + hours.start * 60_000, now);
        const close = day + hours.end * 60_000;
        for (const interval of sortedBusy) {
            if (interval.end <= cursor || interval.start >= close) continue;
            if (interval.start > cursor) slots.push({ start: cursor, end: Math.min(interval.start, close) });
            cursor = Math.max(cursor, interval.end);
            if (cursor >= close) break;
        }
        if (cursor < close) slots.push({ start: cursor, end: close });
    }
    return slots.filter(slot => slot.end - slot.start >= MIN_FREE_MINUTES * 60_000);
};

export const shapeAgenda = (rows: AgendaRows, from: string, to: string, now: number): AgendaResponse => {
    const events = Array.isArray(rows?.events) ? rows.events : [];
    const busy: Interval[] = [];
    const ocupados = events.flatMap(event => {
        const start = time(event.start);
        if (start == null) return [];
        const ownEnd = time(event.end);
        const end = ownEnd != null && ownEnd > start ? ownEnd : start + DEFAULT_EVENT_MINUTES * 60_000;
        busy.push({ start, end });
        return [{
            inicio: localIso(start),
            fim: localIso(end),
            tipo: EVENT_TYPES[event.event_type ?? ''] ?? 'nao_informado',
            situacao: EVENT_STATUS[event.service_status ?? 'scheduled'] ?? 'agendado',
            bairro: event.bairro ? String(event.bairro).slice(0, 80) : null,
            cidade: event.cidade ? String(event.cidade).slice(0, 80) : null,
        }];
    });

    const hours = normalizeWorkingHours(rows?.working_hours ?? null);
    const avisos: string[] = [];
    if (!hours) avisos.push('Horário de trabalho não configurado no CRM: não há como calcular horários livres. Confirme com a equipe.');
    if (events.length >= 500) avisos.push('Agenda muito cheia: só os primeiros 500 compromissos vieram. Consulte um intervalo menor.');
    avisos.push('Horário livre não é reserva: confirme com a equipe antes de prometer um horário ao cliente.');

    return {
        fuso: CRM_TIME_ZONE,
        de: from,
        ate: to,
        horario_trabalho: hours ? { inicio: hours.inicio, fim: hours.fim, dias_semana: hours.days } : null,
        ocupados,
        livres: hours ? freeSlots(from, to, hours, busy, now).map(slot => ({ inicio: localIso(slot.start), fim: localIso(slot.end) })) : null,
        avisos,
    };
};
