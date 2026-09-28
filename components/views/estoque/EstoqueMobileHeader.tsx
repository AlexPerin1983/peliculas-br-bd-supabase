import React, { useRef, useState } from 'react';
import { Layers3, Ruler, Scissors, Search, X } from 'lucide-react';
import type { Bobina, Retalho } from '../../../types';
import type { EstoqueStats } from '../../../services/estoqueDb';
import { formatStockMeters } from '../../../src/lib/estoqueDimensions';
import { getEstoqueQuickFilters, type EstoqueTab } from '../../../src/lib/estoqueQuickFilters';

// O menu fixo ("Buscar") foca este campo.
export const ESTOQUE_SEARCH_ID = 'estoque-mobile-search';
// Busca e filtros: sobem para o topo da tela ao digitar (o teclado não cobre os campos).
export const ESTOQUE_SEARCH_AREA_ID = 'estoque-mobile-search-area';

export const scrollSearchAreaToTop = () => {
    // Espera o teclado começar a abrir para a conta da rolagem já considerar a tela menor.
    window.setTimeout(() => document.getElementById(ESTOQUE_SEARCH_AREA_ID)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 150);
};

export type EstoqueSizeSearch = {
    larguraCm: string;
    comprimentoCm: string;
    onLarguraChange: (value: string) => void;
    onComprimentoChange: (value: string) => void;
    onClear: () => void;
    active: boolean;
    matchCount: number;
};

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
    // Só na aba de retalhos.
    sizeSearch?: EstoqueSizeSearch;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const area = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const sanitize = (value: string) => value.replace(/[^\d.,]/g, '');
const sizeInput = 'h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-center font-semibold tabular-nums text-[var(--text-strong)] outline-none transition placeholder:font-normal placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10';

/** Topo do estoque no celular: resumo em números, abas, busca (texto e medida) e filtros rápidos. */
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
    sizeSearch,
}) => {
    const filters = getEstoqueQuickFilters(activeTab, bobinas, retalhos, statusFilter);
    const [sizeOpen, setSizeOpen] = useState(false);
    const larguraRef = useRef<HTMLInputElement>(null);
    const comprimentoRef = useRef<HTMLInputElement>(null);
    // Aberta enquanto houver medida digitada.
    const showSize = Boolean(sizeSearch) && (sizeOpen || Boolean(sizeSearch?.larguraCm || sizeSearch?.comprimentoCm));

    const summary = [
        { label: 'Metros livres', value: stats ? `${formatStockMeters(stats.totalMetrosDisponiveis)} m` : '—', detail: stats ? plural(stats.totalBobinasAtivas, 'bobina ativa', 'bobinas ativas') : '' },
        { label: 'Retalhos livres', value: stats ? String(stats.totalRetalhoDisponivel) : '—', detail: stats ? `${area.format(stats.totalAreaRetalhos)} m²` : '' },
        { label: 'Consumo 30 dias', value: stats ? `${formatStockMeters(stats.consumoUltimos30Dias)} m` : '—', detail: 'das bobinas' },
    ];
    const tabs = [
        { id: 'bobinas' as const, label: 'Bobinas', count: bobinas.length, icon: Layers3 },
        { id: 'retalhos' as const, label: 'Retalhos', count: retalhos.length, icon: Scissors },
    ];

    const toggleSize = () => {
        if (showSize) {
            sizeSearch?.onClear();
            setSizeOpen(false);
            return;
        }
        setSizeOpen(true);
        // Já abre o teclado na largura.
        window.setTimeout(() => larguraRef.current?.focus(), 60);
    };

    // "Buscar" do teclado: fecha o teclado para ver o resultado.
    const blurOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') event.currentTarget.blur();
    };

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

            <div id={ESTOQUE_SEARCH_AREA_ID} className="scroll-mt-3 space-y-2.5">
                <div id="estoque-mobile-tabs" className="grid grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-1 text-[13px] font-semibold" role="tablist" aria-label="Tipo de material">
                    {tabs.map(({ id, label, count, icon: Icon }) => (
                        <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => onChangeTab(id)}
                            className={`flex h-10 items-center justify-center gap-1.5 rounded-lg transition-colors ${activeTab === id ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {label}
                            <span className="min-w-5 rounded-full bg-black/5 px-1.5 text-[11px] tabular-nums dark:bg-white/10">{count}</span>
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    <label className="relative block min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" aria-hidden="true" />
                        <input
                            id={ESTOQUE_SEARCH_ID}
                            type="search"
                            value={searchTerm}
                            onChange={event => onSearchChange(event.target.value)}
                            onFocus={scrollSearchAreaToTop}
                            onKeyDown={blurOnEnter}
                            enterKeyHint="search"
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
                    {sizeSearch ? (
                        <button type="button" onClick={toggleSize} aria-pressed={showSize} aria-label={showSize ? 'Fechar busca por medida' : 'Buscar retalho por medida'}
                            title="Buscar retalho por medida"
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${showSize
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)]'}`}>
                            <Ruler className="h-[18px] w-[18px]" aria-hidden="true" />
                        </button>
                    ) : null}
                </div>

                {sizeSearch && showSize ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-hairline)]" role="group" aria-label="Buscar retalho por medida">
                        <p className="text-xs font-semibold text-[var(--text-strong)]">Medida da peça <span className="font-normal text-[var(--text-muted)]">em cm (largura × comprimento)</span></p>
                        <div className="mt-2 flex items-center gap-2">
                            <input
                                ref={larguraRef}
                                type="text"
                                inputMode="decimal"
                                enterKeyHint="next"
                                value={sizeSearch.larguraCm}
                                onChange={event => sizeSearch.onLarguraChange(sanitize(event.target.value))}
                                onFocus={scrollSearchAreaToTop}
                                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); comprimentoRef.current?.focus(); } }}
                                placeholder="Largura"
                                aria-label="Largura (cm)"
                                style={{ fontSize: 16 }}
                                className={sizeInput}
                            />
                            <span className="text-[var(--text-muted)]" aria-hidden="true">×</span>
                            <input
                                ref={comprimentoRef}
                                type="text"
                                inputMode="decimal"
                                enterKeyHint="search"
                                value={sizeSearch.comprimentoCm}
                                onChange={event => sizeSearch.onComprimentoChange(sanitize(event.target.value))}
                                onFocus={scrollSearchAreaToTop}
                                onKeyDown={blurOnEnter}
                                placeholder="Comprimento"
                                aria-label="Comprimento (cm)"
                                style={{ fontSize: 16 }}
                                className={sizeInput}
                            />
                        </div>
                        {sizeSearch.active ? (
                            <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${sizeSearch.matchCount > 0
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                                {sizeSearch.matchCount > 0
                                    ? `${plural(sizeSearch.matchCount, 'retalho cabe', 'retalhos cabem')} nessa medida, do menor desperdício.`
                                    : 'Nenhum retalho disponível cabe nessa medida.'}
                            </p>
                        ) : (
                            <p className="mt-2 text-xs text-[var(--text-muted)]">Aparecem só os retalhos disponíveis que cabem na peça.</p>
                        )}
                    </div>
                ) : null}

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
