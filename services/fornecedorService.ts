import { Fornecedor } from '../types';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'peliculas-br-fornecedores';

export async function getFornecedores(): Promise<Fornecedor[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('fornecedores')
            .select('*')
            .order('empresa', { ascending: true });

        if (error) throw error;

        return (data || []).map(row => ({
            id: row.id,
            empresa: row.empresa,
            contato: row.contato || '',
            telefone: row.telefone || '',
            representacoes: row.representacoes || '',
            email: row.email || '',
            endereco: row.endereco || '',
            observacao: row.observacao || '',
            criadoEm: row.criado_em
        }));
    } catch (error) {
        console.error('Error fetching fornecedores:', error);
        return [];
    }
}

export async function saveFornecedor(fornecedor: Fornecedor): Promise<Fornecedor> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const dataToSave = {
        user_id: user.id,
        empresa: fornecedor.empresa,
        contato: fornecedor.contato,
        telefone: fornecedor.telefone,
        representacoes: fornecedor.representacoes,
        email: fornecedor.email,
        endereco: fornecedor.endereco,
        observacao: fornecedor.observacao,
    };

    if (fornecedor.id && !fornecedor.id.startsWith('temp-')) {
        const { data, error } = await supabase
            .from('fornecedores')
            .update(dataToSave)
            .eq('id', fornecedor.id)
            .select()
            .single();

        if (error) throw error;
        return { ...fornecedor, criadoEm: data.criado_em };
    } else {
        const { data, error } = await supabase
            .from('fornecedores')
            .insert(dataToSave)
            .select()
            .single();

        if (error) throw error;
        return {
            ...fornecedor,
            id: data.id,
            criadoEm: data.criado_em
        };
    }
}

export async function deleteFornecedor(id: string): Promise<void> {
    const { error } = await supabase
        .from('fornecedores')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export function createFornecedor(partial: Partial<Fornecedor> = {}): Fornecedor {
    return {
        id: `temp-${Date.now()}`,
        empresa: '',
        contato: '',
        telefone: '',
        criadoEm: new Date().toISOString(),
        ...partial
    };
}

/**
 * Migra dados do localStorage para o Supabase
 */
export async function migrateFromLocalStorage(): Promise<number> {
    try {
        const localData = localStorage.getItem(STORAGE_KEY);
        if (!localData) return 0;

        const fornecedores: Fornecedor[] = JSON.parse(localData);
        if (fornecedores.length === 0) return 0;

        let migratedCount = 0;
        for (const f of fornecedores) {
            try {
                // Remove ID local para gerar um UUID no banco
                const { id, ...rest } = f;
                await saveFornecedor(rest as any);
                migratedCount++;
            } catch (err) {
                console.error(`Falha ao migrar fornecedor ${f.empresa}:`, err);
            }
        }

        // Limpa localStorage após migração bem-sucedida de ao menos um item
        if (migratedCount > 0) {
            localStorage.removeItem(STORAGE_KEY);
        }

        return migratedCount;
    } catch (err) {
        console.error('Erro na migração de fornecedores:', err);
        return 0;
    }
}
