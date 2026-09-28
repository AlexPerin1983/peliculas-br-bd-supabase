import { describe, expect, it } from 'vitest';
import type { Bobina, Retalho } from '../../types';
import { getEstoqueQuickFilters, isBobinaLow, isRetalhoWithoutPlace, matchesBobinaFilter, matchesRetalhoFilter } from './estoqueQuickFilters';

const bobina = (overrides: Partial<Bobina> = {}): Bobina => ({
    id: 1, filmId: 'Fumê', codigoQr: 'b1', larguraCm: 152, comprimentoTotalM: 30, comprimentoRestanteM: 20, status: 'ativa', ...overrides,
});
const retalho = (overrides: Partial<Retalho> = {}): Retalho => ({
    id: 1, filmId: 'Fumê', codigoQr: 'r1', larguraCm: 100, comprimentoCm: 80, status: 'disponivel', localizacao: 'Estante', ...overrides,
});

describe('filtros rápidos do estoque', () => {
    it('bobina acabando: ativa com 20% ou menos do comprimento', () => {
        expect(isBobinaLow(bobina({ comprimentoRestanteM: 6 }))).toBe(true);
        expect(isBobinaLow(bobina({ comprimentoRestanteM: 6.1 }))).toBe(false);
        // Finalizada não é "acabando" (já saiu de uso); sem comprimento total não dá para saber.
        expect(isBobinaLow(bobina({ comprimentoRestanteM: 1, status: 'finalizada' }))).toBe(false);
        expect(isBobinaLow(bobina({ comprimentoRestanteM: 0, comprimentoTotalM: 0 }))).toBe(false);
    });

    it('retalho sem local: só os disponíveis sem localização', () => {
        expect(isRetalhoWithoutPlace(retalho({ localizacao: '  ' }))).toBe(true);
        expect(isRetalhoWithoutPlace(retalho({ localizacao: undefined, status: 'usado' }))).toBe(false);
        expect(isRetalhoWithoutPlace(retalho())).toBe(false);
    });

    it('filtra por status ou pelos filtros de ação', () => {
        expect(matchesBobinaFilter(bobina(), 'todos')).toBe(true);
        expect(matchesBobinaFilter(bobina(), 'ativa')).toBe(true);
        expect(matchesBobinaFilter(bobina(), 'acabando')).toBe(false);
        expect(matchesRetalhoFilter(retalho({ localizacao: '' }), 'sem_local')).toBe(true);
        expect(matchesRetalhoFilter(retalho({ status: 'reservado' }), 'disponivel')).toBe(false);
    });

    it('chips com quantidade; os vazios somem, menos "Todos" e o ativo', () => {
        const retalhos = [retalho(), retalho({ id: 2, localizacao: '' }), retalho({ id: 3, status: 'usado' })];
        expect(getEstoqueQuickFilters('retalhos', [], retalhos).map(item => `${item.label} ${item.count}`))
            .toEqual(['Todos 3', 'Disponíveis 2', 'Sem local 1', 'Usados 1']);
        expect(getEstoqueQuickFilters('bobinas', [bobina()], [], 'descartada').map(item => item.value))
            .toEqual(['todos', 'ativa', 'descartada']);
    });
});
