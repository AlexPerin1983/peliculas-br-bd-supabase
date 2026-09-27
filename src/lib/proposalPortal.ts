import { resolvePortalPricing } from '../../supabase/functions/proposal-portal/followUpPricing';
import { supabase } from '../../services/supabaseClient';
import { offlineDb, type LocalSavedPDF, type SyncQueueItem } from '../../services/offlineDb';
import { isOnlineNow, syncAllPending } from '../../services/syncService';
import type { Client, ProposalPaymentChoice, ProposalPaymentSelection, SavedPDF } from '../../types';
import type { ProposalConditionFields } from './proposalCondition';
import type { PublicPortalShowcase } from '../../supabase/functions/proposal-portal/portalShowcase';

export type ProposalPortalDecision = 'approved' | 'rejected' | 'negotiation';
export type ProposalOfferType = 'percentage' | 'fixed';
export type ProposalPortalMessageKind = 'message' | ProposalPortalDecision | 'condition_extended' | 'condition_updated';

export interface ProposalPortalMessage {
    id: number;
    saved_pdf_id?: number | null;
    sender_type: 'client' | 'company';
    kind: ProposalPortalMessageKind;
    body?: string | null;
    offer_type?: ProposalOfferType | null;
    offer_value?: number | null;
    condition_value?: number | null;
    payment_selection?: ProposalPaymentSelection | null;
    created_at: string;
}

export interface PublicProposalPortal {
    portal: {
        id: string;
        token: string;
        expires_at: string;
        status: 'active' | 'approved' | 'rejected' | 'negotiating' | 'expired' | 'revoked';
        decision_pdf_id?: number | null;
        decision_at?: string | null;
        last_activity_at?: string;
        expired: boolean;
    };
    clientName: string;
    company: {
        name: string;
        phone?: string;
        email?: string;
        logo?: string;
        colors?: { primaria?: string; secundaria?: string };
        // Nota do Google, depoimentos e fotos de trabalhos (quando a empresa preencheu).
        showcase?: PublicPortalShowcase | null;
    };
    proposals: Array<Pick<SavedPDF, 'id' | 'proposalOptionName' | 'nomeArquivo' | 'totalPreco' | 'totalM2' | 'date' | 'expirationDate' | 'status' | 'paymentConfig'> & ProposalConditionFields & { highlighted?: boolean }>;
    messages: ProposalPortalMessage[];
}

export interface PublicProposalPortalUnchanged {
    unchanged: true;
    lastActivityAt: string;
}

const invokePublicPortal = async <T>(body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.functions.invoke('proposal-portal', { body });
    if (error) throw new Error(error.message || 'Nao foi possivel acessar a proposta.');
    if (data?.error) throw new Error(data.error);
    return data as T;
};

export const loadPublicProposalPortal = (token: string, trackView = false, knownActivityAt?: string) =>
    invokePublicPortal<PublicProposalPortal | PublicProposalPortalUnchanged>({
        token,
        action: 'load',
        trackView,
        knownActivityAt,
    });

// Abre o PDF no leitor do navegador. A aba nasce no toque (senão o celular bloqueia
// a janela aberta depois da espera) e recebe o endereço quando ele chega.
export const openPublicProposalPdf = async (token: string, proposalId: number) => {
    const tab = window.open('', '_blank');
    if (tab) {
        try {
            tab.document.title = 'Abrindo proposta…';
            tab.document.body.innerHTML = '<p style="font:15px system-ui,sans-serif;color:#64748b;padding:32px;text-align:center">Abrindo o PDF…</p>';
        } catch {
            // A aba pode não permitir escrever; segue só com o endereço.
        }
    }
    try {
        const result = await invokePublicPortal<{ url: string }>({ token, action: 'download', proposalId, mode: 'view' });
        // Servidor ainda sem o modo "ver" devolve endereço de download: baixa como antes, sem aba parada.
        const isDownload = /[?&]download=/.test(result.url);
        if (tab && !tab.closed && !isDownload) {
            tab.location.href = result.url;
        } else {
            tab?.close();
            window.location.assign(result.url);
        }
    } catch (error) {
        tab?.close();
        throw error;
    }
};

export const sendPublicProposalMessage = (token: string, body: string) =>
    invokePublicPortal<{ ok: true }>({ token, action: 'message', body });

export const respondToPublicProposal = (
    token: string,
    proposalId: number,
    kind: ProposalPortalDecision,
    options: { body?: string; offerType?: ProposalOfferType; offerValue?: number; paymentChoice?: ProposalPaymentChoice } = {}
) => invokePublicPortal<{ ok: true; status: PublicProposalPortal['portal']['status'] }>({
    token,
    action: 'respond',
    proposalId,
    kind,
    ...options,
});

export interface CreatedProposalPortal {
    portalId: string;
    token: string;
    shareCode: string;
    expiresAt: string;
    url: string;
}

export const buildProposalClientSlug = (clientName = 'cliente') => {
    const firstName = clientName.trim().split(/\s+/)[0] || 'cliente';
    return firstName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'cliente';
};

export const buildProposalPortalUrl = (accessKey: string, clientName?: string) => {
    const url = new URL(window.location.origin);
    if (clientName) {
        url.pathname = `/p/${buildProposalClientSlug(clientName)}/${encodeURIComponent(accessKey)}`;
    } else {
        url.pathname = '/proposta';
        url.searchParams.set('token', accessKey);
    }
    return url.toString();
};

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const PDF_SYNC_TIMEOUT_MS = 15_000;
const PDF_SYNC_POLL_MS = 120;

const isPersistedPdfId = (value: unknown): value is number => (
    typeof value === 'number'
    && Number.isInteger(value)
    && value > 0
    && value <= POSTGRES_INTEGER_MAX
);

const getTemporaryPdfId = (localId?: string): number | undefined => {
    if (!localId) return undefined;
    const timestamp = Number.parseInt(localId.split('_')[1] || '', 10);
    return Number.isFinite(timestamp) ? -timestamp : undefined;
};

const findLocalProposalPdf = (pdfId: number): Promise<LocalSavedPDF | undefined> => (
    offlineDb.savedPdfs
        .filter(item => (
            item.id === pdfId
            || item._remoteId === pdfId
            || getTemporaryPdfId(item._localId) === pdfId
        ))
        .first()
);

const resolvePersistedPdfId = (pdfId: number, localPdf?: LocalSavedPDF): number | undefined => {
    if (isPersistedPdfId(localPdf?._remoteId)) return localPdf._remoteId;
    if (isPersistedPdfId(localPdf?.id)) return localPdf.id;
    if (isPersistedPdfId(pdfId)) return pdfId;
    return undefined;
};

const isQueuedPdfMutation = (
    item: SyncQueueItem,
    pdfId: number,
    localPdf: LocalSavedPDF | undefined,
    persistedPdfId: number | undefined
) => {
    if (item.table !== 'savedPdfs' || (item.action !== 'create' && item.action !== 'update')) {
        return false;
    }

    const queuedLocalId = item.data?._localId;
    const queuedRemoteId = isPersistedPdfId(item.data?._remoteId)
        ? item.data._remoteId
        : isPersistedPdfId(item.data?.id)
            ? item.data.id
            : undefined;
    const queuedTemporaryId = getTemporaryPdfId(queuedLocalId);

    return Boolean(
        (localPdf?._localId && queuedLocalId === localPdf._localId)
        || (persistedPdfId && queuedRemoteId === persistedPdfId)
        || queuedTemporaryId === pdfId
    );
};

const readProposalPdfSyncState = async (pdfIds: number[]) => {
    const [localPdfs, queuedMutations] = await Promise.all([
        Promise.all(pdfIds.map(findLocalProposalPdf)),
        offlineDb.syncQueue
            .where('table')
            .equals('savedPdfs')
            .toArray(),
    ]);

    return pdfIds.map((pdfId, index) => {
        const localPdf = localPdfs[index];
        const persistedPdfId = resolvePersistedPdfId(pdfId, localPdf);
        return {
            persistedPdfId,
            hasPendingMutation: queuedMutations.some(item => (
                isQueuedPdfMutation(item, pdfId, localPdf, persistedPdfId)
            )),
        };
    });
};

export const resolvePersistedProposalPdfIds = async (pdfIds: number[]): Promise<number[]> => {
    const initialState = await readProposalPdfSyncState(pdfIds);
    if (initialState.every(item => isPersistedPdfId(item.persistedPdfId) && !item.hasPendingMutation)) {
        return initialState.map(item => item.persistedPdfId as number);
    }

    if (!isOnlineNow()) {
        throw new Error('Conecte-se \u00e0 internet para terminar de salvar o or\u00e7amento e criar o link.');
    }

    // Uma proposta pode ja ter ID remoto e ainda possuir uma alteracao local
    // pendente (por exemplo, logo apos renomear a opcao). O portal le os dados
    // do servidor, entao aguardamos tambem a fila dessa proposta ser concluida.
    // Se outra sincronizacao estiver em andamento, syncAllPending agenda uma
    // nova passagem e o polling abaixo acompanha a retirada do item da fila.
    await syncAllPending({ force: true });
    const deadline = Date.now() + PDF_SYNC_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const state = await readProposalPdfSyncState(pdfIds);
        if (state.every(item => isPersistedPdfId(item.persistedPdfId) && !item.hasPendingMutation)) {
            return state.map(item => item.persistedPdfId as number);
        }
        await new Promise(resolve => window.setTimeout(resolve, PDF_SYNC_POLL_MS));
    }

    throw new Error('O or\u00e7amento ainda est\u00e1 sendo salvo. Aguarde alguns segundos e tente criar o link novamente.');
};

export const createProposalPortal = async (pdfs: SavedPDF[], expirationDate: string, clientName: string): Promise<CreatedProposalPortal> => {
    const pdfIds = pdfs.map(pdf => pdf.id).filter((id): id is number => typeof id === 'number');
    if (pdfIds.length !== pdfs.length || pdfIds.length === 0) {
        throw new Error('Salve as propostas antes de criar o link.');
    }

    const expiresAt = new Date(`${expirationDate}T23:59:59`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new Error('Escolha uma validade futura.');
    }

    const persistedPdfIds = await resolvePersistedProposalPdfIds(pdfIds);
    const { data, error } = await supabase.rpc('create_proposal_portal', {
        p_pdf_ids: persistedPdfIds,
        p_expires_at: expiresAt.toISOString(),
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.portal_token) throw new Error('O link nao foi criado.');

    // The RPC already confirms that the portal was committed. Building the URL
    // from that response avoids a second read that can briefly fail because of
    // schema cache/RLS propagation and incorrectly report a failed creation.
    // Newer RPC versions may also return portal_share_code; older deployments
    // remain fully compatible by using the secure portal token.
    const accessKey = typeof row.portal_share_code === 'string' && row.portal_share_code.trim()
        ? row.portal_share_code
        : row.portal_token;

    return {
        portalId: row.portal_id,
        token: row.portal_token,
        shareCode: accessKey,
        expiresAt: row.expires_at,
        url: buildProposalPortalUrl(accessKey, clientName),
    };
};

// Links já criados para o cliente destas propostas (sem os encerrados), do mais novo ao mais antigo.
export interface ExistingProposalPortal {
    id: string;
    url: string;
    status: PublicProposalPortal['portal']['status'];
    expiresAt: string;
    createdAt: string;
    expired: boolean;
    viewCount: number;
    lastViewedAt?: string | null;
    proposals: Array<{ id: number; name: string; total: number }>;
    // Mostra exatamente as propostas selecionadas agora.
    sameProposals: boolean;
    // Ainda pode ser atualizado (não foi aprovado nem recusado).
    updatable: boolean;
}

export const findClientProposalPortals = async (pdfs: SavedPDF[], clientName: string): Promise<ExistingProposalPortal[]> => {
    const pdfIds = pdfs.map(pdf => pdf.id).filter((id): id is number => typeof id === 'number');
    if (pdfIds.length === 0 || !isOnlineNow()) return [];

    const persistedPdfIds = await resolvePersistedProposalPdfIds(pdfIds);
    const { data: pdfRows, error: pdfError } = await supabase.from('saved_pdfs').select('client_id').in('id', persistedPdfIds);
    if (pdfError) throw pdfError;
    const clientIds = Array.from(new Set((pdfRows || []).map(row => Number(row.client_id))));
    if (clientIds.length !== 1) return [];

    const { data: portals, error } = await supabase
        .from('proposal_portals')
        .select('id, token, status, expires_at, created_at, view_count, last_viewed_at, proposal_portal_items(saved_pdf_id, position, saved_pdfs(proposal_option_name, nome_arquivo, total_preco))')
        .eq('client_id', clientIds[0])
        .neq('status', 'revoked')
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) throw error;

    const selectedKey = [...persistedPdfIds].sort((a, b) => a - b).join(',');
    return (portals || []).map((portal: any) => {
        const items = [...(portal.proposal_portal_items || [])].sort((a: any, b: any) => a.position - b.position);
        const expired = portal.status === 'expired' || new Date(portal.expires_at).getTime() <= Date.now();
        return {
            id: portal.id,
            // O mesmo endereço que foi enviado ao cliente.
            url: buildProposalPortalUrl(portal.token, clientName),
            status: portal.status,
            expiresAt: portal.expires_at,
            createdAt: portal.created_at,
            expired,
            viewCount: Number(portal.view_count || 0),
            lastViewedAt: portal.last_viewed_at,
            proposals: items.map((item: any) => ({
                id: Number(item.saved_pdf_id),
                name: item.saved_pdfs?.proposal_option_name || item.saved_pdfs?.nome_arquivo || `Proposta #${item.saved_pdf_id}`,
                total: Number(item.saved_pdfs?.total_preco || 0),
            })),
            sameProposals: items.map((item: any) => Number(item.saved_pdf_id)).sort((a: number, b: number) => a - b).join(',') === selectedKey,
            updatable: !['approved', 'rejected'].includes(portal.status),
        };
    });
};

// Mantém o endereço e a conversa; troca as propostas mostradas e a validade.
export const refreshProposalPortal = async (portalId: string, pdfs: SavedPDF[], expirationDate: string, clientName: string): Promise<CreatedProposalPortal> => {
    const pdfIds = pdfs.map(pdf => pdf.id).filter((id): id is number => typeof id === 'number');
    if (pdfIds.length !== pdfs.length || pdfIds.length === 0) {
        throw new Error('Salve as propostas antes de atualizar o link.');
    }
    const expiresAt = new Date(`${expirationDate}T23:59:59`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new Error('Escolha uma validade futura.');
    }

    const persistedPdfIds = await resolvePersistedProposalPdfIds(pdfIds);
    const { data, error } = await supabase.rpc('refresh_proposal_portal', {
        p_portal_id: portalId,
        p_pdf_ids: persistedPdfIds,
        p_expires_at: expiresAt.toISOString(),
    });
    if (error) throw new Error(error.message || 'Não foi possível atualizar o link.');
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.portal_token) throw new Error('O link não foi atualizado.');
    return {
        portalId: row.portal_id,
        token: row.portal_token,
        shareCode: row.portal_token,
        expiresAt: row.expires_at,
        url: buildProposalPortalUrl(row.portal_token, clientName),
    };
};

// Encerra o link: o cliente passa a ver "proposta indisponível".
export const revokeProposalPortal = async (portalId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('proposal_portals')
        .update({ status: 'revoked', updated_at: now, last_activity_at: now })
        .eq('id', portalId);
    if (error) throw new Error(error.message || 'Não foi possível encerrar o link.');
};

export const buildProposalShareMessage = (client: Client, pdfs: SavedPDF[], portalUrl: string, expiresAt: string) => {
    const firstName = client.nome.trim().split(/\s+/)[0];
    const greeting = firstName ? `Oi, ${firstName}! Tudo bem? 🙂` : 'Oi! Tudo bem? 🙂';
    const intro = pdfs.length === 1
        ? 'Preparei a sua proposta das películas. No link você vê os detalhes, baixa o PDF e pode aprovar por lá mesmo:'
        : `Preparei ${pdfs.length} opções de proposta pra você comparar. No link você vê os detalhes, baixa o PDF e pode aprovar por lá mesmo:`;
    const expiry = new Date(expiresAt).toLocaleDateString('pt-BR');
    const prices = pdfs.map(pdf => `${pdf.proposalOptionName || pdf.nomeArquivo}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pdf.totalPreco)}`).join('\n');
    return `${greeting}\n${intro}\n\n${prices}\n\n${portalUrl}\n\nA proposta vale até ${expiry}. Qualquer dúvida, é só me chamar por aqui!`;
};

export const buildProposalDecisionWhatsAppMessage = ({
    clientName,
    companyName,
    proposalName,
    proposalValue,
    decision,
    portalUrl,
}: {
    clientName: string;
    companyName: string;
    proposalName: string;
    proposalValue: number;
    decision: ProposalPortalMessage;
    portalUrl: string;
}) => {
    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);

    if (decision.kind === 'approved') {
        const paymentText = decision.payment_selection?.label
            ? `, com pagamento via ${decision.payment_selection.label}`
            : '';
        return [
            `Ol\u00e1, equipe ${companyName}!`,
            `Sou ${clientName} e aprovei a proposta de ${proposalName}, no valor de ${formatCurrency(proposalValue || 0)}${paymentText}.`,
            'Podemos agendar o servi\u00e7o?',
            '',
            `Ver proposta: ${portalUrl}`,
        ].join('\n');
    }

    const decisionLabel = decision.kind === 'approved'
        ? 'Aprovada'
        : decision.kind === 'rejected'
            ? 'Recusada'
            : 'Quero negociar';
    const lines = [
        `Ol\u00e1, equipe ${companyName}.`,
        '',
        `Sou ${clientName} e acabei de responder \u00e0 proposta:`,
        `- Proposta: ${proposalName}`,
        `- Decis\u00e3o: ${decisionLabel}`,
        `- Valor: ${formatCurrency(proposalValue || 0)}`,
    ];

    if (decision.kind === 'negotiation' && decision.offer_value != null) {
        lines.push(decision.offer_type === 'percentage'
            ? `- Condi\u00e7\u00e3o sugerida: ${decision.offer_value}% de desconto`
            : `- Valor sugerido: ${formatCurrency(decision.offer_value)}`);
    }
    if (decision.payment_selection?.label) {
        lines.push(`- Pagamento escolhido: ${decision.payment_selection.label}`);
    }
    if (decision.body?.trim()) {
        lines.push(`- Observa\u00e7\u00e3o: ${decision.body.trim()}`);
    }

    lines.push('', `Abrir proposta: ${portalUrl}`);
    return lines.join('\n');
};

export interface CompanyProposalPortal {
    id: string;
    token: string;
    shareCode?: string | null;
    clientId: number;
    clientName: string;
    expiresAt: string;
    status: PublicProposalPortal['portal']['status'];
    lastActivityAt: string;
    lastReadByCompanyAt?: string | null;
    viewCount: number;
    proposals: Array<{ id: number; name: string; total: number } & ProposalConditionFields>;
    messages: ProposalPortalMessage[];
    unreadCount: number;
    // Acompanhamento ("Para acompanhar hoje").
    createdAt?: string;
    firstViewedAt?: string | null;
    lastViewedAt?: string | null;
    clientPhone?: string | null;
    lostAt?: string | null;
    lostReason?: string | null;
    followUps?: ProposalFollowUpEvent[];
}

export interface ProposalFollowUpEvent {
    id: number;
    kind: 'contact' | 'lost' | 'reopened' | 'snooze' | 'offer';
    step?: string | null;
    channel?: 'whatsapp' | 'call' | 'other' | null;
    reason?: string | null;
    note?: string | null;
    // "Lembrar depois": quando a proposta volta para "Hoje".
    remind_at?: string | null;
    created_at: string;
}

// Com clientId, só os links daquele cliente (ficha do cliente).
export const loadCompanyProposalPortals = async (options: { clientId?: number } = {}): Promise<CompanyProposalPortal[]> => {
    let query = supabase
        .from('proposal_portals')
        .select('id, token, share_code, client_id, expires_at, status, last_activity_at, last_read_by_company_at, view_count, created_at, first_viewed_at, last_viewed_at, lost_at, lost_reason')
        .neq('status', 'revoked');
    if (options.clientId != null) query = query.eq('client_id', options.clientId);
    const { data: portals, error } = await query.order('last_activity_at', { ascending: false });
    if (error) throw error;
    if (!portals?.length) return [];

    const portalIds = portals.map(item => item.id);
    const clientIds = Array.from(new Set(portals.map(item => item.client_id)));
    const [{ data: clients }, { data: items }, { data: messages }, followUpResult] = await Promise.all([
        supabase.from('clients').select('id, nome, telefone').in('id', clientIds),
        supabase.from('proposal_portal_items').select('portal_id, saved_pdf_id, position, condition_original_value, condition_final_value, condition_discount_amount, condition_discount_percent, condition_expires_at, saved_pdfs(proposal_option_name, nome_arquivo, total_preco, follow_up_base_value, follow_up_discount_percent, follow_up_discount_amount, follow_up_revision)').in('portal_id', portalIds).order('position'),
        supabase.from('proposal_portal_messages').select('id, portal_id, saved_pdf_id, sender_type, kind, body, offer_type, offer_value, condition_value, payment_selection, created_at').in('portal_id', portalIds).order('created_at'),
        supabase.from('proposal_portal_follow_ups').select('id, portal_id, kind, step, channel, reason, note, remind_at, created_at').in('portal_id', portalIds).order('created_at'),
    ]);
    // O histórico de contatos é complemento: se falhar, as conversas continuam aparecendo.
    const followUps = followUpResult?.error ? [] : (followUpResult?.data || []);

    const clientNames = new Map((clients || []).map(client => [Number(client.id), client.nome]));
    const clientPhones = new Map((clients || []).map((client: any) => [Number(client.id), client.telefone as string | null]));
    return portals.map(portal => {
        const portalMessages = (messages || []).filter(message => message.portal_id === portal.id) as Array<ProposalPortalMessage & { portal_id: string }>;
        const readAt = portal.last_read_by_company_at ? new Date(portal.last_read_by_company_at).getTime() : 0;
        return {
            id: portal.id,
            token: portal.token,
            shareCode: portal.share_code,
            clientId: Number(portal.client_id),
            clientName: clientNames.get(Number(portal.client_id)) || 'Cliente',
            expiresAt: portal.expires_at,
            status: portal.status,
            lastActivityAt: portal.last_activity_at,
            lastReadByCompanyAt: portal.last_read_by_company_at,
            viewCount: Number(portal.view_count || 0),
            proposals: (items || []).filter(item => item.portal_id === portal.id).map((item: any) => ({
                id: Number(item.saved_pdf_id),
                name: item.saved_pdfs?.proposal_option_name || item.saved_pdfs?.nome_arquivo || `Proposta #${item.saved_pdf_id}`,
                total: Number(item.saved_pdfs?.total_preco || 0),
                ...resolvePortalPricing(item.saved_pdfs, item, portal.expires_at),
            })),
            messages: portalMessages,
            unreadCount: portalMessages.filter(message => message.sender_type === 'client' && new Date(message.created_at).getTime() > readAt).length,
            createdAt: portal.created_at,
            firstViewedAt: portal.first_viewed_at,
            lastViewedAt: portal.last_viewed_at,
            clientPhone: clientPhones.get(Number(portal.client_id)) ?? null,
            lostAt: portal.lost_at,
            lostReason: portal.lost_reason,
            followUps: (followUps as Array<ProposalFollowUpEvent & { portal_id: string }>).filter(event => event.portal_id === portal.id),
        };
    });
};

// Registra um contato de acompanhamento (mensagem, ligação...).
export const recordProposalFollowUp = async (portalId: string, step: string, channel: 'whatsapp' | 'call' | 'other', note?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Sessão encerrada. Entre novamente.');
    const { error } = await supabase.from('proposal_portal_follow_ups').insert({
        portal_id: portalId,
        kind: 'contact',
        step,
        channel,
        note: note?.trim() || null,
        created_by: auth.user.id,
    });
    if (error) throw new Error(error.message || 'Não foi possível registrar o contato.');
};

// "Perdida" é interno: o cliente continua vendo o link e pode aprovar depois.
// Aceita uma lista para encerrar várias de uma vez (ex.: as vencidas há muito tempo).
export const markProposalPortalLost = async (portalIds: string | string[], reason: string, note?: string) => {
    const ids = Array.isArray(portalIds) ? portalIds : [portalIds];
    if (ids.length === 0) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Sessão encerrada. Entre novamente.');
    const now = new Date().toISOString();
    const { error } = await supabase.from('proposal_portals').update({ lost_at: now, lost_reason: reason, updated_at: now }).in('id', ids);
    if (error) throw new Error(error.message || 'Não foi possível marcar como perdida.');
    await supabase.from('proposal_portal_follow_ups').insert(ids.map(id => ({
        portal_id: id, kind: 'lost', reason, note: note?.trim() || null, created_by: auth.user!.id,
    })));
};

export const reopenProposalPortal = async (portalIds: string | string[]) => {
    const ids = Array.isArray(portalIds) ? portalIds : [portalIds];
    if (ids.length === 0) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Sessão encerrada. Entre novamente.');
    const { error } = await supabase.from('proposal_portals').update({ lost_at: null, lost_reason: null, updated_at: new Date().toISOString() }).in('id', ids);
    if (error) throw new Error(error.message || 'Não foi possível reabrir a proposta.');
    await supabase.from('proposal_portal_follow_ups').insert(ids.map(id => ({ portal_id: id, kind: 'reopened', created_by: auth.user!.id })));
};

// "Lembrar depois": o cliente pediu para chamar em outra data.
export const snoozeProposalFollowUp = async (portalId: string, step: string, remindAt: Date, note?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Sessão encerrada. Entre novamente.');
    if (!(remindAt.getTime() > Date.now())) throw new Error('Escolha uma data futura para o lembrete.');
    const { error } = await supabase.from('proposal_portal_follow_ups').insert({
        portal_id: portalId,
        kind: 'snooze',
        step,
        remind_at: remindAt.toISOString(),
        note: note?.trim() || null,
        created_by: auth.user.id,
    });
    if (error) throw new Error(error.message || 'Não foi possível salvar o lembrete.');
};

// Condição especial com prazo: o prazo passa a ser a validade do link (a página
// do cliente mostra a contagem regressiva) e a oferta entra no histórico.
export const setProposalOfferDeadline = async (portalId: string, deadline: Date, note: string) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Sessão encerrada. Entre novamente.');
    if (!(deadline.getTime() > Date.now())) throw new Error('Escolha um prazo futuro.');
    const now = new Date().toISOString();
    const { error } = await supabase.from('proposal_portals')
        .update({ expires_at: deadline.toISOString(), last_activity_at: now, updated_at: now })
        .eq('id', portalId);
    if (error) throw new Error(error.message || 'Não foi possível atualizar o prazo do link.');
    await supabase.from('proposal_portals').update({ status: 'active' }).eq('id', portalId).eq('status', 'expired');
    await supabase.from('proposal_portal_follow_ups').insert({
        portal_id: portalId, kind: 'offer', note: note.trim() || null, created_by: auth.user.id,
    });
};

// Opção destacada como "Recomendada" na página do cliente (null tira o destaque).
export const setProposalPortalHighlight = async (portalId: string, pdfId: number | null) => {
    const [persistedId] = pdfId == null ? [null] : await resolvePersistedProposalPdfIds([pdfId]);
    const { error } = await supabase.from('proposal_portals').update({ highlighted_pdf_id: persistedId ?? null }).eq('id', portalId);
    if (error) throw new Error(error.message || 'Não foi possível destacar a opção.');
};

export const markCompanyProposalPortalRead = async (portalId: string) => {
    const { error } = await supabase.from('proposal_portals').update({ last_read_by_company_at: new Date().toISOString() }).eq('id', portalId);
    if (error) throw error;
};

export const sendCompanyProposalMessage = async (portalId: string, body: string) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Sessão encerrada. Entre novamente.');
    const { error } = await supabase.from('proposal_portal_messages').insert({
        portal_id: portalId,
        sender_type: 'company',
        kind: 'message',
        body: body.trim(),
        created_by: auth.user.id,
    });
    if (error) throw error;
    await supabase.from('proposal_portals').update({ last_activity_at: new Date().toISOString() }).eq('id', portalId);
};

export const updateProposalPortalCondition = async (
    portalId: string,
    proposalId: number,
    expiresAt: string,
    finalValue?: number
) => {
    const { error } = await supabase.rpc('update_proposal_portal_condition', {
        p_portal_id: portalId,
        p_saved_pdf_id: proposalId,
        p_expires_at: expiresAt,
        p_final_value: finalValue ?? null,
    });
    if (error) throw error;
};
