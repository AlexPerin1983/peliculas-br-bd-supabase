import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { AiUsageSummary, normalizeAiDailyLimit, normalizeAiUsageRows, summarizeAiUsage } from '../../components/admin/aiUsage';

/**
 * Uso de IA de UMA empresa e o limite diário dela. Carrega só quando há userId
 * (ficha aberta) e reseta ao trocar ou fechar.
 */
export const useAdminCompanyAiUsage = (userId: string | null) => {
    const [usage, setUsage] = useState<AiUsageSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // null = sem limite próprio (vale o padrão do servidor).
    const [customLimit, setCustomLimit] = useState<number | null>(null);
    // false enquanto o limite não pôde ser lido (ex.: banco ainda sem a função).
    const [limitAvailable, setLimitAvailable] = useState(false);
    const [savingLimit, setSavingLimit] = useState(false);
    const [limitMessage, setLimitMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    useEffect(() => {
        setUsage(null);
        setError(null);
        setCustomLimit(null);
        setLimitAvailable(false);
        setLimitMessage(null);
        if (!userId) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            setLoading(true);
            const [usageResult, limitResult] = await Promise.all([
                supabase.rpc('admin_company_ai_usage', { p_user_id: userId }),
                supabase.rpc('admin_get_ai_daily_limit', { p_user_id: userId }),
            ]);
            if (cancelled) return;

            if (usageResult.error) {
                console.error('Erro ao carregar uso de IA da empresa:', usageResult.error);
                setError('Não foi possível carregar o uso de IA.');
            } else {
                setUsage(summarizeAiUsage(normalizeAiUsageRows(usageResult.data)));
            }

            if (limitResult.error) {
                console.error('Erro ao carregar limite de IA da empresa:', limitResult.error);
            } else {
                setCustomLimit(normalizeAiDailyLimit(limitResult.data));
                setLimitAvailable(true);
            }
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    /** Grava o limite diário; null volta ao padrão. */
    const saveLimit = useCallback(async (dailyLimit: number | null) => {
        if (!userId) return;
        setSavingLimit(true);
        setLimitMessage(null);
        const { data, error: rpcError } = await supabase.rpc('admin_set_ai_daily_limit', {
            p_user_id: userId,
            p_daily_limit: dailyLimit,
        });
        if (rpcError) {
            console.error('Erro ao salvar limite de IA:', rpcError);
            setLimitMessage({ type: 'error', text: 'Não foi possível salvar o limite. Nada mudou.' });
        } else {
            const saved = normalizeAiDailyLimit(data);
            setCustomLimit(saved);
            setLimitMessage({
                type: 'success',
                text: saved === null ? 'Voltou ao limite padrão.' : saved === 0 ? 'IA cortada para esta empresa.' : `Limite salvo: ${saved} por dia.`,
            });
        }
        setSavingLimit(false);
    }, [userId]);

    return { usage, loading, error, customLimit, limitAvailable, savingLimit, limitMessage, saveLimit };
};
