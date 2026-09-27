import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Handshake, MessageCircle, Pin, Plus, RefreshCcw, Search, UserPlus, UserRound, Users, X } from 'lucide-react';
import { Agendamento, Client, SavedPDF } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import { ListSkeleton } from '../ui/Skeleton';
import { matchesSearch } from '../../src/lib/textSearch';
import {
    buildClientWhatsAppUrl,
    formatMoneyShort,
    needsReactivation,
    relativeDays,
    summarizeClient,
    type ClientSummary,
} from '../../src/lib/clientInsights';
import { ClientAvatar, ClientStageBadge } from '../client/ClientHero';

interface ClientListViewProps {
    clients: Client[];
    pdfs: SavedPDF[];
    agendamentos?: Agendamento[];
    isLoading: boolean;
    onOpenClient: (id: number) => void;
    onAddClient: () => void;
    onTogglePin: (id: number) => void;
    hasMoreServerClients?: boolean;
    isLoadingMoreClients?: boolean;
    onLoadMoreClients?: () => Promise<void>;
    onSearchClients?: (term: string) => Promise<void>;
}

type Filter = 'all' | 'negotiating' | 'customers' | 'reactivate' | 'pinned';
type Sort = 'activity' | 'name' | 'value';

const PAGE_SIZE = 20;
const digitsOf = (value?: string) => (value || '').replace(/\D/g, '');

const SORT_LABELS: Record<Sort, string> = {
    activity: 'Atividade recente',
    name: 'Nome (A–Z)',
    value: 'Maior valor',
};

interface Row {
    client: Client;
    summary: ClientSummary;
    reactivate: boolean;
}

const matchesFilter = (row: Row, filter: Filter) => {
    if (filter === 'negotiating') return row.summary.openGroups.length > 0;
    if (filter === 'customers') return row.summary.stage === 'customer' || row.summary.stage === 'recurring';
    if (filter === 'reactivate') return row.reactivate;
    if (filter === 'pinned') return Boolean(row.client.pinned);
    return true;
};

const FooterButton: React.FC<{ label: string; icon: React.ReactNode; active?: boolean; onClick: () => void }> = ({ label, icon, active, onClick }) => (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active}
        className={`group relative flex h-14 w-16 flex-col items-center justify-center rounded-xl transition-all duration-200 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}>
        <span className="transition-transform duration-300 group-active:scale-90">{icon}</span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);

/** Carteira de clientes: quem está negociando, quem já é cliente e quem vale reativar. */
const ClientListView: React.FC<ClientListViewProps> = ({
    clients,
    pdfs,
    agendamentos = [],
    isLoading,
    onOpenClient,
    onAddClient,
    onTogglePin,
    hasMoreServerClients = false,
    isLoadingMoreClients = false,
    onLoadMoreClients,
    onSearchClients,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [sort, setSort] = useState<Sort>('activity');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const initialSearchRef = useRef(true);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!onSearchClients) return;
        if (initialSearchRef.current) {
            initialSearchRef.current = false;
            return;
        }
        const timer = window.setTimeout(() => { void onSearchClients(searchTerm.trim()); }, 300);
        return () => window.clearTimeout(timer);
    }, [onSearchClients, searchTerm]);

    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchTerm, filter, sort]);

    // Resumo de cada cliente a partir dos orçamentos e da agenda (uma passada só em cada lista).
    const rows = useMemo<Row[]>(() => {
        const now = Date.now();
        const pdfsByClient = new Map<number, SavedPDF[]>();
        for (const pdf of pdfs) {
            if (pdf.clienteId == null) continue;
            pdfsByClient.set(pdf.clienteId, [...(pdfsByClient.get(pdf.clienteId) || []), pdf]);
        }
        const agendaByClient = new Map<number, Agendamento[]>();
        for (const item of agendamentos) {
            if (item.clienteId == null) continue;
            agendaByClient.set(item.clienteId, [...(agendaByClient.get(item.clienteId) || []), item]);
        }
        return clients.map(client => {
            const summary = summarizeClient(client, pdfsByClient.get(client.id ?? -1) || [], agendaByClient.get(client.id ?? -1) || [], [], now);
            return { client, summary, reactivate: needsReactivation(client, summary, now) };
        });
    }, [clients, pdfs, agendamentos]);

    const searched = useMemo(() => {
        const term = searchTerm.trim();
        if (!term) return rows;
        const termDigits = digitsOf(term);
        return rows.filter(({ client }) => matchesSearch(client.nome, term) || (termDigits.length >= 3 && digitsOf(client.telefone).includes(termDigits)));
    }, [rows, searchTerm]);

    const counts = useMemo(() => {
        const result: Record<Filter, number> = { all: searched.length, negotiating: 0, customers: 0, reactivate: 0, pinned: 0 };
        for (const row of searched) {
            (['negotiating', 'customers', 'reactivate', 'pinned'] as Filter[]).forEach(key => { if (matchesFilter(row, key)) result[key] += 1; });
        }
        return result;
    }, [searched]);

    const filtered = useMemo(() => {
        const list = searched.filter(row => matchesFilter(row, filter));
        const byPinned = (a: Row, b: Row) => Number(Boolean(b.client.pinned)) - Number(Boolean(a.client.pinned))
            || (a.client.pinned && b.client.pinned ? (b.client.pinnedAt || 0) - (a.client.pinnedAt || 0) : 0);
        return [...list].sort((a, b) => byPinned(a, b) || (
            sort === 'name'
                ? a.client.nome.localeCompare(b.client.nome, 'pt-BR')
                : sort === 'value'
                    ? (b.summary.closedValue + b.summary.openValue) - (a.summary.closedValue + a.summary.openValue)
                    : b.summary.lastActivityAt - a.summary.lastActivityAt || (b.client.id || 0) - (a.client.id || 0)
        ));
    }, [searched, filter, sort]);

    const displayed = filtered.slice(0, visibleCount);

    const handleLoadMore = async () => {
        if (visibleCount < filtered.length) setVisibleCount(previous => previous + PAGE_SIZE);
        if (visibleCount + PAGE_SIZE >= filtered.length && hasMoreServerClients && onLoadMoreClients) {
            await onLoadMoreClients();
        }
    };

    const focusSearch = () => {
        searchRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        searchRef.current?.focus({ preventScroll: true });
    };
    const cycleSort = () => setSort(current => (current === 'activity' ? 'name' : current === 'name' ? 'value' : 'activity'));

    const chips: Array<{ id: Filter; label: string }> = [
        { id: 'all', label: 'Todos' },
        { id: 'negotiating', label: 'Em negociação' },
        { id: 'customers', label: 'Clientes' },
        { id: 'reactivate', label: 'Para reativar' },
        { id: 'pinned', label: 'Fixados' },
    ];

    const infoFor = ({ client, summary }: Row) => {
        if (summary.openValue > 0) return `${formatMoneyShort(summary.openValue)} em aberto`;
        if (summary.closedValue > 0) return `${formatMoneyShort(summary.closedValue)} fechado`;
        return client.telefone || 'Sem telefone';
    };

    return (
        <div className="mx-auto w-full max-w-3xl space-y-4 pb-28 animate-fade-in sm:pb-0">
            <header className="flex items-end justify-between gap-3 px-1 pt-1">
                <div className="min-w-0">
                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">Clientes</h1>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {isLoading ? 'Carregando…' : `${clients.length}${hasMoreServerClients ? '+' : ''} ${clients.length === 1 ? 'cliente' : 'clientes'}`}
                    </p>
                </div>
                <div className="hidden shrink-0 sm:block">
                    <ActionButton onClick={onAddClient} variant="primary" size="md" icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}>
                        Novo cliente
                    </ActionButton>
                </div>
            </header>

            <div className="flex gap-2">
                <label className="relative block flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" aria-hidden="true" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Buscar por nome ou telefone"
                        aria-label="Buscar cliente"
                        disabled={isLoading}
                        style={{ fontSize: 16 }}
                        className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] pl-10 pr-10 text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10"
                    />
                    {searchTerm ? (
                        <button type="button" onClick={() => setSearchTerm('')} aria-label="Limpar busca"
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]">
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    ) : null}
                </label>
                <label className="relative hidden shrink-0 sm:block">
                    <span className="sr-only">Ordenar</span>
                    <select value={sort} onChange={event => setSort(event.target.value as Sort)} aria-label="Ordenar clientes" style={{ fontSize: 14 }}
                        className="h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)] outline-none">
                        {(Object.keys(SORT_LABELS) as Sort[]).map(option => <option key={option} value={option}>{SORT_LABELS[option]}</option>)}
                    </select>
                </label>
            </div>

            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 text-xs font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar clientes">
                {chips.map(chip => (
                    <button key={chip.id} type="button" aria-pressed={filter === chip.id} onClick={() => setFilter(chip.id)}
                        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors ${filter === chip.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
                        {chip.label} <span className={`tabular-nums ${filter === chip.id ? 'text-white/80' : 'opacity-70'}`}>{counts[chip.id]}</span>
                    </button>
                ))}
            </div>
            <div className="px-1 text-xs sm:hidden">
                <button type="button" onClick={cycleSort} aria-label={`Ordem: ${SORT_LABELS[sort]}. Toque para mudar`} className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
                    <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" /> Ordem: <span className="font-semibold text-[var(--text-body)]">{SORT_LABELS[sort].toLowerCase()}</span>
                </button>
            </div>

            {isLoading ? (
                <ListSkeleton count={6} />
            ) : filtered.length === 0 ? (
                searchTerm ? (
                    <ContentState compact icon={<Search className="h-7 w-7" aria-hidden="true" />} title="Nenhum cliente encontrado"
                        description="Tente outro nome ou telefone, ou cadastre um novo cliente." actionLabel="Adicionar cliente" onAction={onAddClient} />
                ) : filter !== 'all' ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                        <p>{filter === 'reactivate' ? 'Ninguém para reativar agora.' : filter === 'pinned' ? 'Nenhum cliente fixado.' : 'Nenhum cliente nesse filtro.'}</p>
                        <p className="mt-2 text-xs font-semibold"><button type="button" onClick={() => setFilter('all')} className="text-[var(--brand-primary)]">Ver todos</button></p>
                    </div>
                ) : (
                    <ContentState icon={<UserRound className="h-7 w-7" aria-hidden="true" />} title="Nenhum cliente ainda"
                        description="Cadastre seu primeiro cliente para começar." actionLabel="Adicionar cliente" onAction={onAddClient} />
                )
            ) : (
                <>
                    {filter === 'reactivate' ? (
                        <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-body)]">
                            Clientes com telefone, sem nada em andamento e sem contato há mais de 90 dias. Um "oi, como ficaram as películas?" costuma render indicação e novos ambientes.
                        </p>
                    ) : null}
                    <ul className="space-y-2">
                        {displayed.map(row => {
                            const { client, summary } = row;
                            const whatsappUrl = buildClientWhatsAppUrl(client);
                            return (
                                <li key={client.id} className={`flex items-center gap-1 rounded-2xl border bg-[var(--surface-raised)] pr-1.5 shadow-[var(--shadow-hairline)] ${client.pinned ? 'border-blue-200 dark:border-blue-900/60' : 'border-[var(--border-subtle)]'}`}>
                                    <button type="button" onClick={() => client.id != null && onOpenClient(client.id)}
                                        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left">
                                        <ClientAvatar client={client} />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-baseline gap-2">
                                                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--text-strong)]">{client.nome}</span>
                                                {summary.lastActivityAt ? <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{relativeDays(summary.lastActivityAt)}</span> : null}
                                            </span>
                                            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                                <ClientStageBadge stage={summary.stage} />
                                                <span className="truncate">{infoFor(row)}</span>
                                            </span>
                                        </span>
                                    </button>
                                    {whatsappUrl ? (
                                        <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${client.nome}`}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30">
                                            <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
                                        </a>
                                    ) : null}
                                    <button type="button" onClick={() => client.id != null && onTogglePin(client.id)}
                                        aria-label={client.pinned ? 'Desafixar cliente' : 'Fixar cliente no topo'} title={client.pinned ? 'Desafixar' : 'Fixar no topo'}
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${client.pinned ? 'text-[var(--brand-primary)]' : 'text-[var(--text-soft)] hover:text-[var(--text-strong)]'}`}>
                                        <Pin className="h-4 w-4" aria-hidden="true" fill={client.pinned ? 'currentColor' : 'none'} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {(visibleCount < filtered.length || hasMoreServerClients) ? (
                        <div className="flex justify-center pt-1">
                            <ActionButton onClick={handleLoadMore} variant="secondary" size="md" icon={<Plus className="h-4 w-4" aria-hidden="true" />} disabled={isLoadingMoreClients}>
                                {isLoadingMoreClients ? 'Carregando...' : 'Carregar mais'}
                            </ActionButton>
                        </div>
                    ) : null}
                </>
            )}

            <div className="fixed left-4 right-4 z-40 sm:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                <nav aria-label="Menu dos clientes" className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                    <div className="relative flex items-center justify-between">
                        <div className="flex gap-1">
                            <FooterButton label="Todos" icon={<Users className="h-5 w-5" aria-hidden="true" />} active={filter === 'all'} onClick={() => setFilter('all')} />
                            <FooterButton label="Negociando" icon={<Handshake className="h-5 w-5" aria-hidden="true" />} active={filter === 'negotiating'} onClick={() => setFilter('negotiating')} />
                        </div>
                        <div className="absolute left-1/2 -top-12 -translate-x-1/2">
                            <button type="button" onClick={onAddClient} aria-label="Novo cliente"
                                className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_8px_20px_rgba(21,94,239,0.4)] transition-all duration-300 hover:-translate-y-1 active:scale-95 dark:border-slate-900">
                                <UserPlus className="h-7 w-7" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="flex gap-1">
                            <FooterButton label="Reativar" icon={<RefreshCcw className="h-5 w-5" aria-hidden="true" />} active={filter === 'reactivate'} onClick={() => setFilter('reactivate')} />
                            <FooterButton label="Buscar" icon={<Search className="h-5 w-5" aria-hidden="true" />} onClick={focusSearch} />
                        </div>
                    </div>
                </nav>
            </div>
        </div>
    );
};

export default ClientListView;
