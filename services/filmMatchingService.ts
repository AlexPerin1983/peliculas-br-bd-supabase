import { Film } from '../types';
import { getFilmMatchingAliases, getFilmMatchingBrand } from '../utils/filmMatchingMetadata';

export interface FilmMatchAlternative {
    filmName: string;
    score: number;
    reason: string;
}

export interface FilmMatchResult {
    extractedFilmText: string;
    matchedFilmName: string | null;
    confidence: number;
    alternatives: FilmMatchAlternative[];
}

const normalizeText = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const collapseText = (value: string): string =>
    normalizeText(value).replace(/\s+/g, '');

const getTokens = (value: string): string[] =>
    normalizeText(value)
        .split(' ')
        .filter(token => token.length > 1);

const calculateTokenOverlap = (left: string[], right: string[]): number => {
    if (left.length === 0 || right.length === 0) return 0;

    const leftSet = new Set(left);
    const rightSet = new Set(right);
    const intersection = [...leftSet].filter(token => rightSet.has(token)).length;
    const union = new Set([...leftSet, ...rightSet]).size;

    return union === 0 ? 0 : intersection / union;
};

const scoreFilmMatch = (extractedFilmText: string, film: Film): FilmMatchAlternative => {
    const extractedNormalized = normalizeText(extractedFilmText);
    const filmNormalized = normalizeText(film.nome);
    const extractedCollapsed = collapseText(extractedFilmText);
    const filmCollapsed = collapseText(film.nome);
    const extractedTokens = getTokens(extractedFilmText);
    const filmTokens = getTokens(film.nome);
    const brand = getFilmMatchingBrand(film);
    const aliases = getFilmMatchingAliases(film);

    if (!extractedNormalized || !filmNormalized) {
        return {
            filmName: film.nome,
            score: 0,
            reason: 'empty'
        };
    }

    if (extractedNormalized === filmNormalized) {
        return {
            filmName: film.nome,
            score: 1,
            reason: 'exact_name'
        };
    }

    if (extractedCollapsed === filmCollapsed) {
        return {
            filmName: film.nome,
            score: 0.97,
            reason: 'collapsed_name'
        };
    }

    if (filmCollapsed.includes(extractedCollapsed) || extractedCollapsed.includes(filmCollapsed)) {
        return {
            filmName: film.nome,
            score: extractedTokens.length <= 1 || filmTokens.length <= 1 ? 0.72 : 0.9,
            reason: extractedTokens.length <= 1 || filmTokens.length <= 1 ? 'partial_substring_match' : 'substring_match'
        };
    }

    for (const alias of aliases) {
        const aliasNormalized = normalizeText(alias);
        const aliasCollapsed = collapseText(alias);

        if (!aliasNormalized) continue;

        if (extractedNormalized === aliasNormalized || extractedCollapsed === aliasCollapsed) {
            return {
                filmName: film.nome,
                score: 0.96,
                reason: 'exact_alias'
            };
        }

        if (aliasCollapsed.includes(extractedCollapsed) || extractedCollapsed.includes(aliasCollapsed)) {
            return {
                filmName: film.nome,
                score: 0.82,
                reason: 'alias_substring_match'
            };
        }
    }

    const tokenOverlap = calculateTokenOverlap(extractedTokens, filmTokens);
    const aliasTokenOverlap = aliases.reduce((best, alias) => {
        const overlap = calculateTokenOverlap(extractedTokens, getTokens(alias));
        return Math.max(best, overlap);
    }, 0);
    const bestOverlap = Math.max(tokenOverlap, aliasTokenOverlap);

    if (brand) {
        const normalizedBrand = normalizeText(brand);
        if (normalizedBrand && extractedNormalized.includes(normalizedBrand)) {
            return {
                filmName: film.nome,
                score: Math.max(0.7, 0.55 + bestOverlap * 0.25),
                reason: bestOverlap > 0 ? 'brand_plus_overlap' : 'brand_match'
            };
        }
    }

    if (bestOverlap > 0) {
        return {
            filmName: film.nome,
            score: Math.min(0.84, 0.45 + bestOverlap * 0.35),
            reason: aliasTokenOverlap > tokenOverlap ? 'alias_token_overlap' : 'token_overlap'
        };
    }

    return {
        filmName: film.nome,
        score: 0,
        reason: 'no_match'
    };
};

export const matchFilmFromExtractedText = (
    extractedFilmText: string | null | undefined,
    films: Film[]
): FilmMatchResult => {
    const safeText = (extractedFilmText || '').trim();

    if (!safeText || films.length === 0) {
        return {
            extractedFilmText: safeText,
            matchedFilmName: null,
            confidence: 0,
            alternatives: []
        };
    }

    const rankedMatches = films
        .map(film => scoreFilmMatch(safeText, film))
        .filter(match => match.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);

    const bestMatch = rankedMatches[0];

    return {
        extractedFilmText: safeText,
        matchedFilmName: bestMatch?.filmName || null,
        confidence: bestMatch?.score || 0,
        alternatives: rankedMatches
    };
};
