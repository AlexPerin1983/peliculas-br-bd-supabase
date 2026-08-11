import { describe, expect, it } from 'vitest';
import type { Film } from '../../types';
import { normalizeFilmForPersistence, validateFilmForPersistence } from './filmPersistence';

describe('persistência segura de películas', () => {
    it('normaliza números inválidos e limita percentuais', () => {
        const film = normalizeFilmForPersistence({
            nome: '  Premium  ',
            preco: Number.NaN,
            precoMetroLinear: -20,
            precoVendaMetroLinear: Number.POSITIVE_INFINITY,
            maoDeObra: 45.5,
            garantiaFabricante: 9_999_999_999,
            garantiaMaoDeObra: 30.8,
            uv: 120,
            ir: -5,
            vtl: 35,
            espessura: Number.NaN,
            tser: 101,
        });

        expect(film).toMatchObject({
            nome: 'Premium',
            preco: 0,
            precoMetroLinear: 0,
            precoVendaMetroLinear: 0,
            maoDeObra: 45.5,
            garantiaFabricante: 2_147_483_647,
            garantiaMaoDeObra: 30,
            uv: 100,
            ir: 0,
            vtl: 35,
            espessura: 0,
            tser: 100,
        });
    });

    it('rejeita campos financeiros inválidos antes de salvar', () => {
        const film = { nome: 'Premium', preco: Number.NaN } as Film;
        expect(validateFilmForPersistence(film)).toBe('Preço de venda precisa ser um número válido.');
    });
});
