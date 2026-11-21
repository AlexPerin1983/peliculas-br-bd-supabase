// "Enviar pela IA": a equipe libera, no app, o envio do link da proposta (já com
// o PDF gerado aqui) e o atendimento de WhatsApp (Conversa Bridge Ai) manda ao
// cliente na mesma conversa. Só aparece para empresas com o atendimento ligado
// (chave do CRM com permissão de envio); as funções do banco conferem a empresa.
import { supabase } from '../../services/supabaseClient';

let availability: Promise<boolean> | null = null;

export const isAiProposalSendAvailable = (): Promise<boolean> => {
    if (!availability) {
        availability = (async () => {
            const { data, error } = await supabase.rpc('crm_ai_send_available');
            return !error && data === true;
        })().catch(() => false);
        // Sem resposta (ex.: offline), tenta de novo na próxima vez que a tela abrir.
        availability.then(ok => { if (!ok) availability = null; });
    }
    return availability;
};

export const requestAiProposalSend = async (portalId: string, message: string) => {
    const { error } = await supabase.rpc('crm_ai_send_request', { p_portal_id: portalId, p_message: message });
    if (error) throw new Error(error.message || 'Não foi possível pedir o envio.');
};

export interface AiProposalSendStatus {
    status: 'pendente' | 'enviado' | 'falhou' | 'cancelado';
    detail: string | null;
    createdAt: string;
}

export const getAiProposalSendStatus = async (portalId: string): Promise<AiProposalSendStatus | null> => {
    const { data, error } = await supabase.rpc('crm_ai_send_status', { p_portal_id: portalId });
    if (error || !data) return null;
    return { status: data.status, detail: data.detail ?? null, createdAt: data.created_at };
};

export const describeAiProposalSend = (status: AiProposalSendStatus | null) => {
    if (!status) return '';
    if (status.status === 'pendente') return 'Aguardando o atendimento enviar ao cliente…';
    if (status.status === 'enviado') return 'Enviado ao cliente pelo atendimento.';
    if (status.status === 'cancelado') return 'O atendimento não enviou em 24 horas. Envie de novo ou pelo WhatsApp.';
    return `O atendimento não conseguiu enviar${status.detail ? `: ${status.detail}` : ''}. Envie pelo WhatsApp.`;
};
