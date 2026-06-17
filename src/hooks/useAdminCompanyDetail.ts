import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';

export interface ActivityMonth {
    mes: string;          // ISO date (primeiro dia do mês)
    orcamentos: number;
    faturamento: number;
}

const toNumber = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Busca a série mensal de atividade (últimos 12 meses) de UMA empresa.
 * Carrega só quando há userId (drawer aberto) e reseta ao trocar/fechar.
 */
export const useAdminCompanyDetail = (userId: string | null) => {
    const [series, setSeries] = useState<ActivityMonth[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            setSeries([]);
            setError(null);
            setLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                setLoading(true);
                setError(null);

                const { data, error: rpcError } = await supabase.rpc('admin_company_activity_series', {
                    p_user_id: userId,
                });
                if (rpcError) throw rpcError;
                if (cancelled) return;

                const normalized: ActivityMonth[] = (data || []).map((r: any) => ({
                    mes: r.mes,
                    orcamentos: toNumber(r.orcamentos),
                    faturamento: toNumber(r.faturamento),
                }));
                setSeries(normalized);
            } catch (err: any) {
                if (cancelled) return;
                console.error('Erro ao carregar detalhe da empresa:', err);
                setError(err?.message || 'Não foi possível carregar a tendência.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    return { series, loading, error };
};
