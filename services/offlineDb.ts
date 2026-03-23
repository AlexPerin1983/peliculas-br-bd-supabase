// =====================================================
// OFFLINE DATABASE - IndexedDB para armazenamento local
// =====================================================
// Este serviço armazena dados localmente para funcionar offline
// e sincroniza com Supabase quando houver conexão

import Dexie, { Table } from 'dexie';
import { Client, Film, UserInfo, SavedPDF, Agendamento, ProposalOption } from '../types';

// Tipos para dados com metadata de sincronização
export interface SyncMetadata {
    _localId?: string;          // ID local único
    _syncStatus: 'synced' | 'pending' | 'error';  // Status de sincronização
    _lastModified: number;      // Timestamp da última modificação local
    _syncedAt?: number;         // Timestamp da última sincronização
    _remoteId?: number | string; // ID no servidor (Supabase)
}

export type LocalClient = Client & SyncMetadata;
export type LocalFilm = Film & SyncMetadata;
export type LocalUserInfo = UserInfo & SyncMetadata;
export type LocalSavedPDF = SavedPDF & SyncMetadata;
export type LocalAgendamento = Agendamento & SyncMetadata;
export type LocalProposalOption = ProposalOption & SyncMetadata & { clientId: number };
export interface SyncQueueItem {
    id?: number;
    table: string;
    action: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
    status: 'pending' | 'error';
    retryCount: number;
    lastError?: string;
    lastAttemptAt?: number;
}

export interface FailedSyncItem {
    id: number;
    table: string;
    action: 'create' | 'update' | 'delete';
    retryCount: number;
    lastError: string | null;
    lastAttemptAt: number | null;
}

// Classe do banco de dados IndexedDB
class OfflineDatabase extends Dexie {
    clients!: Table<LocalClient, string>;
    films!: Table<LocalFilm, string>;
    userInfo!: Table<LocalUserInfo, string>;
    savedPdfs!: Table<LocalSavedPDF, string>;
    agendamentos!: Table<LocalAgendamento, string>;
    proposalOptions!: Table<LocalProposalOption, string>;
    syncQueue!: Table<SyncQueueItem, number>;

    constructor() {
        super('PeliculasBROfflineDB');

        this.version(1).stores({
            clients: '_localId, id, nome, _syncStatus',
            films: '_localId, nome, _syncStatus',
            userInfo: '_localId, id, _syncStatus',
            savedPdfs: '_localId, id, clienteId, _syncStatus',
            agendamentos: '_localId, id, clienteId, _syncStatus',
            proposalOptions: '_localId, id, clientId, _syncStatus',
            syncQueue: '++id, table, timestamp'
        });
        this.version(2).stores({
            clients: '_localId, id, nome, _syncStatus',
            films: '_localId, nome, _syncStatus',
            userInfo: '_localId, id, _syncStatus',
            savedPdfs: '_localId, id, clienteId, _syncStatus',
            agendamentos: '_localId, id, clienteId, _syncStatus',
            proposalOptions: '_localId, id, clientId, _syncStatus',
            syncQueue: '++id, table, status, timestamp, lastAttemptAt'
        }).upgrade(async tx => {
            const syncQueueTable = tx.table('syncQueue');
            await syncQueueTable.toCollection().modify((item: SyncQueueItem) => {
                item.status = item.status || 'pending';
                item.retryCount = item.retryCount || 0;
                item.lastError = item.lastError || undefined;
                item.lastAttemptAt = item.lastAttemptAt || undefined;
            });
        });
    }
}

// Instância única do banco
export const offlineDb = new OfflineDatabase();

// Gerar ID local único
export const generateLocalId = (): string => {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

async function enqueueSyncItem(item: Omit<SyncQueueItem, 'id' | 'status' | 'retryCount'>): Promise<void> {
    await offlineDb.syncQueue.add({
        ...item,
        status: 'pending',
        retryCount: 0
    });
}

// =====================================================
// FUNÇÕES DE CLIENTES
// =====================================================

export async function getAllClientsLocal(): Promise<LocalClient[]> {
    // Retorna todos os clientes que não estão marcados como erro
    // Isso inclui: synced (sincronizados) e pending (aguardando sincronização)
    const allClients = await offlineDb.clients.toArray();
    const filtered = allClients.filter(c => c._syncStatus === 'synced' || c._syncStatus === 'pending');
    return filtered;
}

export async function saveClientLocal(client: Omit<Client, 'id'> | Client): Promise<LocalClient> {
    const now = Date.now();

    // Cast para acessar propriedade id que pode existir
    const clientWithId = client as Client;
    const clientId = clientWithId.id;

    // IMPORTANTE: Buscar cliente existente pelo ID para evitar duplicação
    // Isso é necessário quando um cliente existente é atualizado (ex: ao fixar)
    let existingClient: LocalClient | undefined;

    if (clientId) {
        // Buscar pelo ID remoto
        existingClient = await offlineDb.clients
            .filter(c => c.id === clientId || c._remoteId === clientId)
            .first();
    }

    // Usar o _localId existente se encontrado, senão verificar se veio no cliente, senão gerar novo
    const localId = existingClient?._localId || (client as LocalClient)._localId || generateLocalId();

    const localClient: LocalClient = {
        ...client,
        _localId: localId,
        _syncStatus: 'pending',
        _lastModified: now,
        _remoteId: clientId
    };

    // Se existe um cliente com _localId diferente (formato remote_), deletar o antigo para evitar duplicata
    if (clientId && !existingClient) {
        const remoteFormatClient = await offlineDb.clients
            .filter(c => c._localId === `remote_${clientId}`)
            .first();
        if (remoteFormatClient) {
            await offlineDb.clients.delete(remoteFormatClient._localId!);
        }
    }

    await offlineDb.clients.put(localClient);

    // Adicionar à fila de sincronização
    await enqueueSyncItem({
        table: 'clients',
        action: clientId ? 'update' : 'create',
        data: localClient,
        timestamp: now
    });

    return localClient;
}

export async function deleteClientLocal(clientId: number | string): Promise<void> {
    // Encontrar o cliente pelo ID remoto ou local
    const client = await offlineDb.clients
        .filter(c => c.id === clientId || c._localId === clientId)
        .first();

    if (client) {
        // Se tem ID remoto, marcar para deletar no servidor
        if (client._remoteId || client.id) {
            await enqueueSyncItem({
                table: 'clients',
                action: 'delete',
                data: { id: client._remoteId || client.id },
                timestamp: Date.now()
            });
        }

        // Deletar localmente
        await offlineDb.clients.delete(client._localId!);
    }
}

// =====================================================
// FUNÇÕES DE PELÍCULAS (FILMS)
// =====================================================

export async function getAllFilmsLocal(): Promise<LocalFilm[]> {
    // Retorna todos os filmes que não estão marcados como erro
    // Isso inclui: synced (sincronizados) e pending (aguardando sincronização)
    const allFilms = await offlineDb.films.toArray();
    const filtered = allFilms.filter(f => f._syncStatus === 'synced' || f._syncStatus === 'pending');
    return filtered;
}

export async function saveFilmLocal(film: Film): Promise<LocalFilm> {
    const now = Date.now();

    // Buscar filme existente pelo nome
    const existingFilm = await offlineDb.films
        .filter(f => f.nome === film.nome)
        .first();

    // Usar o _localId existente se encontrado, senão gerar novo
    const localId = existingFilm?._localId || generateLocalId();

    const localFilm: LocalFilm = {
        ...film,
        _localId: localId,
        _syncStatus: 'pending',
        _lastModified: now
    };

    // Se não encontrou filme existente, verificar se existe com formato remote_ e remover para evitar duplicata
    if (!existingFilm) {
        const remoteFormatFilm = await offlineDb.films
            .filter(f => f._localId === `remote_${film.nome}`)
            .first();
        if (remoteFormatFilm) {
            await offlineDb.films.delete(remoteFormatFilm._localId!);
        }
    }

    await offlineDb.films.put(localFilm);

    await enqueueSyncItem({
        table: 'films',
        action: existingFilm ? 'update' : 'create',
        data: localFilm,
        timestamp: now
    });

    return localFilm;
}

export async function deleteFilmLocal(filmName: string): Promise<void> {
    const film = await offlineDb.films
        .filter(f => f.nome === filmName)
        .first();

    if (film) {
        await enqueueSyncItem({
            table: 'films',
            action: 'delete',
            data: { nome: filmName },
            timestamp: Date.now()
        });

        await offlineDb.films.delete(film._localId!);
    }
}

// =====================================================
// FUNÇÕES DE USER INFO
// =====================================================

export async function getUserInfoLocal(): Promise<LocalUserInfo | null> {
    const userInfos = await offlineDb.userInfo.toArray();
    return userInfos[0] || null;
}

export async function saveUserInfoLocal(userInfo: UserInfo): Promise<LocalUserInfo> {
    const now = Date.now();
    const existing = await getUserInfoLocal();
    const localId = existing?._localId || 'current_user';

    const localUserInfo: LocalUserInfo = {
        ...userInfo,
        _localId: localId,
        _syncStatus: 'pending',
        _lastModified: now
    };

    await offlineDb.userInfo.put(localUserInfo);

    await enqueueSyncItem({
        table: 'userInfo',
        action: existing ? 'update' : 'create',
        data: localUserInfo,
        timestamp: now
    });

    return localUserInfo;
}

// =====================================================
// FUNÇÕES DE PROPOSAL OPTIONS (MEDIDAS)
// =====================================================

export async function getProposalOptionsLocal(clientId: number): Promise<LocalProposalOption[]> {
    return await offlineDb.proposalOptions
        .filter(po => po.clientId === clientId)
        .toArray();
}

export async function saveProposalOptionsLocal(clientId: number, options: ProposalOption[]): Promise<void> {
    const now = Date.now();

    // Deletar opções antigas deste cliente
    const existingOptions = await getProposalOptionsLocal(clientId);
    for (const opt of existingOptions) {
        await offlineDb.proposalOptions.delete(opt._localId!);
    }

    // Salvar novas opções
    for (const option of options) {
        const localId = generateLocalId();
        const localOption: LocalProposalOption = {
            ...option,
            clientId,
            _localId: localId,
            _syncStatus: 'pending',
            _lastModified: now
        };

        await offlineDb.proposalOptions.put(localOption);
    }

    // Adicionar à fila de sincronização
    await enqueueSyncItem({
        table: 'proposalOptions',
        action: 'update',
        data: { clientId, options },
        timestamp: now
    });
}

// =====================================================
// FUNÇÕES DE PDFs
// =====================================================

// Helper para converter Blob para base64
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// Helper para converter base64 para Blob
const base64ToBlob = (base64: string): Blob => {
    try {
        // Se já é um Blob ou não tem formato base64, retornar como está
        if (!base64 || typeof base64 !== 'string' || !base64.includes(',')) {
            console.warn('[OfflineDb] base64ToBlob: formato inválido, retornando blob vazio');
            return new Blob([], { type: 'application/pdf' });
        }

        const parts = base64.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (error) {
        console.error('[OfflineDb] Erro ao converter base64 para Blob:', error);
        return new Blob([], { type: 'application/pdf' });
    }
};

export async function getAllPdfsLocal(): Promise<LocalSavedPDF[]> {
    const localPdfs = await offlineDb.savedPdfs.toArray();

    // OTIMIZAÇÃO: Não converter base64 para Blob aqui (isso é muito custoso)
    // O pdfBlob será convertido lazy quando o usuário clicar em baixar
    // Por enquanto, retornamos os PDFs como estão
    return localPdfs;
}

// Função para converter pdfBlob sob demanda (lazy loading)
export function convertPdfBlobIfNeeded(pdf: LocalSavedPDF): Blob {
    // Se já é um Blob, retornar diretamente
    if (pdf.pdfBlob instanceof Blob) {
        return pdf.pdfBlob;
    }

    // Se é uma string (base64), converter para Blob
    if (typeof pdf.pdfBlob === 'string') {
        return base64ToBlob(pdf.pdfBlob);
    }

    console.warn('[OfflineDb] pdfBlob em formato inesperado:', typeof pdf.pdfBlob);
    return new Blob([], { type: 'application/pdf' });
}

export async function getPdfLocal(pdfId: number | string): Promise<LocalSavedPDF | null> {
    // Buscar pelo ID remoto ou local
    const pdf = await offlineDb.savedPdfs
        .filter(p => p.id === pdfId || p._remoteId === pdfId || p._localId === pdfId)
        .first();

    if (pdf) {
        // Garantir que o blob seja convertido se necessário
        const blob = convertPdfBlobIfNeeded(pdf);
        return { ...pdf, pdfBlob: blob };
    }

    return null;
}


export async function savePdfLocal(pdf: SavedPDF): Promise<LocalSavedPDF> {
    const now = Date.now();
    const localId = generateLocalId();

    // Converter Blob para base64 para armazenar no IndexedDB
    // Isso permite sincronização correta com Supabase
    let pdfBlobBase64: string;
    if (pdf.pdfBlob instanceof Blob) {
        pdfBlobBase64 = await blobToBase64(pdf.pdfBlob);
    } else {
        // Já está em base64
        pdfBlobBase64 = pdf.pdfBlob as unknown as string;
    }

    const localPdf: LocalSavedPDF = {
        ...pdf,
        pdfBlob: pdfBlobBase64 as unknown as Blob, // Armazenar como base64 internamente
        _localId: localId,
        _syncStatus: 'pending',
        _lastModified: now,
        _remoteId: pdf.id
    };

    await offlineDb.savedPdfs.put(localPdf);

    await enqueueSyncItem({
        table: 'savedPdfs',
        action: pdf.id ? 'update' : 'create',
        data: localPdf,
        timestamp: now
    });

    return localPdf;
}

// =====================================================
// FUNÇÕES DE AGENDAMENTOS
// =====================================================

export async function getAllAgendamentosLocal(): Promise<LocalAgendamento[]> {
    return await offlineDb.agendamentos.toArray();
}

export async function saveAgendamentoLocal(agendamento: Agendamento): Promise<LocalAgendamento> {
    const now = Date.now();
    const localId = generateLocalId();

    const localAgendamento: LocalAgendamento = {
        ...agendamento,
        _localId: localId,
        _syncStatus: 'pending',
        _lastModified: now,
        _remoteId: agendamento.id
    };

    await offlineDb.agendamentos.put(localAgendamento);

    await enqueueSyncItem({
        table: 'agendamentos',
        action: agendamento.id ? 'update' : 'create',
        data: localAgendamento,
        timestamp: now
    });

    return localAgendamento;
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

// Limpar todos os dados locais
export async function clearAllLocalData(): Promise<void> {
    await offlineDb.clients.clear();
    await offlineDb.films.clear();
    await offlineDb.userInfo.clear();
    await offlineDb.savedPdfs.clear();
    await offlineDb.agendamentos.clear();
    await offlineDb.proposalOptions.clear();
    await offlineDb.syncQueue.clear();
}

// Obter contagem de itens pendentes de sincronização
export async function getPendingSyncCount(): Promise<number> {
    return await offlineDb.syncQueue.where('status').equals('pending').count();
}

export async function getFailedSyncCount(): Promise<number> {
    return await offlineDb.syncQueue.where('status').equals('error').count();
}

export async function getFailedSyncItems(limit = 3): Promise<FailedSyncItem[]> {
    const items = await offlineDb.syncQueue
        .where('status')
        .equals('error')
        .reverse()
        .sortBy('lastAttemptAt');

    return items
        .slice(0, limit)
        .map(item => ({
            id: item.id!,
            table: item.table,
            action: item.action,
            retryCount: item.retryCount,
            lastError: item.lastError || null,
            lastAttemptAt: item.lastAttemptAt || null
        }));
}

export async function markSyncItemError(id: number, errorMessage: string): Promise<void> {
    const item = await offlineDb.syncQueue.get(id);
    await offlineDb.syncQueue.update(id, {
        status: 'error',
        lastError: errorMessage,
        lastAttemptAt: Date.now(),
        retryCount: (item?.retryCount || 0) + 1
    });
}

export async function markSyncItemPending(id: number): Promise<void> {
    await offlineDb.syncQueue.update(id, {
        status: 'pending',
        lastError: undefined,
        lastAttemptAt: Date.now()
    });
}

// Marcar item como sincronizado
export async function markAsSynced(table: string, localId: string, remoteId?: number | string): Promise<void> {
    const now = Date.now();

    switch (table) {
        case 'clients':
            await offlineDb.clients.update(localId, {
                _syncStatus: 'synced',
                _syncedAt: now,
                ...(remoteId !== undefined ? { _remoteId: remoteId, id: remoteId as number } : {})
            });
            break;
        case 'films':
            await offlineDb.films.update(localId, { _syncStatus: 'synced', _syncedAt: now });
            break;
        case 'userInfo':
            await offlineDb.userInfo.update(localId, { _syncStatus: 'synced', _syncedAt: now });
            break;
        case 'savedPdfs':
            await offlineDb.savedPdfs.update(localId, {
                _syncStatus: 'synced',
                _syncedAt: now,
                ...(remoteId !== undefined ? { _remoteId: remoteId, id: remoteId as number } : {})
            });
            break;
        case 'agendamentos':
            await offlineDb.agendamentos.update(localId, {
                _syncStatus: 'synced',
                _syncedAt: now,
                ...(remoteId !== undefined ? { _remoteId: remoteId, id: remoteId as number } : {})
            });
            break;
    }
}

export default offlineDb;
