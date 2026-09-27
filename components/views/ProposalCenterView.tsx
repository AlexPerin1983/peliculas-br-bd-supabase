import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks, MessageSquareText, MessagesSquare, Plus, Search, Settings2 } from 'lucide-react';
import ProposalClientList, { INITIAL_PROPOSAL_LIST_VIEW, type ProposalListView } from '../ProposalClientList';
import ProposalDetailPanel from '../ProposalDetailPanel';
import FollowUpTemplatesModal from '../FollowUpTemplatesModal';
import { loadCompanyProposalPortals, type CompanyProposalPortal } from '../../src/lib/proposalPortal';
import { buildFollowUpQueue, groupPortalsByClient, summarizeProposalResults, type FollowUpTemplates } from '../../src/lib/proposalFollowUpQueue';
import { getFollowUpMessageTemplates, type FollowUpMessageTemplateRow } from '../../services/supabaseDb';
import { supabase } from '../../services/supabaseClient';
import AgendaPushReminderControl from './AgendaPushReminderControl';

interface ProposalCenterViewProps {
    onOpenHistory: () => void;
}

const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60_000;
const CLOCK_TICK_MS = 60_000;
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const PORTAL_PARAM = 'proposalPortal';

const scrollToId = (id: string, block: ScrollLogicalPosition = 'start') =>
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block }));

// Link aberto por notificação (?proposalPortal=...): usado uma vez e tirado do endereço ao fechar.
const readPortalParam = () => new URLSearchParams(window.location.search).get(PORTAL_PARAM);
const clearPortalParam = () => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PORTAL_PARAM)) return;
    url.searchParams.delete(PORTAL_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

const FooterButton: React.FC<{
    onClick: () => void;
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    badge?: number;
}> = ({ onClick, label, icon, active, badge }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={`group relative flex h-14 w-16 flex-col items-center justify-center rounded-xl transition-all duration-200 ${active
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
    >
        <span className="transition-transform duration-300 group-active:scale-90">{icon}</span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">{label}</span>
        {badge && badge > 0 ? (
            <span className="absolute right-1.5 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
                {badge > 99 ? '99+' : badge}
            </span>
        ) : null}
    </button>
);

/** Menu fixo da Central de propostas (somente celular), no mesmo formato das outras telas. */
const ProposalCenterMobileFooter: React.FC<{
    view: ProposalListView;
    dueCount: number;
    replyCount: number;
    onToday: () => void;
    onReplies: () => void;
    onNewLink: () => void;
    onSearch: () => void;
    onMessages: () => void;
}> = ({ view, dueCount, replyCount, onToday, onReplies, onNewLink, onSearch, onMessages }) => (
    <div className="fixed left-4 right-4 z-40 sm:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        <nav aria-label="Menu das propostas" className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="relative flex items-center justify-between">
                <div className="flex gap-1">
                    <FooterButton onClick={onToday} label="Hoje" icon={<ListChecks className="h-5 w-5" aria-hidden="true" />} active={view.tab === 'today' && view.filter !== 'reply'} badge={dueCount} />
                    <FooterButton onClick={onReplies} label="Respostas" icon={<MessagesSquare className="h-5 w-5" aria-hidden="true" />} active={view.tab === 'today' && view.filter === 'reply'} badge={replyCount} />
                </div>

                <div className="absolute left-1/2 -top-12 -translate-x-1/2">
                    <button
                        type="button"
                        onClick={onNewLink}
                        aria-label="Novo link"
                        title="Escolha um orçamento no Histórico para criar o link"
                        className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_8px_20px_rgba(21,94,239,0.4)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(21,94,239,0.5)] active:scale-95 dark:border-slate-900"
                    >
                        <Plus className="h-7 w-7" aria-hidden="true" />
                    </button>
                </div>

                <div className="flex gap-1">
                    <FooterButton onClick={onSearch} label="Buscar" icon={<Search className="h-5 w-5" aria-hidden="true" />} />
                    <FooterButton onClick={onMessages} label="Mensagens" icon={<MessageSquareText className="h-5 w-5" aria-hidden="true" />} />
                </div>
            </div>
        </nav>
    </div>
);

const ProposalCenterView: React.FC<ProposalCenterViewProps> = ({ onOpenHistory }) => {
    const [portals, setPortals] = useState<CompanyProposalPortal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<ProposalListView>(INITIAL_PROPOSAL_LIST_VIEW);
    const [openPortalId, setOpenPortalId] = useState<string | null>(readPortalParam);
    const [templatesOpen, setTemplatesOpen] = useState(false);
    const [savedTemplates, setSavedTemplates] = useState<FollowUpMessageTemplateRow[]>([]);
    // Relógio da tela: o "Abriu agora" e o "próximo contato" mudam com o tempo, sem novos dados.
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
        return () => window.clearInterval(timer);
    }, []);

    const refresh = useCallback(async () => {
        try {
            setPortals(await loadCompanyProposalPortals());
            setNow(Date.now());
            setError(null);
        } catch (nextError) {
            console.error('[ProposalCenterView] Falha ao carregar propostas:', nextError);
            setError('Não foi possível atualizar as propostas agora. Tente de novo em instantes.');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadTemplates = useCallback(() => {
        getFollowUpMessageTemplates().then(setSavedTemplates).catch(() => setSavedTemplates([]));
    }, []);

    useEffect(() => {
        void refresh();
        loadTemplates();
        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        const interval = window.setInterval(refreshWhenVisible, FALLBACK_REFRESH_INTERVAL_MS);
        document.addEventListener('visibilitychange', refreshWhenVisible);
        const channel = supabase.channel('proposal-center')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_portals' }, refreshWhenVisible)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_portal_messages' }, refreshWhenVisible)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_portal_items' }, refreshWhenVisible)
            .subscribe();

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
            void supabase.removeChannel(channel);
        };
    }, [refresh, loadTemplates]);

    // Notificações e atalhos abrem a ficha do cliente.
    useEffect(() => {
        const openPortal = (event: Event) => {
            const portalId = (event as CustomEvent<{ portalId?: string }>).detail?.portalId;
            if (portalId) setOpenPortalId(portalId);
        };
        window.addEventListener('proposal-portal-open', openPortal);
        return () => window.removeEventListener('proposal-portal-open', openPortal);
    }, []);

    const templates = useMemo<FollowUpTemplates>(
        () => Object.fromEntries(savedTemplates.map(row => [row.step, row.text])),
        [savedTemplates],
    );
    const groups = useMemo(() => groupPortalsByClient(portals), [portals]);
    const primaries = useMemo(() => groups.map(group => group.primary), [groups]);
    const queue = useMemo(() => buildFollowUpQueue(primaries, now), [primaries, now]);
    const openGroup = openPortalId
        ? groups.find(group => group.primary.id === openPortalId || group.others.some(link => link.id === openPortalId)) || null
        : null;

    // Link que não existe mais (encerrado ou de outra empresa): esquece o pedido.
    useEffect(() => {
        if (!loading && openPortalId && !openGroup) {
            setOpenPortalId(null);
            clearPortalParam();
        }
    }, [loading, openPortalId, openGroup]);

    const results = useMemo(() => summarizeProposalResults(portals, now), [portals, now]);
    const replyCount = queue.due.filter(item => item.step === 'reply').length;

    const stats = [
        {
            label: 'Em aberto',
            value: money.format(results.openValue),
            detail: plural(results.openCount, 'cliente', 'clientes'),
            title: 'Soma das propostas em "Hoje" e "Aguardando"',
        },
        {
            label: 'Aprovado no mês',
            value: money.format(results.approvedValue),
            detail: results.approvedCount > 0 ? plural(results.approvedCount, 'proposta', 'propostas') : 'nenhuma ainda',
            title: 'Propostas aprovadas pelo link neste mês (valor da opção escolhida)',
        },
        {
            label: 'Fechamento',
            value: results.closeRate == null ? '—' : `${Math.round(results.closeRate * 100)}%`,
            detail: results.decidedCount > 0 ? `${results.wonCount} de ${results.decidedCount} · 90 dias` : 'últimos 90 dias',
            title: 'Dos clientes que decidiram nos últimos 90 dias (aprovou, recusou ou perdida), quantos aprovaram',
        },
    ];

    const changeView = useCallback((next: Partial<ProposalListView>) => setView(current => ({ ...current, ...next })), []);
    const closeDetail = useCallback(() => {
        setOpenPortalId(null);
        clearPortalParam();
    }, []);
    const showToday = () => {
        changeView({ tab: 'today', filter: 'all' });
        scrollToId('proposal-list');
    };
    const showReplies = () => {
        changeView({ tab: 'today', filter: 'reply' });
        scrollToId('proposal-list');
    };
    const openSearch = () => {
        window.requestAnimationFrame(() => {
            const field = document.getElementById('proposal-list-search');
            if (!field) return scrollToId('proposal-list');
            field.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            field.focus({ preventScroll: true });
        });
    };

    return (
        <div className="space-y-5 pb-28 sm:pb-0">
            <header className="flex items-start justify-between gap-3 px-1 pt-1">
                <div className="min-w-0">
                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">Propostas</h1>
                    <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">Quem abriu, quem respondeu e o próximo passo de cada cliente.</p>
                </div>
                <div className="hidden shrink-0 items-center gap-2 text-sm font-semibold sm:flex">
                    <button type="button" onClick={() => setTemplatesOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)] transition hover:text-[var(--text-strong)]">
                        <Settings2 className="h-4 w-4" aria-hidden="true" /> Mensagens
                    </button>
                    <button
                        type="button"
                        onClick={onOpenHistory}
                        title="Escolha um orçamento no Histórico para criar o link"
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-white shadow-sm transition hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Novo link
                    </button>
                </div>
            </header>

            <section className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]" aria-label="Resumo das propostas">
                {stats.map(stat => (
                    <div key={stat.label} className="min-w-0 px-2 py-3 text-center" title={stat.title}>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">{stat.label}</p>
                        {loading ? (
                            <span className="mx-auto mt-1.5 block h-5 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                        ) : (
                            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums tracking-[-0.01em] text-[var(--text-strong)]">{stat.value}</p>
                        )}
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{loading ? ' ' : stat.detail}</p>
                    </div>
                ))}
            </section>

            {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">{error}</p> : null}

            <ProposalClientList
                groups={groups}
                templates={templates}
                loading={loading}
                now={now}
                view={view}
                onViewChange={changeView}
                onOpen={setOpenPortalId}
                onChanged={refresh}
            />

            <section aria-labelledby="proposal-alerts-title">
                <h2 id="proposal-alerts-title" className="sr-only">Notificações das propostas</h2>
                <AgendaPushReminderControl />
            </section>

            {openGroup ? (
                <ProposalDetailPanel
                    key={openGroup.clientId}
                    group={openGroup}
                    initialPortalId={openPortalId}
                    templates={templates}
                    now={now}
                    onClose={closeDetail}
                    onChanged={refresh}
                />
            ) : null}

            <FollowUpTemplatesModal isOpen={templatesOpen} saved={savedTemplates} onClose={() => setTemplatesOpen(false)} onSaved={loadTemplates} />

            <ProposalCenterMobileFooter
                view={view}
                dueCount={loading ? 0 : queue.due.length}
                replyCount={loading ? 0 : replyCount}
                onToday={showToday}
                onReplies={showReplies}
                onNewLink={onOpenHistory}
                onSearch={openSearch}
                onMessages={() => setTemplatesOpen(true)}
            />
        </div>
    );
};

export default ProposalCenterView;
