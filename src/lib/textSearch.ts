/**
 * Normaliza um texto para busca: remove acentos/diacríticos, coloca em
 * minúsculas e tira espaços nas pontas. Assim "Laís", "lais" e "LAIS"
 * passam a ser equivalentes na pesquisa.
 */
export const normalizeSearchText = (value?: string | number | null): string => {
    if (value === null || value === undefined) return '';

    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

/**
 * Indica se o texto contém o termo buscado, ignorando acentos e maiúsculas.
 */
export const matchesSearch = (text: string | number | null | undefined, term: string): boolean => {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm) return true;
    return normalizeSearchText(text).includes(normalizedTerm);
};
