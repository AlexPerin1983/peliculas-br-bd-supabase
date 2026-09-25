import { describe, expect, it } from 'vitest';
import type { Film } from '../../types';
import {
    applyFilmWarrantyOverrides,
    hasFilmWarrantyOverride,
    resolveFilmWarranty,
    updateFilmWarrantyOverrides,
} from './filmWarrantyOverrides';

const reflecta = {
    nome: 'Reflecta Clear',
    preco: 150,
    garantiaFabricante: 5,
    garantiaMaoDeObra: 90,
    garantiaMaoDeObraUnidade: 'dias',
} as Film;

describe('garantia da película nesta proposta', () => {
    it('usa o catálogo quando a proposta não personaliza', () => {
        expect(resolveFilmWarranty(reflecta, undefined, 'Reflecta Clear')).toEqual({
            garantiaFabricante: 5,
            garantiaMaoDeObra: 90,
            garantiaMaoDeObraUnidade: 'dias',
        });
    });

    it('troca só o que foi personalizado e assume "dias" sem unidade', () => {
        expect(resolveFilmWarranty(reflecta, { 'Reflecta Clear': { garantiaFabricante: 10 } }, 'Reflecta Clear')).toEqual({
            garantiaFabricante: 10,
            garantiaMaoDeObra: 90,
            garantiaMaoDeObraUnidade: 'dias',
        });
        expect(resolveFilmWarranty(
            { garantiaMaoDeObra: 1, garantiaMaoDeObraUnidade: 'anos' },
            { X: { garantiaMaoDeObra: 180 } },
            'X',
        ).garantiaMaoDeObraUnidade).toBe('dias');
    });

    it('aplica em uma cópia sem alterar o catálogo', () => {
        const films = [reflecta, { nome: 'Outra', preco: 80 } as Film];
        const applied = applyFilmWarrantyOverrides(films, {
            'Reflecta Clear': { garantiaFabricante: 10, garantiaMaoDeObra: 2, garantiaMaoDeObraUnidade: 'anos' },
        });
        expect(applied[0]).toMatchObject({ nome: 'Reflecta Clear', preco: 150, garantiaFabricante: 10, garantiaMaoDeObra: 2, garantiaMaoDeObraUnidade: 'anos' });
        expect(applied[1]).toBe(films[1]);
        expect(reflecta.garantiaFabricante).toBe(5);
        expect(applyFilmWarrantyOverrides(films, undefined)).toBe(films);
    });

    it('limpa campos vazios e remove a película quando volta ao catálogo', () => {
        let overrides = updateFilmWarrantyOverrides(undefined, 'Reflecta Clear', { garantiaFabricante: 10 });
        expect(overrides).toEqual({ 'Reflecta Clear': { garantiaFabricante: 10 } });
        expect(hasFilmWarrantyOverride(overrides, 'Reflecta Clear')).toBe(true);

        overrides = updateFilmWarrantyOverrides(overrides, 'Reflecta Clear', { garantiaMaoDeObra: 2, garantiaMaoDeObraUnidade: 'anos' });
        expect(overrides).toEqual({ 'Reflecta Clear': { garantiaFabricante: 10, garantiaMaoDeObra: 2, garantiaMaoDeObraUnidade: 'anos' } });

        overrides = updateFilmWarrantyOverrides(overrides, 'Reflecta Clear', { garantiaMaoDeObra: undefined });
        expect(overrides).toEqual({ 'Reflecta Clear': { garantiaFabricante: 10 } });

        overrides = updateFilmWarrantyOverrides(overrides, 'Reflecta Clear', { garantiaFabricante: undefined });
        expect(overrides).toBeUndefined();
        expect(hasFilmWarrantyOverride(overrides, 'Reflecta Clear')).toBe(false);

        expect(updateFilmWarrantyOverrides({ A: { garantiaFabricante: 3 }, B: { garantiaFabricante: 4 } }, 'A', undefined))
            .toEqual({ B: { garantiaFabricante: 4 } });
    });
});
