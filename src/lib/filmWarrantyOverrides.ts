import type { Film, FilmWarrantyOverride, FilmWarrantyOverrides, WarrantyUnit } from '../../types';

// Garantia da película só nesta proposta. Vazio = usa a garantia do catálogo.
// Fica separada dos preços para que "Restaurar preços" não apague a garantia.

export interface ResolvedFilmWarranty {
    garantiaFabricante?: number;
    garantiaMaoDeObra?: number;
    garantiaMaoDeObraUnidade?: WarrantyUnit;
}

const isPositive = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

export const resolveFilmWarranty = (
    film: Pick<Film, 'garantiaFabricante' | 'garantiaMaoDeObra' | 'garantiaMaoDeObraUnidade'> | undefined,
    overrides: FilmWarrantyOverrides | undefined,
    filmName: string,
): ResolvedFilmWarranty => {
    const custom = overrides?.[filmName];
    const customLabor = isPositive(custom?.garantiaMaoDeObra);

    return {
        garantiaFabricante: isPositive(custom?.garantiaFabricante) ? custom!.garantiaFabricante : film?.garantiaFabricante,
        garantiaMaoDeObra: customLabor ? custom!.garantiaMaoDeObra : film?.garantiaMaoDeObra,
        garantiaMaoDeObraUnidade: customLabor
            ? (custom!.garantiaMaoDeObraUnidade || 'dias')
            : film?.garantiaMaoDeObraUnidade,
    };
};

// Cópia das películas com a garantia desta proposta aplicada (o catálogo não muda).
export const applyFilmWarrantyOverrides = <T extends Film>(films: T[], overrides: FilmWarrantyOverrides | undefined): T[] => {
    if (!overrides || Object.keys(overrides).length === 0) return films;
    return films.map(film => (overrides[film.nome] ? { ...film, ...resolveFilmWarranty(film, overrides, film.nome) } : film));
};

export const hasFilmWarrantyOverride = (overrides: FilmWarrantyOverrides | undefined, filmName: string): boolean =>
    Boolean(overrides?.[filmName] && Object.keys(overrides[filmName]).length > 0);

export const updateFilmWarrantyOverrides = (
    overrides: FilmWarrantyOverrides | undefined,
    filmName: string,
    patch: Partial<FilmWarrantyOverride> | undefined,
): FilmWarrantyOverrides | undefined => {
    const next = { ...(overrides || {}) };

    if (patch === undefined) {
        delete next[filmName];
    } else {
        const merged: FilmWarrantyOverride = { ...(next[filmName] || {}), ...patch };
        (Object.keys(merged) as (keyof FilmWarrantyOverride)[]).forEach(key => {
            if (merged[key] === undefined) delete merged[key];
        });
        if (merged.garantiaMaoDeObra === undefined) delete merged.garantiaMaoDeObraUnidade;

        if (Object.keys(merged).length > 0) next[filmName] = merged;
        else delete next[filmName];
    }

    return Object.keys(next).length > 0 ? next : undefined;
};
