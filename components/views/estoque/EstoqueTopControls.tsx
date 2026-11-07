import React, { useEffect, useMemo, useRef } from 'react';
import { StatusFilterDropdown } from '../../ui/StatusFilterDropdown';
import { PackageIcon, PlusIcon, QrCodeIcon, ScissorsIcon, SearchIcon } from './EstoqueIcons';
import { getEstoqueStatusOptions } from './estoqueStatus';

interface EstoqueTopControlsProps {
    activeTab: 'bobinas' | 'retalhos';
    bobinasCount: number;
    retalhosCount: number;
    visibleCount: number;
    onChangeTab: (tab: 'bobinas' | 'retalhos') => void;
    onAdd: () => void;
    onAI: () => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    onScan: () => void;
    /** Busca mobile controlada pelo footer flutuante. */
    mobileSearchOpen: boolean;
    onCloseMobileSearch: () => void;
}

const viewToggleBaseClassName =
    'flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border transition-all duration-200';

const actionButtonClassName =
    'inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-all duration-200 hover:-translate-y-px hover:bg-[var(--surface)] hover:text-[var(--text-strong)]';

const EstoqueTopControls: React.FC<EstoqueTopControlsProps> = ({
    activeTab,
    bobinasCount,
    retalhosCount,
    visibleCount,
    onChangeTab,
    onAdd,
    onAI,
    searchTerm,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    viewMode,
    onViewModeChange,
    onScan,
    mobileSearchOpen,
    onCloseMobileSearch,
}) => {
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (mobileSearchOpen) {
            searchInputRef.current?.focus();
        }
    }, [mobileSearchOpen]);

    const currentTabLabel = activeTab === 'bobinas' ? 'bobinas' : 'retalhos';
    const resultSummary = `${visibleCount} de ${activeTab === 'bobinas' ? bobinasCount : retalhosCount} ${currentTabLabel}`;

    const statusOptions = useMemo(() => getEstoqueStatusOptions(activeTab), [activeTab]);

    const renderViewToggle = (iconSize: number) => (
        <div className="flex rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-1 shadow-[var(--shadow-hairline)]">
            <button
                type="button"
                className={`${viewToggleBaseClassName} ${
                    viewMode === 'grid'
                        ? 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-strong)] shadow-sm'
                        : 'border-transparent bg-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
                onClick={() => onViewModeChange('grid')}
                title="Visualização em grade"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
            </button>
            <button
                type="button"
                className={`${viewToggleBaseClassName} ${
                    viewMode === 'list'
                        ? 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-strong)] shadow-sm'
                        : 'border-transparent bg-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
                onClick={() => onViewModeChange('list')}
                title="Visualização em lista"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
            </button>
        </div>
    );

    return (
        <section className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-hairline)] sm:p-5">
            {mobileSearchOpen ? (
                <div className="sm:hidden">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                onCloseMobileSearch();
                                if (!searchTerm.trim()) {
                                    onSearchChange('');
                                }
                            }}
                            className={actionButtonClassName}
                            aria-label="Fechar busca"
                        >
                            <i className="fas fa-arrow-left text-[13px]" aria-hidden="true"></i>
                        </button>

                        <label className="relative flex-1">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                <SearchIcon />
                            </span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder={`Buscar ${activeTab === 'bobinas' ? 'bobina' : 'retalho'}`}
                                className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-10 pr-10 text-[13px] font-medium text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
                            />
                            {searchTerm ? (
                                <button
                                    type="button"
                                    onClick={() => onSearchChange('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                                    aria-label="Limpar busca"
                                >
                                    <i className="fas fa-times-circle text-[13px]" aria-hidden="true"></i>
                                </button>
                            ) : null}
                        </label>
                    </div>

                    <p className="pt-2 pl-11 text-[11px] text-[var(--text-muted)]">
                        {searchTerm.trim() ? `${visibleCount} resultados em foco` : 'Busque por película, ID, lote ou local'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Uma linha só: abas com a contagem, o que está na tela e as ações.
                        O título "Estoque" já está no topo da página. */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div role="tablist" aria-label="Tipo de material" className="inline-flex rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-1">
                                {([
                                    { key: 'bobinas' as const, label: 'Bobinas', count: bobinasCount, icon: <PackageIcon /> },
                                    { key: 'retalhos' as const, label: 'Retalhos', count: retalhosCount, icon: <ScissorsIcon /> },
                                ]).map(tab => {
                                    const isActive = activeTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            onClick={() => onChangeTab(tab.key)}
                                            className={`inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius-control)-2px)] px-3 transition-colors [&_svg]:h-4 [&_svg]:w-4 ${isActive
                                                ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-[var(--shadow-hairline)]'
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'}`}
                                        >
                                            {tab.icon}
                                            <span className="text-sm font-medium">{tab.label}</span>
                                            <span className="text-xs tabular-nums text-[var(--text-muted)]">{tab.count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <span className="truncate text-xs tabular-nums text-[var(--text-muted)]">{resultSummary}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onScan}
                                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] [&_svg]:h-4 [&_svg]:w-4"
                                aria-label="Escanear"
                            >
                                <QrCodeIcon />
                                <span className="hidden text-sm font-medium md:inline">Escanear</span>
                            </button>
                            <button
                                type="button"
                                onClick={onAI}
                                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                aria-label="Adicionar com IA"
                            >
                                <i className="fas fa-wand-magic-sparkles text-[13px]" aria-hidden="true"></i>
                                <span className="hidden text-sm font-medium md:inline">Criar com IA</span>
                            </button>
                            <button
                                type="button"
                                onClick={onAdd}
                                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--surface-inverse)] px-3.5 text-[var(--surface)] transition-opacity hover:opacity-90 [&_svg]:h-4 [&_svg]:w-4"
                                aria-label={activeTab === 'bobinas' ? 'Nova bobina' : 'Novo retalho'}
                            >
                                <PlusIcon />
                                <span className="text-sm font-semibold">{activeTab === 'bobinas' ? 'Nova bobina' : 'Novo retalho'}</span>
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <label className="relative flex-1">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                <SearchIcon />
                            </span>
                            <input
                                type="text"
                                placeholder={`Buscar ${activeTab === 'bobinas' ? 'bobina' : 'retalho'} por película, ID ou local`}
                                value={searchTerm}
                                onChange={(event) => onSearchChange(event.target.value)}
                                className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-10 pr-4 text-[14px] text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-blue-500/15"
                            />
                        </label>

                        <div className="min-w-[180px]">
                            <StatusFilterDropdown
                                value={statusFilter}
                                onChange={onStatusFilterChange}
                                options={statusOptions}
                            />
                        </div>

                        {renderViewToggle(18)}
                    </div>
                </>
            )}
        </section>
    );
};

export default EstoqueTopControls;
