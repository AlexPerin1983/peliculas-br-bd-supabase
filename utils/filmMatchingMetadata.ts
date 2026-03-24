import { Film } from '../types';

export const FILM_MATCH_BRAND_KEY = '__match_brand';
export const FILM_MATCH_ALIASES_KEY = '__match_aliases';

export const getFilmMatchingBrand = (film: Film): string =>
    (film.customFields?.[FILM_MATCH_BRAND_KEY] || '').trim();

export const getFilmMatchingAliases = (film: Film): string[] =>
    (film.customFields?.[FILM_MATCH_ALIASES_KEY] || '')
        .split(',')
        .map(alias => alias.trim())
        .filter(Boolean);

export const stripMatchingMetadataFromCustomFields = (
    customFields?: { [key: string]: string }
): { [key: string]: string } => {
    if (!customFields) return {};

    return Object.fromEntries(
        Object.entries(customFields).filter(([key]) =>
            key !== FILM_MATCH_BRAND_KEY && key !== FILM_MATCH_ALIASES_KEY
        )
    );
};

export const withMatchingMetadata = (
    customFields: { [key: string]: string },
    brand: string,
    aliases: string
): { [key: string]: string } => {
    const result = { ...customFields };
    const sanitizedBrand = brand.trim();
    const sanitizedAliases = aliases
        .split(',')
        .map(alias => alias.trim())
        .filter(Boolean)
        .join(', ');

    if (sanitizedBrand) {
        result[FILM_MATCH_BRAND_KEY] = sanitizedBrand;
    } else {
        delete result[FILM_MATCH_BRAND_KEY];
    }

    if (sanitizedAliases) {
        result[FILM_MATCH_ALIASES_KEY] = sanitizedAliases;
    } else {
        delete result[FILM_MATCH_ALIASES_KEY];
    }

    return result;
};
