import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeSearchText } from './textSearch';

describe('normalizeSearchText', () => {
    it('remove acentos e coloca em minúsculas', () => {
        expect(normalizeSearchText('Laís')).toBe('lais');
        expect(normalizeSearchText('JOÃO')).toBe('joao');
        expect(normalizeSearchText('Conceição')).toBe('conceicao');
    });

    it('tira espaços nas pontas', () => {
        expect(normalizeSearchText('  Ana  ')).toBe('ana');
    });

    it('lida com valores vazios/nulos', () => {
        expect(normalizeSearchText('')).toBe('');
        expect(normalizeSearchText(null)).toBe('');
        expect(normalizeSearchText(undefined)).toBe('');
    });
});

describe('matchesSearch', () => {
    it('encontra ignorando acento no termo', () => {
        expect(matchesSearch('Laís', 'lais')).toBe(true);
        expect(matchesSearch('Laís', 'laís')).toBe(true);
        expect(matchesSearch('lais', 'Laís')).toBe(true);
    });

    it('encontra ignorando maiúsculas e busca parcial', () => {
        expect(matchesSearch('João Conceição', 'concei')).toBe(true);
        expect(matchesSearch('João Conceição', 'JOAO')).toBe(true);
    });

    it('retorna true quando o termo está vazio', () => {
        expect(matchesSearch('qualquer', '')).toBe(true);
    });

    it('retorna false quando não há correspondência', () => {
        expect(matchesSearch('Laís', 'pedro')).toBe(false);
    });
});
