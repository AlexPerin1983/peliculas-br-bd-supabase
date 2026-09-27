import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, LoaderCircle, MessageCircle, MessageSquareText, RotateCcw, Search, ThumbsDown, X } from 'lucide-react';
import {
    markProposalPortalLost,
    recordProposalFollowUp,
    reopenProposalPortal,
} from '../src/lib/proposalPortal';
import {
    buildFollowUpQueue,
    closedKind,
    CLOSED_FILTERS,
    describeClosed,
    describeNextContact,
    FOLLOW_UP_FILTERS,
    lastClientMessage,
    openedRecently,
    portalTotal,
    STALE_AFTER_DAYS,
    summarizeLostProposals,
    type ClientProposalGroup,
    type FollowUpItem,
    type FollowUpStep,
    type FollowUpTemplates,
} from '../src/lib/proposalFollowUpQueue';
import { buildProposalWhatsAppUrl } from '../src/lib/proposalMessages';
import { OpenedNowBadge } from './ProposalDetailPanel';

export type ProposalListTab = 'today' | 'waiting' | 'closed';

export interface ProposalListView {
    tab: ProposalListTab;
    // Situação (passo), "stale" (antigas) ou tipo de encerrada.
    filter: string;
    query: string;
}

export const INITIAL_PROPOSAL_LIST_VIEW: ProposalListView = { tab: 'today', filter: 'all', query: '' };

interface ProposalClientListProps {
    groups: ClientProposalGroup[];
    templates: FollowUpTemplates;
    loading?: boolean;
    // Hora de referência (a Central atualiza a cada minuto para o "Abriu agora" sumir sozinho).
    now?: number;
    view: ProposalListView;
    onViewChange: (next: Partial<ProposalListView>) => void;
    onOpen: (portalId: string) => void;
    onChanged: () => Promise<void> | void;
}

const PAGE_SIZE = 10;
// Com poucos clientes a busca só ocupa espaço.
const SEARCH_MIN_CLIENTS = 7;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const stepDot: Record<FollowUpStep, string> = {
    reply: 'bg-blue-600',
    expiring: 'bg-amber-500',
    hot: 'bg-emerald-500',
    not_opened: 'bg-slate-400',
    value: 'bg-sky-500',
    expired: 'bg-orange-500',
    close: 'bg-red-500',
};

const closedDot = { approved: 'bg-emerald-600', rejected: 'bg-red-500', lost: 'bg-slate-400' } as const;

const Chip: React.FC<{ label: string; count: number; active: boolean; tone?: 'amber'; onClick: () => void }> = ({ label, count, active, tone, onClick }) => (
    <button type="button" aria-pressed={active} onClick={onClick}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors ${active
            ? 'border-blue-600 bg-blue-600 text-white'
            : tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
        {label} <span className={`tabular-nums ${active ? 'text-white/80' : 'opacity-70'}`}>{count}</span>
    </button>
);

// Uma linha por cliente; tocar abre a ficha (mensagem, conversa e histórico).
const ClientRow: React.FC<{
    group: ClientProposalGroup;
    dot: string;
    subtitle: React.ReactNode;
    badge?: React.ReactNode;
    onOpen: () => void;
    action?: React.ReactNode;
}> = ({ group, dot, subtitle, badge, onOpen, action }) => {
    const { primary } = group;
    return (
        <article className="flex items-center gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] pr-2">
            <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-1 text-left">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="truncate text-[15px] font-semibold text-[var(--text-strong)]">{primary.clientName}</span>
                            {badge}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{currency.format(portalTotal(primary))}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{subtitle}</span>
                </span>
                {group.unreadCount > 0 ? (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white" aria-label={`${group.unreadCount} nova${group.unreadCount > 1 ? 's' : ''}`}>{group.unreadCount}</span>
                ) : null}
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            </button>
            {action}
        </article>
    );
};

/** Lista única de clientes com proposta enviada por link: o que fazer hoje, quem está aguardando e as encerradas. */
const ProposalClientList: React.FC<ProposalClientListProps> = ({ groups, templates, loading = false, now = Date.now(), view, onViewChange, onOpen, onChanged }) => {
    const { tab, filter, query } = view;
    const [visible, setVisible] = useState(PAGE_SIZE);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null);

    useEffect(() => { setVisible(PAGE_SIZE); }, [tab, filter, query]);

    const searched = useMemo(() => {
        const term = normalizeSearch(query);
        return term ? groups.filter(group => normalizeSearch(group.primary.clientName).includes(term)) : groups;
    }, [groups, query]);
    const groupByPortal = useMemo(() => new Map(searched.map(group => [group.primary.id, group])), [searched]);
    const { due, waiting, stale } = useMemo(() => buildFollowUpQueue(searched.map(group => group.primary), now, templates), [searched, now, templates]);
    const closed = useMemo(() => searched.filter(group => closedKind(group.primary)), [searched]);
    const lostSummary = useMemo(() => summarizeLostProposals(groups.map(group => group.primary)), [groups]);

    const tabItems = tab === 'today' ? due : tab === 'waiting' ? waiting : [];
    const stepFilters = useMemo(
        () => FOLLOW_UP_FILTERS.map(option => ({ ...option, count: tabItems.filter(item => item.step === option.step).length })).filter(option => option.count > 0),
        [tabItems],
    );
    const closedFilters = useMemo(
        () => CLOSED_FILTERS.map(option => ({ ...option, count: closed.filter(group => closedKind(group.primary) === option.kind).length })).filter(option => option.count > 0),
        [closed],
    );
    const showStale = tab === 'today' && stale.length > 0;

    // Depois de encerrar as antigas, o filtro some.
    useEffect(() => {
        if (filter === 'stale' && !showStale) onViewChange({ filter: 'all' });
    }, [filter, showStale, onViewChange]);

    const listItems: FollowUpItem[] = filter === 'stale' ? stale : filter === 'all' ? tabItems : tabItems.filter(item => item.step === filter);
    const closedItems = filter === 'all' ? closed : closed.filter(group => closedKind(group.primary) === filter);

    const run = async (key: string, action: () => Promise<void>) => {
        setBusyId(key);
        setError('');
        try {
            await action();
            await onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.');
        } finally {
            setBusyId(null);
        }
    };

    const closeStale = () => {
        const ids = stale.map(item => item.portal.id);
        void run('stale', async () => {
            await markProposalPortalLost(ids, 'no_response', `Vencida há mais de ${STALE_AFTER_DAYS} dias`);
            setUndo({ ids, label: ids.length === 1 ? '1 proposta antiga encerrada como perdida.' : `${ids.length} propostas antigas encerradas como perdidas.` });
            onViewChange({ filter: 'all' });
        });
    };

    const reopen = (ids: string[]) =>
        void run(ids.length === 1 ? ids[0] : 'undo', async () => {
            await reopenProposalPortal(ids.length === 1 ? ids[0] : ids);
            setUndo(current => (current && current.ids.every(id => ids.includes(id)) ? null : current));
        });

    const tabs: Array<{ id: ProposalListTab; label: string; count: number }> = [
        { id: 'today', label: 'Hoje', count: due.length },
        { id: 'waiting', label: 'Aguardando', count: waiting.length },
        { id: 'closed', label: 'Encerradas', count: closed.length },
    ];

    const term = query.trim();
    // Na busca, o cliente pode estar em outra aba.
    const notFound = due.length + waiting.length + stale.length + closed.length > 0
        ? `"${term}" não está nesta aba. Veja as outras abas.`
        : `Nenhum cliente encontrado para "${term}".`;
    const moreButton = (total: number) => total > visible ? (
        <button type="button" onClick={() => setVisible(current => current + PAGE_SIZE)} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] text-[var(--text-body)]">
            <span className="font-semibold">Mostrar mais ({total - visible})</span>
        </button>
    ) : null;
    const empty = (text: React.ReactNode) => (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-[var(--text-muted)]">
            <p>{text}</p>
            {filter !== 'all' && !term ? (
                <p className="mt-2 text-xs font-semibold"><button type="button" onClick={() => onViewChange({ filter: 'all' })} className="text-blue-600">Ver todas</button></p>
            ) : null}
        </div>
    );

    const renderItem = (item: FollowUpItem) => {
        const { portal } = item;
        const group = groupByPortal.get(portal.id);
        if (!group) return null;
        const clientMessage = item.step === 'reply' ? lastClientMessage(portal) : null;
        const whatsappUrl = item.message ? buildProposalWhatsAppUrl(portal.clientPhone || undefined, item.message) : null;
        const subtitle = clientMessage?.body
            ? <span className="text-blue-700 dark:text-blue-300">“{clientMessage.body}”</span>
            : <>
                <span className={item.step === 'reply' ? 'text-blue-700 dark:text-blue-300' : item.step === 'expiring' || item.step === 'expired' ? 'text-amber-700 dark:text-amber-300' : ''}>{item.title}</span>
                {!item.due ? <> · <span>Próximo contato: {describeNextContact(item.dueAt)}</span></> : null}
            </>;
        const action = item.step === 'reply' ? (
            <button type="button" onClick={() => onOpen(portal.id)} aria-label={`Responder ${portal.clientName}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            </button>
        ) : whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label={`WhatsApp para ${portal.clientName}`} title="Enviar a mensagem sugerida no WhatsApp"
                onClick={() => void run(portal.id, () => recordProposalFollowUp(portal.id, item.step, 'whatsapp'))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </a>
        ) : null;
        return <ClientRow key={portal.id} group={group} dot={stepDot[item.step]} subtitle={subtitle} badge={openedRecently(portal, now) ? <OpenedNowBadge /> : null} onOpen={() => onOpen(portal.id)} action={action} />;
    };

    return (
        <section id="proposal-list" className="scroll-mt-24 space-y-3 text-sm" aria-label="Clientes com proposta">
            {groups.length >= SEARCH_MIN_CLIENTS || term ? (
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                    <input
                        id="proposal-list-search"
                        type="search"
                        value={query}
                        onChange={event => onViewChange({ query: event.target.value, filter: 'all' })}
                        placeholder="Buscar cliente"
                        aria-label="Buscar cliente"
                        style={{ fontSize: 16 }}
                        className="h-10 w-full scroll-mt-28 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] pl-9 pr-3 text-[var(--text-body)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                </label>
            ) : null}

            <div className="grid grid-cols-3 rounded-xl bg-[var(--surface-muted)] p-1 text-[13px] font-semibold" role="tablist" aria-label="Propostas">
                {tabs.map(item => (
                    <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} aria-label={`${item.label} (${item.count})`} onClick={() => onViewChange({ tab: item.id, filter: 'all' })}
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-lg transition-colors ${tab === item.id ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                        {item.label}
                        <span className={`min-w-5 rounded-full px-1.5 text-[11px] tabular-nums ${tab === item.id && item.id === 'today' && item.count > 0 ? 'bg-blue-600 text-white' : 'bg-black/5 dark:bg-white/10'}`}>{item.count}</span>
                    </button>
                ))}
            </div>

            {tab === 'closed' ? (
                closedFilters.length > 1 ? (
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 text-xs font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar encerradas">
                        <Chip label="Todas" count={closed.length} active={filter === 'all'} onClick={() => onViewChange({ filter: 'all' })} />
                        {closedFilters.map(option => <Chip key={option.kind} label={option.label} count={option.count} active={filter === option.kind} onClick={() => onViewChange({ filter: option.kind })} />)}
                    </div>
                ) : null
            ) : stepFilters.length > 1 || showStale ? (
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 text-xs font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por situação">
                    <Chip label="Todas" count={tabItems.length} active={filter === 'all'} onClick={() => onViewChange({ filter: 'all' })} />
                    {stepFilters.map(option => <Chip key={option.step} label={option.label} count={option.count} active={filter === option.step} onClick={() => onViewChange({ filter: option.step })} />)}
                    {showStale ? <Chip label="Antigas" count={stale.length} tone="amber" active={filter === 'stale'} onClick={() => onViewChange({ filter: 'stale' })} /> : null}
                </div>
            ) : null}

            {undo ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-body)]">
                    <span>{undo.label}</span>
                    <span className="flex shrink-0 items-center gap-3 font-semibold">
                        <button type="button" disabled={busyId === 'undo'} onClick={() => reopen(undo.ids)} className="text-blue-600 disabled:opacity-50">Desfazer</button>
                        <button type="button" onClick={() => setUndo(null)} aria-label="Fechar aviso"><X className="h-3.5 w-3.5" /></button>
                    </span>
                </div>
            ) : null}
            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}

            {loading ? (
                <div className="space-y-2" role="status">
                    {[0, 1, 2, 3].map(index => (
                        <div key={index} className="flex animate-pulse items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3.5" aria-hidden="true">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
                            <span className="min-w-0 flex-1 space-y-2">
                                <span className="block h-3.5 rounded bg-slate-200 dark:bg-slate-700" style={{ width: `${[46, 38, 52, 34][index]}%` }} />
                                <span className="block h-3 rounded bg-slate-100 dark:bg-slate-800" style={{ width: `${[64, 58, 70, 50][index]}%` }} />
                            </span>
                            <span className="h-3 w-14 shrink-0 rounded bg-slate-100 dark:bg-slate-800" />
                        </div>
                    ))}
                    <span className="sr-only">Carregando…</span>
                </div>
            ) : tab === 'closed' ? (
                closedItems.length === 0 ? empty(term ? notFound : 'Nenhuma proposta encerrada.') : (
                    <div className="space-y-2">
                        {(filter === 'all' || filter === 'lost') && lostSummary.topReason ? (
                            <p className="px-1 text-xs text-[var(--text-muted)]">Nos últimos 30 dias, o motivo de perda mais comum foi <strong className="font-semibold text-[var(--text-strong)]">{lostSummary.topReason.toLowerCase()}</strong>.</p>
                        ) : null}
                        {closedItems.slice(0, visible).map(group => {
                            const closedInfo = describeClosed(group.primary)!;
                            const action = closedInfo.kind === 'lost' ? (
                                <span className="shrink-0 text-xs font-semibold">
                                    <button type="button" disabled={busyId === group.primary.id} onClick={() => reopen([group.primary.id])} className="inline-flex h-10 items-center gap-1 px-2 text-blue-600 disabled:opacity-50">
                                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reabrir
                                    </button>
                                </span>
                            ) : null;
                            return <ClientRow key={group.primary.id} group={group} dot={closedDot[closedInfo.kind]} subtitle={closedInfo.label} onOpen={() => onOpen(group.primary.id)} action={action} />;
                        })}
                        {moreButton(closedItems.length)}
                    </div>
                )
            ) : listItems.length === 0 ? (
                empty(term
                    ? notFound
                    : filter === 'reply'
                        ? 'Nenhum cliente esperando resposta agora.'
                        : filter !== 'all'
                            ? 'Nada nesse filtro agora.'
                            : tab === 'today'
                                ? `Nada para hoje.${waiting.length > 0 ? ` ${waiting.length === 1 ? '1 cliente está' : `${waiting.length} clientes estão`} aguardando o momento certo.` : ''}${showStale ? ` Há ${stale.length === 1 ? '1 antiga' : `${stale.length} antigas`} em "Antigas".` : ''}`
                                : 'Ninguém aguardando.')
            ) : (
                <div className="space-y-2">
                    {filter === 'stale' ? (
                        <div className="rounded-2xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                            <p className="text-[13px] leading-5">
                                Venceram há mais de {STALE_AFTER_DAYS} dias sem resposta, por isso ficam fora de "Hoje". Encerre como perdidas para limpar a lista. Se precisar, dá para reabrir em "Encerradas".
                            </p>
                            <div className="mt-2 text-[13px] font-semibold">
                                <button type="button" disabled={busyId === 'stale'} onClick={closeStale} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-white disabled:opacity-60">
                                    {busyId === 'stale' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ThumbsDown className="h-4 w-4" aria-hidden="true" />}
                                    {stale.length === 1 ? 'Encerrar a antiga como perdida' : `Encerrar as ${stale.length} como perdidas`}
                                </button>
                            </div>
                        </div>
                    ) : null}
                    {listItems.slice(0, visible).map(renderItem)}
                    {moreButton(listItems.length)}
                </div>
            )}
        </section>
    );
};

export default ProposalClientList;
