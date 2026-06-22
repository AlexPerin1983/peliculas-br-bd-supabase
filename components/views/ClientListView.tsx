import React, { useMemo, useState } from 'react';
import { ChevronRight, FileText, Pin, Plus, Search, UserPlus, UserRound, X } from 'lucide-react';
import { Client, SavedPDF } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import { ListSkeleton } from '../ui/Skeleton';
import { matchesSearch } from '../../src/lib/textSearch';

interface ClientListViewProps {
    clients: Client[];
    pdfs: SavedPDF[];
    isLoading: boolean;
    onOpenClient: (id: number) => void;
    onAddClient: () => void;
    onTogglePin: (id: number) => void;
}

interface ClientStats {
    count: number;
    hasPending: boolean;
    isConverted: boolean;
}

const EMPTY_STATS: ClientStats = { count: 0, hasPending: false, isConverted: false };

const ClientListView: React.FC<ClientListViewProps> = ({
    clients,
    pdfs,
    isLoading,
    onOpenClient,
    onAddClient,
    onTogglePin,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(20);

    const statsMap = useMemo(() => {
        const map = new Map<number, ClientStats>();
        for (const pdf of pdfs) {
            const id = pdf.clienteId;
            if (id == null) continue;
            const stats = map.get(id) ?? { ...EMPTY_STATS };
            stats.count += 1;
            if ((pdf.status || 'pending') === 'approved') {
                stats.isConverted = true;
            } else {
                stats.hasPending = true;
            }
            map.set(id, stats);
        }
        return map;
    }, [pdfs]);

    const filteredClients = useMemo(() => {
        const term = searchTerm.trim();
        const base = term ? clients.filter(client => matchesSearch(client.nome, term)) : clients;
        return [...base].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            if (a.pinned && b.pinned) {
                if (a.pinnedAt && b.pinnedAt) return b.pinnedAt - a.pinnedAt;
                if (a.pinnedAt) return -1;
                if (b.pinnedAt) return 1;
            }
            return (b.id || 0) - (a.id || 0);
        });
    }, [clients, searchTerm]);

    const displayedClients = useMemo(() => filteredClients.slice(0, visibleCount), [filteredClients, visibleCount]);

    return (
        <div className="mx-auto w-full max-w-3xl space-y-4 animate-fade-in">
            {/* Busca + novo cliente */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-soft)]">
                        <Search className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => { setSearchTerm(event.target.value); setVisibleCount(20); }}
                        placeholder="Buscar cliente pelo nome..."
                        className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] pl-10 pr-10 text-sm text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10"
                        disabled={isLoading}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]"
                            aria-label="Limpar busca"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    )}
                </div>
                <ActionButton
                    onClick={onAddClient}
                    variant="primary"
                    size="md"
                    icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                    className="shrink-0"
                >
                    Novo cliente
                </ActionButton>
            </div>

            {isLoading ? (
                <ListSkeleton count={6} />
            ) : filteredClients.length === 0 ? (
                searchTerm ? (
                    <ContentState
                        compact
                        icon={<Search className="h-7 w-7" aria-hidden="true" />}
                        title="Nenhum cliente encontrado"
                        description="Tente outro nome ou cadastre um novo cliente."
                        actionLabel="Adicionar cliente"
                        onAction={onAddClient}
                    />
                ) : (
                    <ContentState
                        icon={<UserRound className="h-7 w-7" aria-hidden="true" />}
                        title="Nenhum cliente ainda"
                        description="Cadastre seu primeiro cliente para começar."
                        actionLabel="Adicionar cliente"
                        onAction={onAddClient}
                    />
                )
            ) : (
                <>
                    <div className="space-y-2">
                        {displayedClients.map(client => {
                            const stats = (client.id != null && statsMap.get(client.id)) || EMPTY_STATS;
                            const initials = client.nome.trim().slice(0, 2).toUpperCase() || 'CL';
                            return (
                                <div
                                    key={client.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => client.id != null && onOpenClient(client.id)}
                                    onKeyDown={(event) => {
                                        if ((event.key === 'Enter' || event.key === ' ') && client.id != null) {
                                            event.preventDefault();
                                            onOpenClient(client.id);
                                        }
                                    }}
                                    className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-panel)] border bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-hairline)] transition-all hover:shadow-[var(--shadow-soft)] ${client.pinned ? 'border-l-4 border-l-[var(--brand-primary)] border-y-[var(--border-subtle)] border-r-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary-soft)] text-sm font-black text-[var(--brand-primary)]">
                                        {initials}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-[var(--text-strong)]">{client.nome}</p>
                                        <p className="truncate text-xs text-[var(--text-muted)]">{client.telefone || 'Sem telefone'}</p>
                                        {(stats.count > 0 || stats.isConverted || stats.hasPending) && (
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                {stats.count > 0 && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                                                        <FileText className="h-2.5 w-2.5" aria-hidden="true" />
                                                        {stats.count} {stats.count === 1 ? 'orçamento' : 'orçamentos'}
                                                    </span>
                                                )}
                                                {stats.isConverted && (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">Fechado</span>
                                                )}
                                                {stats.hasPending && (
                                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">Pendente</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); if (client.id != null) onTogglePin(client.id); }}
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border transition-colors ${client.pinned ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-soft)] hover:text-[var(--text-strong)]'}`}
                                        aria-label={client.pinned ? 'Desafixar cliente' : 'Fixar cliente no topo'}
                                        title={client.pinned ? 'Desafixar' : 'Fixar no topo'}
                                    >
                                        <Pin className="h-4 w-4" aria-hidden="true" fill={client.pinned ? 'currentColor' : 'none'} />
                                    </button>

                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-soft)]">
                                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {visibleCount < filteredClients.length && (
                        <div className="flex justify-center pt-2">
                            <ActionButton
                                onClick={() => setVisibleCount(prev => prev + 20)}
                                variant="secondary"
                                size="md"
                                icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                            >
                                Carregar mais
                            </ActionButton>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ClientListView;
