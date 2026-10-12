import { supabase } from './supabaseClient';
import { TRIAGE_CATEGORIES, type TriageCategory, type TriageDoneStatus } from '../src/lib/whatsappTriage';

export interface TriageSuggestion {
    id: number;
    phone: string | null;
    name: string | null;
    category: TriageCategory;
    confidence: number | null;
    source: string | null;
    snippet: string | null;
    lastMessageAt: string | null;
}

export interface TriageDone {
    id: number;
    phone: string | null;
    name: string | null;
    category: TriageCategory;
    status: TriageDoneStatus;
    decidedAt: string | null;
}

export interface TriageList {
    enabled: boolean;
    pending: TriageSuggestion[];
    recent: TriageDone[];
}

export interface TriageDecision {
    status: 'approved' | 'discarded';
    category?: TriageCategory;
    created?: boolean;
    name?: string;
}

const EMPTY: TriageList = { enabled: false, pending: [], recent: [] };
const isCategory = (value: unknown): value is TriageCategory => TRIAGE_CATEGORIES.includes(value as TriageCategory);

/** Só empresas com o WhatsApp conectado ligado recebem a lista; as outras, enabled: false. */
export const listWhatsAppTriage = async (): Promise<TriageList> => {
    try {
        const { data, error } = await supabase.rpc('whatsapp_triage_list');
        if (error || !data?.enabled) return EMPTY;
        return {
            enabled: true,
            pending: (Array.isArray(data.pending) ? data.pending : [])
                .filter((row: any) => isCategory(row?.category))
                .map((row: any) => ({
                    id: Number(row.id),
                    phone: row.phone ?? null,
                    name: row.name ?? null,
                    category: row.category,
                    confidence: row.confidence == null ? null : Number(row.confidence),
                    source: row.source ?? null,
                    snippet: row.snippet ?? null,
                    lastMessageAt: row.last_message_at ?? null,
                })),
            recent: (Array.isArray(data.recent) ? data.recent : [])
                .filter((row: any) => isCategory(row?.category))
                .map((row: any) => ({
                    id: Number(row.id),
                    phone: row.phone ?? null,
                    name: row.name ?? null,
                    category: row.category,
                    status: row.status,
                    decidedAt: row.decided_at ?? null,
                })),
        };
    } catch {
        return EMPTY;
    }
};

/** Aprova (com o tipo e o nome escolhidos) ou descarta uma sugestão. */
export const decideWhatsAppTriage = async (
    id: number,
    action: 'approve' | 'discard',
    category?: TriageCategory,
    name?: string,
): Promise<TriageDecision> => {
    const { data, error } = await supabase.rpc('whatsapp_triage_decide', {
        p_id: id,
        p_action: action,
        p_category: category ?? null,
        p_name: name?.trim() || null,
    });
    if (error) throw new Error(error.message || 'Não foi possível salvar a decisão.');
    return {
        status: data?.status === 'discarded' ? 'discarded' : 'approved',
        category: isCategory(data?.category) ? data.category : undefined,
        created: Boolean(data?.created),
        name: typeof data?.name === 'string' ? data.name : undefined,
    };
};
