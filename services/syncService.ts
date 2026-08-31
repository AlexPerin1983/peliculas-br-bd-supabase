// =====================================================
// SYNC SERVICE - Sincronizacao entre Local e Supabase
// =====================================================

import {
    offlineDb,
    getFailedSyncItems,
    getFailedSyncCount,
    getPendingSyncCount,
    markProposalOptionsAsSynced,
    markSyncItemError,
    markSyncItemPending,
    markAsSynced,
    LocalClient,
    LocalFilm,
    SyncQueueItem,
    LocalUserInfo,
    LocalStandaloneExpense
} from './offlineDb';
import {
    deleteAgendamentoRemote,
    deleteClientRemote,
    deleteCustomFilmRemote,
    deletePDFRemote,
    deleteStandaloneExpenseRemote,
    saveAgendamentoRemote,
    saveClientRemote,
    saveCustomFilmRemote,
    savePDFRemote,
    saveProposalOptionsRemote,
    saveStandaloneExpenseRemote,
    saveUserInfoRemote
} from './supabaseDb';
import { normalizeFilmForPersistence } from '../src/lib/filmPersistence';
import { ProposalOptionOperation, ProposalOptionsSaveResult } from './proposalSync';
import {
    canAutomaticallyRetrySyncError,
    classifySyncError,
    getSyncErrorInfo,
    type SyncErrorInfo
} from '../src/lib/syncErrors';

let isOnline = navigator.onLine;
let syncInProgress = false;
let syncRequestedWhileBusy = false;
let syncRequestedOptions: SyncRunOptions | undefined;
let syncListeners: ((status: SyncStatus) => void)[] = [];
const POSTGRES_INTEGER_MAX = 2147483647;

// Backoff exponencial para evitar tempestade de retries quando o backend
// está lento/indisponível (cada falha adia a próxima tentativa automática).
let consecutiveSyncFailures = 0;
let nextSyncAllowedAt = 0;
let syncRetryTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_BACKOFF_BASE_MS = 5_000;
const SYNC_BACKOFF_MAX_MS = 5 * 60_000;

function clearScheduledSyncRetry(): void {
    if (syncRetryTimer !== null) {
        clearTimeout(syncRetryTimer);
        syncRetryTimer = null;
    }
}

function scheduleSyncRetry(delay: number): void {
    clearScheduledSyncRetry();

    // Evita que timers de módulos isolados atravessem os testes. No aplicativo,
    // a tentativa acontece automaticamente quando o intervalo termina.
    if (!isOnline || import.meta.env.MODE === 'test') {
        return;
    }

    syncRetryTimer = setTimeout(() => {
        syncRetryTimer = null;
        if (isOnline) {
            void syncAllPending({ force: true });
        }
    }, delay);
}

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
        errorInfo?: SyncErrorInfo;
    }[];
    lastSyncAt: number | null;
    lastAttemptAt?: number | null;
    nextRetryAt?: number | null;
    syncInProgress: boolean;
    error: string | null;
    errorInfo?: SyncErrorInfo;
}

let currentStatus: SyncStatus = {
    isOnline: navigator.onLine,
    pendingCount: 0,
    failedCount: 0,
    failedItems: [],
    lastSyncAt: null,
    lastAttemptAt: null,
    nextRetryAt: null,
    syncInProgress: false,
    error: null,
    errorInfo: undefined
};

function isLegacyPdfBlobError(error: unknown): boolean {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: unknown }).message || '')
            : String(error || '');

    const normalizedMessage = message.toLowerCase();
    return normalizedMessage.includes('readasdataurl')
        && normalizedMessage.includes('blob');
}

function hasPdfBlobPayload(pdfBlob: unknown): boolean {
    return (typeof pdfBlob === 'string' && pdfBlob.length > 0)
        || (typeof Blob !== 'undefined' && pdfBlob instanceof Blob);
}

function isPersistedIntegerId(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isInteger(value)
        && value > 0
        && value <= POSTGRES_INTEGER_MAX;
}

function getPersistedIntegerId(...values: unknown[]): number | undefined {
    return values.find(isPersistedIntegerId);
}

const getTemporaryPublicIdFromLocalId = (localId?: string): number | undefined => {
    if (!localId) return undefined;

    const timestamp = parseInt(localId.split('_')[1] || '', 10);
    return Number.isFinite(timestamp) ? -timestamp : undefined;
};

async function findLocalClient(value: unknown, clientName?: string): Promise<LocalClient | undefined> {
    if (!offlineDb.clients) {
        return undefined;
    }

    if (value !== undefined && value !== null) {
        const directRecord = await offlineDb.clients
            .filter(client => (
                client.id === value
                || client._remoteId === value
                || client._localId === value
                || getTemporaryPublicIdFromLocalId(client._localId) === value
            ))
            .first();

        if (directRecord) {
            return directRecord;
        }
    }

    const normalizedName = typeof clientName === 'string' ? clientName.trim().toLowerCase() : '';
    if (!normalizedName) {
        return undefined;
    }

    return await offlineDb.clients
        .filter(client => client.nome?.trim().toLowerCase() === normalizedName)
        .first();
}

async function ensureLocalClientSynced(localClient: LocalClient): Promise<number | undefined> {
    const existingRemoteId = getPersistedIntegerId(localClient._remoteId, localClient.id);
    if (existingRemoteId) {
        return existingRemoteId;
    }

    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...clientRest } = localClient;
    const savedClient = await saveClientRemote(clientRest);

    if (_localId) {
        await markAsSynced('clients', _localId, savedClient.id);
    }

    return savedClient.id;
}

async function resolveLocalRemoteId(
    table: 'clients' | 'savedPdfs' | 'agendamentos' | 'proposalOptions',
    value: unknown
): Promise<number | undefined> {
    if (isPersistedIntegerId(value)) {
        return value;
    }

    if (value === undefined || value === null) {
        return undefined;
    }

    const collection = table === 'clients'
        ? offlineDb.clients
        : table === 'savedPdfs'
            ? offlineDb.savedPdfs
            : table === 'agendamentos'
                ? offlineDb.agendamentos
                : offlineDb.proposalOptions;
    const localRecord = await collection
        .filter(item => (
            item.id === value
            || item._remoteId === value
            || item._localId === value
            || getTemporaryPublicIdFromLocalId(item._localId) === value
        ))
        .first();

    if (isPersistedIntegerId(localRecord?._remoteId)) {
        return localRecord._remoteId as number;
    }

    if (isPersistedIntegerId(localRecord?.id)) {
        return localRecord.id as number;
    }

    return undefined;
}

async function resolveClientRemoteId(value: unknown, clientName?: string): Promise<number | undefined> {
    const resolvedId = await resolveLocalRemoteId('clients', value);
    if (resolvedId) {
        return resolvedId;
    }

    const localRecord = await findLocalClient(value, clientName);
    if (!localRecord) {
        return undefined;
    }

    return ensureLocalClientSynced(localRecord);
}

async function normalizeAgendamentoReferences(agendamento: any): Promise<any> {
    const payload = { ...agendamento };

    if ('pdfId' in payload) {
        const resolvedPdfId = await resolveLocalRemoteId('savedPdfs', payload.pdfId);
        if (resolvedPdfId) {
            payload.pdfId = resolvedPdfId;
        } else {
            delete payload.pdfId;
        }
    }

    if (Array.isArray(payload.pdfIds)) {
        const resolvedPdfIds = (await Promise.all(
            payload.pdfIds.map((pdfId: unknown) => resolveLocalRemoteId('savedPdfs', pdfId))
        )).filter(isPersistedIntegerId);

        if (resolvedPdfIds.length > 0) {
            payload.pdfIds = Array.from(new Set(resolvedPdfIds));
        } else {
            delete payload.pdfIds;
        }
    }

    if ('clienteId' in payload) {
        const resolvedClientId = await resolveClientRemoteId(payload.clienteId, payload.clienteNome || payload.clientName);
        if (resolvedClientId) {
            payload.clienteId = resolvedClientId;
        } else {
            delete payload.clienteId;
        }
    }

    return payload;
}

async function normalizeSavedPdfReferences(pdf: any): Promise<any> {
    const payload = { ...pdf };

    if ('clienteId' in payload) {
        const resolvedClientId = await resolveClientRemoteId(payload.clienteId, payload.clientName);
        if (resolvedClientId) {
            payload.clienteId = resolvedClientId;
        } else if (!isPersistedIntegerId(payload.clienteId)) {
            delete payload.clienteId;
        }
    }

    if ('agendamentoId' in payload) {
        const resolvedAgendamentoId = await resolveLocalRemoteId('agendamentos', payload.agendamentoId);
        if (resolvedAgendamentoId) {
            payload.agendamentoId = resolvedAgendamentoId;
        } else if (!isPersistedIntegerId(payload.agendamentoId)) {
            delete payload.agendamentoId;
        }
    }

    if ('proposalOptionId' in payload) {
        const resolvedProposalOptionId = await resolveLocalRemoteId('proposalOptions', payload.proposalOptionId);
        if (resolvedProposalOptionId) {
            payload.proposalOptionId = resolvedProposalOptionId;
        } else if (!isPersistedIntegerId(payload.proposalOptionId)) {
            delete payload.proposalOptionId;
        }
    }

    return payload;
}

async function normalizeStandaloneExpenseReferences(expense: any): Promise<any> {
    const payload = { ...expense };

    if ('clientId' in payload && payload.clientId !== null) {
        const resolvedClientId = await resolveClientRemoteId(payload.clientId);
        if (resolvedClientId) {
            payload.clientId = resolvedClientId;
        } else if (!isPersistedIntegerId(payload.clientId)) {
            payload.clientId = null;
        }
    }

    if ('proposalId' in payload && payload.proposalId !== null) {
        const resolvedProposalId = await resolveLocalRemoteId('savedPdfs', payload.proposalId);
        if (resolvedProposalId) {
            payload.proposalId = resolvedProposalId;
        } else if (!isPersistedIntegerId(payload.proposalId)) {
            payload.proposalId = null;
        }
    }

    return payload;
}

async function findLocalSavedPdf(data: any) {
    const localId = data?._localId;
    if (localId) {
        const localPdf = await offlineDb.savedPdfs.get(localId);
        if (localPdf) {
            return localPdf;
        }
    }

    const remoteId = data?._remoteId ?? data?.id;
    if (remoteId === undefined || remoteId === null) {
        return undefined;
    }

    return await offlineDb.savedPdfs
        .filter(pdf => pdf.id === remoteId || pdf._remoteId === remoteId)
        .first();
}

async function resolveSavedPdfRemoteIdForSync(data: any, localPdf?: any): Promise<number | undefined> {
    const directRemoteId = getPersistedIntegerId(data?._remoteId, data?.id, localPdf?._remoteId, localPdf?.id);
    if (directRemoteId) {
        return directRemoteId;
    }

    const temporaryId = [data?._remoteId, data?.id, localPdf?._remoteId, localPdf?.id]
        .find(value => typeof value === 'number' && !isPersistedIntegerId(value));

    if (temporaryId === undefined) {
        return undefined;
    }

    const originalLocalPdf = await offlineDb.savedPdfs
        .filter(pdf => {
            const temporaryPublicId = getTemporaryPublicIdFromLocalId(pdf._localId);
            return pdf.id === temporaryId
                || pdf._remoteId === temporaryId
                || temporaryPublicId === temporaryId
                || (
                    typeof temporaryId === 'number'
                    && typeof temporaryPublicId === 'number'
                    && Math.abs(temporaryPublicId) === Math.abs(temporaryId)
                );
        })
        .first();

    return getPersistedIntegerId(originalLocalPdf?._remoteId, originalLocalPdf?.id);
}

async function shouldDiscardLegacySavedPdfItem(item: SyncQueueItem): Promise<boolean> {
    if (item.table !== 'savedPdfs') {
        return false;
    }

    if (!(item.action === 'create' || item.action === 'update')) {
        return false;
    }

    const localPdf = await findLocalSavedPdf(item.data);
    const referenceTime = item.lastAttemptAt ?? item.timestamp ?? 0;
    // Somente uma confirmação anterior permite concluir uma entrada legada.
    // A ausência de arquivo ou vínculo, por si só, não autoriza descartá-la.
    return localPdf?._syncStatus === 'synced' && (localPdf._syncedAt ?? 0) >= referenceTime;
}

export function initSyncService(): void {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void updatePendingCount().then(() => {
        if (navigator.onLine && (currentStatus.pendingCount > 0 || currentStatus.failedCount > 0)) {
            void syncAllPending();
        }
    });
}

function handleOnline(): void {
    isOnline = true;
    currentStatus.isOnline = true;
    // Volta de conexão: zera o backoff e força uma tentativa imediata.
    consecutiveSyncFailures = 0;
    nextSyncAllowedAt = 0;
    currentStatus.nextRetryAt = null;
    clearScheduledSyncRetry();
    notifyListeners();
    syncAllPending({ force: true });
}

function handleOffline(): void {
    isOnline = false;
    currentStatus.isOnline = false;
    clearScheduledSyncRetry();
    currentStatus.nextRetryAt = null;
    notifyListeners();
}

interface SyncRunOptions {
    force?: boolean;
    // Exclusivo da ação explícita Tentar novamente. force sozinho apenas ignora o backoff.
    retryBlocked?: boolean;
}

export async function syncAllPending(options?: SyncRunOptions): Promise<void> {
    if (!isOnline) {
        return;
    }

    if (syncInProgress) {
        syncRequestedWhileBusy = true;
        syncRequestedOptions = {
            force: syncRequestedOptions?.force || options?.force,
            retryBlocked: syncRequestedOptions?.retryBlocked || options?.retryBlocked
        };
        return;
    }

    // Respeita o backoff após falhas consecutivas, exceto quando forçado
    // (ex.: volta de conexão ou retry manual do usuário).
    if (!options?.force && nextSyncAllowedAt > Date.now()) {
        return;
    }

    clearScheduledSyncRetry();
    currentStatus.nextRetryAt = null;

    syncInProgress = true;
    currentStatus.syncInProgress = true;
    currentStatus.error = null;
    currentStatus.errorInfo = undefined;
    notifyListeners();

    let shouldScheduleRetry = false;
    let successfulItems = 0;

    try {
        const queue = await offlineDb.syncQueue.orderBy('timestamp').toArray();
        const sanitizedQueue: SyncQueueItem[] = [];

        for (const item of queue) {
            if (item.id && await shouldDiscardLegacySavedPdfItem(item)) {
                await acknowledgeProcessedQueueItem(item);
                continue;
            }

            sanitizedQueue.push(item);
        }

        for (const item of sanitizedQueue) {
            const hasClassifiedFailure = !!item.errorInfo || !!item.lastError;
            if (item.status === 'error' && hasClassifiedFailure && !options?.retryBlocked
                && !canAutomaticallyRetrySyncError(getSyncErrorInfo(item), item.retryCount)) {
                continue;
            }
            try {
                currentStatus.lastAttemptAt = Date.now();
                if (item.status === 'error') {
                    await markSyncItemPending(item.id!);
                }
                const processResult = await processQueueItem(item);
                const acknowledged = await acknowledgeProcessedQueueItem(item);

                if (acknowledged && processResult?.proposalOptions) {
                    await markProposalOptionsAsSynced(
                        processResult.proposalOptions.localClientId,
                        processResult.proposalOptions.result.options,
                        processResult.proposalOptions.result.revision
                    );

                    if (processResult.proposalOptions.result.conflictResolved && typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('proposal-sync-conflict-resolved', {
                            detail: {
                                clientId: processResult.proposalOptions.localClientId,
                                preservedConflicts: processResult.proposalOptions.result.preservedConflicts
                            }
                        }));
                    }
                }
                if (acknowledged) successfulItems += 1;
            } catch (error: any) {
                currentStatus.error = `${item.table}: ${error?.message || error}`;
                const info = classifySyncError(error);
                currentStatus.errorInfo = info;
                const marked = await markSyncItemError(item.id!, currentStatus.error, info, {
                    timestamp: item.timestamp,
                    syncToken: item.data?.syncToken
                });

                if (marked === false) {
                    // Uma nova edição substituiu a tentativa antiga: continua pendente.
                    shouldScheduleRetry = true;
                    continue;
                }
                if (info.category === 'authentication') {
                    shouldScheduleRetry = false;
                    break;
                }

                shouldScheduleRetry ||= canAutomaticallyRetrySyncError(info, (item.retryCount || 0) + 1);
                if (info.category === 'network' || info.category === 'server') {
                    // Sem resposta do servidor, os próximos itens provavelmente
                    // falhariam também. Preservamos a fila e aguardamos o retry.
                    break;
                }
            }
        }

        await updatePendingCount();
        if (successfulItems > 0 && !currentStatus.error
            && currentStatus.pendingCount === 0 && currentStatus.failedCount === 0) {
            currentStatus.lastSyncAt = Date.now();
        }
    } catch (error: any) {
        console.error('[SyncService] Erro geral na sincronizacao:', error);
        currentStatus.lastAttemptAt = Date.now();
        currentStatus.error = String(error?.message || error);
        currentStatus.errorInfo = classifySyncError(error);
        shouldScheduleRetry = canAutomaticallyRetrySyncError(currentStatus.errorInfo, consecutiveSyncFailures + 1);
    } finally {
        syncInProgress = false;
        currentStatus.syncInProgress = false;

        if (shouldScheduleRetry && isOnline) {
            // Falhou: agenda próxima tentativa com backoff exponencial.
            consecutiveSyncFailures += 1;
            const delay = Math.min(
                SYNC_BACKOFF_BASE_MS * 2 ** (consecutiveSyncFailures - 1),
                SYNC_BACKOFF_MAX_MS
            );
            nextSyncAllowedAt = Date.now() + delay;
            currentStatus.nextRetryAt = nextSyncAllowedAt;
            scheduleSyncRetry(delay);
        } else {
            // Sucesso: limpa o backoff.
            consecutiveSyncFailures = 0;
            nextSyncAllowedAt = 0;
            currentStatus.nextRetryAt = null;
            clearScheduledSyncRetry();
        }

        notifyListeners();

        if (syncRequestedWhileBusy && isOnline) {
            const requestedOptions = syncRequestedOptions;
            syncRequestedWhileBusy = false;
            syncRequestedOptions = undefined;
            void syncAllPending(requestedOptions);
        }
    }
}

interface QueueProcessResult {
    proposalOptions?: {
        localClientId: number;
        result: ProposalOptionsSaveResult;
    };
}

async function acknowledgeProcessedQueueItem(item: SyncQueueItem): Promise<boolean> {
    if (typeof (offlineDb.syncQueue as any).get !== 'function') {
        await offlineDb.syncQueue.delete(item.id!);
        return true;
    }

    const currentItem = await offlineDb.syncQueue.get(item.id!);
    if (!currentItem) return true;

    const processedToken = item.data?.syncToken;
    const currentToken = currentItem.data?.syncToken;
    const isSameMutation = processedToken
        ? processedToken === currentToken
        : currentItem.timestamp === item.timestamp;

    if (!isSameMutation) {
        return false;
    }

    await offlineDb.syncQueue.delete(item.id!);
    return true;
}

async function processQueueItem(item: SyncQueueItem): Promise<QueueProcessResult | void> {
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
            return { proposalOptions: await syncProposalOptions(data) };
        case 'savedPdfs':
            await syncPdf(action, data);
            break;
        case 'standaloneExpenses':
            await syncStandaloneExpense(action, data);
            break;
        case 'agendamentos':
            await syncAgendamento(action, data);
            break;
        default:
            throw Object.assign(new Error('Operação não reconhecida pelo aplicativo; pendência preservada.'), { code: 'SYNC_CONFIGURATION' });
    }
}

async function syncClient(action: string, data: LocalClient): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...clientRest } = data;
    const localClient = await findLocalClient(_localId || _remoteId || id, clientRest.nome);
    const remoteId = getPersistedIntegerId(_remoteId, id, localClient?._remoteId, localClient?.id);

    if (action === 'create') {
        if (remoteId) {
            if (_localId) {
                await markAsSynced('clients', _localId, remoteId);
            }
            return;
        }

        const result = await saveClientRemote(clientRest);
        await markAsSynced('clients', _localId!, result.id);
        return;
    }

    if (action === 'update') {
        const updateId = remoteId;
        if (!updateId) throw new Error('ID do cliente nao encontrado para atualizacao');

        await saveClientRemote({ ...clientRest, id: updateId });
        await markAsSynced('clients', _localId!);
        return;
    }

    if (action === 'delete') {
        const deleteId = remoteId;
        if (!deleteId) return;
        await deleteClientRemote(deleteId);
    }
}

async function syncFilm(action: string, data: LocalFilm): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...filmRest } = data;

    if (action === 'create' || action === 'update') {
        await saveCustomFilmRemote(normalizeFilmForPersistence(filmRest));
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

async function syncProposalOptions(data: {
    clientId: number;
    options: any[];
    operations?: ProposalOptionOperation[];
    baseRevision?: number;
    baseOptions?: any[];
    deviceId?: string;
}): Promise<{ localClientId: number; result: ProposalOptionsSaveResult }> {
    const { clientId, options } = data;
    const remoteClientId = await resolveClientRemoteId(clientId);
    if (!remoteClientId) {
        throw new Error('ID do cliente nao encontrado para sincronizar opcoes da proposta');
    }

    const savedResult = await saveProposalOptionsRemote(remoteClientId, options, {
        baseRevision: data.baseRevision ?? 0,
        baseOptions: data.baseOptions ?? [],
        deviceId: data.deviceId ?? 'unknown-device',
        operations: data.operations
    });
    const result = savedResult ?? {
        options,
        revision: (data.baseRevision ?? 0) + 1,
        conflictResolved: false,
        preservedConflicts: 0
    };

    return { localClientId: clientId, result };
}

async function syncPdf(action: string, data: any): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...pdfRest } = data;
    const remoteId = getPersistedIntegerId(_remoteId, id);

    if (action === 'create' || action === 'update') {
        const localPdf = await findLocalSavedPdf(data);
        const resolvedRemoteId = await resolveSavedPdfRemoteIdForSync(data, localPdf);
        const normalizedPdfRest = await normalizeSavedPdfReferences({
            ...pdfRest,
            ...(!hasPdfBlobPayload(pdfRest.pdfBlob) && hasPdfBlobPayload(localPdf?.pdfBlob)
                ? { pdfBlob: localPdf.pdfBlob }
                : {})
        });
        const syncPdfPayload = action === 'update' && resolvedRemoteId
            ? { ...normalizedPdfRest, id: resolvedRemoteId }
            : normalizedPdfRest;

        try {
            const savedPdf = await savePDFRemote(syncPdfPayload);

            if (_localId) {
                await markAsSynced('savedPdfs', _localId, savedPdf.id);
            }
            return;
        } catch (error) {
            const legacyBlobError = isLegacyPdfBlobError(error);

            if (legacyBlobError && action === 'update') {
                const repairedPayload = {
                    ...syncPdfPayload,
                    pdfBlob: undefined
                };

                const savedPdf = await savePDFRemote(repairedPayload);
                if (_localId) {
                    await markAsSynced('savedPdfs', _localId, savedPdf.id);
                }
                return;
            }

            if (legacyBlobError && _localId) {
                const localPdf = await offlineDb.savedPdfs.get(_localId);
                const repairedBlob = localPdf?.pdfBlob;

                if (repairedBlob && (typeof repairedBlob === 'string' || repairedBlob instanceof Blob)) {
                    const savedPdf = await savePDFRemote({
                        ...syncPdfPayload,
                        pdfBlob: repairedBlob
                    });

                    await markAsSynced('savedPdfs', _localId, savedPdf.id);
                    return;
                }
            }

            throw error;
        }
    }

    if (action === 'delete') {
        if (!remoteId) return;
        await deletePDFRemote(remoteId);
    }
}

async function syncStandaloneExpense(action: string, data: LocalStandaloneExpense): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...expenseRest } = data;
    const remoteId = getPersistedIntegerId(_remoteId, id);

    if (action === 'create' || action === 'update') {
        const normalizedExpenseRest = await normalizeStandaloneExpenseReferences(expenseRest);
        const payload = action === 'update' && remoteId
            ? { ...normalizedExpenseRest, id: remoteId }
            : normalizedExpenseRest;
        const savedExpense = await saveStandaloneExpenseRemote(payload);

        if (_localId) {
            await markAsSynced('standaloneExpenses', _localId, savedExpense.id);
        }
        return;
    }

    if (action === 'delete') {
        const deleteId = remoteId;
        if (!deleteId) return;
        await deleteStandaloneExpenseRemote(deleteId);
    }
}

async function syncAgendamento(action: string, data: any): Promise<void> {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, id, ...agendamentoRest } = data;
    const remoteId = getPersistedIntegerId(_remoteId, id);

    if (action === 'create' || (action === 'update' && !remoteId)) {
        const agendamentoPayload = await normalizeAgendamentoReferences(agendamentoRest);
        const savedAgendamento = await saveAgendamentoRemote(agendamentoPayload);
        if (_localId) {
            await markAsSynced('agendamentos', _localId, savedAgendamento.id);
        }
        return;
    }

    if (action === 'update') {
        const updateId = remoteId;
        if (!updateId) throw new Error('ID do agendamento nao encontrado para atualizacao');

        const agendamentoPayload = await normalizeAgendamentoReferences(agendamentoRest);
        await saveAgendamentoRemote({ ...agendamentoPayload, id: updateId });
        if (_localId) {
            await markAsSynced('agendamentos', _localId);
        }
        return;
    }

    if (action === 'delete') {
        const deleteId = remoteId;
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

export async function refreshSyncStatus(): Promise<void> {
    await updatePendingCount();
}

export function isOnlineNow(): boolean {
    return isOnline;
}

export async function forcSync(): Promise<void> {
    // Retry manual do usuário: ignora o backoff.
    consecutiveSyncFailures = 0;
    nextSyncAllowedAt = 0;
    await syncAllPending({ force: true, retryBlocked: true });
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
    refreshSyncStatus,
    isOnlineNow,
    forcSync,
    clearSyncQueue
};
