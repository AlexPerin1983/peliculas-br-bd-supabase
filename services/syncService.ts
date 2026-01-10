// =====================================================
// SYNC SERVICE - Sincronização entre Local e Supabase
// =====================================================
// Este serviço gerencia a sincronização de dados entre
// o banco local (IndexedDB) e o Supabase (remoto)

import { supabase } from './supabaseClient';
import {
    offlineDb,
    getPendingSyncCount,
    markAsSynced,
    LocalClient,
    LocalFilm,
    LocalUserInfo
} from './offlineDb';

// Status de conexão
let isOnline = navigator.onLine;
let syncInProgress = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];

export interface SyncStatus {
    isOnline: boolean;
    pendingCount: number;
    lastSyncAt: number | null;
    syncInProgress: boolean;
    error: string | null;
}

let currentStatus: SyncStatus = {
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSyncAt: null,
    syncInProgress: false,
    error: null
};

// =====================================================
// LISTENERS DE CONEXÃO
// =====================================================

export function initSyncService(): void {
    // Escutar mudanças de conexão
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar pendentes ao iniciar
    updatePendingCount();

    console.log('[SyncService] Iniciado. Online:', navigator.onLine);
}

function handleOnline(): void {
    console.log('[SyncService] Conexão restaurada!');
    isOnline = true;
    currentStatus.isOnline = true;
    notifyListeners();

    // Tentar sincronizar automaticamente
    syncAllPending();
}

function handleOffline(): void {
    console.log('[SyncService] Sem conexão.');
    isOnline = false;
    currentStatus.isOnline = false;
    notifyListeners();
}

// =====================================================
// SINCRONIZAÇÃO
// =====================================================

export async function syncAllPending(): Promise<void> {
    if (!isOnline || syncInProgress) {
        console.log('[SyncService] Sync ignorado. Online:', isOnline, 'Em progresso:', syncInProgress);
        return;
    }

    syncInProgress = true;
    currentStatus.syncInProgress = true;
    currentStatus.error = null;
    notifyListeners();

    try {
        // Processar fila de sincronização
        const queue = await offlineDb.syncQueue.orderBy('timestamp').toArray();

        console.log('[SyncService] Processando', queue.length, 'itens pendentes');

        for (const item of queue) {
            try {
                await processQueueItem(item);
                // Remover da fila após sucesso
                await offlineDb.syncQueue.delete(item.id!);
            } catch (error: any) {
                console.error('[SyncService] Erro ao sincronizar item:', {
                    table: item.table,
                    action: item.action,
                    error: error?.message || error,
                    details: error?.details || error?.hint || 'Sem detalhes adicionais'
                });
                currentStatus.error = `${item.table}: ${error?.message || error}`;

                // IMPORTANTE: Remover itens problemáticos da fila para não bloquear
                // a sincronização de novos itens
                console.warn('[SyncService] Removendo item problemático da fila para evitar bloqueio');
                await offlineDb.syncQueue.delete(item.id!);
            }
        }

        currentStatus.lastSyncAt = Date.now();
        await updatePendingCount();

        console.log('[SyncService] Sincronização completa!');

    } catch (error: any) {
        console.error('[SyncService] Erro geral na sincronização:', error);
        currentStatus.error = error.message;
    } finally {
        syncInProgress = false;
        currentStatus.syncInProgress = false;
        notifyListeners();
    }
}

async function processQueueItem(item: { table: string; action: string; data: any }): Promise<void> {
    const { table, action, data } = item;

    switch (table) {
        case 'clients':
            await syncClient(action, data);
            break;
        case 'films':
            await syncFilm(action, data);
            break;
        case 'userInfo':
            await syncUserInfo(action, data);
            break;
        case 'proposalOptions':
            await syncProposalOptions(data);
            break;
        case 'savedPdfs':
            await syncPdf(action, data);
            break;
        case 'agendamentos':
            await syncAgendamento(action, data);
            break;
    }
}

// =====================================================
// SINCRONIZAÇÃO POR TABELA
// =====================================================

async function syncClient(action: string, data: LocalClient): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...clientRest } = data;

    // Obter user_id atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    // Mapear campos para o formato do Supabase (snake_case)
    const supabaseData = {
        user_id: user.id,
        nome: clientRest.nome,
        telefone: clientRest.telefone,
        email: clientRest.email,
        cpf_cnpj: clientRest.cpfCnpj,
        cep: clientRest.cep || null,
        logradouro: clientRest.logradouro || null,
        numero: clientRest.numero || null,
        complemento: clientRest.complemento || null,
        bairro: clientRest.bairro || null,
        cidade: clientRest.cidade || null,
        uf: clientRest.uf || null,
        last_updated: new Date().toISOString(),
        pinned: clientRest.pinned || false,
        pinned_at: clientRest.pinnedAt ? new Date(clientRest.pinnedAt).toISOString() : null
    };

    if (action === 'create') {
        const { data: result, error } = await supabase
            .from('clients')
            .insert(supabaseData)
            .select()
            .single();

        if (error) throw error;

        // Atualizar o ID remoto localmente
        await markAsSynced('clients', _localId!, result.id);

    } else if (action === 'update') {
        const updateId = _remoteId || id;
        if (!updateId) {
            throw new Error('ID do cliente não encontrado para atualização');
        }

        const { error } = await supabase
            .from('clients')
            .update(supabaseData)
            .eq('id', updateId);

        if (error) throw error;
        await markAsSynced('clients', _localId!);

    } else if (action === 'delete') {
        const deleteId = _remoteId || id;
        if (!deleteId) return; // Nada para deletar no servidor

        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', deleteId);

        if (error) throw error;
    }
}

async function syncFilm(action: string, data: LocalFilm): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...filmRest } = data;

    // Obter user_id atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    // Mapear campos para formato Supabase
    const supabaseData = {
        user_id: user.id,
        nome: filmRest.nome,
        preco: filmRest.preco,
        preco_metro_linear: filmRest.precoMetroLinear,
        mao_de_obra: filmRest.maoDeObra,
        garantia_fabricante: filmRest.garantiaFabricante,
        garantia_mao_de_obra: filmRest.garantiaMaoDeObra,
        uv: filmRest.uv,
        ir: filmRest.ir,
        vtl: filmRest.vtl,
        espessura: filmRest.espessura,
        tser: filmRest.tser,
        imagens: filmRest.imagens,
        pinned: filmRest.pinned,
        pinned_at: filmRest.pinnedAt ? new Date(filmRest.pinnedAt).toISOString() : null,
        custom_fields: filmRest.customFields
    };

    if (action === 'create' || action === 'update') {
        const { error } = await supabase
            .from('films')
            .upsert(supabaseData, { onConflict: 'user_id,nome' });

        if (error) throw error;
        await markAsSynced('films', _localId!);

    } else if (action === 'delete') {
        const { error } = await supabase
            .from('films')
            .delete()
            .eq('nome', data.nome);

        if (error) throw error;
    }
}

async function syncUserInfo(action: string, data: LocalUserInfo): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...userRest } = data;

    // Obter user_id atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    // Mapear campos para formato Supabase
    const supabaseData = {
        user_id: user.id,
        nome: userRest.nome,
        empresa: userRest.empresa,
        telefone: userRest.telefone,
        email: userRest.email,
        endereco: userRest.endereco,
        cpf_cnpj: userRest.cpfCnpj,
        site: userRest.site,
        logo: userRest.logo,
        assinatura: userRest.assinatura,
        cores: userRest.cores,
        payment_methods: userRest.payment_methods,
        proposal_validity_days: userRest.proposalValidityDays,
        prazo_pagamento: userRest.prazoPagamento,
        working_hours: userRest.workingHours,
        employees: userRest.employees,
        ai_config: userRest.aiConfig,
        last_selected_client_id: userRest.lastSelectedClientId,
        social_links: userRest.socialLinks
    };

    const { error } = await supabase
        .from('user_info')
        .upsert(supabaseData, { onConflict: 'user_id' });

    if (error) throw error;
    await markAsSynced('userInfo', _localId!);
}

async function syncProposalOptions(data: { clientId: number; options: any[] }): Promise<void> {
    const { clientId, options } = data;

    // Obter user_id atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    // Buscar organization_id do usuário
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    const orgId = profile?.organization_id;

    // Deletar opções antigas
    await supabase
        .from('proposal_options')
        .delete()
        .eq('client_id', clientId);

    // Inserir novas opções com o formato correto
    for (const option of options) {
        const { error } = await supabase
            .from('proposal_options')
            .insert({
                user_id: user.id,
                organization_id: orgId,
                client_id: clientId,
                name: option.name,
                measurements: option.measurements,
                general_discount: option.generalDiscount
            });

        if (error) throw error;
    }
}

async function syncPdf(action: string, data: any): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...pdfRest } = data;

    // Obter user_id atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    if (action === 'create') {
        // Mapear campos para formato Supabase
        const supabaseData = {
            user_id: user.id,
            client_id: pdfRest.clienteId,
            client_name: pdfRest.clientName,
            date: pdfRest.date,
            expiration_date: pdfRest.expirationDate,
            total_preco: pdfRest.totalPreco,
            total_m2: pdfRest.totalM2,
            subtotal: pdfRest.subtotal,
            general_discount_amount: pdfRest.generalDiscountAmount,
            general_discount: pdfRest.generalDiscount,
            pdf_blob: pdfRest.pdfBlob, // Já deveria ser base64
            nome_arquivo: pdfRest.nomeArquivo,
            measurements: pdfRest.measurements,
            status: pdfRest.status || 'pending',
            agendamento_id: pdfRest.agendamentoId,
            proposal_option_name: pdfRest.proposalOptionName,
            proposal_option_id: pdfRest.proposalOptionId
        };

        const { error } = await supabase
            .from('saved_pdfs')
            .insert(supabaseData);

        if (error) throw error;
    }
}

async function syncAgendamento(action: string, data: any): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...agendamentoRest } = data;

    // Obter user_id atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    // Mapear campos para formato Supabase
    const supabaseData = {
        user_id: user.id,
        pdf_id: agendamentoRest.pdfId,
        client_id: agendamentoRest.clienteId,
        client_name: agendamentoRest.clienteNome,
        start_time: agendamentoRest.start,
        end_time: agendamentoRest.end,
        notes: agendamentoRest.notes
    };

    if (action === 'create') {
        const { error } = await supabase
            .from('agendamentos')
            .insert(supabaseData);

        if (error) throw error;

    } else if (action === 'update') {
        const updateId = _remoteId || id;
        if (!updateId) {
            throw new Error('ID do agendamento não encontrado para atualização');
        }

        const { error } = await supabase
            .from('agendamentos')
            .update(supabaseData)
            .eq('id', updateId);

        if (error) throw error;
    }
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

async function updatePendingCount(): Promise<void> {
    currentStatus.pendingCount = await getPendingSyncCount();
    notifyListeners();
}

function notifyListeners(): void {
    syncListeners.forEach(listener => listener({ ...currentStatus }));
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
    syncListeners.push(listener);
    // Notificar imediatamente com status atual
    listener({ ...currentStatus });

    // Retornar função de unsubscribe
    return () => {
        syncListeners = syncListeners.filter(l => l !== listener);
    };
}

export function getSyncStatus(): SyncStatus {
    return { ...currentStatus };
}

export function isOnlineNow(): boolean {
    return isOnline;
}

// Forçar sincronização manual
export async function forcSync(): Promise<void> {
    await syncAllPending();
}

// Limpar fila de sincronização (útil para resolver problemas com itens corrompidos)
export async function clearSyncQueue(): Promise<number> {
    const count = await offlineDb.syncQueue.count();
    await offlineDb.syncQueue.clear();
    await updatePendingCount();
    console.log('[SyncService] Fila de sincronização limpa. Itens removidos:', count);
    return count;
}

export default {
    initSyncService,
    syncAllPending,
    subscribeSyncStatus,
    getSyncStatus,
    isOnlineNow,
    forcSync,
    clearSyncQueue
};
