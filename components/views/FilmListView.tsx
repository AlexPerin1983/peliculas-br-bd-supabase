import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Film } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import PageCollectionToolbar from '../ui/PageCollectionToolbar';
import ViewModeToggle from '../ui/ViewModeToggle';
import { matchesSearch, normalizeSearchText } from '../../src/lib/textSearch';
import { formatGarantiaMaoDeObraCurto } from '../../src/lib/filmWarranty';
import { getVisibleCustomFields, sortFilmsForDisplay } from '../../src/lib/filmCatalog';

interface FilmListViewProps {
    films: Film[];
    onAdd: () => void;
    onEdit: (film: Film) => void;
    onDuplicate: (film: Film) => void;
    onTogglePin: (filmName: string) => void;
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

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const getFilmAccentColor = (film: Film) =>
    film.pinned ? 'bg-[var(--surface-inverse)]' : 'bg-[var(--brand-primary)]';

const getFilmAccentDotClass = (film: Film) =>
    film.pinned ? 'bg-[var(--surface-inverse)]' : 'bg-[var(--brand-primary)]';

const FilmItemActions: React.FC<FilmItemActionHandlers & {
    film: Film;
    size: 'card' | 'row';
}> = ({ film, onEdit, onDuplicate, onTogglePin, onDelete, size }) => {
    const control = size === 'card'
        ? 'h-9 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:bg-[var(--surface)] sm:h-10'
        : 'h-8 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm hover:bg-[var(--surface-muted)]';
    const iconButton = `${control} inline-flex shrink-0 items-center justify-center transition-all ${size === 'card' ? 'w-9 sm:w-10' : 'w-8'}`;
    const run = (event: React.MouseEvent, action: () => void) => {
        event.stopPropagation();
        action();
    };

    return (
        <div className="flex gap-2">
            <button
                type="button"
                onClick={(event) => run(event, () => onEdit(film))}
                className={`${control} inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-body)] transition-all hover:text-[var(--text-strong)] ${size === 'card' ? 'px-3.5 sm:px-4 sm:text-xs' : 'px-3'}`}
                title="Editar"
            >
                <i className="fas fa-pen text-[9px] sm:text-[10px]" aria-hidden="true"></i>
                Editar
            </button>
            <button
                type="button"
                onClick={(event) => run(event, () => onTogglePin(film.nome))}
                aria-pressed={!!film.pinned}
                aria-label={film.pinned ? `Desafixar ${film.nome}` : `Fixar ${film.nome} no topo`}
                title={film.pinned ? 'Desafixar' : 'Fixar no topo'}
                className={`${iconButton} ${film.pinned ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'}`}
            >
                <i className={`fas fa-thumbtack text-[10px] sm:text-[11px] ${film.pinned ? '' : 'rotate-45'}`} aria-hidden="true"></i>
            </button>
            <button
                type="button"
                onClick={(event) => run(event, () => onDuplicate(film))}
                aria-label={`Duplicar ${film.nome}`}
                title="Duplicar"
                className={`${iconButton} text-[var(--text-muted)] hover:text-[var(--text-strong)]`}
            >
                <i className="fas fa-copy text-[10px] sm:text-[11px]" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                onClick={(event) => run(event, () => onDelete(film.nome))}
                aria-label={`Excluir ${film.nome}`}
                title="Excluir"
                className={`${iconButton} text-[var(--text-muted)] hover:bg-[var(--danger)] hover:text-white`}
            >
                <i className="fas fa-trash-alt text-[10px] sm:text-[11px]" aria-hidden="true"></i>
            </button>
        </div>
    );
};

const FilmCustomFieldsGrid: React.FC<{ film: Film; valueClassName: string }> = ({ film, valueClassName }) => (
    <>
        {getVisibleCustomFields(film).map(([key, value]) => (
            <div key={key}>
                <span className="text-[8px] font-semibold uppercase text-[var(--text-soft)] sm:text-[9px]">
                    {key}
                </span>
                <p className={`mt-1 ${valueClassName}`}>
                    {value}
                </p>
            </div>
        ))}
    </>
);

const TechIndicator: React.FC<{
    label: string;
    value: number | undefined;
    color: string;
}> = ({ label, value, color }) => {
    if (value === undefined || value === 0) return null;

    const clampedValue = Math.min(value, 100);

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative flex h-11 w-11 items-center justify-center sm:h-12 sm:w-12">
                <svg className="h-full w-full -rotate-90">
                    <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="transparent"
                        className="text-[var(--border-subtle)]"
                    />
                    <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="transparent"
                        strokeDasharray={125.6}
                        strokeDashoffset={125.6 - (125.6 * clampedValue) / 100}
                        strokeLinecap="round"
                        className={color}
                    />
                </svg>
                <span className="absolute text-[9px] font-semibold text-[var(--text-strong)] sm:text-[10px]">
                    {value}%
                </span>
            </div>
            <span className="text-[9px] font-semibold uppercase text-[var(--text-soft)] sm:text-[10px]">
                {label}
            </span>
        </div>
    );
};

const FilmCard: React.FC<FilmItemActionHandlers & {
    film: Film;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
    index: number;
}> = ({ film, onEdit, onDuplicate, onTogglePin, onDelete, isExpanded, onToggleExpand, onOpenGallery, index }) => {
    const handleImageClick = (imageIndex: number, event: React.MouseEvent) => {
        event.stopPropagation();
        if (film.imagens && film.imagens.length > 0) {
            onOpenGallery(film.imagens, imageIndex);
        }
    };

    const hasTechnicalData = Boolean(film.uv || film.ir || film.vtl || film.espessura || film.tser);
    const hasImages = (film.imagens?.length || 0) > 0;
    const hasDetails = Boolean(film.espessura) || getVisibleCustomFields(film).length > 0;

    const accentColor = getFilmAccentColor(film);

    return (
        <article
            className="group animate-stagger relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:shadow-[var(--shadow-soft)]"
            style={{ animationDelay: `${index * 0.08}s` }}
        >
            <div className={`h-1 w-full ${accentColor}`} />

            <div className="p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <h3 className="truncate text-[1.25rem] font-semibold leading-tight text-[var(--text-strong)] sm:text-[1.55rem]">
                                {film.nome}
                            </h3>
                            {film.pinned ? (
                                <i
                                    className="fas fa-thumbtack rotate-45 text-[9px] text-[var(--brand-primary)] sm:text-[10px]"
                                    title="Fixado"
                                    aria-hidden="true"
                                />
                            ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                            {film.garantiaFabricante ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-1 text-[9px] font-semibold text-[var(--text-body)] sm:px-2.5 sm:text-[10px]">
                                    <i className="fas fa-shield-alt text-[7px] sm:text-[8px]" aria-hidden="true"></i>
                                    {film.garantiaFabricante} anos fabricante
                                </span>
                            ) : null}
                            {film.garantiaMaoDeObra ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-1 text-[9px] font-semibold text-[var(--text-body)] sm:px-2.5 sm:text-[10px]">
                                    <i className="fas fa-tools text-[7px] sm:text-[8px]" aria-hidden="true"></i>
                                    {formatGarantiaMaoDeObraCurto(film.garantiaMaoDeObra, film.garantiaMaoDeObraUnidade)} M.O.
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        <p className="text-[1.5rem] font-semibold leading-none text-[var(--text-strong)] sm:text-[1.85rem]">
                            {formatCurrency(film.preco || 0)}
                        </p>
                        <p className="mt-1 text-[9px] font-semibold uppercase text-[var(--text-soft)] sm:text-[10px]">
                            por m²
                        </p>
                        {film.maoDeObra ? (
                            <p className="mt-1 text-[10px] font-medium text-[var(--text-muted)] sm:text-[11px]">
                                + {formatCurrency(film.maoDeObra)} M.O.
                            </p>
                        ) : null}
                    </div>
                </div>

                {hasTechnicalData ? (
                    <div className="mb-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-3 sm:mb-5 sm:px-3 sm:py-4">
                        <div className="flex items-center justify-around gap-3">
                            <TechIndicator label="VTL" value={film.vtl} color="text-[var(--brand-primary)]" />
                            <TechIndicator label="UV" value={film.uv} color="text-[var(--brand-primary)]" />
                            <TechIndicator label="IR" value={film.ir} color="text-[var(--brand-primary)]" />
                            {film.tser ? (
                                <TechIndicator label="TSER" value={film.tser} color="text-[var(--brand-primary)]" />
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {hasImages ? (
                    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:mb-5">
                        {film.imagens!.map((image, imageIndex) => (
                            <button
                                key={`${film.nome}-${imageIndex}`}
                                type="button"
                                onClick={(event) => handleImageClick(imageIndex, event)}
                                className="h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-subtle)] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-primary)] sm:h-14 sm:w-14"
                                aria-label={`Abrir imagem ${imageIndex + 1} de ${film.nome}`}
                            >
                                <img src={image} alt="" className="h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3.5 sm:pt-4">
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
                            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)] sm:gap-2 sm:text-[11px]"
                        >
                            {isExpanded ? 'Menos' : 'Detalhes'}
                            <i
                                className={`fas fa-chevron-down text-[9px] transition-transform duration-300 sm:text-[10px] ${isExpanded ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                            ></i>
                        </button>
                    ) : null}
                </div>
            </div>

            <div
                className={`overflow-hidden border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] transition-all duration-300 ${
                    isExpanded ? 'max-h-48 px-4 py-3.5 opacity-100 sm:px-5 sm:py-4' : 'max-h-0 px-4 opacity-0 sm:px-5'
                }`}
            >
                <div className="grid grid-cols-2 gap-4 text-[13px] sm:text-sm">
                    {film.espessura ? (
                        <div>
                            <span className="text-[8px] font-semibold uppercase text-[var(--text-soft)] sm:text-[9px]">
                                Espessura
                            </span>
                            <p className="mt-1 font-semibold text-[var(--text-strong)]">
                                {film.espessura} mc
                            </p>
                        </div>
                    ) : null}

                    <FilmCustomFieldsGrid film={film} valueClassName="font-semibold text-[var(--text-strong)]" />
                </div>
            </div>
        </article>
    );
};

const FilmMetricChip: React.FC<{
    label: string;
    value: number | undefined;
    toneClassName: string;
}> = ({ label, value, toneClassName }) => {
    if (value === undefined || value === 0) return null;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${toneClassName}`}
        >
            <span className="text-[8px] leading-none">{label}</span>
            <span>{value}%</span>
        </span>
    );
};

const FilmListAppleRow: React.FC<FilmItemActionHandlers & {
    film: Film;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
    index: number;
}> = ({ film, onEdit, onDuplicate, onTogglePin, onDelete, isExpanded, onToggleExpand, onOpenGallery, index }) => {
    const firstImage = film.imagens?.[0];
    const hasImages = Boolean(firstImage);
    const hasTechnicalData = Boolean(film.vtl || film.uv || film.ir || film.tser);
    const accentDotClass = getFilmAccentDotClass(film);
    const warrantySummary = [
        film.garantiaFabricante ? `${film.garantiaFabricante} anos fabricante` : null,
        film.garantiaMaoDeObra ? `${formatGarantiaMaoDeObraCurto(film.garantiaMaoDeObra, film.garantiaMaoDeObraUnidade)} M.O.` : null,
    ]
        .filter(Boolean)
        .join(' / ');
    const technicalSummary = [
        film.vtl ? `VTL ${film.vtl}%` : null,
        film.uv ? `UV ${film.uv}%` : null,
        film.ir ? `IR ${film.ir}%` : null,
        film.tser ? `TSER ${film.tser}%` : null,
    ]
        .filter(Boolean)
        .slice(0, 3)
        .join(' / ');
    const collapsedSummary = [warrantySummary, technicalSummary].filter(Boolean).join(' / ');

    return (
        <article
            className="group animate-stagger relative bg-transparent transition-all duration-300"
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            <button
                type="button"
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)] sm:px-5 sm:py-3.5"
            >
                <div className="flex items-start gap-3">
                    {hasImages ? (
                        <div className="relative hidden h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] shadow-[var(--shadow-hairline)] sm:block sm:h-12 sm:w-12">
                            <img src={firstImage} alt="" className="h-full w-full object-cover" />
                            {(film.imagens?.length || 0) > 1 ? (
                                <span className="absolute bottom-1 right-1 rounded-full bg-slate-950/75 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                    {film.imagens!.length}
                                </span>
                            ) : null}
                        </div>
                    ) : (
                        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] shadow-[var(--shadow-hairline)] sm:flex sm:h-12 sm:w-12">
                            <i className="fas fa-layer-group text-[12px]" aria-hidden="true"></i>
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                            <span className={`mt-[0.38rem] h-2 w-2 shrink-0 rounded-full ${accentDotClass}`} />
                            <h3 className="text-[0.92rem] font-medium leading-[1.2] text-[var(--text-strong)] sm:truncate sm:text-[1.04rem]">
                                {film.nome}
                            </h3>
                            {film.pinned ? (
                                <i
                                    className="mt-[0.2rem] fas fa-thumbtack rotate-45 text-[8px] text-[var(--brand-primary)]"
                                    title="Fixado"
                                    aria-hidden="true"
                                />
                            ) : null}
                        </div>

                        <p className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">
                            <span className="sm:hidden">{warrantySummary || 'Toque para ver detalhes técnicos'}</span>
                            <span className="hidden sm:inline">{collapsedSummary || 'Toque para ver detalhes técnicos'}</span>
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-3 pr-1 sm:hidden">
                            <div className="min-w-0">
                                <p className="text-[0.98rem] font-semibold leading-none text-[var(--text-strong)]">
                                    {formatCurrency(film.preco || 0)}
                                </p>
                                {film.maoDeObra ? (
                                    <p className="mt-1 text-[10px] font-medium text-[var(--text-muted)]">
                                        + {formatCurrency(film.maoDeObra)} M.O.
                                    </p>
                                ) : null}
                            </div>
                            <p className="text-[8px] font-semibold uppercase text-[var(--text-soft)]">
                                por m²
                            </p>
                        </div>
                    </div>

                    <div className="hidden shrink-0 pl-2 text-right sm:block">
                        <p className="text-[1.02rem] font-semibold leading-none text-[var(--text-strong)] sm:text-[1.12rem]">
                            {formatCurrency(film.preco || 0)}
                        </p>
                        <p className="mt-1 text-[8px] font-semibold uppercase text-[var(--text-soft)]">
                            por m²
                        </p>
                        {film.maoDeObra ? (
                            <p className="mt-1 text-[10px] font-medium text-[var(--text-muted)]">
                                + {formatCurrency(film.maoDeObra)} M.O.
                            </p>
                        ) : null}
                    </div>

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                        <i
                            className={`fas fa-chevron-right text-[10px] transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                        ></i>
                    </div>
                </div>
            </button>

            <div
                className={`overflow-hidden transition-all duration-300 ${
                    isExpanded ? 'max-h-[360px] opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 sm:px-5">
                    <div className="space-y-3">
                        {hasTechnicalData ? (
                            <div className="flex flex-wrap gap-1.5">
                                <FilmMetricChip
                                    label="VTL"
                                    value={film.vtl}
                                    toneClassName="border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]"
                                />
                                <FilmMetricChip
                                    label="UV"
                                    value={film.uv}
                                    toneClassName="border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]"
                                />
                                <FilmMetricChip
                                    label="IR"
                                    value={film.ir}
                                    toneClassName="border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]"
                                />
                                <FilmMetricChip
                                    label="TSER"
                                    value={film.tser}
                                    toneClassName="border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]"
                                />
                            </div>
                        ) : null}

                        {hasImages ? (
                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                {film.imagens!.map((image, imageIndex) => (
                                    <button
                                        key={`${film.nome}-${imageIndex}`}
                                        type="button"
                                        onClick={() => onOpenGallery(film.imagens!, imageIndex)}
                                        className="h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] transition-all hover:border-[var(--brand-primary)]"
                                        aria-label={`Abrir imagem ${imageIndex + 1} de ${film.nome}`}
                                    >
                                        <img src={image} alt="" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-3 text-[12px] sm:text-[13px]">
                            {film.maoDeObra ? (
                                <div>
                                    <span className="text-[8px] font-semibold uppercase text-[var(--text-soft)] sm:text-[9px]">
                                        Mão de obra
                                    </span>
                                    <p className="mt-1 font-medium text-[var(--text-strong)]">
                                        {formatCurrency(film.maoDeObra)}
                                    </p>
                                </div>
                            ) : null}
                            {film.espessura ? (
                                <div>
                                    <span className="text-[8px] font-semibold uppercase text-[var(--text-soft)] sm:text-[9px]">
                                        Espessura
                                    </span>
                                    <p className="mt-1 font-medium text-[var(--text-strong)]">
                                        {film.espessura} mc
                                    </p>
                                </div>
                            ) : null}
                            <FilmCustomFieldsGrid film={film} valueClassName="font-medium text-[var(--text-strong)]" />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                            <FilmItemActions
                                film={film}
                                size="row"
                                onEdit={onEdit}
                                onDuplicate={onDuplicate}
                                onTogglePin={onTogglePin}
                                onDelete={onDelete}
                            />

                            <span className="text-[10px] font-medium text-[var(--text-soft)]">
                                {film.imagens?.length ? `${film.imagens.length} ${film.imagens.length === 1 ? 'imagem' : 'imagens'}` : 'Sem imagens'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
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
    onSearchChange,
    onClearSearch,
    onAdd,
}) => {
    const summary =
        totalFilms === 0
            ? 'Monte um catálogo premium com busca e manutenção mais claras.'
            : filteredCount !== totalFilms
              ? `${filteredCount} de ${totalFilms} películas em foco agora.`
              : `${totalFilms} películas prontas para consulta, edição e venda.`;

    return (
        <section className="hidden sm:block">
            <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
                <div className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]" aria-hidden="true" />
                <div className="mb-5 flex items-end justify-between gap-4">
                    <div className="space-y-2">
                        <span className="ui-kicker">
                            Catálogo
                        </span>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-[var(--text-strong)]">
                                Películas
                            </h2>
                            <span className="inline-flex min-h-8 items-center rounded-full bg-[var(--surface-muted)] px-3 text-xs font-bold text-[var(--text-muted)]">
                                {totalFilms}
                            </span>
                        </div>
                        <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                            {summary}
                        </p>
                    </div>

                    {totalFilms > 0 ? (
                        <div className="hidden items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] shadow-[var(--shadow-hairline)] lg:inline-flex">
                            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--brand-primary)]"></span>
                            {filteredCount} visíveis agora
                        </div>
                    ) : null}
                </div>

                <PageCollectionToolbar
                    search={searchTerm}
                    onSearchChange={onSearchChange}
                    onClearSearch={onClearSearch}
                    searchPlaceholder="Buscar película..."
                    primaryActionLabel="Nova película"
                    onPrimaryAction={onAdd}
                />
            </div>
        </section>
    );
};

const FilmListView: React.FC<FilmListViewProps> = ({ films, onAdd, onEdit, onDuplicate, onTogglePin, onDelete, onOpenGallery }) => {
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
                <div className="flex items-start justify-between gap-3 px-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] shadow-[var(--shadow-hairline)] sm:text-xs">
                            {filteredFilms.length} de {films.length} películas
                        </span>
                        {searchTerm.trim() ? (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-colors hover:text-[var(--text-strong)] sm:text-xs"
                            >
                                <i className="fas fa-times-circle text-[11px]" aria-hidden="true"></i>
                                Limpar busca
                            </button>
                        ) : null}
                    </div>

                    <ViewModeToggle value={viewMode} onChange={setViewMode} />
                </div>
            ) : null}

            {displayedFilms.length > 0 ? (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                        <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
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
                    )}

                    {visibleCount < filteredFilms.length ? (
                        <div className="flex justify-center pt-2">
                            <ActionButton
                                onClick={handleLoadMore}
                                variant="secondary"
                                size="md"
                                className="group rounded-full px-6"
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
                    description="Adicione as películas com que você trabalha."
                    actionLabel="Adicionar película"
                    onAction={onAdd}
                />
            )}
        </div>
    );
};

export default FilmListView;
