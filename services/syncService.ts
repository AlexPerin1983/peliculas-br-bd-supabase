// =====================================================
// SYNC SERVICE - Sincronizacao entre Local e Supabase
// =====================================================

import {
    offlineDb,
    getFailedSyncItems,
    getFailedSyncCount,
    getPendingSyncCount,
    markSyncItemError,
    markSyncItemPending,
    markAsSynced,
    LocalClient,
    LocalFilm,
    SyncQueueItem,
    LocalUserInfo
} from './offlineDb';
import {
    deleteAgendamentoRemote,
    deleteClientRemote,
    deleteCustomFilmRemote,
    saveAgendamentoRemote,
    saveClientRemote,
    saveCustomFilmRemote,
    savePDFRemote,
    saveProposalOptionsRemote,
    saveUserInfoRemote
} from './supabaseDb';

let isOnline = navigator.onLine;
let syncInProgress = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];

export interface SyncStatus {
    isOnline: boolean;
    pendingCount: number;
    failedCount: number;
    failedItems: {
        id: number;
        table: string;
        action: 'create' | 'update' | 'delete';
        retryCount: number;
        lastError: string | null;
        lastAttemptAt: number | null;
    }[];
    lastSyncAt: number | null;
    syncInProgress: boolean;
    error: string | null;
}

let currentStatus: SyncStatus = {
    isOnline: navigator.onLine,
    pendingCount: 0,
    failedCount: 0,
    failedItems: [],
    lastSyncAt: null,
    syncInProgress: false,
    error: null
};

function isAuthError(error: unknown): boolean {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: unknown }).message || '')
            : String(error || '');

    const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

    const normalizedMessage = message.toLowerCase();
    const normalizedCode = code.toUpperCase();

    return normalizedMessage.includes('jwt expired')
        || normalizedMessage.includes('unauthorized')
        || normalizedMessage.includes('invalid jwt')
        || normalizedCode === 'PGRST301'
        || normalizedCode === 'PGRST303';
}

export function initSyncService(): void {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    updatePendingCount();
}

function handleOnline(): void {
    isOnline = true;
    currentStatus.isOnline = true;
    notifyListeners();
    syncAllPending();
}

function handleOffline(): void {
    isOnline = false;
    currentStatus.isOnline = false;
    notifyListeners();
}

export async function syncAllPending(): Promise<void> {
    if (!isOnline || syncInProgress) {
        return;
    }

    syncInProgress = true;
    currentStatus.syncInProgress = true;
    currentStatus.error = null;
    notifyListeners();

    try {
        const queue = await offlineDb.syncQueue.orderBy('timestamp').toArray();

        for (const item of queue) {
            try {
                if (item.status === 'error') {
                    await markSyncItemPending(item.id!);
                }
                await processQueueItem(item);
                await offlineDb.syncQueue.delete(item.id!);
            } catch (error: any) {
                currentStatus.error = `${item.table}: ${error?.message || error}`;
                await markSyncItemError(item.id!, currentStatus.error);

                if (isAuthError(error)) {
                    currentStatus.error = 'Sessao expirada. Faca login novamente para continuar sincronizando.';
                    break;
                }
            }
        }

        currentStatus.lastSyncAt = Date.now();
        await updatePendingCount();
    } catch (error: any) {
        console.error('[SyncService] Erro geral na sincronizacao:', error);
        currentStatus.error = error.message;
    } finally {
        syncInProgress = false;
        currentStatus.syncInProgress = false;
        notifyListeners();
    }
}

async function processQueueItem(item: SyncQueueItem): Promise<void> {
    const { table, action, data } = item;

    switch (table) {
        case 'clients':
            await syncClient(action, data);
            break;
        case 'films':
            await syncFilm(action, data);
            break;
        case 'userInfo':
            await syncUserInfo(data);
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

async function syncClient(action: string, data: LocalClient): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...clientRest } = data;

    if (action === 'create') {
        const result = await saveClientRemote(clientRest);
        await markAsSynced('clients', _localId!, result.id);
        return;
    }

    if (action === 'update') {
        const updateId = _remoteId || id;
        if (!updateId) throw new Error('ID do cliente nao encontrado para atualizacao');

        await saveClientRemote({ ...clientRest, id: updateId });
        await markAsSynced('clients', _localId!);
        return;
    }

    if (action === 'delete') {
        const deleteId = _remoteId || id;
        if (!deleteId) return;
        await deleteClientRemote(deleteId);
    }
}

async function syncFilm(action: string, data: LocalFilm): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...filmRest } = data;

    if (action === 'create' || action === 'update') {
        await saveCustomFilmRemote(filmRest);
        await markAsSynced('films', _localId!);
        return;
    }

    if (action === 'delete') {
        await deleteCustomFilmRemote(data.nome);
    }
}

async function syncUserInfo(data: LocalUserInfo): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...userRest } = data;

    await saveUserInfoRemote({
        ...userRest,
        id: 'info'
    });

    await markAsSynced('userInfo', _localId!);
}

async function syncProposalOptions(data: { clientId: number; options: any[] }): Promise<void> {
    const { clientId, options } = data;
    await saveProposalOptionsRemote(clientId, options);
}

async function syncPdf(action: string, data: any): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...pdfRest } = data;

    if (action === 'create' || action === 'update') {
        const savedPdf = await savePDFRemote(
            action === 'update' && (_remoteId || id)
                ? { ...pdfRest, id: _remoteId || id }
                : pdfRest
        );

        if (_localId) {
            await markAsSynced('savedPdfs', _localId, savedPdf.id);
        }
    }
}

async function syncAgendamento(action: string, data: any): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...agendamentoRest } = data;

    if (action === 'create') {
        const savedAgendamento = await saveAgendamentoRemote(agendamentoRest);
        if (_localId) {
            await markAsSynced('agendamentos', _localId, savedAgendamento.id);
        }
        return;
    }

    if (action === 'update') {
        const updateId = _remoteId || id;
        if (!updateId) throw new Error('ID do agendamento nao encontrado para atualizacao');

        await saveAgendamentoRemote({ ...agendamentoRest, id: updateId });
        if (_localId) {
            await markAsSynced('agendamentos', _localId);
        }
        return;
    }

    if (action === 'delete') {
        const deleteId = _remoteId || id;
        if (!deleteId) return;
        await deleteAgendamentoRemote(deleteId);
    }
}

async function updatePendingCount(): Promise<void> {
    currentStatus.pendingCount = await getPendingSyncCount();
    currentStatus.failedCount = await getFailedSyncCount();
    currentStatus.failedItems = await getFailedSyncItems();
    notifyListeners();
}

function notifyListeners(): void {
    syncListeners.forEach(listener => listener({ ...currentStatus }));
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
    syncListeners.push(listener);
    listener({ ...currentStatus });

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

export async function forcSync(): Promise<void> {
    await syncAllPending();
}

export async function clearSyncQueue(): Promise<number> {
    const count = await offlineDb.syncQueue.count();
    await offlineDb.syncQueue.clear();
    await updatePendingCount();
    console.log('[SyncService] Fila de sincronizacao limpa. Itens removidos:', count);
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
