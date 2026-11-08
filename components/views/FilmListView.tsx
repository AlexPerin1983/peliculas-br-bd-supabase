import React, { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Film } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import { ChevronDown, ChevronRight, Copy, FileUp, Pencil, Percent, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import ViewModeToggle from '../ui/ViewModeToggle';
import { matchesSearch, normalizeSearchText } from '../../src/lib/textSearch';
import { formatGarantiaMaoDeObra } from '../../src/lib/filmWarranty';
import { getVisibleCustomFields, sortFilmsForDisplay } from '../../src/lib/filmCatalog';

const FilmPriceAdjustmentModal = lazy(() => import('../modals/FilmPriceAdjustmentModal'));

interface FilmListViewProps {
    films: Film[];
    onAdd: () => void;
    onEdit: (film: Film) => void;
    onDuplicate: (film: Film) => void;
    onTogglePin: (filmName: string) => void;
    /** Salva várias películas de uma vez (reajuste de preços em lote). */
    onSaveFilms: (films: Film[]) => Promise<void>;
    /** Abre a leitura da tabela do fornecedor com IA. */
    onImportTable: () => void;
    onDelete: (filmName: string) => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
}

interface FilmItemActionHandlers {
    onEdit: (film: Film) => void;
    onDuplicate: (film: Film) => void;
    onTogglePin: (filmName: string) => void;
    onDelete: (filmName: string) => void;
}

type FilmViewMode = 'grid' | 'list';

const FILM_VIEW_MODE_STORAGE_KEY = 'peliculas-view-mode';

const TOOLBAR_BUTTON = 'inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]';

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const warrantyText = (film: Film) => [
    film.garantiaFabricante ? `${film.garantiaFabricante} ${film.garantiaFabricante === 1 ? 'ano' : 'anos'} de fábrica` : null,
    film.garantiaMaoDeObra ? `${formatGarantiaMaoDeObra(film.garantiaMaoDeObra, film.garantiaMaoDeObraUnidade)} de mão de obra` : null,
].filter(Boolean).join(' · ');

const FILM_METRICS: Array<{ key: 'vtl' | 'uv' | 'ir' | 'tser'; label: string; title: string }> = [
    { key: 'vtl', label: 'VTL', title: 'Luz visível que passa' },
    { key: 'uv', label: 'UV', title: 'Raios UV bloqueados' },
    { key: 'ir', label: 'IR', title: 'Infravermelho (calor) bloqueado' },
    { key: 'tser', label: 'TSER', title: 'Energia solar total rejeitada' },
];

const filmMetrics = (film: Film) =>
    FILM_METRICS
        .map((metric) => ({ ...metric, value: film[metric.key] }))
        .filter((metric): metric is typeof metric & { value: number } => typeof metric.value === 'number' && metric.value > 0);

/**
 * Amostra da película: um pedaço de vidro com o céu atrás, escurecido pela
 * luz visível que passa (VTL). 70% fica clarinho, 5% fica quase preto.
 */
const FilmSwatch: React.FC<{ vtl?: number; size?: 'md' | 'sm' }> = ({ vtl, size = 'md' }) => {
    const known = typeof vtl === 'number' && vtl > 0;
    const shade = known ? Math.min(0.9, Math.max(0.04, 1 - vtl / 100)) : 0;
    const dimensions = size === 'md' ? 'h-12 w-10' : 'h-10 w-8';
    return (
        <span
            className={`relative shrink-0 overflow-hidden rounded-[6px] border border-black/10 bg-gradient-to-b from-sky-200 to-sky-50 dark:border-white/10 ${dimensions}`}
            title={known ? `Passa ${vtl}% da luz` : 'Sem VTL cadastrado'}
            aria-hidden="true"
        >
            <span className="absolute inset-0" style={{ backgroundColor: `rgba(15, 23, 42, ${shade})` }} />
            <span className="absolute -top-2 left-1.5 h-[140%] w-1.5 rotate-[18deg] bg-white/35" />
            {!known ? <span className="absolute inset-1 rounded-[3px] border border-dashed border-slate-400/60" /> : null}
        </span>
    );
};

const FilmItemActions: React.FC<FilmItemActionHandlers & {
    film: Film;
    size: 'card' | 'row';
}> = ({ film, onEdit, onDuplicate, onTogglePin, onDelete, size }) => {
    const iconButton = `inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] transition-colors ${size === 'card' ? 'h-9 w-9' : 'h-8 w-8'}`;
    const run = (event: React.MouseEvent, action: () => void) => {
        event.stopPropagation();
        action();
    };

    return (
        <div className="flex items-center gap-1">
            <button
                type="button"
                onClick={(event) => run(event, () => onEdit(film))}
                className={`inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] ${size === 'card' ? 'mr-1 h-9' : 'mr-1 h-8'}`}
                title="Editar"
            >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-xs font-medium">Editar</span>
            </button>
            <button
                type="button"
                onClick={(event) => run(event, () => onTogglePin(film.nome))}
                aria-pressed={!!film.pinned}
                aria-label={film.pinned ? `Desafixar ${film.nome}` : `Fixar ${film.nome} no topo`}
                title={film.pinned ? 'Desafixar' : 'Fixar no topo'}
                className={`${iconButton} ${film.pinned ? 'text-[var(--brand-primary)] hover:bg-[var(--surface-muted)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
            >
                <Pin className="h-4 w-4" fill={film.pinned ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={(event) => run(event, () => onDuplicate(film))}
                aria-label={`Duplicar ${film.nome}`}
                title="Duplicar"
                className={`${iconButton} text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]`}
            >
                <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={(event) => run(event, () => onDelete(film.nome))}
                aria-label={`Excluir ${film.nome}`}
                title="Excluir"
                className={`${iconButton} text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400`}
            >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
};

const FilmCustomFieldsGrid: React.FC<{ film: Film; valueClassName: string }> = ({ film, valueClassName }) => (
    <>
        {getVisibleCustomFields(film).map(([key, value]) => (
            <div key={key}>
                <span className="text-xs text-[var(--text-muted)]">
                    {key}
                </span>
                <p className={`mt-0.5 ${valueClassName}`}>
                    {value}
                </p>
            </div>
        ))}
    </>
);

/** Números técnicos com uma barra fina de 0 a 100%. */
const FilmMetricsStrip: React.FC<{ film: Film }> = ({ film }) => {
    const metrics = filmMetrics(film);
    if (metrics.length === 0) return null;
    return (
        <dl className="grid gap-3 rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-3 py-2.5" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
            {metrics.map((metric) => (
                <div key={metric.key} title={metric.title}>
                    <dt className="text-[11px] text-[var(--text-muted)]">{metric.label}</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums text-[var(--text-strong)]">{metric.value}%</dd>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                        <div className="h-full rounded-full bg-[var(--text-muted)]" style={{ width: `${Math.min(metric.value, 100)}%` }} />
                    </div>
                </div>
            ))}
        </dl>
    );
};

const FilmImages: React.FC<{ film: Film; onOpenGallery: (images: string[], initialIndex: number) => void }> = ({ film, onOpenGallery }) => {
    if (!film.imagens?.length) return null;
    return (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {film.imagens.map((image, imageIndex) => (
                <button
                    key={`${film.nome}-${imageIndex}`}
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpenGallery(film.imagens!, imageIndex);
                    }}
                    className="h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-subtle)] transition-colors hover:border-[var(--border-strong)]"
                    aria-label={`Abrir imagem ${imageIndex + 1} de ${film.nome}`}
                >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
            ))}
        </div>
    );
};

const FilmCard: React.FC<FilmItemActionHandlers & {
    film: Film;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
    index: number;
}> = ({ film, onEdit, onDuplicate, onTogglePin, onDelete, isExpanded, onToggleExpand, onOpenGallery }) => {
    const hasDetails = Boolean(film.espessura) || getVisibleCustomFields(film).length > 0;
    const warranty = warrantyText(film);

    return (
        <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)] transition-colors hover:border-[var(--border-strong)]">
            <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                    <FilmSwatch vtl={film.vtl} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <h3 className="truncate text-base font-semibold leading-tight text-[var(--text-strong)]">
                                {film.nome}
                            </h3>
                            {film.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" fill="currentColor" aria-label="Fixada" /> : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{warranty || 'Sem garantia cadastrada'}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="tabular-nums">
                        <span className="text-xl font-semibold text-[var(--text-strong)]">{formatCurrency(film.preco || 0)}</span>
                        <span className="text-xs text-[var(--text-muted)]"> por m²</span>
                    </p>
                    {film.maoDeObra ? (
                        <p className="text-xs tabular-nums text-[var(--text-muted)]">+ {formatCurrency(film.maoDeObra)} de mão de obra</p>
                    ) : null}
                </div>

                <FilmMetricsStrip film={film} />
                <FilmImages film={film} onOpenGallery={onOpenGallery} />

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                    <FilmItemActions
                        film={film}
                        size="card"
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onTogglePin={onTogglePin}
                        onDelete={onDelete}
                    />

                    {hasDetails ? (
                        <button
                            type="button"
                            onClick={onToggleExpand}
                            aria-expanded={isExpanded}
                            className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] px-2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
                        >
                            <span className="text-xs font-medium">{isExpanded ? 'Menos' : 'Detalhes'}</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                    ) : null}
                </div>
            </div>

            {hasDetails ? (
                <div hidden={!isExpanded} className="grid grid-cols-2 gap-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-4 text-sm [&[hidden]]:hidden">
                    {film.espessura ? (
                        <div>
                            <span className="text-xs text-[var(--text-muted)]">Espessura</span>
                            <p className="mt-0.5 font-medium text-[var(--text-strong)]">{film.espessura} mc</p>
                        </div>
                    ) : null}
                    <FilmCustomFieldsGrid film={film} valueClassName="font-medium text-[var(--text-strong)]" />
                </div>
            ) : null}
        </article>
    );
};

// Mesmas colunas para a linha e o cabeçalho da lista no computador.
const LIST_GRID = 'sm:grid sm:grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(44px,0.45fr))_minmax(0,1.1fr)_236px] sm:items-center sm:gap-4';

const FilmListAppleRow: React.FC<FilmItemActionHandlers & {
    film: Film;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
    index: number;
}> = ({ film, onEdit, onDuplicate, onTogglePin, onDelete, isExpanded, onToggleExpand, onOpenGallery }) => {
    const warranty = warrantyText(film);
    const hasExtra = Boolean(film.imagens?.length || film.espessura || getVisibleCustomFields(film).length > 0);

    return (
        <article className="group/row">
            <div className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-muted)] sm:px-5 ${LIST_GRID}`}>
                <button
                    type="button"
                    onClick={onToggleExpand}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                    <FilmSwatch vtl={film.vtl} size="sm" />
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                            <h3 className="truncate text-sm font-medium text-[var(--text-strong)]">{film.nome}</h3>
                            {film.pinned ? <Pin className="h-3 w-3 shrink-0 text-[var(--brand-primary)]" fill="currentColor" aria-label="Fixada" /> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{warranty || 'Sem garantia cadastrada'}</span>
                        {/* Celular: preço embaixo do nome. */}
                        <span className="mt-1 block text-sm font-semibold tabular-nums text-[var(--text-strong)] sm:hidden">
                            {formatCurrency(film.preco || 0)} <span className="text-xs font-normal text-[var(--text-muted)]">/m²</span>
                        </span>
                    </span>
                    <ChevronRight className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform sm:hidden ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true" />
                </button>

                {FILM_METRICS.map((metric) => (
                    <span key={metric.key} className="hidden text-right text-sm tabular-nums text-[var(--text-body)] sm:block" title={metric.title}>
                        {film[metric.key] ? `${film[metric.key]}%` : <span className="text-[var(--text-soft)]">—</span>}
                    </span>
                ))}

                <span className="hidden text-right sm:block">
                    <span className="block text-sm font-semibold tabular-nums text-[var(--text-strong)]">{formatCurrency(film.preco || 0)}</span>
                    {film.maoDeObra ? <span className="block text-xs tabular-nums text-[var(--text-muted)]">+ {formatCurrency(film.maoDeObra)} M.O.</span> : null}
                </span>

                <div className="hidden items-center justify-end gap-1 sm:flex">
                    <FilmItemActions
                        film={film}
                        size="row"
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onTogglePin={onTogglePin}
                        onDelete={onDelete}
                    />
                    <button
                        type="button"
                        onClick={onToggleExpand}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Fechar detalhes de ${film.nome}` : `Ver detalhes de ${film.nome}`}
                        disabled={!hasExtra}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-strong)] disabled:invisible"
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {isExpanded ? (
                <div className="space-y-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 sm:px-5">
                    <div className="sm:hidden">
                        <FilmMetricsStrip film={film} />
                    </div>
                    <FilmImages film={film} onOpenGallery={onOpenGallery} />
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        {film.maoDeObra ? (
                            <div className="sm:hidden">
                                <span className="text-xs text-[var(--text-muted)]">Mão de obra</span>
                                <p className="mt-0.5 font-medium tabular-nums text-[var(--text-strong)]">{formatCurrency(film.maoDeObra)}</p>
                            </div>
                        ) : null}
                        {film.espessura ? (
                            <div>
                                <span className="text-xs text-[var(--text-muted)]">Espessura</span>
                                <p className="mt-0.5 font-medium text-[var(--text-strong)]">{film.espessura} mc</p>
                            </div>
                        ) : null}
                        <FilmCustomFieldsGrid film={film} valueClassName="font-medium text-[var(--text-strong)]" />
                    </div>
                    <div className="border-t border-[var(--border-subtle)] pt-3 sm:hidden">
                        <FilmItemActions
                            film={film}
                            size="row"
                            onEdit={onEdit}
                            onDuplicate={onDuplicate}
                            onTogglePin={onTogglePin}
                            onDelete={onDelete}
                        />
                    </div>
                </div>
            ) : null}
        </article>
    );
};

interface FilmListMobileToolbarProps {
    totalFilms: number;
    filteredCount: number;
    searchTerm: string;
    isSearchActive: boolean;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    onActivateSearch: () => void;
    onCloseSearch: () => void;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onAdd: () => void;
}

const FilmListMobileToolbar: React.FC<FilmListMobileToolbarProps> = ({
    totalFilms,
    filteredCount,
    searchTerm,
    isSearchActive,
    searchInputRef,
    onActivateSearch,
    onCloseSearch,
    onSearchChange,
    onClearSearch,
    onAdd,
}) => {
    if (isSearchActive) {
        return (
            <section className="sm:hidden">
                <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-soft)]">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onCloseSearch}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-all hover:bg-[var(--surface)] hover:text-[var(--text-strong)]"
                            aria-label="Fechar busca"
                        >
                            <i className="fas fa-arrow-left text-[13px]" aria-hidden="true"></i>
                        </button>

                        <label className="relative flex-1">
                            <i
                                className="fas fa-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-soft)]"
                                aria-hidden="true"
                            ></i>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder="Buscar película..."
                                className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-9 pr-9 text-[13px] font-medium text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
                            />
                            {searchTerm ? (
                                <button
                                    type="button"
                                    onClick={onClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
                                    aria-label="Limpar busca"
                                >
                                    <i className="fas fa-times-circle text-[13px]" aria-hidden="true"></i>
                                </button>
                            ) : null}
                        </label>
                    </div>

                    <div className="pl-11 pt-2 text-[10px] font-medium text-[var(--text-muted)]">
                        {searchTerm.trim()
                            ? `${filteredCount} resultados em foco`
                            : totalFilms > 0
                              ? 'Busque por nome, preço ou mão de obra'
                              : 'Cadastre uma película para liberar a busca'}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="sm:hidden">
            <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-soft)]">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[1.3rem] font-semibold text-[var(--text-strong)]">
                                Películas
                            </h2>
                            <span className="inline-flex min-h-6 items-center rounded-full bg-[var(--surface-muted)] px-2 text-[9px] font-semibold text-[var(--text-muted)]">
                                {totalFilms}
                            </span>
                        </div>
                        <p className="mt-1 pr-1 text-[11px] leading-5 text-[var(--text-muted)]">
                            {totalFilms === 0
                                ? 'Cadastre seu catálogo.'
                                : `${filteredCount} itens no catálogo.`}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onActivateSearch}
                            disabled={totalFilms === 0}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] shadow-sm transition-all hover:bg-[var(--surface)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Buscar película"
                        >
                            <i className="fas fa-search text-[13px]" aria-hidden="true"></i>
                        </button>

                        <button
                            type="button"
                            onClick={onAdd}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary)] text-white shadow-[0_10px_20px_rgba(21,94,239,0.18)] transition-all hover:bg-[var(--brand-primary-strong)]"
                            aria-label="Adicionar película"
                        >
                            <i className="fas fa-plus text-[13px]" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

interface FilmListDesktopHeaderProps {
    totalFilms: number;
    filteredCount: number;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onAdd: () => void;
}

const FilmListDesktopHeader: React.FC<FilmListDesktopHeaderProps> = ({
    totalFilms,
    filteredCount,
    searchTerm,
    onAdd,
}) => (
    <header className="hidden items-end justify-between gap-3 sm:flex">
        <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight text-[var(--text-strong)]">Películas</h2>
            <p className="mt-1 text-sm tabular-nums text-[var(--text-muted)]">
                {totalFilms === 0
                    ? 'Nenhuma película no catálogo'
                    : searchTerm.trim()
                        ? `${filteredCount} de ${totalFilms} películas`
                        : `${totalFilms} ${totalFilms === 1 ? 'película' : 'películas'} no catálogo`}
            </p>
        </div>
        <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--surface-inverse)] px-3.5 text-[var(--surface)] transition-opacity hover:opacity-90"
        >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-semibold">Nova película</span>
        </button>
    </header>
);

const FilmListView: React.FC<FilmListViewProps> = ({ films, onAdd, onEdit, onDuplicate, onTogglePin, onSaveFilms, onImportTable, onDelete, onOpenGallery }) => {
    const [isPriceAdjustmentOpen, setIsPriceAdjustmentOpen] = useState(false);
    const [expandedFilmName, setExpandedFilmName] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [viewMode, setViewMode] = useState<FilmViewMode>(() => {
        if (typeof window === 'undefined') return 'grid';

        try {
            return window.localStorage.getItem(FILM_VIEW_MODE_STORAGE_KEY) === 'list' ? 'list' : 'grid';
        } catch {
            return 'grid';
        }
    });
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const deferredSearchTerm = useDeferredValue(searchTerm);

    // A ordem que vem do banco muda com edições pendentes/offline; fixa aqui.
    const sortedFilms = useMemo(() => sortFilmsForDisplay(films), [films]);

    const filteredFilms = useMemo(() => {
        if (!deferredSearchTerm.trim()) return sortedFilms;

        const lowerTerm = normalizeSearchText(deferredSearchTerm);

        return sortedFilms.filter((film) =>
            matchesSearch(film.nome, lowerTerm) ||
            (film.preco ? film.preco.toString().includes(lowerTerm) : false) ||
            (film.maoDeObra ? film.maoDeObra.toString().includes(lowerTerm) : false)
        );
    }, [deferredSearchTerm, sortedFilms]);

    const displayedFilms = useMemo(() => filteredFilms.slice(0, visibleCount), [filteredFilms, visibleCount]);

    useEffect(() => {
        if (!isSearchActive) return;

        const frame = window.requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isSearchActive]);

    useEffect(() => {
        try {
            window.localStorage.setItem(FILM_VIEW_MODE_STORAGE_KEY, viewMode);
        } catch {
            // Ignore storage failures and keep the session state in memory.
        }
    }, [viewMode]);

    const handleLoadMore = () => {
        setVisibleCount((current) => current + 10);
    };

    const handleToggleExpand = (filmName: string) => {
        setExpandedFilmName((current) => (current === filmName ? null : filmName));
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setVisibleCount(10);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setVisibleCount(10);
    };

    const handleCloseSearch = () => {
        setIsSearchActive(false);
        handleClearSearch();
    };

    return (
        <div className="space-y-5 sm:space-y-6">
            <FilmListMobileToolbar
                totalFilms={films.length}
                filteredCount={filteredFilms.length}
                searchTerm={searchTerm}
                isSearchActive={isSearchActive}
                searchInputRef={searchInputRef}
                onActivateSearch={() => setIsSearchActive(true)}
                onCloseSearch={handleCloseSearch}
                onSearchChange={handleSearchChange}
                onClearSearch={handleClearSearch}
                onAdd={onAdd}
            />

            <FilmListDesktopHeader
                totalFilms={films.length}
                filteredCount={filteredFilms.length}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                onClearSearch={handleClearSearch}
                onAdd={onAdd}
            />

            {films.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 px-1 sm:px-0">
                    <label className="relative hidden min-w-0 flex-1 sm:block sm:max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" aria-hidden="true" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => handleSearchChange(event.target.value)}
                            placeholder="Buscar por nome ou preço"
                            aria-label="Buscar película"
                            style={{ fontSize: 14 }}
                            className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] pl-10 pr-9 text-[var(--text-strong)] outline-none transition-colors placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)]"
                        />
                        {searchTerm ? (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                aria-label="Limpar busca"
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        ) : null}
                    </label>
                    <span className="text-xs tabular-nums text-[var(--text-muted)] sm:hidden">
                        {filteredFilms.length} de {films.length} películas
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsPriceAdjustmentOpen(true)}
                            className={TOOLBAR_BUTTON}
                        >
                            <Percent className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="text-xs font-medium sm:text-sm">Reajustar preços</span>
                        </button>
                        <button
                            type="button"
                            onClick={onImportTable}
                            className={TOOLBAR_BUTTON}
                        >
                            <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="text-xs font-medium sm:text-sm">Importar tabela</span>
                        </button>
                        <ViewModeToggle value={viewMode} onChange={setViewMode} />
                    </div>
                </div>
            ) : null}

            {isPriceAdjustmentOpen ? (
                <Suspense fallback={null}>
                    <FilmPriceAdjustmentModal
                        films={films}
                        onClose={() => setIsPriceAdjustmentOpen(false)}
                        onSaveFilms={onSaveFilms}
                    />
                </Suspense>
            ) : null}

            {displayedFilms.length > 0 ? (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {displayedFilms.map((film, index) => (
                                <FilmCard
                                    key={film.nome}
                                    film={film}
                                    onEdit={onEdit}
                                    onDuplicate={onDuplicate}
                                    onTogglePin={onTogglePin}
                                    onDelete={onDelete}
                                    isExpanded={expandedFilmName === film.nome}
                                    onToggleExpand={() => handleToggleExpand(film.nome)}
                                    onOpenGallery={onOpenGallery}
                                    index={index}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
                            <div className={`hidden border-b border-[var(--border-subtle)] px-5 py-2.5 text-xs text-[var(--text-muted)] ${LIST_GRID}`} aria-hidden="true">
                                <span>Película</span>
                                {FILM_METRICS.map((metric) => <span key={metric.key} className="text-right" title={metric.title}>{metric.label}</span>)}
                                <span className="text-right">Preço por m²</span>
                                <span />
                            </div>
                            <div className="divide-y divide-[var(--border-subtle)]">
                            {displayedFilms.map((film, index) => (
                                <FilmListAppleRow
                                    key={film.nome}
                                    film={film}
                                    onEdit={onEdit}
                                    onDuplicate={onDuplicate}
                                    onTogglePin={onTogglePin}
                                    onDelete={onDelete}
                                    isExpanded={expandedFilmName === film.nome}
                                    onToggleExpand={() => handleToggleExpand(film.nome)}
                                    onOpenGallery={onOpenGallery}
                                    index={index}
                                />
                            ))}
                            </div>
                        </div>
                    )}

                    {visibleCount < filteredFilms.length ? (
                        <div className="flex justify-center pt-2">
                            <ActionButton
                                onClick={handleLoadMore}
                                variant="secondary"
                                size="md"
                            >
                                Carregar mais
                            </ActionButton>
                        </div>
                    ) : null}
                </>
            ) : searchTerm.trim() ? (
                <ContentState
                    compact
                    iconClassName="fas fa-search"
                    title="Nenhuma película encontrada"
                    description="Tente buscar com outro termo."
                />
            ) : (
                <ContentState
                    iconClassName="fas fa-layer-group"
                    title="Cadastre sua primeira película"
                    description="Adicione as películas com que você trabalha ou importe a tabela do fornecedor com IA."
                    actionLabel="Adicionar película"
                    onAction={onAdd}
                    secondaryActionLabel="Importar tabela"
                    onSecondaryAction={onImportTable}
                    secondaryActionIconClassName="fas fa-file-import"
                />
            )}
        </div>
    );
};

export default FilmListView;
