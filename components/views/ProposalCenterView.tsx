import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks, MessageSquareText, MessagesSquare, Plus, Search } from 'lucide-react';
import ProposalPortalInbox from '../ProposalPortalInbox';
import ProposalFollowUpQueue from '../ProposalFollowUpQueue';
import { loadCompanyProposalPortals, type CompanyProposalPortal } from '../../src/lib/proposalPortal';
import { buildFollowUpQueue } from '../../src/lib/proposalFollowUpQueue';
import { supabase } from '../../services/supabaseClient';
import AgendaPushReminderControl from './AgendaPushReminderControl';

interface ProposalCenterViewProps {
    onOpenHistory: () => void;
}

type Section = 'follow' | 'conversations';

const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60_000;

const scrollToId = (id: string, block: ScrollLogicalPosition = 'start') =>
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block }));

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
        aria-current={active ? 'page' : undefined}
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
    section: Section;
    dueCount: number;
    unread: number;
    onFollow: () => void;
    onConversations: () => void;
    onNewLink: () => void;
    onSearch: () => void;
    onMessages: () => void;
}> = ({ section, dueCount, unread, onFollow, onConversations, onNewLink, onSearch, onMessages }) => (
    <div className="fixed left-4 right-4 z-40 sm:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        <nav aria-label="Menu das propostas" className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="relative flex items-center justify-between">
                <div className="flex gap-1">
                    <FooterButton onClick={onFollow} label="Acompanhar" icon={<ListChecks className="h-5 w-5" aria-hidden="true" />} active={section === 'follow'} badge={dueCount} />
                    <FooterButton onClick={onConversations} label="Conversas" icon={<MessagesSquare className="h-5 w-5" aria-hidden="true" />} active={section === 'conversations'} badge={unread} />
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
    // No celular, uma parte por vez (o menu fixo alterna); no computador, as duas aparecem.
    const [section, setSection] = useState<Section>('follow');
    const [templatesOpen, setTemplatesOpen] = useState(false);

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

    // "Abrir conversa" (na lista ou em outro lugar) leva para a parte de conversas.
    useEffect(() => {
        const showConversation = () => {
            setSection('conversations');
            scrollToId('proposal-conversations');
        };
        window.addEventListener('proposal-portal-open', showConversation);
        return () => window.removeEventListener('proposal-portal-open', showConversation);
    }, []);

    const summary = useMemo(() => ({
        sent: portals.length,
        waiting: portals.filter(portal => portal.status === 'active' && !portal.lostAt && portal.messages.every(message => message.sender_type !== 'client')).length,
        unseen: portals.filter(portal => portal.viewCount === 0 && portal.status === 'active').length,
        responded: portals.filter(portal => portal.messages.some(message => message.sender_type === 'client')).length,
        unread: portals.reduce((total, portal) => total + portal.unreadCount, 0),
    }), [portals]);
    const dueCount = useMemo(() => buildFollowUpQueue(portals).due.length, [portals]);

    const stats = [
        { label: 'Enviadas', value: summary.sent },
        { label: 'Aguardando', value: summary.waiting },
        { label: 'Não abriram', value: summary.unseen },
        { label: 'Responderam', value: summary.responded, badge: summary.unread },
    ];

    const showFollow = () => {
        setSection('follow');
        scrollToId('proposal-follow-up');
    };
    const showConversations = () => {
        setSection('conversations');
        scrollToId('proposal-conversations');
    };
    const openSearch = () => {
        setSection('follow');
        window.requestAnimationFrame(() => {
            const field = document.getElementById('proposal-follow-up-search');
            if (!field) return scrollToId('proposal-follow-up');
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                <div className="hidden shrink-0 text-sm font-semibold sm:block">
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

            <div className={section === 'follow' ? '' : 'hidden sm:block'}>
                <ProposalFollowUpQueue portals={portals} loading={loading} onChanged={refresh} templatesOpen={templatesOpen} onTemplatesOpenChange={setTemplatesOpen} />
            </div>

            <section id="proposal-conversations" className={`scroll-mt-24 space-y-3 ${section === 'conversations' ? '' : 'hidden sm:block'}`} aria-labelledby="proposal-conversations-title">
                <h2 id="proposal-conversations-title" className="px-1 text-base font-semibold tracking-[-0.01em] text-[var(--text-strong)]">Conversas</h2>
                <ProposalPortalInbox defaultOpen />
            </section>

            <section aria-labelledby="proposal-alerts-title">
                <h2 id="proposal-alerts-title" className="sr-only">Notificações das propostas</h2>
                <AgendaPushReminderControl />
            </section>

            <ProposalCenterMobileFooter
                section={section}
                dueCount={loading ? 0 : dueCount}
                unread={summary.unread}
                onFollow={showFollow}
                onConversations={showConversations}
                onNewLink={onOpenHistory}
                onSearch={openSearch}
                onMessages={() => setTemplatesOpen(true)}
            />
        </div>
    );
};

export default ProposalCenterView;
