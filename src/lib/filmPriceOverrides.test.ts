import { Film } from '../../types';
import {
    hasFilmPriceOverride,
    resetFilmPriceOverrides,
    resolveFilmPrices,
    updateFilmPriceOverrides,
} from './filmPriceOverrides';

describe('filmPriceOverrides', () => {
    const film: Film = {
        nome: 'Jateada',
        preco: 100,
        maoDeObra: 35,
        precoMetroLinear: 25,
        precoVendaMetroLinear: 80,
    };

    it('usa o catálogo como padrão e aceita zero como preço personalizado', () => {
        expect(resolveFilmPrices(film, undefined, film.nome)).toEqual({
            preco: 100,
            maoDeObra: 35,
            precoMetroLinear: 25,
            precoVendaMetroLinear: 80,
        });

        expect(resolveFilmPrices(film, { Jateada: { preco: '0' } }, film.nome).preco).toBe(0);
    });

    it('edita e restaura somente a proposta sem alterar a película', () => {
        const overrides = updateFilmPriceOverrides(undefined, film.nome, 'preco', '85');

        expect(resolveFilmPrices(film, overrides, film.nome).preco).toBe(85);
        expect(hasFilmPriceOverride(overrides, film.nome, 'preco')).toBe(true);
        expect(film.preco).toBe(100);
        expect(resetFilmPriceOverrides(overrides, film.nome)).toBeUndefined();
    });
});
