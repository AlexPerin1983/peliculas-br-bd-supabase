import React from 'react';
import { BarChart3, Search, SlidersHorizontal } from 'lucide-react';
import { PackageIcon, ScissorsIcon } from './EstoqueIcons';

type EstoqueMobileHeaderProps = {
    activeTab: 'bobinas' | 'retalhos';
    mode: 'items' | 'summary';
    bobinasCount: number;
    retalhosCount: number;
    searchTerm: string;
    filterActive: boolean;
    onChangeTab: (tab: 'bobinas' | 'retalhos') => void;
    onChangeMode: (mode: 'items' | 'summary') => void;
    onSearchChange: (value: string) => void;
    onOpenFilter: () => void;
};

const EstoqueMobileHeader: React.FC<EstoqueMobileHeaderProps> = ({
    activeTab,
    mode,
    bobinasCount,
    retalhosCount,
    searchTerm,
    filterActive,
    onChangeTab,
    onChangeMode,
    onSearchChange,
    onOpenFilter,
}) => (
    <section className="sm:hidden">
        <div className="flex items-center justify-between gap-3 px-1">
            <div>
                <p className="text-[1.35rem] font-semibold text-[var(--text-strong)]">Estoque</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {bobinasCount + retalhosCount} materiais cadastrados
                </p>
            </div>

            <button
                type="button"
                onClick={() => onChangeMode(mode === 'summary' ? 'items' : 'summary')}
                className={`inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border px-3 text-[12px] font-semibold transition-colors ${
                    mode === 'summary'
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                        : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'
                }`}
                aria-pressed={mode === 'summary'}
            >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                {mode === 'summary' ? 'Ver itens' : 'Resumo'}
            </button>
        </div>

        {mode === 'items' ? (
            <>
                <div className="mt-4 grid grid-cols-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-1">
                    <button
                        type="button"
                        onClick={() => onChangeTab('bobinas')}
                        className={`flex h-11 items-center justify-center gap-2 rounded-[calc(var(--radius-control)-4px)] text-[12px] font-semibold transition-all ${
                            activeTab === 'bobinas'
                                ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm'
                                : 'text-[var(--text-muted)]'
                        }`}
                        aria-pressed={activeTab === 'bobinas'}
                    >
                        <PackageIcon /> Bobinas <span className="text-[10px] opacity-70">{bobinasCount}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onChangeTab('retalhos')}
                        className={`flex h-11 items-center justify-center gap-2 rounded-[calc(var(--radius-control)-4px)] text-[12px] font-semibold transition-all ${
                            activeTab === 'retalhos'
                                ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm'
                                : 'text-[var(--text-muted)]'
                        }`}
                        aria-pressed={activeTab === 'retalhos'}
                    >
                        <ScissorsIcon /> Retalhos <span className="text-[10px] opacity-70">{retalhosCount}</span>
                    </button>
                </div>

                <div className="mt-3 flex gap-2">
                    <label className="relative min-w-0 flex-1">
                        <span className="sr-only">Buscar no estoque</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder={activeTab === 'bobinas' ? 'Buscar bobina...' : 'Buscar retalho...'}
                            className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] pl-10 pr-3 text-[13px] text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={onOpenFilter}
                        aria-label={filterActive ? 'Alterar filtro ativo' : 'Filtrar estoque'}
                        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border ${
                            filterActive
                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)]'
                        }`}
                    >
                        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                        {filterActive ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--brand-primary)]" /> : null}
                    </button>
                </div>
            </>
        ) : (
            <div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-[12px] font-semibold text-[var(--text-strong)]">Resumo do estoque</p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">Indicadores gerais separados da operação diária.</p>
            </div>
        )}
    </section>
);

export default EstoqueMobileHeader;
