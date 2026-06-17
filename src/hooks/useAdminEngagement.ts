import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabaseClient';

export interface EngagementRow {
    user_id: string;
    email: string;
    empresa: string | null;
    telefone: string | null;
    created_at: string;
    orcamentos: number;
    clientes: number;
    agendamentos: number;
    servicos: number;
    faturamento: number;
    ultima_atividade: string | null;
}

export type EngagementMetric = 'orcamentos' | 'clientes' | 'agendamentos' | 'servicos' | 'faturamento';

const ACTIVE_WINDOW_DAYS = 30;

const toNumber = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

export const useAdminEngagement = (enabled: boolean) => {
    const [rows, setRows] = useState<EngagementRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEngagement = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: rpcError } = await supabase.rpc('admin_user_engagement');
            if (rpcError) throw rpcError;

            const normalized: EngagementRow[] = (data || []).map((r: any) => ({
                user_id: r.user_id,
                email: r.email || '(sem email)',
                empresa: r.empresa || null,
                telefone: r.telefone || null,
                created_at: r.created_at,
                orcamentos: toNumber(r.orcamentos),
                clientes: toNumber(r.clientes),
                agendamentos: toNumber(r.agendamentos),
                servicos: toNumber(r.servicos),
                faturamento: toNumber(r.faturamento),
                ultima_atividade: r.ultima_atividade || null,
            }));

            setRows(normalized);
        } catch (err: any) {
            console.error('Erro ao carregar engajamento:', err);
            setError(err?.message || 'Não foi possível carregar o engajamento.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (enabled) fetchEngagement();
    }, [enabled, fetchEngagement]);

    const totals = useMemo(() => {
        const cutoff = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        let orcamentos = 0;
        let clientes = 0;
        let faturamento = 0;
        let ativos30d = 0;

        for (const r of rows) {
            orcamentos += r.orcamentos;
            clientes += r.clientes;
            faturamento += r.faturamento;
            if (r.ultima_atividade && new Date(r.ultima_atividade).getTime() >= cutoff) {
                ativos30d += 1;
            }
        }

        return { orcamentos, clientes, faturamento, ativos30d, totalUsuarios: rows.length };
    }, [rows]);

    return { rows, loading, error, fetchEngagement, totals, activeWindowDays: ACTIVE_WINDOW_DAYS };
};
