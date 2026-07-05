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

const tabBaseClassName =
    'flex min-h-[58px] items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-all duration-200';

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
    const mobileSummary =
        activeTab === 'bobinas'
            ? `${bobinasCount} bobinas em acompanhamento`
            : `${retalhosCount} retalhos disponiveis`;

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
                title="Visualizacao em grade"
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
                title="Visualizacao em lista"
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
        <section className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]" aria-hidden="true" />
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
                                placeholder={`Buscar ${activeTab === 'bobinas' ? 'bobina' : 'retalho'}...`}
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
                        {searchTerm.trim() ? `${visibleCount} resultados em foco` : 'Busque por ID, filme, lote ou localizacao'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="mb-2 hidden items-center gap-2 sm:flex">
                                <span className="ui-kicker">Controle de materiais</span>
                                <span className="h-1 w-1 rounded-full bg-[var(--border-strong)]" aria-hidden="true" />
                                <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                                    {resultSummary}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <h2 className="text-[1.1rem] font-semibold text-[var(--text-strong)] sm:text-[1.9rem]">
                                    Estoque
                                </h2>
                                <span className="inline-flex min-h-5 items-center rounded-full bg-[var(--surface-muted)] px-2 text-[10px] font-semibold text-[var(--text-muted)]">
                                    {bobinasCount + retalhosCount}
                                </span>
                            </div>

                            <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)] sm:hidden">
                                {mobileSummary}
                            </p>
                            <p className="mt-1 hidden max-w-xl text-[13px] leading-5 text-[var(--text-muted)] sm:block">
                                {activeTab === 'bobinas'
                                    ? `${bobinasCount} bobinas cadastradas para consulta, QR e consumo em proposta.`
                                    : `${retalhosCount} retalhos cadastrados para reaproveitamento com mais controle.`}
                            </p>
                        </div>

                        {/* Ações no desktop; no mobile vão para o footer flutuante */}
                        <div className="hidden items-center gap-1.5 sm:flex sm:gap-2">
                            <button
                                type="button"
                                onClick={onScan}
                                className={`${actionButtonClassName} sm:w-auto sm:gap-2 sm:px-3 sm:text-[13px] sm:font-semibold`}
                                aria-label="Escanear"
                            >
                                <QrCodeIcon />
                                <span className="hidden md:inline">Escanear</span>
                            </button>

                            <button
                                type="button"
                                onClick={onAI}
                                className={`${actionButtonClassName} sm:w-auto sm:gap-2 sm:px-3 sm:text-[13px] sm:font-semibold`}
                                aria-label="Adicionar com IA"
                            >
                                <i className="fas fa-wand-magic-sparkles text-[13px]" aria-hidden="true"></i>
                                <span className="hidden md:inline">Criar com IA</span>
                            </button>

                            <button
                                type="button"
                                onClick={onAdd}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-inverse)] text-[var(--surface)] shadow-[0_14px_26px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-px hover:opacity-90 sm:w-auto sm:gap-2 sm:px-3.5 sm:text-[13px] sm:font-semibold"
                                aria-label={activeTab === 'bobinas' ? 'Nova bobina' : 'Novo retalho'}
                            >
                                <PlusIcon />
                                <span className="hidden sm:inline">{activeTab === 'bobinas' ? 'Nova bobina' : 'Novo retalho'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:gap-2 sm:overflow-visible">
                        <button
                            type="button"
                            className={`${tabBaseClassName} ${
                                activeTab === 'bobinas'
                                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_14px_28px_rgba(21,94,239,0.22)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-body)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
                            }`}
                            onClick={() => onChangeTab('bobinas')}
                        >
                            <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${
                                    activeTab === 'bobinas' ? 'bg-white/15 text-white' : 'bg-[var(--surface)] text-[var(--text-muted)]'
                                }`}
                            >
                                <PackageIcon />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[12px] font-semibold sm:text-[13px]">Bobinas</span>
                                <span className={`block text-[10px] ${activeTab === 'bobinas' ? 'text-white/75' : 'text-[var(--text-muted)]'}`}>
                                    {bobinasCount} itens
                                </span>
                            </span>
                        </button>

                        <button
                            type="button"
                            className={`${tabBaseClassName} ${
                                activeTab === 'retalhos'
                                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_14px_28px_rgba(21,94,239,0.22)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-body)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
                            }`}
                            onClick={() => onChangeTab('retalhos')}
                        >
                            <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${
                                    activeTab === 'retalhos' ? 'bg-white/15 text-white' : 'bg-[var(--surface)] text-[var(--text-muted)]'
                                }`}
                            >
                                <ScissorsIcon />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[12px] font-semibold sm:text-[13px]">Retalhos</span>
                                <span className={`block text-[10px] ${activeTab === 'retalhos' ? 'text-white/75' : 'text-[var(--text-muted)]'}`}>
                                    {retalhosCount} itens
                                </span>
                            </span>
                        </button>
                    </div>

                    <div className="mt-4 hidden items-center gap-3 sm:flex">
                        <label className="relative flex-1">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                <SearchIcon />
                            </span>
                            <input
                                type="text"
                                placeholder={`Buscar ${activeTab === 'bobinas' ? 'bobina' : 'retalho'} por ID, filme ou localizacao...`}
                                value={searchTerm}
                                onChange={(event) => onSearchChange(event.target.value)}
                                className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-10 pr-4 text-[14px] text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
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
