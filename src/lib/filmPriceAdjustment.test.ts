import { describe, expect, it } from 'vitest';
import type { Film } from '../../types';
import {
    adjustPrice,
    applyFilmPriceAdjustment,
    getFilmPriceChanges,
    isValidAdjustmentPercent,
} from './filmPriceAdjustment';

const film = (overrides: Partial<Film>): Film => ({ nome: 'G5', preco: 100, ...overrides });

describe('reajuste de preços em lote', () => {
    it('aumenta e reduz em percentual, com centavos ou reais inteiros', () => {
        expect(adjustPrice(95, 10, false)).toBe(104.5);
        expect(adjustPrice(95, 10, true)).toBe(105);
        expect(adjustPrice(100, -15, false)).toBe(85);
        expect(adjustPrice(33.33, 7, false)).toBe(35.66);
    });

    it('aceita só percentuais entre -90% e +300%, sem zero', () => {
        expect(isValidAdjustmentPercent(10)).toBe(true);
        expect(isValidAdjustmentPercent(-90)).toBe(true);
        expect(isValidAdjustmentPercent(0)).toBe(false);
        expect(isValidAdjustmentPercent(-95)).toBe(false);
        expect(isValidAdjustmentPercent(301)).toBe(false);
        expect(isValidAdjustmentPercent(Number.NaN)).toBe(false);
    });

    it('reajusta só os grupos escolhidos e não mexe em valores zerados', () => {
        const original = film({ preco: 100, precoVendaMetroLinear: 0, maoDeObra: 20, precoMetroLinear: 40 });

        const vendaApenas = applyFilmPriceAdjustment(original, { percent: 10, fields: ['venda'], roundToWholeReais: false });
        expect(vendaApenas).toMatchObject({ preco: 110, precoVendaMetroLinear: 0, maoDeObra: 20, precoMetroLinear: 40 });

        const tudo = applyFilmPriceAdjustment(original, { percent: 10, fields: ['venda', 'maoDeObra', 'custo'], roundToWholeReais: false });
        expect(tudo).toMatchObject({ preco: 110, maoDeObra: 22, precoMetroLinear: 44 });
        expect(original.preco).toBe(100);
    });

    it('preço de venda inclui o preço linear legado', () => {
        const legado = film({ preco: 0, precoVendaMetroLinear: 150 });
        const adjustment = { percent: 10, fields: ['venda' as const], roundToWholeReais: false };

        expect(applyFilmPriceAdjustment(legado, adjustment).precoVendaMetroLinear).toBe(165);
        expect(getFilmPriceChanges(legado, adjustment)).toEqual([{ field: 'venda', before: 150, after: 165 }]);
    });

    it('a prévia lista só o que muda', () => {
        const adjustment = { percent: 10, fields: ['venda' as const, 'maoDeObra' as const], roundToWholeReais: true };

        expect(getFilmPriceChanges(film({ preco: 95, maoDeObra: 0 }), adjustment))
            .toEqual([{ field: 'venda', before: 95, after: 105 }]);
        expect(getFilmPriceChanges(film({ preco: 0, maoDeObra: 0 }), adjustment)).toEqual([]);
        // Arredondado, 2% de R$ 10 não muda nada.
        expect(getFilmPriceChanges(film({ preco: 10 }), { ...adjustment, percent: 2 })).toEqual([]);
        expect(getFilmPriceChanges(film({ preco: 10 }), { ...adjustment, percent: 0 })).toEqual([]);
    });
});
