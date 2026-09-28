import React from 'react';
import { Layers3, Scissors, Search, X } from 'lucide-react';
import type { Bobina, Retalho } from '../../../types';
import type { EstoqueStats } from '../../../services/estoqueDb';
import { formatStockMeters } from '../../../src/lib/estoqueDimensions';
import { getEstoqueQuickFilters, type EstoqueTab } from '../../../src/lib/estoqueQuickFilters';

// O menu fixo ("Buscar") foca este campo.
export const ESTOQUE_SEARCH_ID = 'estoque-mobile-search';

type EstoqueMobileHeaderProps = {
    activeTab: EstoqueTab;
    bobinas: Bobina[];
    retalhos: Retalho[];
    stats: EstoqueStats | null;
    searchTerm: string;
    statusFilter: string;
    onChangeTab: (tab: EstoqueTab) => void;
    onSearchChange: (value: string) => void;
    onStatusFilterChange: (value: string) => void;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const area = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Topo do estoque no celular: resumo em números, abas, busca e filtros rápidos. */
const EstoqueMobileHeader: React.FC<EstoqueMobileHeaderProps> = ({
    activeTab,
    bobinas,
    retalhos,
    stats,
    searchTerm,
    statusFilter,
    onChangeTab,
    onSearchChange,
    onStatusFilterChange,
}) => {
    const filters = getEstoqueQuickFilters(activeTab, bobinas, retalhos, statusFilter);
    const summary = [
        { label: 'Metros livres', value: stats ? `${formatStockMeters(stats.totalMetrosDisponiveis)} m` : '—', detail: stats ? plural(stats.totalBobinasAtivas, 'bobina ativa', 'bobinas ativas') : '' },
        { label: 'Retalhos livres', value: stats ? String(stats.totalRetalhoDisponivel) : '—', detail: stats ? `${area.format(stats.totalAreaRetalhos)} m²` : '' },
        { label: 'Consumo 30 dias', value: stats ? `${formatStockMeters(stats.consumoUltimos30Dias)} m` : '—', detail: 'das bobinas' },
    ];
    const tabs = [
        { id: 'bobinas' as const, label: 'Bobinas', count: bobinas.length, icon: Layers3 },
        { id: 'retalhos' as const, label: 'Retalhos', count: retalhos.length, icon: Scissors },
    ];

    return (
        <section className="space-y-4 sm:hidden">
            <header className="px-1 pt-1">
                <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">Estoque</h1>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{plural(bobinas.length, 'bobina', 'bobinas')} · {plural(retalhos.length, 'retalho', 'retalhos')}</p>
            </header>

            <section className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]" aria-label="Resumo do estoque">
                {summary.map(item => (
                    <div key={item.label} className="min-w-0 px-2 py-3 text-center">
                        <p className="truncate text-[11px] text-[var(--text-muted)]">{item.label}</p>
                        <p className="mt-0.5 truncate text-lg font-semibold tabular-nums tracking-[-0.01em] text-[var(--text-strong)]">{item.value}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{item.detail}</p>
                    </div>
                ))}
            </section>

            <div id="estoque-mobile-tabs" className="grid scroll-mt-20 grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-1 text-[13px] font-semibold" role="tablist" aria-label="Tipo de material">
                {tabs.map(({ id, label, count, icon: Icon }) => (
                    <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => onChangeTab(id)}
                        className={`flex h-10 items-center justify-center gap-1.5 rounded-lg transition-colors ${activeTab === id ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {label}
                        <span className="min-w-5 rounded-full bg-black/5 px-1.5 text-[11px] tabular-nums dark:bg-white/10">{count}</span>
                    </button>
                ))}
            </div>

            <div className="space-y-2.5">
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" aria-hidden="true" />
                    <input
                        id={ESTOQUE_SEARCH_ID}
                        type="search"
                        value={searchTerm}
                        onChange={event => onSearchChange(event.target.value)}
                        placeholder={activeTab === 'bobinas' ? 'Buscar película, lote ou local' : 'Buscar película ou local'}
                        aria-label="Buscar no estoque"
                        style={{ fontSize: 16 }}
                        className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] pl-10 pr-10 text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {searchTerm ? (
                        <button type="button" onClick={() => onSearchChange('')} aria-label="Limpar busca"
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]">
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    ) : null}
                </label>

                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 text-xs font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar estoque">
                    {filters.map(filter => {
                        const active = statusFilter === filter.value;
                        const warn = filter.warn && filter.count > 0 && !active;
                        return (
                            <button key={filter.value} type="button" aria-pressed={active} onClick={() => onStatusFilterChange(filter.value)}
                                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors ${active
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : warn
                                        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200'
                                        : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
                                {filter.label} <span className={`tabular-nums ${active ? 'text-white/80' : 'opacity-70'}`}>{filter.count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default EstoqueMobileHeader;
