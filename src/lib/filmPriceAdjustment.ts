import type { Film } from '../../types';

/** Grupos de preço que o reajuste em lote pode alterar. */
export type FilmPriceField = 'venda' | 'maoDeObra' | 'custo';

export const FILM_PRICE_FIELD_LABELS: Record<FilmPriceField, string> = {
    venda: 'Preço de venda',
    maoDeObra: 'Mão de obra',
    custo: 'Custo (metro linear)',
};

// "venda" inclui o preço linear legado, que também é preço de venda.
const FIELD_KEYS: Record<FilmPriceField, Array<'preco' | 'precoVendaMetroLinear' | 'maoDeObra' | 'precoMetroLinear'>> = {
    venda: ['preco', 'precoVendaMetroLinear'],
    maoDeObra: ['maoDeObra'],
    custo: ['precoMetroLinear'],
};

export const MIN_ADJUSTMENT_PERCENT = -90;
export const MAX_ADJUSTMENT_PERCENT = 300;

export interface FilmPriceAdjustment {
    /** Positivo aumenta, negativo reduz (ex.: 10 = +10%). */
    percent: number;
    fields: FilmPriceField[];
    roundToWholeReais: boolean;
}

export interface FilmPriceChange {
    field: FilmPriceField;
    before: number;
    after: number;
}

export const isValidAdjustmentPercent = (percent: number) =>
    Number.isFinite(percent)
    && percent !== 0
    && percent >= MIN_ADJUSTMENT_PERCENT
    && percent <= MAX_ADJUSTMENT_PERCENT;

export const adjustPrice = (value: number, percent: number, roundToWholeReais: boolean): number => {
    const adjusted = value * (1 + percent / 100);
    return roundToWholeReais ? Math.round(adjusted) : Math.round(adjusted * 100) / 100;
};

/**
 * Película com os preços escolhidos reajustados. Campos zerados (não usados
 * pela película) continuam zerados.
 */
export const applyFilmPriceAdjustment = (film: Film, adjustment: FilmPriceAdjustment): Film => {
    const updated: Film = { ...film };
    for (const field of adjustment.fields) {
        for (const key of FIELD_KEYS[field]) {
            const current = Number(film[key]) || 0;
            if (current > 0) updated[key] = adjustPrice(current, adjustment.percent, adjustment.roundToWholeReais);
        }
    }
    return updated;
};

/** O que muda na película, por grupo (para a prévia). Vazio quando nada muda. */
export const getFilmPriceChanges = (film: Film, adjustment: FilmPriceAdjustment): FilmPriceChange[] => {
    if (!isValidAdjustmentPercent(adjustment.percent)) return [];

    return adjustment.fields.flatMap((field) => {
        // A prévia mostra o principal de cada grupo; o linear legado só quando é o único preço de venda.
        const key = field === 'venda' && !(Number(film.preco) > 0) ? 'precoVendaMetroLinear' : FIELD_KEYS[field][0];
        const before = Number(film[key]) || 0;
        if (before <= 0) return [];
        const after = adjustPrice(before, adjustment.percent, adjustment.roundToWholeReais);
        return after === before ? [] : [{ field, before, after }];
    });
};
