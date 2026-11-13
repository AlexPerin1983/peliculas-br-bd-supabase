import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { AiUsageSummary, normalizeAiUsageRows, summarizeAiUsage } from '../../components/admin/aiUsage';

/**
 * Uso de IA de UMA empresa. Carrega só quando há userId (ficha aberta) e
 * reseta ao trocar ou fechar.
 */
export const useAdminCompanyAiUsage = (userId: string | null) => {
    const [usage, setUsage] = useState<AiUsageSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            setUsage(null);
            setError(null);
            setLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                setLoading(true);
                setError(null);
                setUsage(null);

                const { data, error: rpcError } = await supabase.rpc('admin_company_ai_usage', { p_user_id: userId });
                if (rpcError) throw rpcError;
                if (cancelled) return;

                setUsage(summarizeAiUsage(normalizeAiUsageRows(data)));
            } catch (err) {
                if (cancelled) return;
                console.error('Erro ao carregar uso de IA da empresa:', err);
                setError('Não foi possível carregar o uso de IA.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    return { usage, loading, error };
};
