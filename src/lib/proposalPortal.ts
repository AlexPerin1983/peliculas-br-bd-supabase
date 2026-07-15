import { supabase } from '../../services/supabaseClient';
import type { Client, SavedPDF } from '../../types';
import type { ProposalConditionFields } from './proposalCondition';

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
        expired: boolean;
    };
    clientName: string;
    company: {
        name: string;
        phone?: string;
        email?: string;
        logo?: string;
        colors?: { primaria?: string; secundaria?: string };
    };
    proposals: Array<Pick<SavedPDF, 'id' | 'proposalOptionName' | 'nomeArquivo' | 'totalPreco' | 'totalM2' | 'date' | 'expirationDate' | 'status'> & ProposalConditionFields>;
    messages: ProposalPortalMessage[];
}

const invokePublicPortal = async <T>(body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.functions.invoke('proposal-portal', { body });
    if (error) throw new Error(error.message || 'Nao foi possivel acessar a proposta.');
    if (data?.error) throw new Error(data.error);
    return data as T;
};

export const loadPublicProposalPortal = (token: string, trackView = false) =>
    invokePublicPortal<PublicProposalPortal>({ token, action: 'load', trackView });

export const downloadPublicProposal = async (token: string, proposalId: number) => {
    const result = await invokePublicPortal<{ url: string }>({ token, action: 'download', proposalId });
    window.location.assign(result.url);
};

export const sendPublicProposalMessage = (token: string, body: string) =>
    invokePublicPortal<{ ok: true }>({ token, action: 'message', body });

export const respondToPublicProposal = (
    token: string,
    proposalId: number,
    kind: ProposalPortalDecision,
    options: { body?: string; offerType?: ProposalOfferType; offerValue?: number } = {}
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
    expiresAt: string;
    url: string;
}

export const buildProposalPortalUrl = (token: string) => {
    const url = new URL(window.location.origin);
    url.pathname = '/proposta';
    url.searchParams.set('token', token);
    return url.toString();
};

export const createProposalPortal = async (pdfs: SavedPDF[], expirationDate: string): Promise<CreatedProposalPortal> => {
    const pdfIds = pdfs.map(pdf => pdf.id).filter((id): id is number => typeof id === 'number');
    if (pdfIds.length !== pdfs.length || pdfIds.length === 0) {
        throw new Error('Salve as propostas antes de criar o link.');
    }

    const expiresAt = new Date(`${expirationDate}T23:59:59`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new Error('Escolha uma validade futura.');
    }

    const { data, error } = await supabase.rpc('create_proposal_portal', {
        p_pdf_ids: pdfIds,
        p_expires_at: expiresAt.toISOString(),
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.portal_token) throw new Error('O link nao foi criado.');

    return {
        portalId: row.portal_id,
        token: row.portal_token,
        expiresAt: row.expires_at,
        url: buildProposalPortalUrl(row.portal_token),
    };
};

export const buildProposalShareMessage = (client: Client, pdfs: SavedPDF[], portalUrl: string, expiresAt: string) => {
    const firstName = client.nome.trim().split(/\s+/)[0] || 'Olá';
    const optionText = pdfs.length === 1 ? 'sua proposta' : `suas ${pdfs.length} opções de proposta`;
    const expiry = new Date(expiresAt).toLocaleDateString('pt-BR');
    return `${firstName}, preparei ${optionText}. Você pode visualizar, baixar o PDF e responder pelo link abaixo:\n\n${portalUrl}\n\nA proposta fica disponível até ${expiry}.`;
};

export interface CompanyProposalPortal {
    id: string;
    token: string;
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
}

export const loadCompanyProposalPortals = async (): Promise<CompanyProposalPortal[]> => {
    const { data: portals, error } = await supabase
        .from('proposal_portals')
        .select('id, token, client_id, expires_at, status, last_activity_at, last_read_by_company_at, view_count')
        .neq('status', 'revoked')
        .order('last_activity_at', { ascending: false });
    if (error) throw error;
    if (!portals?.length) return [];

    const portalIds = portals.map(item => item.id);
    const clientIds = Array.from(new Set(portals.map(item => item.client_id)));
    const [{ data: clients }, { data: items }, { data: messages }] = await Promise.all([
        supabase.from('clients').select('id, nome').in('id', clientIds),
        supabase.from('proposal_portal_items').select('portal_id, saved_pdf_id, position, condition_original_value, condition_final_value, condition_discount_amount, condition_discount_percent, condition_expires_at, saved_pdfs(proposal_option_name, nome_arquivo, total_preco)').in('portal_id', portalIds).order('position'),
        supabase.from('proposal_portal_messages').select('id, portal_id, saved_pdf_id, sender_type, kind, body, offer_type, offer_value, condition_value, created_at').in('portal_id', portalIds).order('created_at'),
    ]);

    const clientNames = new Map((clients || []).map(client => [Number(client.id), client.nome]));
    return portals.map(portal => {
        const portalMessages = (messages || []).filter(message => message.portal_id === portal.id) as Array<ProposalPortalMessage & { portal_id: string }>;
        const readAt = portal.last_read_by_company_at ? new Date(portal.last_read_by_company_at).getTime() : 0;
        return {
            id: portal.id,
            token: portal.token,
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
                conditionOriginalValue: item.condition_original_value == null ? null : Number(item.condition_original_value),
                conditionFinalValue: item.condition_final_value == null ? null : Number(item.condition_final_value),
                conditionDiscountAmount: item.condition_discount_amount == null ? null : Number(item.condition_discount_amount),
                conditionDiscountPercent: item.condition_discount_percent == null ? null : Number(item.condition_discount_percent),
                conditionExpiresAt: item.condition_expires_at,
            })),
            messages: portalMessages,
            unreadCount: portalMessages.filter(message => message.sender_type === 'client' && new Date(message.created_at).getTime() > readAt).length,
        };
    });
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
