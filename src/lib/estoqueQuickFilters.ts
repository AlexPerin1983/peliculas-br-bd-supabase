import type { Bobina, Retalho } from '../../types';

// Filtros rápidos do estoque (chips do celular): além do status, o que pede ação —
// bobina acabando (hora de repor) e retalho disponível sem localização (difícil de achar).

export type EstoqueTab = 'bobinas' | 'retalhos';

// Bobina "acabando": ativa e com 20% ou menos do comprimento.
export const LOW_STOCK_RATIO = 0.2;

export const bobinaRemainingRatio = (bobina: Pick<Bobina, 'comprimentoRestanteM' | 'comprimentoTotalM'>) =>
    bobina.comprimentoTotalM > 0 ? Math.max(0, Math.min(1, bobina.comprimentoRestanteM / bobina.comprimentoTotalM)) : 0;

export const isBobinaLow = (bobina: Bobina) =>
    bobina.status === 'ativa' && bobina.comprimentoTotalM > 0 && bobinaRemainingRatio(bobina) <= LOW_STOCK_RATIO;

export const isRetalhoWithoutPlace = (retalho: Retalho) => retalho.status === 'disponivel' && !retalho.localizacao?.trim();

export const matchesBobinaFilter = (bobina: Bobina, filter: string) =>
    filter === 'todos' || (filter === 'acabando' ? isBobinaLow(bobina) : bobina.status === filter);

export const matchesRetalhoFilter = (retalho: Retalho, filter: string) =>
    filter === 'todos' || (filter === 'sem_local' ? isRetalhoWithoutPlace(retalho) : retalho.status === filter);

export interface EstoqueQuickFilter {
    value: string;
    label: string;
    count: number;
    // Pede atenção (aparece em âmbar quando tem itens).
    warn?: boolean;
}

const OPTIONS: Record<EstoqueTab, Array<Omit<EstoqueQuickFilter, 'count'>>> = {
    bobinas: [
        { value: 'todos', label: 'Todas' },
        { value: 'ativa', label: 'Ativas' },
        { value: 'acabando', label: 'Acabando', warn: true },
        { value: 'finalizada', label: 'Finalizadas' },
        { value: 'descartada', label: 'Descartadas' },
    ],
    retalhos: [
        { value: 'todos', label: 'Todos' },
        { value: 'disponivel', label: 'Disponíveis' },
        { value: 'sem_local', label: 'Sem local', warn: true },
        { value: 'reservado', label: 'Reservados' },
        { value: 'usado', label: 'Usados' },
        { value: 'descartado', label: 'Descartados' },
    ],
};

/** Chips com a quantidade de cada filtro (os vazios somem, menos "Todos" e o que estiver ativo). */
export const getEstoqueQuickFilters = (tab: EstoqueTab, bobinas: Bobina[], retalhos: Retalho[], active = 'todos'): EstoqueQuickFilter[] =>
    OPTIONS[tab]
        .map(option => ({
            ...option,
            count: tab === 'bobinas'
                ? bobinas.filter(item => matchesBobinaFilter(item, option.value)).length
                : retalhos.filter(item => matchesRetalhoFilter(item, option.value)).length,
        }))
        .filter(option => option.value === 'todos' || option.value === active || option.count > 0);
