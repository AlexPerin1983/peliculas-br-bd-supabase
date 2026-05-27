import { useCallback, useMemo, useState } from 'react';
import { Bobina, Retalho } from '../../types';

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

    const setViewMode = useCallback((mode: 'grid' | 'list') => {
        setViewModeState(mode);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem(ESTOQUE_VIEW_MODE_STORAGE_KEY, mode);
        }
    }, []);

    const filteredBobinas = useMemo(() => {
        return bobinas.filter(b => {
            const normalizedSearch = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                b.id?.toString().includes(searchTerm) ||
                b.filmId.toLowerCase().includes(normalizedSearch) ||
                (b.localizacao && b.localizacao.toLowerCase().includes(normalizedSearch)) ||
                (b.lote && b.lote.toLowerCase().includes(normalizedSearch));

            const matchesStatus = statusFilter === 'todos' || b.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [bobinas, searchTerm, statusFilter]);

    const filteredRetalhos = useMemo(() => {
        return retalhos.filter(r => {
            const normalizedSearch = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                r.id?.toString().includes(searchTerm) ||
                r.filmId.toLowerCase().includes(normalizedSearch) ||
                (r.localizacao && r.localizacao.toLowerCase().includes(normalizedSearch));

            const matchesStatus = statusFilter === 'todos' || r.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [retalhos, searchTerm, statusFilter]);

    return {
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        viewMode,
        setViewMode,
        filteredBobinas,
        filteredRetalhos
    };
}
