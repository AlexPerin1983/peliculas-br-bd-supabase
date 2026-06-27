// =====================================================
// OFFLINE-FIRST DATABASE - Camada híbrida de dados
// =====================================================
// Este serviço usa a estratégia Offline-First:
// 1. Salva localmente primeiro (resposta imediata)
// 2. Tenta sincronizar com Supabase em background
// 3. Carrega do Supabase quando online, do local quando offline

import { Client, Measurement, UserInfo, Film, PaymentMethods, SavedPDF, Agendamento, ProposalOption, StandaloneExpense } from '../types';
import * as supabaseDb from './supabaseDb';
import * as offlineDb from './offlineDb';
import { isOnlineNow, syncAllPending } from './syncService';

const POSTGRES_INTEGER_MAX = 2147483647;

const isPersistedIntegerId = (value: unknown): value is number => (
    typeof value === 'number'
    && Number.isInteger(value)
    && value > 0
    && value <= POSTGRES_INTEGER_MAX
);

const getTemporaryPublicIdFromLocalId = (localId?: string): number | undefined => {
    if (!localId) return undefined;

    const timestamp = parseInt(localId.split('_')[1] || '', 10);
    return Number.isFinite(timestamp) ? -Math.abs(timestamp) : undefined;
};

const getPublicClientId = (localClient: offlineDb.LocalClient): number | undefined => {
    if (isPersistedIntegerId(localClient._remoteId)) {
        return localClient._remoteId;
    }

    if (isPersistedIntegerId(localClient.id)) {
        return localClient.id;
    }

    return getTemporaryPublicIdFromLocalId(localClient._localId);
};

const stripUserInfoSyncMetadata = (localUserInfo: offlineDb.LocalUserInfo): UserInfo => {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...userInfo } = localUserInfo;
    return userInfo;
};

const cacheUserInfoLocally = async (userInfo: UserInfo, localId: string = 'current_user') => {
    if (userInfo.isFallback) {
        return;
    }

    await offlineDb.offlineDb.userInfo.put({
        ...userInfo,
        _localId: localId,
        _syncStatus: 'synced',
        _lastModified: Date.now()
    });
};

const patchUserInfoLocally = async (patch: Partial<Pick<UserInfo, 'payment_methods' | 'aiConfig' | 'lastSelectedClientId'>>): Promise<UserInfo | null> => {
    const localUserInfo = await offlineDb.getUserInfoLocal();

    if (!localUserInfo || localUserInfo.isFallback) {
        return null;
    }

    const updatedLocal = {
        ...localUserInfo,
        ...patch,
        isFallback: false
    };

    await offlineDb.saveUserInfoLocal(updatedLocal);
    return stripUserInfoSyncMetadata(updatedLocal);
};

// =====================================================
// CLIENTES
// =====================================================

export async function getAllClients(): Promise<Client[]> {
    try {
        if (isOnlineNow()) {
            // Online: primeiro sincronizar pendentes, depois buscar do Supabase

            // 1. Buscar clientes locais pendentes (não sincronizados)
            const localClients = await offlineDb.getAllClientsLocal();
            const pendingClients = localClients.filter(c => c._syncStatus === 'pending');

            // 2. Sincronizar pendentes em background (não bloquear a UI)
            if (pendingClients.length > 0) {
                syncAllPending().catch(err => console.error('[OfflineFirst] Erro na sincronização:', err));
            }

            // 3. Buscar do Supabase
            const supabaseClients = await supabaseDb.getAllClients();

            // 4. Atualizar cache local com dados do Supabase usando bulkPut (muito mais rápido)
            const now = Date.now();
            const clientsToCache = supabaseClients.map(client => ({
                ...client,
                _localId: `remote_${client.id}`,
                _syncStatus: 'synced' as const,
                _lastModified: now,
                _remoteId: client.id
            }));

            if (clientsToCache.length > 0) {
                await offlineDb.offlineDb.clients.bulkPut(clientsToCache);
            }

            // 5. Mesclar: Supabase + pendentes locais (que ainda não foram sincronizados)
            // IMPORTANTE: Evitar duplicação verificando pelo ID do cliente E pelo _remoteId
            const supabaseIds = new Set(supabaseClients.map(c => c.id));
            const pendingNotInSupabase = pendingClients
                .filter(c => {
                    // Se tem _remoteId e já está no Supabase, não incluir (evita duplicata)
                    const remoteId = isPersistedIntegerId(c._remoteId)
                        ? c._remoteId
                        : isPersistedIntegerId(c.id)
                            ? c.id
                            : undefined;
                    if (remoteId && supabaseIds.has(remoteId)) {
                        return false;
                    }
                    // Se tem id do cliente e já está no Supabase, não incluir (evita duplicata de updates)
                    // Se não tem nenhum dos dois, é um cliente novo não sincronizado
                    return true;
                })
                .map(localClient => {
                    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...client } = localClient;
                    // Garantir ID consistente
                    const clientId = getPublicClientId(localClient);
                    return { ...client, id: clientId };
                });

            // Retornar todos (Supabase + pendentes não sincronizados)
            const allClients = [...supabaseClients, ...pendingNotInSupabase];

            return allClients;
        } else {
            // Offline: buscar do cache local
            const localClients = await offlineDb.getAllClientsLocal();

            // Mapear clientes locais para o formato correto, garantindo ID consistente
            const result = localClients.map(localClient => {
                const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...client } = localClient;

                // Garantir ID consistente: usa _remoteId se existe, senão extrai do _localId
                const clientId = getPublicClientId(localClient);

                return { ...client, id: clientId };
            });

            return result;
        }
    } catch (error) {
        console.error('[OfflineFirst] Erro ao buscar clientes, usando cache local:', error);
        const localClients = await offlineDb.getAllClientsLocal();

        // Mapear com ID consistente
        return localClients.map(localClient => {
            const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...client } = localClient;
            const clientId = getPublicClientId(localClient);
            return { ...client, id: clientId };
        });
    }
}

export async function saveClient(client: Omit<Client, 'id'> | Client): Promise<Client> {
    // Se estiver online, salvar diretamente no Supabase para resposta imediata e consistente
    if (isOnlineNow()) {
        try {
            const savedClient = await supabaseDb.saveClient(client);
            // Atualizar cache local
            await offlineDb.offlineDb.clients.put({
                ...savedClient,
                _localId: `remote_${savedClient.id}`,
                _syncStatus: 'synced',
                _lastModified: Date.now(),
                _remoteId: savedClient.id
            });
            return savedClient;
        } catch (error) {
            console.error('[OfflineFirst] Erro ao salvar no Supabase, salvando localmente:', error);
            // Fallback para salvar localmente se falhar
        }
    }

    // Offline ou fallback: salvar localmente primeiro
    const localClient = await offlineDb.saveClientLocal(client as Client);

    // Gerar ID temporário baseado no _localId para consistência
    // Extrai o timestamp do _localId (formato: local_TIMESTAMP_RANDOM)
    const tempId = getPublicClientId(localClient) ?? -Date.now();

    if (!isPersistedIntegerId(localClient.id) && localClient._localId) {
        await offlineDb.offlineDb.clients.update(localClient._localId, { id: tempId });
    }

    return {
        ...client,
        id: tempId
    };
}

export async function deleteClient(clientId: number): Promise<void> {
    await offlineDb.deleteClientLocal(clientId);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }
}

// =====================================================
// PELÍCULAS (FILMS)
// =====================================================

export async function getAllCustomFilms(): Promise<Film[]> {
    try {
        if (isOnlineNow()) {
            // 1. Buscar filmes locais pendentes (não sincronizados)
            const localFilms = await offlineDb.getAllFilmsLocal();
            const pendingFilms = localFilms.filter(f => f._syncStatus === 'pending');

            // 2. Sincronizar pendentes em background (não bloquear a UI)
            if (pendingFilms.length > 0) {
                syncAllPending().catch(err => console.error('[OfflineFirst] Erro na sincronização de filmes:', err));
            }

            // 3. Buscar do Supabase
            const supabaseFilms = await supabaseDb.getAllCustomFilms();

            // 4. Atualizar cache local com dados do Supabase usando bulkPut
            const now = Date.now();
            const filmsToCache = supabaseFilms.map(film => ({
                ...film,
                _localId: `remote_${film.nome}`,
                _syncStatus: 'synced' as const,
                _lastModified: now
            }));

            if (filmsToCache.length > 0) {
                await offlineDb.offlineDb.films.bulkPut(filmsToCache);
            }

            // 5. Mesclar: Supabase + pendentes locais
            // IMPORTANTE: Filmes pendentes PREVALECEM sobre os do Supabase
            // Isso garante que edições apareçam imediatamente na UI
            const pendingFilmNames = new Set(pendingFilms.map(f => f.nome));

            // Filmes do Supabase que N?O foram editados localmente
            const supabaseFilmsNotEdited = supabaseFilms.filter(f => !pendingFilmNames.has(f.nome));

            // Converter filmes pendentes para o formato correto
            const pendingFilmsFormatted = pendingFilms.map(localFilm => {
                const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...film } = localFilm;
                return film;
            });

            // Retornar todos: pendentes locais (prevalecem) + Supabase não editados
            const allFilms = [...pendingFilmsFormatted, ...supabaseFilmsNotEdited];

            return allFilms;
        } else {
            // Offline: buscar do cache local
            const localFilms = await offlineDb.getAllFilmsLocal();

            return localFilms.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...film }) => film);
        }
    } catch (error) {
        console.error('[OfflineFirst] Erro ao buscar películas, usando cache local:', error);
        const localFilms = await offlineDb.getAllFilmsLocal();
        return localFilms.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...film }) => film);
    }
}

export async function saveCustomFilm(film: Film): Promise<void> {
    await offlineDb.saveFilmLocal(film);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }
}

export async function deleteCustomFilm(filmName: string): Promise<void> {
    await offlineDb.deleteFilmLocal(filmName);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }
}

// =====================================================
// USER INFO
// =====================================================

export async function getUserInfo(): Promise<UserInfo | null> {
    try {
        // 1. Tentar carregar do cache local primeiro (instant?neo)
        const localUserInfo = await offlineDb.getUserInfoLocal();
        let result: UserInfo | null = null;

        if (localUserInfo) {
            result = stripUserInfoSyncMetadata(localUserInfo);
        }

        // 2. Se estiver online, atualizar em background ou se não tiver local
        if (isOnlineNow()) {
            if (!result) {
                // Se não tem local, precisamos esperar o Supabase
                const userInfo = await supabaseDb.getUserInfo();
                if (userInfo) {
                    await cacheUserInfoLocally(userInfo);
                }
                return userInfo;
            } else {
                // Se já tem local, atualiza em background para a próxima vez
                // MAS APENAS se o dado local não estiver pendente de sincronização
                if (localUserInfo && localUserInfo._syncStatus !== 'pending') {
                    supabaseDb.getUserInfo().then(async (userInfo) => {
                        // Só atualiza se o dado remoto for válido e diferente do mock inicial
                        // para evitar "resetar" os dados do usuário para o mock por erro de rede
                        if (userInfo) {
                            await cacheUserInfoLocally(userInfo, localUserInfo._localId || 'current_user');
                        }
                    }).catch(err => console.error('[OfflineFirst] Erro ao atualizar userInfo em background:', err));
                }

                return result;
            }
        }

        return result;
    } catch (error) {
        console.error('[OfflineFirst] Erro ao buscar userInfo, usando cache local:', error);
        const localUserInfo = await offlineDb.getUserInfoLocal();
        if (localUserInfo) {
            return stripUserInfoSyncMetadata(localUserInfo);
        }
        return null;
    }
}

export async function saveUserInfo(userInfo: UserInfo): Promise<void> {
    await offlineDb.saveUserInfoLocal({ ...userInfo, isFallback: false });

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }
}

// Atualiza APENAS o campo payment_methods sem sobrescrever outros campos
// Retorna o userInfo atualizado do banco para sincronizar com o estado local
export async function updatePaymentMethodsOnly(paymentMethods: any[]): Promise<UserInfo | null> {
    try {
        if (isOnlineNow()) {
            // Atualiza apenas payment_methods no banco
            const updatedUserInfo = await supabaseDb.updatePaymentMethodsOnly(paymentMethods);
            if (updatedUserInfo) {
                await cacheUserInfoLocally(updatedUserInfo);
            }

            return updatedUserInfo;
        } else {
            return await patchUserInfoLocally({ payment_methods: paymentMethods });
        }
    } catch (error) {
        console.error('[OfflineFirst] Erro ao atualizar payment_methods:', error);
        throw error;
    }
}

export async function updateAIConfigOnly(aiConfig: UserInfo['aiConfig']): Promise<UserInfo | null> {
    try {
        if (isOnlineNow()) {
            const updatedUserInfo = await supabaseDb.updateAIConfigOnly(aiConfig);
            if (updatedUserInfo) {
                await cacheUserInfoLocally(updatedUserInfo);
            }
            return updatedUserInfo;
        }

        return await patchUserInfoLocally({ aiConfig });
    } catch (error) {
        console.error('[OfflineFirst] Erro ao atualizar aiConfig:', error);
        throw error;
    }
}

export async function updateLastSelectedClientIdOnly(lastSelectedClientId: UserInfo['lastSelectedClientId']): Promise<UserInfo | null> {
    try {
        if (isOnlineNow()) {
            const updatedUserInfo = await supabaseDb.updateLastSelectedClientIdOnly(lastSelectedClientId);
            if (updatedUserInfo) {
                await cacheUserInfoLocally(updatedUserInfo);
            }
            return updatedUserInfo;
        }

        return await patchUserInfoLocally({ lastSelectedClientId });
    } catch (error) {
        console.error('[OfflineFirst] Erro ao atualizar lastSelectedClientId:', error);
        throw error;
    }
}

// =====================================================
// PROPOSAL OPTIONS (MEDIDAS)
// =====================================================

export async function getProposalOptions(clientId: number): Promise<ProposalOption[]> {
    try {
        const localOptions = await offlineDb.getProposalOptionsLocal(clientId);
        const normalizedLocalOptions = localOptions.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, clientId: cId, ...option }) => option);

        if (isOnlineNow()) {
            const hasUnsyncedLocalChanges = localOptions.some(option =>
                option._syncStatus === 'pending' || option._syncStatus === 'error'
            );

            if (hasUnsyncedLocalChanges) {
                syncAllPending().catch(err => console.error('[OfflineFirst] Erro ao sincronizar proposal options pendentes:', err));
                return normalizedLocalOptions;
            }

            const options = await supabaseDb.getProposalOptions(clientId);

            await offlineDb.replaceProposalOptionsCache(clientId, options, 'synced');

            return options;
        } else {
            return normalizedLocalOptions;
        }
    } catch (error) {
        console.error('[OfflineFirst] Erro ao buscar proposal options, usando cache local:', error);
        const localOptions = await offlineDb.getProposalOptionsLocal(clientId);
        return localOptions.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, clientId: cId, ...option }) => option);
    }
}

export async function saveProposalOptions(clientId: number, options: ProposalOption[]): Promise<void> {
    await offlineDb.saveProposalOptionsLocal(clientId, options);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }
}

export async function deleteProposalOptions(clientId: number): Promise<void> {
    // Deletar localmente
    const localOptions = await offlineDb.getProposalOptionsLocal(clientId);
    for (const opt of localOptions) {
        await offlineDb.offlineDb.proposalOptions.delete(opt._localId!);
    }

    if (isOnlineNow()) {
        await supabaseDb.deleteProposalOptions(clientId);
    }
}

// =====================================================
// PDFs
// =====================================================

const getPublicPdfId = (localPdf: offlineDb.LocalSavedPDF): number | undefined => {
    const remoteId = localPdf._remoteId;
    if (isPersistedIntegerId(remoteId)) {
        return remoteId;
    }

    if (isPersistedIntegerId(localPdf.id)) {
        return localPdf.id;
    }

    return getTemporaryPublicIdFromLocalId(localPdf._localId);
};

const stripPdfSyncMetadata = (localPdf: offlineDb.LocalSavedPDF): SavedPDF => {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...pdf } = localPdf;
    return { ...pdf, id: getPublicPdfId(localPdf) };
};

const sortPdfsByDateDesc = (pdfs: SavedPDF[]): SavedPDF[] => (
    [...pdfs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
);

const mergeUnsyncedLocalPdfs = (remotePdfs: SavedPDF[], localPdfs: offlineDb.LocalSavedPDF[]): SavedPDF[] => {
    const unsyncedLocalPdfs = localPdfs.filter(pdf => (
        pdf._syncStatus === 'pending' || pdf._syncStatus === 'error'
    ));

    if (unsyncedLocalPdfs.length === 0) {
        return remotePdfs;
    }

    const localPublicPdfs = unsyncedLocalPdfs.map(stripPdfSyncMetadata);
    const locallyChangedRemoteIds = new Set(
        unsyncedLocalPdfs
            .map(pdf => typeof pdf._remoteId === 'number' ? pdf._remoteId : pdf.id)
            .filter(isPersistedIntegerId)
    );

    const remotePdfsWithoutLocalChanges = remotePdfs.filter(pdf => (
        !pdf.id || !locallyChangedRemoteIds.has(pdf.id)
    ));

    syncAllPending().catch(err => console.error('[OfflineFirst] Erro ao sincronizar PDFs pendentes:', err));

    return sortPdfsByDateDesc([...localPublicPdfs, ...remotePdfsWithoutLocalChanges]);
};

export async function getAllPDFs(): Promise<SavedPDF[]> {
    try {
        if (isOnlineNow()) {
            const remotePdfs = await supabaseDb.getAllPDFs();
            const localPdfs = await offlineDb.getAllPdfsLocal();
            return mergeUnsyncedLocalPdfs(remotePdfs, localPdfs);
        }

        const localPdfs = await offlineDb.getAllPdfsLocal();
        // Garantir que cada PDF tenha um ID (necessário para seleção na UI)
        return localPdfs.map(stripPdfSyncMetadata);
    } catch (error) {
        const localPdfs = await offlineDb.getAllPdfsLocal();
        return localPdfs.map(stripPdfSyncMetadata);
    }
}

export async function savePDF(pdf: SavedPDF): Promise<SavedPDF> {
    const localPdf = await offlineDb.savePdfLocal(pdf);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }

    // Garantir que o PDF retornado tenha um ID (necessário para seleção na UI)
    // Usa _remoteId, ou pdf.id original, ou gera um ID temporário baseado no timestamp do _localId
    let finalId = isPersistedIntegerId(localPdf._remoteId)
        ? localPdf._remoteId
        : isPersistedIntegerId(pdf.id)
            ? pdf.id
            : undefined;
    if (!finalId && localPdf._localId) {
        // Gera um ID temporário negativo (para diferenciar de IDs reais que são positivos)
        finalId = getTemporaryPublicIdFromLocalId(localPdf._localId) ?? -Date.now();
    }

    return { ...pdf, id: finalId };
}

export async function updatePDF(pdf: SavedPDF): Promise<void> {
    await offlineDb.savePdfLocal(pdf);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }
}

export async function getPDFsForClient(clientId: number): Promise<SavedPDF[]> {
    const allPdfs = await getAllPDFs();
    return allPdfs.filter(pdf => pdf.clienteId === clientId);
}

export async function getPDFBlob(pdfId: number): Promise<Blob | null> {
    try {
        if (isOnlineNow() && pdfId > 0) {
            return await supabaseDb.getPDFBlob(pdfId);
        } else {
            const localPdf = await offlineDb.getPdfLocal(pdfId);
            return localPdf?.pdfBlob || null;
        }
    } catch (error) {
        console.error('[OfflineFirst] Erro ao buscar blob do PDF:', error);
        const localPdf = await offlineDb.getPdfLocal(pdfId);
        return localPdf?.pdfBlob || null;
    }
}

export async function deletePDF(pdfId: number): Promise<void> {
    // Por enquanto, apenas deletar do Supabase se online
    if (isOnlineNow()) {
        await supabaseDb.deletePDF(pdfId);
    }
}

// =====================================================
// DESPESAS AVULSAS
// =====================================================

const stripStandaloneExpenseSyncMetadata = (localExpense: offlineDb.LocalStandaloneExpense): StandaloneExpense => {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...expense } = localExpense;
    const publicId = isPersistedIntegerId(_remoteId)
        ? _remoteId
        : isPersistedIntegerId(expense.id)
            ? expense.id
            : getTemporaryPublicIdFromLocalId(_localId);
    return { ...expense, id: publicId };
};

export async function getAllStandaloneExpenses(): Promise<StandaloneExpense[]> {
    try {
        const localExpenses = await offlineDb.getAllStandaloneExpensesLocal();
        const pendingExpenses = localExpenses.filter(expense => expense._syncStatus === 'pending');

        if (isOnlineNow()) {
            if (pendingExpenses.length > 0) {
                syncAllPending().catch(err => console.error('[OfflineFirst] Erro na sincronizacao de despesas:', err));
            }

            const remoteExpenses = await supabaseDb.getAllStandaloneExpenses();
            const now = Date.now();
            const remoteExpensesToCache = remoteExpenses.map(expense => ({
                ...expense,
                _localId: `remote_expense_${expense.id}`,
                _syncStatus: 'synced' as const,
                _lastModified: now,
                _syncedAt: now,
                _remoteId: expense.id
            }));

            if (remoteExpensesToCache.length > 0) {
                await offlineDb.offlineDb.standaloneExpenses.bulkPut(remoteExpensesToCache);
            }

            const remoteIds = new Set(remoteExpenses.map(expense => expense.id).filter(Boolean));
            const pendingNotInRemote = pendingExpenses
                .filter(expense => {
                    const remoteId = isPersistedIntegerId(expense._remoteId)
                        ? expense._remoteId
                        : isPersistedIntegerId(expense.id)
                            ? expense.id
                            : undefined;
                    return !remoteId || !remoteIds.has(remoteId);
                })
                .map(stripStandaloneExpenseSyncMetadata);

            return [...remoteExpenses, ...pendingNotInRemote].sort((a, b) =>
                (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0)
            );
        }

        return localExpenses.map(stripStandaloneExpenseSyncMetadata);
    } catch (error) {
        console.error('[OfflineFirst] Erro ao buscar despesas avulsas, usando cache local:', error);
        const localExpenses = await offlineDb.getAllStandaloneExpensesLocal();
        return localExpenses.map(stripStandaloneExpenseSyncMetadata);
    }
}

export async function saveStandaloneExpense(expense: StandaloneExpense): Promise<StandaloneExpense> {
    if (isOnlineNow()) {
        try {
            const savedExpense = await supabaseDb.saveStandaloneExpense(expense);
            await offlineDb.offlineDb.standaloneExpenses.put({
                ...savedExpense,
                _localId: `remote_expense_${savedExpense.id}`,
                _syncStatus: 'synced',
                _lastModified: Date.now(),
                _syncedAt: Date.now(),
                _remoteId: savedExpense.id
            });
            return savedExpense;
        } catch (error) {
            console.error('[OfflineFirst] Erro ao salvar despesa no Supabase, salvando localmente:', error);
        }
    }

    const localExpense = await offlineDb.saveStandaloneExpenseLocal(expense);
    const tempId = isPersistedIntegerId(localExpense._remoteId)
        ? localExpense._remoteId
        : isPersistedIntegerId(localExpense.id)
            ? localExpense.id
            : getTemporaryPublicIdFromLocalId(localExpense._localId) ?? -Date.now();

    if (!localExpense.id && localExpense._localId) {
        await offlineDb.offlineDb.standaloneExpenses.update(localExpense._localId, { id: tempId });
    }

    return {
        ...stripStandaloneExpenseSyncMetadata(localExpense),
        id: tempId
    };
}

export async function deleteStandaloneExpense(expenseId: number): Promise<void> {
    await offlineDb.deleteStandaloneExpenseLocal(expenseId);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }
}

// =====================================================
// AGENDAMENTOS
// =====================================================

const stripAgendamentoSyncMetadata = (localAgendamento: offlineDb.LocalAgendamento): Agendamento => {
    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...agendamento } = localAgendamento;
    const publicId = isPersistedIntegerId(_remoteId)
        ? _remoteId
        : isPersistedIntegerId(agendamento.id)
            ? agendamento.id
            : getTemporaryPublicIdFromLocalId(_localId);
    return { ...agendamento, id: publicId };
};

// Tamanho da equipe ativa (capacidade de agendamentos simultâneos). Leitura
// leve e org-wide — vai direto ao Supabase, sem cache local (não faz sentido
// guardar offline um número que muda com convites/bloqueios). Em falha/offline,
// retorna 0 e o chamador aplica o piso mínimo de 1 (o próprio dono).
export async function getActiveTeamSize(): Promise<number> {
    try {
        return await supabaseDb.getActiveTeamSize();
    } catch (error) {
        console.error('[offlineFirst] getActiveTeamSize failed:', error);
        return 0;
    }
}

export async function getAllAgendamentos(): Promise<Agendamento[]> {
    try {
        const localAgendamentos = await offlineDb.getAllAgendamentosLocal();
        const pendingAgendamentos = localAgendamentos.filter(agendamento => agendamento._syncStatus === 'pending');

        if (isOnlineNow()) {
            if (pendingAgendamentos.length > 0) {
                syncAllPending().catch(err => console.error('[OfflineFirst] Erro na sincronizacao de agendamentos:', err));
            }

            const remoteAgendamentos = await supabaseDb.getAllAgendamentos();
            const remoteIds = new Set(remoteAgendamentos.map(agendamento => agendamento.id).filter(Boolean));
            const pendingNotInRemote = pendingAgendamentos
                .filter(agendamento => {
                    const remoteId = isPersistedIntegerId(agendamento._remoteId)
                        ? agendamento._remoteId
                        : isPersistedIntegerId(agendamento.id)
                            ? agendamento.id
                            : undefined;
                    return !remoteId || !remoteIds.has(remoteId);
                })
                .map(stripAgendamentoSyncMetadata);

            return [...remoteAgendamentos, ...pendingNotInRemote];
        }

        return localAgendamentos.map(stripAgendamentoSyncMetadata);
    } catch (error) {
        const localAgendamentos = await offlineDb.getAllAgendamentosLocal();
        return localAgendamentos.map(stripAgendamentoSyncMetadata);
    }
}

export async function saveAgendamento(agendamento: Agendamento): Promise<Agendamento> {
    if (isOnlineNow()) {
        try {
            const savedAgendamento = await supabaseDb.saveAgendamento(agendamento);
            await offlineDb.offlineDb.agendamentos.put({
                ...savedAgendamento,
                _localId: `remote_agendamento_${savedAgendamento.id}`,
                _syncStatus: 'synced',
                _lastModified: Date.now(),
                _syncedAt: Date.now(),
                _remoteId: savedAgendamento.id
            });
            return savedAgendamento;
        } catch (error) {
            console.error('[OfflineFirst] Erro ao salvar agendamento no Supabase, salvando localmente:', error);
        }
    }

    const localAgendamento = await offlineDb.saveAgendamentoLocal(agendamento);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }

    const tempId = isPersistedIntegerId(localAgendamento._remoteId)
        ? localAgendamento._remoteId
        : isPersistedIntegerId(agendamento.id)
            ? agendamento.id
            : getTemporaryPublicIdFromLocalId(localAgendamento._localId) ?? -Date.now();

    if (!localAgendamento.id && localAgendamento._localId) {
        await offlineDb.offlineDb.agendamentos.update(localAgendamento._localId, { id: tempId });
    }

    return { ...agendamento, id: tempId };
}

export async function deleteAgendamento(agendamentoId: number): Promise<void> {
    if (isOnlineNow()) {
        await supabaseDb.deleteAgendamento(agendamentoId);
    }
}

export async function getAgendamentoByPdfId(pdfId: number): Promise<Agendamento | null> {
    if (isOnlineNow()) {
        return await supabaseDb.getAgendamentoByPdfId(pdfId);
    }
    return null;
}

// =====================================================
// MEDIDAS (Legacy - mantido para compatibilidade)
// =====================================================

export async function getMeasurements(clientId: number): Promise<Measurement[]> {
    return (await supabaseDb.getMeasurements(clientId)) || [];
}

export async function saveMeasurements(clientId: number, measurements: Measurement[]): Promise<void> {
    await supabaseDb.saveMeasurements(clientId, measurements);
}

export async function deleteMeasurements(clientId: number): Promise<void> {
    await supabaseDb.deleteMeasurements(clientId);
}

// =====================================================
// MIGRA??O
// =====================================================

export async function migratePDFsWithProposalOptionId(): Promise<{ updated: number; skipped: number; errors: number }> {
    if (isOnlineNow()) {
        return await supabaseDb.migratePDFsWithProposalOptionId();
    }
    return { updated: 0, skipped: 0, errors: 0 };
}
