// Supabase Database Service - Estoque
// Funções para gerenciar bobinas, retalhos e consumos

import { supabase } from './supabaseClient';
import { Bobina, Retalho, Consumo } from '../types';

// Cache para o ID do usuário para evitar chamadas repetidas ao auth.getUser()
let cachedUserId: string | null = null;

// Helper para obter o user_id atual
const getCurrentUserId = async (): Promise<string | null> => {
    if (cachedUserId) return cachedUserId;

    // Tenta obter da sessão primeiro (mais rápido, sem request de rede)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
        cachedUserId = session.user.id;
        return cachedUserId;
    }

    // Fallback para getUser (request de rede)
    const { data: { user } } = await supabase.auth.getUser();
    cachedUserId = user?.id || null;
    return cachedUserId;
};

// Helper para gerar código QR único
export const generateQRCode = (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `PBR-${timestamp}-${random}`.toUpperCase();
};

// ============================================
// BOBINAS FUNCTIONS
// ============================================

export const getAllBobinas = async (): Promise<Bobina[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('bobinas')
        .select('*')
        .order('data_cadastro', { ascending: false });

    if (error) {
        console.error('Error fetching bobinas:', error);
        return [];
    }

    return (data || []).map(mapRowToBobina);
};

export const getBobinasByFilm = async (filmId: string): Promise<Bobina[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('bobinas')
        .select('*')
        .eq('film_id', filmId)
        .eq('status', 'ativa')
        .order('data_cadastro', { ascending: false });

    if (error) {
        console.error('Error fetching bobinas by film:', error);
        return [];
    }

    return (data || []).map(mapRowToBobina);
};

export const getBobinaByQR = async (codigoQr: string): Promise<Bobina | null> => {
    console.log('getBobinaByQR - Iniciando busca para:', codigoQr);
    const userId = await getCurrentUserId();
    console.log('getBobinaByQR - userId:', userId);
    if (!userId) return null;

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('bobinas')
        .select('*')
        .eq('codigo_qr', codigoQr)
        .single();

    if (error) {
        console.log('getBobinaByQR - Erro ou não encontrado:', error.message);
        return null;
    }

    console.log('getBobinaByQR - Sucesso:', data?.id);
    return data ? mapRowToBobina(data) : null;
};

export const getBobinaById = async (id: number): Promise<Bobina | null> => {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('bobinas')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) return null;
    return mapRowToBobina(data);
};

export const saveBobina = async (bobina: Omit<Bobina, 'id'> | Bobina): Promise<Bobina> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const bobinaData = {
        user_id: userId,
        film_id: bobina.filmId,
        codigo_qr: bobina.codigoQr || generateQRCode(),
        largura_cm: bobina.larguraCm,
        comprimento_total_m: bobina.comprimentoTotalM,
        comprimento_restante_m: bobina.comprimentoRestanteM,
        custo_total: bobina.custoTotal,
        fornecedor: bobina.fornecedor,
        lote: bobina.lote,
        status: bobina.status || 'ativa',
        localizacao: bobina.localizacao,
        observacao: bobina.observacao,
        data_ultima_atualizacao: new Date().toISOString()
    };

    if ('id' in bobina && bobina.id) {
        const { data, error } = await supabase
            .from('bobinas')
            .update(bobinaData)
            .eq('id', bobina.id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return mapRowToBobina(data);
    } else {
        const { data, error } = await supabase
            .from('bobinas')
            .insert(bobinaData)
            .select()
            .single();

        if (error) throw error;
        return mapRowToBobina(data);
    }
};

export const deleteBobina = async (id: number): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { error } = await supabase
        .from('bobinas')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

    if (error) throw error;
};

const mapRowToBobina = (row: any): Bobina => ({
    id: row.id,
    filmId: row.film_id,
    codigoQr: row.codigo_qr,
    larguraCm: row.largura_cm,
    comprimentoTotalM: row.comprimento_total_m,
    comprimentoRestanteM: row.comprimento_restante_m,
    custoTotal: row.custo_total,
    fornecedor: row.fornecedor,
    lote: row.lote,
    dataCadastro: row.data_cadastro,
    dataUltimaAtualizacao: row.data_ultima_atualizacao,
    status: row.status,
    localizacao: row.localizacao,
    observacao: row.observacao
});

// ============================================
// RETALHOS FUNCTIONS
// ============================================

export const getAllRetalhos = async (): Promise<Retalho[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('retalhos')
        .select('*')
        .order('data_cadastro', { ascending: false });

    if (error) {
        console.error('Error fetching retalhos:', error);
        return [];
    }

    return (data || []).map(mapRowToRetalho);
};

export const getRetalhosByFilm = async (filmId: string): Promise<Retalho[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('retalhos')
        .select('*')
        .eq('film_id', filmId)
        .eq('status', 'disponivel')
        .order('area_m2', { ascending: false });

    if (error) {
        console.error('Error fetching retalhos by film:', error);
        return [];
    }

    return (data || []).map(mapRowToRetalho);
};

export const getRetalhosByBobina = async (bobinaId: number): Promise<Retalho[]> => {
    const userId = await getCurrentUserId();
    console.log('getRetalhosByBobina - userId:', userId, 'bobinaId:', bobinaId);
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('retalhos')
        .select('*')
        .eq('bobina_id', bobinaId)
        .order('data_cadastro', { ascending: false });

    if (error) {
        console.error('Error fetching retalhos by bobina:', error);
        return [];
    }

    console.log('getRetalhosByBobina - data found:', data?.length || 0);
    return (data || []).map(mapRowToRetalho);
};

export const getRetalhoByQR = async (codigoQr: string): Promise<Retalho | null> => {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('retalhos')
        .select('*')
        .eq('codigo_qr', codigoQr)
        .single();

    if (error || !data) return null;
    return mapRowToRetalho(data);
};

export const saveRetalho = async (retalho: Omit<Retalho, 'id'> | Retalho): Promise<Retalho> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const retalhoData = {
        user_id: userId,
        bobina_id: retalho.bobinaId,
        film_id: retalho.filmId,
        codigo_qr: retalho.codigoQr || generateQRCode(),
        largura_cm: retalho.larguraCm,
        comprimento_cm: retalho.comprimentoCm,
        status: retalho.status || 'disponivel',
        localizacao: retalho.localizacao,
        observacao: retalho.observacao
    };

    if ('id' in retalho && retalho.id) {
        const { data, error } = await supabase
            .from('retalhos')
            .update(retalhoData)
            .eq('id', retalho.id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return mapRowToRetalho(data);
    } else {
        const { data, error } = await supabase
            .from('retalhos')
            .insert(retalhoData)
            .select()
            .single();

        if (error) throw error;
        return mapRowToRetalho(data);
    }
};

export const deleteRetalho = async (id: number): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { error } = await supabase
        .from('retalhos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

    if (error) throw error;
};

const mapRowToRetalho = (row: any): Retalho => ({
    id: row.id,
    bobinaId: row.bobina_id,
    filmId: row.film_id,
    codigoQr: row.codigo_qr,
    larguraCm: row.largura_cm,
    comprimentoCm: row.comprimento_cm,
    areaM2: row.area_m2,
    dataCadastro: row.data_cadastro,
    dataUtilizacao: row.data_utilizacao,
    status: row.status,
    localizacao: row.localizacao,
    observacao: row.observacao
});

// ============================================
// CONSUMOS FUNCTIONS
// ============================================

export const getAllConsumos = async (): Promise<Consumo[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('consumos')
        .select('*')
        .order('data_consumo', { ascending: false });

    if (error) {
        console.error('Error fetching consumos:', error);
        return [];
    }

    return (data || []).map(mapRowToConsumo);
};

export const getConsumosByBobina = async (bobinaId: number): Promise<Consumo[]> => {
    const userId = await getCurrentUserId();
    console.log('getConsumosByBobina - userId:', userId, 'bobinaId:', bobinaId);
    if (!userId) return [];

    // RLS controla acesso por organização
    const { data, error } = await supabase
        .from('consumos')
        .select('*')
        .eq('bobina_id', bobinaId)
        .order('data_consumo', { ascending: false });

    if (error) {
        console.error('Error fetching consumos by bobina:', error);
        return [];
    }

    console.log('getConsumosByBobina - data found:', data?.length || 0);
    return (data || []).map(mapRowToConsumo);
};

export const saveConsumo = async (consumo: Omit<Consumo, 'id'>): Promise<Consumo> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const consumoData = {
        user_id: userId,
        bobina_id: consumo.bobinaId,
        retalho_id: consumo.retalhoId,
        client_id: consumo.clientId,
        client_name: consumo.clientName,
        pdf_id: consumo.pdfId,
        metros_consumidos: consumo.metrosConsumidos,
        largura_corte_cm: consumo.larguraCorteCm,
        comprimento_corte_cm: consumo.comprimentoCorteCm,
        area_m2: consumo.areaM2,
        tipo: consumo.tipo || 'corte',
        observacao: consumo.observacao
    };

    const { data, error } = await supabase
        .from('consumos')
        .insert(consumoData)
        .select()
        .single();

    if (error) throw error;
    return mapRowToConsumo(data);
};

export const deleteConsumo = async (id: number): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { error } = await supabase
        .from('consumos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

    if (error) throw error;
};

const mapRowToConsumo = (row: any): Consumo => ({
    id: row.id,
    bobinaId: row.bobina_id,
    retalhoId: row.retalho_id,
    clientId: row.client_id,
    clientName: row.client_name,
    pdfId: row.pdf_id,
    metrosConsumidos: row.metros_consumidos,
    larguraCorteCm: row.largura_corte_cm,
    comprimentoCorteCm: row.comprimento_corte_cm,
    areaM2: row.area_m2,
    dataConsumo: row.data_consumo,
    tipo: row.tipo,
    observacao: row.observacao
});

// ============================================
// ESTATÍSTICAS DE ESTOQUE
// ============================================

export interface EstoqueStats {
    totalBobinasAtivas: number;
    totalMetrosDisponiveis: number;
    totalRetalhoDisponivel: number;
    totalAreaRetalhos: number;
    consumoUltimos30Dias: number;
}

export const getEstoqueStats = async (): Promise<EstoqueStats> => {
    const userId = await getCurrentUserId();
    if (!userId) {
        return {
            totalBobinasAtivas: 0,
            totalMetrosDisponiveis: 0,
            totalRetalhoDisponivel: 0,
            totalAreaRetalhos: 0,
            consumoUltimos30Dias: 0
        };
    }

    // Buscar bobinas ativas
    // RLS controla acesso por organização
    const { data: bobinas } = await supabase
        .from('bobinas')
        .select('comprimento_restante_m')
        .eq('status', 'ativa');

    // Buscar retalhos disponíveis
    // RLS controla acesso por organização
    const { data: retalhos } = await supabase
        .from('retalhos')
        .select('area_m2')
        .eq('status', 'disponivel');

    // Buscar consumos dos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // RLS controla acesso por organização
    const { data: consumos } = await supabase
        .from('consumos')
        .select('metros_consumidos')
        .gte('data_consumo', thirtyDaysAgo.toISOString());

    const totalMetros = (bobinas || []).reduce((sum, b) => sum + (b.comprimento_restante_m || 0), 0);
    const totalAreaRetalhos = (retalhos || []).reduce((sum, r) => sum + (r.area_m2 || 0), 0);
    const consumo30Dias = (consumos || []).reduce((sum, c) => sum + (c.metros_consumidos || 0), 0);

    return {
        totalBobinasAtivas: (bobinas || []).length,
        totalMetrosDisponiveis: totalMetros,
        totalRetalhoDisponivel: (retalhos || []).length,
        totalAreaRetalhos: totalAreaRetalhos,
        consumoUltimos30Dias: consumo30Dias
    };
};
