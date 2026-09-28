import { useCallback, useMemo, useState } from 'react';
import { Bobina, Retalho } from '../../types';
import { normalizeSearchText } from '../lib/textSearch';
import { getRetalhosForDimensions } from '../lib/retalhoMatching';
import { parseFlexibleCentimeterInput } from '../lib/estoqueDimensions';
import { matchesBobinaFilter, matchesRetalhoFilter } from '../lib/estoqueQuickFilters';

const ESTOQUE_VIEW_MODE_STORAGE_KEY = 'estoque-view-mode';

const getInitialViewMode = (): 'grid' | 'list' => {
    if (typeof window === 'undefined') return 'list';

    const storedViewMode = window.localStorage.getItem(ESTOQUE_VIEW_MODE_STORAGE_KEY);
    if (storedViewMode === 'grid' || storedViewMode === 'list') {
        return storedViewMode;
    }

    return window.matchMedia('(min-width: 1024px)').matches ? 'grid' : 'list';
};

export function useEstoqueFilters(bobinas: Bobina[], retalhos: Retalho[]) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [viewMode, setViewModeState] = useState<'grid' | 'list'>(getInitialViewMode);
    // Busca de retalho por medida (cm) — só usado na aba de retalhos.
    const [medidaLarguraCm, setMedidaLarguraCm] = useState('');
    const [medidaComprimentoCm, setMedidaComprimentoCm] = useState('');

    const limparBuscaPorMedida = useCallback(() => {
        setMedidaLarguraCm('');
        setMedidaComprimentoCm('');
    }, []);

    const setViewMode = useCallback((mode: 'grid' | 'list') => {
        setViewModeState(mode);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem(ESTOQUE_VIEW_MODE_STORAGE_KEY, mode);
        }
    }, []);

    const filteredBobinas = useMemo(() => {
        return bobinas.filter(b => {
            const normalizedSearch = normalizeSearchText(searchTerm);
            const matchesSearch = normalizedSearch === '' ||
                b.id?.toString().includes(normalizedSearch) ||
                normalizeSearchText(b.filmId).includes(normalizedSearch) ||
                (b.localizacao && normalizeSearchText(b.localizacao).includes(normalizedSearch)) ||
                (b.lote && normalizeSearchText(b.lote).includes(normalizedSearch));

            return matchesSearch && matchesBobinaFilter(b, statusFilter);
        });
    }, [bobinas, searchTerm, statusFilter]);

    const larguraCm = parseFlexibleCentimeterInput(medidaLarguraCm);
    const comprimentoCm = parseFlexibleCentimeterInput(medidaComprimentoCm);
    const buscandoPorMedida = larguraCm > 0 && comprimentoCm > 0;

    const filteredRetalhos = useMemo(() => {
        const base = retalhos.filter(r => {
            const normalizedSearch = normalizeSearchText(searchTerm);
            const matchesSearch = normalizedSearch === '' ||
                r.id?.toString().includes(normalizedSearch) ||
                normalizeSearchText(r.filmId).includes(normalizedSearch) ||
                (r.localizacao && normalizeSearchText(r.localizacao).includes(normalizedSearch));

            return matchesSearch && matchesRetalhoFilter(r, statusFilter);
        });

        // Busca por medida: mantém só os retalhos disponíveis que cabem, do menor desperdício
        // (usado ou descartado não existe mais; outro status só se for o filtro escolhido).
        if (buscandoPorMedida) {
            const pool = statusFilter === 'todos' ? base.filter(r => r.status === 'disponivel') : base;
            return getRetalhosForDimensions(larguraCm, comprimentoCm, pool);
        }
        return base;
    }, [retalhos, searchTerm, statusFilter, buscandoPorMedida, larguraCm, comprimentoCm]);

    return {
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        viewMode,
        setViewMode,
        filteredBobinas,
        filteredRetalhos,
        medidaLarguraCm,
        setMedidaLarguraCm,
        medidaComprimentoCm,
        setMedidaComprimentoCm,
        buscandoPorMedida,
        larguraBuscaCm: larguraCm,
        comprimentoBuscaCm: comprimentoCm,
        limparBuscaPorMedida
    };
}
