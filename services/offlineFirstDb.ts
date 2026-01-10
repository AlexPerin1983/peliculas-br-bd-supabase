// =====================================================
// OFFLINE-FIRST DATABASE - Camada híbrida de dados
// =====================================================
// Este serviço usa a estratégia Offline-First:
// 1. Salva localmente primeiro (resposta imediata)
// 2. Tenta sincronizar com Supabase em background
// 3. Carrega do Supabase quando online, do local quando offline

import { Client, Measurement, UserInfo, Film, PaymentMethods, SavedPDF, Agendamento, ProposalOption } from '../types';
import * as supabaseDb from './supabaseDb';
import * as offlineDb from './offlineDb';
import { isOnlineNow, syncAllPending } from './syncService';

// =====================================================
// CLIENTES
// =====================================================

export async function getAllClients(): Promise<Client[]> {
    try {
        if (isOnlineNow()) {
            // Online: buscar do Supabase e atualizar cache local
            const clients = await supabaseDb.getAllClients();

            // Atualizar cache local
            for (const client of clients) {
                await offlineDb.offlineDb.clients.put({
                    ...client,
                    _localId: `remote_${client.id}`,
                    _syncStatus: 'synced',
                    _lastModified: Date.now(),
                    _remoteId: client.id
                });
            }

            return clients;
        } else {
            // Offline: buscar do cache local
            const localClients = await offlineDb.getAllClientsLocal();
            return localClients.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...client }) => client);
        }
    } catch (error) {
        console.error('[OfflineFirst] Erro ao buscar clientes, usando cache local:', error);
        const localClients = await offlineDb.getAllClientsLocal();
        return localClients.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...client }) => client);
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
    const localIdParts = localClient._localId?.split('_') || [];
    const tempId = localClient._remoteId as number || localClient.id || parseInt(localIdParts[1]) || Date.now();

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
            const films = await supabaseDb.getAllCustomFilms();

            // Atualizar cache local
            for (const film of films) {
                await offlineDb.offlineDb.films.put({
                    ...film,
                    _localId: `remote_${film.nome}`,
                    _syncStatus: 'synced',
                    _lastModified: Date.now()
                });
            }

            return films;
        } else {
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
        if (isOnlineNow()) {
            const userInfo = await supabaseDb.getUserInfo();

            if (userInfo) {
                await offlineDb.offlineDb.userInfo.put({
                    ...userInfo,
                    _localId: 'current_user',
                    _syncStatus: 'synced',
                    _lastModified: Date.now()
                });
            }

            return userInfo;
        } else {
            const localUserInfo = await offlineDb.getUserInfoLocal();
            if (localUserInfo) {
                const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...userInfo } = localUserInfo;
                return userInfo;
            }
            return null;
        }
    } catch (error) {
        console.error('[OfflineFirst] Erro ao buscar userInfo, usando cache local:', error);
        const localUserInfo = await offlineDb.getUserInfoLocal();
        if (localUserInfo) {
            const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...userInfo } = localUserInfo;
            return userInfo;
        }
        return null;
    }
}

export async function saveUserInfo(userInfo: UserInfo): Promise<void> {
    await offlineDb.saveUserInfoLocal(userInfo);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }
}

// =====================================================
// PROPOSAL OPTIONS (MEDIDAS)
// =====================================================

export async function getProposalOptions(clientId: number): Promise<ProposalOption[]> {
    try {
        if (isOnlineNow()) {
            const options = await supabaseDb.getProposalOptions(clientId);

            // Atualizar cache local
            for (const option of options) {
                await offlineDb.offlineDb.proposalOptions.put({
                    ...option,
                    clientId,
                    _localId: `remote_${option.id}`,
                    _syncStatus: 'synced',
                    _lastModified: Date.now()
                });
            }

            return options;
        } else {
            const localOptions = await offlineDb.getProposalOptionsLocal(clientId);
            return localOptions.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, clientId: cId, ...option }) => option);
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

export async function getAllPDFs(): Promise<SavedPDF[]> {
    try {
        if (isOnlineNow()) {
            return await supabaseDb.getAllPDFs();
        } else {
            const localPdfs = await offlineDb.getAllPdfsLocal();
            return localPdfs.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...pdf }) => pdf);
        }
    } catch (error) {
        const localPdfs = await offlineDb.getAllPdfsLocal();
        return localPdfs.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...pdf }) => pdf);
    }
}

export async function savePDF(pdf: SavedPDF): Promise<SavedPDF> {
    const localPdf = await offlineDb.savePdfLocal(pdf);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }

    return { ...pdf, id: localPdf._remoteId as number || pdf.id };
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

export async function deletePDF(pdfId: number): Promise<void> {
    // Por enquanto, apenas deletar do Supabase se online
    if (isOnlineNow()) {
        await supabaseDb.deletePDF(pdfId);
    }
}

// =====================================================
// AGENDAMENTOS
// =====================================================

export async function getAllAgendamentos(): Promise<Agendamento[]> {
    try {
        if (isOnlineNow()) {
            return await supabaseDb.getAllAgendamentos();
        } else {
            const localAgendamentos = await offlineDb.getAllAgendamentosLocal();
            return localAgendamentos.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...agendamento }) => agendamento);
        }
    } catch (error) {
        const localAgendamentos = await offlineDb.getAllAgendamentosLocal();
        return localAgendamentos.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...agendamento }) => agendamento);
    }
}

export async function saveAgendamento(agendamento: Agendamento): Promise<Agendamento> {
    const localAgendamento = await offlineDb.saveAgendamentoLocal(agendamento);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }

    return { ...agendamento, id: localAgendamento._remoteId as number || agendamento.id };
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
// MIGRAÇÃO
// =====================================================

export async function migratePDFsWithProposalOptionId(): Promise<{ updated: number; skipped: number; errors: number }> {
    if (isOnlineNow()) {
        return await supabaseDb.migratePDFsWithProposalOptionId();
    }
    return { updated: 0, skipped: 0, errors: 0 };
}
