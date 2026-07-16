import type { Film, FilmPriceOverride, FilmPriceOverrides } from '../../types';

export type FilmPriceField = keyof FilmPriceOverride;

export interface ResolvedFilmPrices {
    preco: number;
    maoDeObra: number;
    precoMetroLinear: number;
    precoVendaMetroLinear: number;
}

export const parseFilmPrice = (value: unknown, fallback = 0): number => {
    if (value === '' || value === null || value === undefined) return Math.max(0, fallback);
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : Math.max(0, fallback);
};

export const getCatalogFilmPrices = (film?: Film): ResolvedFilmPrices => ({
    preco: Math.max(0, film?.preco || 0),
    maoDeObra: Math.max(0, film?.maoDeObra || 0),
    precoMetroLinear: Math.max(0, film?.precoMetroLinear || 0),
    precoVendaMetroLinear: Math.max(0, film?.precoVendaMetroLinear || 0),
});

export const resolveFilmPrices = (
    film: Film | undefined,
    overrides: FilmPriceOverrides | undefined,
    filmName: string,
): ResolvedFilmPrices => {
    const catalog = getCatalogFilmPrices(film);
    const custom = overrides?.[filmName];

    return {
        preco: parseFilmPrice(custom?.preco, catalog.preco),
        maoDeObra: parseFilmPrice(custom?.maoDeObra, catalog.maoDeObra),
        precoMetroLinear: parseFilmPrice(custom?.precoMetroLinear, catalog.precoMetroLinear),
        precoVendaMetroLinear: parseFilmPrice(custom?.precoVendaMetroLinear, catalog.precoVendaMetroLinear),
    };
};

export const hasFilmPriceOverride = (
    overrides: FilmPriceOverrides | undefined,
    filmName: string,
    field?: FilmPriceField,
): boolean => {
    const custom = overrides?.[filmName];
    if (!custom) return false;
    if (field) return Object.prototype.hasOwnProperty.call(custom, field);
    return Object.keys(custom).length > 0;
};

export const updateFilmPriceOverrides = (
    overrides: FilmPriceOverrides | undefined,
    filmName: string,
    field: FilmPriceField,
    value: string | number | undefined,
): FilmPriceOverrides | undefined => {
    const next = { ...(overrides || {}) };
    const filmOverride = { ...(next[filmName] || {}) };

    if (value === undefined || value === '') {
        delete filmOverride[field];
    } else {
        filmOverride[field] = value;
    }

    if (Object.keys(filmOverride).length > 0) next[filmName] = filmOverride;
    else delete next[filmName];

    return Object.keys(next).length > 0 ? next : undefined;
};

export const resetFilmPriceOverrides = (
    overrides: FilmPriceOverrides | undefined,
    filmName: string,
): FilmPriceOverrides | undefined => {
    if (!overrides?.[filmName]) return overrides;
    const next = { ...overrides };
    delete next[filmName];
    return Object.keys(next).length > 0 ? next : undefined;
};
