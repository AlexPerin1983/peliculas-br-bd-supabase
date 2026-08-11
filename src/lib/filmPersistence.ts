import type { Film } from '../../types';

const POSTGRES_INTEGER_MAX = 2_147_483_647;

const nonNegativeNumber = (value: unknown, fallback = 0): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const percentage = (value: unknown): number => Math.min(100, nonNegativeNumber(value));

const integer = (value: unknown, fallback = 0): number => Math.min(
    POSTGRES_INTEGER_MAX,
    Math.trunc(nonNegativeNumber(value, fallback))
);

/**
 * Normaliza dados vindos de formulários, IA e filas offline antigas antes de
 * persistir. Isso permite recuperar automaticamente itens que ficaram presos
 * por NaN, Infinity, percentuais fora da faixa ou inteiros grandes demais.
 */
export const normalizeFilmForPersistence = (film: Film): Film => ({
    ...film,
    nome: String(film.nome || '').trim(),
    preco: nonNegativeNumber(film.preco),
    precoMetroLinear: nonNegativeNumber(film.precoMetroLinear),
    precoVendaMetroLinear: nonNegativeNumber(film.precoVendaMetroLinear),
    maoDeObra: nonNegativeNumber(film.maoDeObra),
    garantiaFabricante: integer(film.garantiaFabricante),
    garantiaMaoDeObra: integer(film.garantiaMaoDeObra, 30),
    garantiaMaoDeObraUnidade: film.garantiaMaoDeObraUnidade || 'dias',
    uv: percentage(film.uv),
    ir: percentage(film.ir),
    vtl: percentage(film.vtl),
    espessura: nonNegativeNumber(film.espessura),
    tser: percentage(film.tser),
    imagens: Array.isArray(film.imagens) ? film.imagens.filter(image => typeof image === 'string') : [],
    customFields: film.customFields && typeof film.customFields === 'object' ? film.customFields : {},
});

export const validateFilmForPersistence = (film: Film): string | null => {
    if (!String(film.nome || '').trim()) return 'Informe o nome da película.';

    const monetaryFields: Array<[string, unknown]> = [
        ['Preço de venda', film.preco],
        ['Custo por metro linear', film.precoMetroLinear],
        ['Preço por metro linear', film.precoVendaMetroLinear],
        ['Mão de obra', film.maoDeObra],
        ['Espessura', film.espessura],
    ];
    const invalid = monetaryFields.find(([, value]) => {
        const parsed = typeof value === 'number' ? value : Number(value);
        return !Number.isFinite(parsed) || parsed < 0;
    });

    return invalid ? `${invalid[0]} precisa ser um número válido.` : null;
};
