import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import ProposalPortalInbox from '../ProposalPortalInbox';
import ProposalFollowUpQueue from '../ProposalFollowUpQueue';
import { loadCompanyProposalPortals, type CompanyProposalPortal } from '../../src/lib/proposalPortal';
import { supabase } from '../../services/supabaseClient';
import AgendaPushReminderControl from './AgendaPushReminderControl';

interface ProposalCenterViewProps {
    onOpenHistory: () => void;
}

const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60_000;

const ProposalCenterView: React.FC<ProposalCenterViewProps> = ({ onOpenHistory }) => {
    const [portals, setPortals] = useState<CompanyProposalPortal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            setPortals(await loadCompanyProposalPortals());
            setError(null);
        } catch (nextError) {
            console.error('[ProposalCenterView] Falha ao carregar resumo:', nextError);
            setError('Não foi possível atualizar os números agora. As conversas continuam disponíveis abaixo.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        const interval = window.setInterval(refreshWhenVisible, FALLBACK_REFRESH_INTERVAL_MS);
        document.addEventListener('visibilitychange', refreshWhenVisible);
        const channel = supabase.channel('proposal-center-summary')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_portals' }, refreshWhenVisible)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_portal_messages' }, refreshWhenVisible)
            .subscribe();

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
            void supabase.removeChannel(channel);
        };
    }, [refresh]);

    const summary = useMemo(() => ({
        sent: portals.length,
        waiting: portals.filter(portal => portal.status === 'active' && !portal.lostAt && portal.messages.every(message => message.sender_type !== 'client')).length,
        unseen: portals.filter(portal => portal.viewCount === 0 && portal.status === 'active').length,
        responded: portals.filter(portal => portal.messages.some(message => message.sender_type === 'client')).length,
        unread: portals.reduce((total, portal) => total + portal.unreadCount, 0),
    }), [portals]);

    const stats = [
        { label: 'Enviadas', value: summary.sent },
        { label: 'Aguardando', value: summary.waiting },
        { label: 'Não abriram', value: summary.unseen },
        { label: 'Responderam', value: summary.responded, badge: summary.unread },
    ];

    return (
        <div className="space-y-5 pb-28 sm:pb-0">
            <header className="flex items-start justify-between gap-3 px-1 pt-1">
                <div className="min-w-0">
                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">Propostas</h1>
                    <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">Quem abriu, quem respondeu e o próximo passo de cada cliente.</p>
                </div>
                <button
                    type="button"
                    onClick={onOpenHistory}
                    title="Escolha um orçamento no Histórico para criar o link"
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Novo link
                </button>
            </header>

            <section className="grid grid-cols-4 divide-x divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]" aria-label="Resumo das propostas">
                {stats.map(stat => (
                    <div key={stat.label} className="px-2 py-3 text-center">
                        <p className="relative inline-block text-xl font-semibold tabular-nums text-[var(--text-strong)]">
                            {loading ? '–' : stat.value}
                            {stat.badge ? <span className="absolute -right-3 -top-1 h-2 w-2 rounded-full bg-blue-600" aria-label={`${stat.badge} novas respostas`} /> : null}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{stat.label}</p>
                    </div>
                ))}
            </section>

            {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">{error}</p> : null}

            <ProposalFollowUpQueue portals={portals} loading={loading} onChanged={refresh} />

            <section className="space-y-3" aria-labelledby="proposal-conversations-title">
                <h2 id="proposal-conversations-title" className="px-1 text-base font-semibold tracking-[-0.01em] text-[var(--text-strong)]">Conversas</h2>
                <ProposalPortalInbox defaultOpen />
            </section>

            <section aria-labelledby="proposal-alerts-title">
                <h2 id="proposal-alerts-title" className="sr-only">Notificações das propostas</h2>
                <AgendaPushReminderControl />
            </section>
        </div>
    );
};

export default ProposalCenterView;
