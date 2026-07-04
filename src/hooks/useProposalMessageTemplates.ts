import { useCallback, useEffect, useState } from 'react';
import { ProposalMessageTemplate } from '../lib/proposalMessages';
import {
    deleteProposalMessageTemplate,
    getProposalMessageTemplates,
    saveProposalMessageTemplate,
} from '../../services/supabaseDb';

// Cache em memória compartilhado entre todas as instâncias do modal, para que
// ao abrir a ficha de outro cliente os modelos já apareçam sem novo fetch e
// qualquer edição (texto/nome/criar/excluir) reflita globalmente na hora.
let cache: ProposalMessageTemplate[] | null = null;
let inflight: Promise<ProposalMessageTemplate[]> | null = null;
const listeners = new Set<(templates: ProposalMessageTemplate[]) => void>();

const sortTemplates = (templates: ProposalMessageTemplate[]) =>
    [...templates].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

const setCache = (templates: ProposalMessageTemplate[]) => {
    cache = sortTemplates(templates);
    listeners.forEach(listener => listener(cache!));
};

/** Pré-carrega o cache (ex.: no boot ou em testes/harness) sem tocar no banco. */
export const primeProposalTemplatesCache = (templates: ProposalMessageTemplate[]) => {
    setCache(templates);
};

const fetchTemplates = async (force: boolean): Promise<ProposalMessageTemplate[]> => {
    if (!force && cache) return cache;
    if (inflight) return inflight;

    inflight = getProposalMessageTemplates()
        .then(templates => {
            setCache(templates);
            return cache!;
        })
        .finally(() => {
            inflight = null;
        });

    return inflight;
};

export interface UseProposalMessageTemplatesResult {
    templates: ProposalMessageTemplate[];
    isLoading: boolean;
    error: string | null;
    createTemplate: (title: string, text: string) => Promise<ProposalMessageTemplate>;
    updateTemplate: (id: number, patch: { title: string; text: string }) => Promise<void>;
    deleteTemplate: (id: number) => Promise<void>;
    reload: () => Promise<void>;
}

export function useProposalMessageTemplates(enabled: boolean): UseProposalMessageTemplatesResult {
    const [templates, setTemplates] = useState<ProposalMessageTemplate[]>(cache ?? []);
    const [isLoading, setIsLoading] = useState<boolean>(cache === null);
    const [error, setError] = useState<string | null>(null);

    // Mantém esta instância em sincronia com o cache compartilhado.
    useEffect(() => {
        const listener = (next: ProposalMessageTemplate[]) => setTemplates(next);
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        (async () => {
            try {
                setError(null);
                if (cache === null) setIsLoading(true);
                await fetchTemplates(false);
            } catch (err) {
                console.error('[proposalTemplates] Falha ao carregar modelos:', err);
                if (!cancelled) setError('Não foi possível carregar os modelos. Verifique a conexão.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    const createTemplate = useCallback(async (title: string, text: string) => {
        const nextSort = (cache && cache.length > 0 ? Math.max(...cache.map(t => t.sortOrder)) : -1) + 1;
        const created = await saveProposalMessageTemplate({ title, text, sortOrder: nextSort });
        setCache([...(cache ?? []), created]);
        return created;
    }, []);

    const updateTemplate = useCallback(async (id: number, patch: { title: string; text: string }) => {
        const existing = cache?.find(t => t.id === id);
        const saved = await saveProposalMessageTemplate({
            id,
            title: patch.title,
            text: patch.text,
            sortOrder: existing?.sortOrder,
        });
        setCache((cache ?? []).map(t => (t.id === id ? saved : t)));
    }, []);

    const deleteTemplate = useCallback(async (id: number) => {
        await deleteProposalMessageTemplate(id);
        setCache((cache ?? []).filter(t => t.id !== id));
    }, []);

    const reload = useCallback(async () => {
        await fetchTemplates(true);
    }, []);

    return { templates, isLoading, error, createTemplate, updateTemplate, deleteTemplate, reload };
}
