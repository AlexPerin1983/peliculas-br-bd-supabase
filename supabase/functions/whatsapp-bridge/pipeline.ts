// Quadro do funil de vendas para o painel do WhatsApp conectado. Recebe as linhas do
// banco (mesmas colunas que o app lê em loadCompanyProposalPortals) e devolve um
// cartão por proposta, com a coluna, o próximo passo e a mensagem pronta.
// Puro (sem Deno nem Supabase): testado no Vitest.
import { resolvePortalPricing } from '../proposal-portal/followUpPricing.ts';
import {
    type BoardColumn, type CadenceSettings, type CorePortal, type FollowUpStep, type FollowUpTemplates,
    boardColumn, connectedRemindersSent, getFollowUpItem, lastFollowUpContactAt, portalTotal,
} from './followUpCore.ts';

export const PIPELINE_PORTAL_COLUMNS = 'id, token, client_id, expires_at, status, view_count, created_at, last_viewed_at, lost_at';
export const PIPELINE_ITEM_COLUMNS = 'portal_id, saved_pdf_id, position, condition_original_value, condition_final_value, condition_discount_amount, condition_discount_percent, condition_expires_at, saved_pdfs(proposal_option_name, nome_arquivo, total_preco, follow_up_base_value, follow_up_discount_percent, follow_up_discount_amount, follow_up_revision)';
export const PIPELINE_MESSAGE_COLUMNS = 'portal_id, sender_type, kind, created_at';
export const PIPELINE_FOLLOW_UP_COLUMNS = 'portal_id, kind, step, channel, remind_at, created_at';

// Aprovadas e vencidas somem do quadro depois de 30 dias (ver boardColumn).
export const PIPELINE_LOOKBACK_DAYS = 31;

// Mesmo número que whatsapp_phone_digits() no banco.
export const phoneDigits = (phone: unknown): string | null => {
    const digits = String(phone ?? '').replace(/\D/g, '').replace(/^0+/, '');
    if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
    return /^\d{12,15}$/.test(digits) ? digits : null;
};

export interface PipelineRows {
    portals: any[];
    clients: any[];
    items: any[];
    messages: any[];
    followUps: any[];
    templates: Array<{ id: number; follow_up_step: string | null; body: string | null }>;
    queued: Array<{ id: number; portal_id: string; step: string | null; status: string }>;
}

export interface PipelineCard {
    portalId: string;
    clientId: number;
    clientName: string;
    phone: string | null;
    column: BoardColumn;
    step: FollowUpStep | null;
    title: string;
    hint: string;
    message: string | null;
    dueAt: number | null;
    due: boolean;
    snoozedUntil: number | null;
    total: number;
    expiresAt: string;
    status: string;
    viewCount: number;
    lastViewedAt: string | null;
    createdAt: string;
    lastContactAt: number | null;
    remindersSent: number;
    queued: { id: number; step: string | null; status: string } | null;
}

// Modelo mais recente de cada passo (igual ao app: o último salvo vale).
export const templatesByStep = (rows: PipelineRows['templates']): FollowUpTemplates => {
    const templates: Record<string, string> = {};
    for (const row of [...rows].sort((a, b) => a.id - b.id)) {
        if (row.follow_up_step && row.body?.trim()) templates[row.follow_up_step] = row.body;
    }
    return templates as FollowUpTemplates;
};

export const toCorePortal = (portal: any, rows: Pick<PipelineRows, 'clients' | 'items' | 'messages' | 'followUps'>): CorePortal & { clientPhone: string | null } => {
    const client = rows.clients.find(row => Number(row.id) === Number(portal.client_id));
    return {
        id: portal.id,
        token: portal.token,
        clientId: Number(portal.client_id),
        clientName: client?.nome || 'Cliente',
        clientPhone: client?.telefone ?? null,
        status: portal.status,
        expiresAt: portal.expires_at,
        createdAt: portal.created_at,
        viewCount: Number(portal.view_count || 0),
        lastViewedAt: portal.last_viewed_at,
        lostAt: portal.lost_at,
        messages: rows.messages.filter(row => row.portal_id === portal.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
        followUps: rows.followUps.filter(row => row.portal_id === portal.id),
        proposals: rows.items.filter(row => row.portal_id === portal.id)
            .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
            .map(row => ({
                id: Number(row.saved_pdf_id),
                name: row.saved_pdfs?.proposal_option_name || row.saved_pdfs?.nome_arquivo || `Proposta #${row.saved_pdf_id}`,
                total: Number(row.saved_pdfs?.total_preco || 0),
                ...resolvePortalPricing(row.saved_pdfs, row, portal.expires_at),
            })),
    };
};

const COLUMN_ORDER: Record<BoardColumn, number> = { replied: 0, no_reply: 1, deadline: 2, sent: 3, won: 4 };

export const buildPipeline = (
    rows: PipelineRows,
    now: number,
    options: { origin: string; cadence?: CadenceSettings; timeZone?: string },
): PipelineCard[] => {
    const templates = templatesByStep(rows.templates);
    const cards: PipelineCard[] = [];
    for (const row of rows.portals) {
        if (row.status === 'revoked') continue;
        const portal = toCorePortal(row, rows);
        const item = getFollowUpItem(portal, now, { origin: options.origin, templates, cadence: options.cadence, timeZone: options.timeZone });
        const column = boardColumn(portal, item, now);
        if (!column) continue;
        const queued = rows.queued.find(entry => entry.portal_id === portal.id && ['pending', 'sending'].includes(entry.status));
        const lastContact = lastFollowUpContactAt(portal);
        cards.push({
            portalId: portal.id,
            clientId: portal.clientId,
            clientName: portal.clientName,
            phone: phoneDigits(portal.clientPhone),
            column,
            step: item?.step ?? null,
            title: item?.title ?? 'Proposta aprovada',
            hint: item?.hint ?? 'Combine a instalação e, depois do serviço, peça a avaliação.',
            message: item?.message ?? null,
            dueAt: item?.dueAt ?? null,
            due: item?.due ?? false,
            snoozedUntil: item?.snoozedUntil ?? null,
            total: portalTotal(portal),
            expiresAt: portal.expiresAt,
            status: portal.status,
            viewCount: portal.viewCount,
            lastViewedAt: portal.lastViewedAt ?? null,
            createdAt: portal.createdAt || '',
            lastContactAt: lastContact || null,
            remindersSent: connectedRemindersSent(portal),
            queued: queued ? { id: queued.id, step: queued.step, status: queued.status } : null,
        });
    }
    return cards.sort((a, b) => COLUMN_ORDER[a.column] - COLUMN_ORDER[b.column] || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
};
