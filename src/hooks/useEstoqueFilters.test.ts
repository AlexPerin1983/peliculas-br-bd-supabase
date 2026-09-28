import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Bobina, Retalho } from '../../types';
import { useEstoqueFilters } from './useEstoqueFilters';

const retalho = (id: number, status: Retalho['status'], larguraCm = 100, comprimentoCm = 100, localizacao = 'Estante'): Retalho =>
    ({ id, filmId: 'Fumê', codigoQr: `r${id}`, larguraCm, comprimentoCm, status, localizacao });
const bobina = (id: number, restante: number, status: Bobina['status'] = 'ativa'): Bobina =>
    ({ id, filmId: 'Fumê', codigoQr: `b${id}`, larguraCm: 152, comprimentoTotalM: 30, comprimentoRestanteM: restante, status });

describe('useEstoqueFilters', () => {
    it('busca por medida: só os retalhos disponíveis (a não ser que o filtro peça outro status)', () => {
        const retalhos = [retalho(1, 'disponivel'), retalho(2, 'usado'), retalho(3, 'descartado'), retalho(4, 'reservado'), retalho(5, 'disponivel', 50, 50)];
        const { result } = renderHook(() => useEstoqueFilters([], retalhos));

        act(() => {
            result.current.setMedidaLarguraCm('80');
            result.current.setMedidaComprimentoCm('80');
        });
        expect(result.current.filteredRetalhos.map(item => item.id)).toEqual([1]);

        act(() => result.current.setStatusFilter('reservado'));
        expect(result.current.filteredRetalhos.map(item => item.id)).toEqual([4]);
    });

    it('filtros rápidos: bobinas acabando e retalhos sem local', () => {
        const { result } = renderHook(() => useEstoqueFilters(
            [bobina(1, 20), bobina(2, 4), bobina(3, 1, 'finalizada')],
            [retalho(1, 'disponivel'), retalho(2, 'disponivel', 100, 100, '')],
        ));

        act(() => result.current.setStatusFilter('acabando'));
        expect(result.current.filteredBobinas.map(item => item.id)).toEqual([2]);

        act(() => result.current.setStatusFilter('sem_local'));
        expect(result.current.filteredRetalhos.map(item => item.id)).toEqual([2]);
    });
});
