import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Clock3, Eye, MessageCircleMore, Plus, Send } from 'lucide-react';
import ProposalPortalInbox from '../ProposalPortalInbox';
import { loadCompanyProposalPortals, type CompanyProposalPortal } from '../../src/lib/proposalPortal';
import { supabase } from '../../services/supabaseClient';
import AgendaPushReminderControl from './AgendaPushReminderControl';

interface ProposalCenterViewProps {
    onOpenHistory: () => void;
}

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
        const interval = window.setInterval(() => void refresh(), 30_000);
        const channel = supabase.channel('proposal-center-summary')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_portals' }, () => void refresh())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_portal_messages' }, () => void refresh())
            .subscribe();

        return () => {
            window.clearInterval(interval);
            void supabase.removeChannel(channel);
        };
    }, [refresh]);

    const summary = useMemo(() => ({
        sent: portals.length,
        waiting: portals.filter(portal => portal.status === 'active' && portal.messages.every(message => message.sender_type !== 'client')).length,
        unseen: portals.filter(portal => portal.viewCount === 0 && portal.status === 'active').length,
        responded: portals.filter(portal => portal.messages.some(message => message.sender_type === 'client')).length,
        unread: portals.reduce((total, portal) => total + portal.unreadCount, 0),
    }), [portals]);

    const cards = [
        { label: 'Enviadas', value: summary.sent, hint: 'links acompanhados', icon: Send, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-950/35 dark:text-blue-300' },
        { label: 'Aguardando', value: summary.waiting, hint: 'sem resposta', icon: Clock3, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-950/35 dark:text-amber-300' },
        { label: 'Não visualizaram', value: summary.unseen, hint: 'ainda não abriram', icon: Eye, tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
        { label: 'Responderam', value: summary.responded, hint: summary.unread > 0 ? `${summary.unread} nova${summary.unread > 1 ? 's' : ''}` : 'tudo acompanhado', icon: MessageCircleMore, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300' },
    ];

    return (
        <div className="space-y-3 pb-28 sm:space-y-4 sm:pb-0">
            <header className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                            <MessageCircleMore className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <p className="ui-kicker text-blue-600 dark:text-blue-300">Vendas e negociação</p>
                            <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--text-strong)] sm:text-3xl">Central de propostas</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                                Veja quem abriu, acompanhe respostas e converse com o cliente sem misturar tudo com os PDFs antigos.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenHistory}
                        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Criar novo link
                    </button>
                </div>
                <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/65 px-4 py-2.5 text-xs font-semibold text-[var(--text-muted)] sm:px-5">
                    Para criar um link, escolha um orçamento no Histórico. As respostas aparecerão automaticamente aqui.
                </div>
            </header>

            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Resumo das propostas">
                {cards.map(({ label, value, hint, icon: Icon, tone }) => (
                    <article key={label} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-hairline)] sm:p-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                            <strong className="text-2xl font-black tabular-nums text-[var(--text-strong)]">{loading ? '–' : value}</strong>
                        </div>
                        <p className="mt-3 text-xs font-black text-[var(--text-strong)]">{label}</p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--text-muted)]">{hint}</p>
                    </article>
                ))}
            </section>

            {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">{error}</p> : null}

            <section aria-labelledby="proposal-alerts-title">
                <h2 id="proposal-alerts-title" className="sr-only">Notificações das propostas</h2>
                <AgendaPushReminderControl />
            </section>

            <section className="space-y-2" aria-labelledby="proposal-conversations-title">
                <div className="flex items-center gap-2 px-1">
                    <BellRing className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    <h2 id="proposal-conversations-title" className="text-sm font-black text-[var(--text-strong)]">Conversas e respostas</h2>
                </div>
                <ProposalPortalInbox defaultOpen />
            </section>
        </div>
    );
};

export default ProposalCenterView;
