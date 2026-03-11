import { Fornecedor } from '../types';

const STORAGE_KEY = 'peliculas-br-fornecedores';

export function getFornecedores(): Fornecedor[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveFornecedor(fornecedor: Fornecedor): Fornecedor {
    const list = getFornecedores();
    const idx = list.findIndex(f => f.id === fornecedor.id);
    if (idx >= 0) {
        list[idx] = fornecedor;
    } else {
        list.unshift(fornecedor);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return fornecedor;
}

export function deleteFornecedor(id: string): void {
    const list = getFornecedores().filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function createFornecedor(data: Omit<Fornecedor, 'id' | 'criadoEm'>): Fornecedor {
    return {
        ...data,
        id: `forn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        criadoEm: new Date().toISOString(),
    };
}
