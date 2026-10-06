import type { Film } from '../../types';

/**
 * Nomes antigos da película, guardados quando ela é renomeada. Medidas,
 * propostas e ajustes guardam o NOME da película; sem isso, renomear deixava
 * esses itens sem película (preço R$ 0).
 */
export const FILM_PREVIOUS_NAMES_KEY = '__previous_names';

/** Chaves com "__" são metadados internos (marca/aliases da IA, nomes antigos). */
export const isInternalFilmFieldKey = (key: string) => key.startsWith('__');

export const getVisibleCustomFields = (film: Film): Array<[string, string]> =>
    Object.entries(film.customFields || {}).filter(([key]) => key.trim() && !isInternalFilmFieldKey(key));

export const getFilmPreviousNames = (film: Film): string[] => {
    const raw = film.customFields?.[FILM_PREVIOUS_NAMES_KEY];
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string' && !!name) : [];
    } catch {
        return [];
    }
};

/** Procura pelo nome atual e, se não achar, pelos nomes antigos (película renomeada). */
export const findFilmByName = (films: Film[], name: string | null | undefined): Film | undefined => {
    if (!name) return undefined;

    return films.find(film => film.nome === name)
        ?? films.find(film => getFilmPreviousNames(film).includes(name));
};

/**
 * Completa o que o formulário não edita antes de salvar: mantém "fixada" e os
 * nomes antigos e, se o nome mudou, guarda o nome anterior.
 */
export const prepareFilmForSave = (film: Film, originalFilm: Film | null): Film => {
    if (!originalFilm) return film;

    const previousNames = getFilmPreviousNames(originalFilm);
    if (originalFilm.nome !== film.nome) previousNames.push(originalFilm.nome);
    const namesToKeep = previousNames
        .filter((name, index, all) => name !== film.nome && all.indexOf(name) === index);

    const customFields = { ...(film.customFields || {}) };
    if (namesToKeep.length > 0) {
        customFields[FILM_PREVIOUS_NAMES_KEY] = JSON.stringify(namesToKeep);
    } else {
        delete customFields[FILM_PREVIOUS_NAMES_KEY];
    }

    return {
        ...film,
        pinned: originalFilm.pinned,
        pinnedAt: originalFilm.pinnedAt,
        customFields,
    };
};

const normalizeFilmName = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

/** Nome já usado por OUTRA película (salvar com ele sobrescreveria a outra). */
export const isFilmNameTaken = (name: string, films: Film[], currentName?: string | null): boolean => {
    const normalized = normalizeFilmName(name);
    if (!normalized) return false;
    if (currentName && normalizeFilmName(currentName) === normalized) return false;

    return films.some(film => normalizeFilmName(film.nome) === normalized);
};

export const getDuplicateFilmName = (name: string, films: Film[]): string => {
    const base = `${name.trim()} (cópia)`;
    if (!isFilmNameTaken(base, films)) return base;

    let counter = 2;
    while (isFilmNameTaken(`${name.trim()} (cópia ${counter})`, films)) counter += 1;
    return `${name.trim()} (cópia ${counter})`;
};

/** Cópia para cadastrar como película nova: sem "fixada" e sem nomes antigos. */
export const buildFilmDuplicate = (film: Film, films: Film[]): Film => {
    const customFields = { ...(film.customFields || {}) };
    delete customFields[FILM_PREVIOUS_NAMES_KEY];

    return {
        ...film,
        nome: getDuplicateFilmName(film.nome, films),
        imagens: [...(film.imagens || [])],
        pinned: false,
        pinnedAt: undefined,
        customFields,
    };
};

/** Fixadas primeiro (a fixada mais recente no topo), depois em ordem alfabética. */
export const sortFilmsForDisplay = (films: Film[]): Film[] =>
    [...films].sort((left, right) => {
        if (!!left.pinned !== !!right.pinned) return left.pinned ? -1 : 1;
        if (left.pinned && right.pinned && (left.pinnedAt || 0) !== (right.pinnedAt || 0)) {
            return (right.pinnedAt || 0) - (left.pinnedAt || 0);
        }
        return left.nome.localeCompare(right.nome, 'pt-BR', { sensitivity: 'base', numeric: true });
    });
