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
    console.log('[OfflineFirst] getAllClients - isOnline:', isOnlineNow());

    try {
        if (isOnlineNow()) {
            // Online: primeiro sincronizar pendentes, depois buscar do Supabase

            // 1. Buscar clientes locais pendentes (não sincronizados)
            const localClients = await offlineDb.getAllClientsLocal();
            const pendingClients = localClients.filter(c => c._syncStatus === 'pending');
            console.log('[OfflineFirst] Clientes pendentes para sincronizar:', pendingClients.length);

            // 2. Sincronizar pendentes em background (não bloquear a UI)
            if (pendingClients.length > 0) {
                console.log('[OfflineFirst] Iniciando sincronização de pendentes...');
                syncAllPending().catch(err => console.error('[OfflineFirst] Erro na sincronização:', err));
            }

            // 3. Buscar do Supabase
            const supabaseClients = await supabaseDb.getAllClients();
            console.log('[OfflineFirst] Clientes do Supabase:', supabaseClients.length);

            // 4. Atualizar cache local com dados do Supabase
            for (const client of supabaseClients) {
                await offlineDb.offlineDb.clients.put({
                    ...client,
                    _localId: `remote_${client.id}`,
                    _syncStatus: 'synced',
                    _lastModified: Date.now(),
                    _remoteId: client.id
                });
            }

            // 5. Mesclar: Supabase + pendentes locais (que ainda não foram sincronizados)
            // IMPORTANTE: Evitar duplicação verificando pelo ID do cliente E pelo _remoteId
            const supabaseIds = new Set(supabaseClients.map(c => c.id));
            const pendingNotInSupabase = pendingClients
                .filter(c => {
                    // Se tem _remoteId e já está no Supabase, não incluir (evita duplicata)
                    if (c._remoteId && supabaseIds.has(c._remoteId as number)) {
                        return false;
                    }
                    // Se tem id do cliente e já está no Supabase, não incluir (evita duplicata de updates)
                    if (c.id && supabaseIds.has(c.id)) {
                        return false;
                    }
                    // Se não tem nenhum dos dois, é um cliente novo não sincronizado
                    return true;
                })
                .map(localClient => {
                    const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...client } = localClient;
                    // Garantir ID consistente
                    let clientId = _remoteId as number || client.id;
                    if (!clientId && _localId) {
                        const parts = _localId.split('_');
                        clientId = parseInt(parts[1]) || Date.now();
                    }
                    return { ...client, id: clientId };
                });

            console.log('[OfflineFirst] Pendentes não no Supabase:', pendingNotInSupabase.length);

            // Retornar todos (Supabase + pendentes não sincronizados)
            const allClients = [...supabaseClients, ...pendingNotInSupabase];
            console.log('[OfflineFirst] Total de clientes retornados:', allClients.length);

            return allClients;
        } else {
            // Offline: buscar do cache local
            console.log('[OfflineFirst] Buscando clientes do cache local...');
            const localClients = await offlineDb.getAllClientsLocal();
            console.log('[OfflineFirst] Clientes locais encontrados:', localClients.length);

            // Mapear clientes locais para o formato correto, garantindo ID consistente
            const result = localClients.map(localClient => {
                const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...client } = localClient;

                // Garantir ID consistente: usa _remoteId se existe, senão extrai do _localId
                let clientId = _remoteId as number || client.id;
                if (!clientId && _localId) {
                    const parts = _localId.split('_');
                    clientId = parseInt(parts[1]) || Date.now();
                }

                return { ...client, id: clientId };
            });

            return result;
        }
    } catch (error) {
        console.error('[OfflineFirst] Erro ao buscar clientes, usando cache local:', error);
        const localClients = await offlineDb.getAllClientsLocal();
        console.log('[OfflineFirst] Fallback - Clientes locais:', localClients.length);

        // Mapear com ID consistente
        return localClients.map(localClient => {
            const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...client } = localClient;
            let clientId = _remoteId as number || client.id;
            if (!clientId && _localId) {
                const parts = _localId.split('_');
                clientId = parseInt(parts[1]) || Date.now();
            }
            return { ...client, id: clientId };
        });
    }
}

export async function saveClient(client: Omit<Client, 'id'> | Client): Promise<Client> {
    console.log('[OfflineFirst] saveClient - isOnline:', isOnlineNow(), 'client:', client);

    // Se estiver online, salvar diretamente no Supabase para resposta imediata e consistente
    if (isOnlineNow()) {
        try {
            const savedClient = await supabaseDb.saveClient(client);
            console.log('[OfflineFirst] Cliente salvo no Supabase:', savedClient);
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
    console.log('[OfflineFirst] Salvando cliente localmente...');
    const localClient = await offlineDb.saveClientLocal(client as Client);
    console.log('[OfflineFirst] Cliente salvo localmente:', localClient);

    // Gerar ID temporário baseado no _localId para consistência
    // Extrai o timestamp do _localId (formato: local_TIMESTAMP_RANDOM)
    const localIdParts = localClient._localId?.split('_') || [];
    const tempId = localClient._remoteId as number || localClient.id || parseInt(localIdParts[1]) || Date.now();

    console.log('[OfflineFirst] ID temporário gerado:', tempId);

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
    console.log('[OfflineFirst] getAllCustomFilms - isOnline:', isOnlineNow());

    try {
        if (isOnlineNow()) {
            // 1. Buscar filmes locais pendentes (não sincronizados)
            const localFilms = await offlineDb.getAllFilmsLocal();
            const pendingFilms = localFilms.filter(f => f._syncStatus === 'pending');
            console.log('[OfflineFirst] Filmes pendentes para sincronizar:', pendingFilms.length);

            // 2. Sincronizar pendentes em background (não bloquear a UI)
            if (pendingFilms.length > 0) {
                console.log('[OfflineFirst] Iniciando sincronização de filmes pendentes...');
                syncAllPending().catch(err => console.error('[OfflineFirst] Erro na sincronização de filmes:', err));
            }

            // 3. Buscar do Supabase
            const supabaseFilms = await supabaseDb.getAllCustomFilms();
            console.log('[OfflineFirst] Filmes do Supabase:', supabaseFilms.length);

            // 4. Atualizar cache local com dados do Supabase
            for (const film of supabaseFilms) {
                await offlineDb.offlineDb.films.put({
                    ...film,
                    _localId: `remote_${film.nome}`,
                    _syncStatus: 'synced',
                    _lastModified: Date.now()
                });
            }

            // 5. Mesclar: Supabase + pendentes locais
            // IMPORTANTE: Filmes pendentes PREVALECEM sobre os do Supabase
            // Isso garante que edições apareçam imediatamente na UI
            const pendingFilmNames = new Set(pendingFilms.map(f => f.nome));

            // Filmes do Supabase que NÃO foram editados localmente
            const supabaseFilmsNotEdited = supabaseFilms.filter(f => !pendingFilmNames.has(f.nome));

            // Converter filmes pendentes para o formato correto
            const pendingFilmsFormatted = pendingFilms.map(localFilm => {
                const { _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...film } = localFilm;
                return film;
            });

            console.log('[OfflineFirst] Filmes do Supabase não editados:', supabaseFilmsNotEdited.length);
            console.log('[OfflineFirst] Filmes pendentes locais:', pendingFilmsFormatted.length);

            // Retornar todos: pendentes locais (prevalecem) + Supabase não editados
            const allFilms = [...pendingFilmsFormatted, ...supabaseFilmsNotEdited];
            console.log('[OfflineFirst] Total de filmes retornados:', allFilms.length);

            return allFilms;
        } else {
            // Offline: buscar do cache local
            console.log('[OfflineFirst] Buscando filmes do cache local...');
            const localFilms = await offlineDb.getAllFilmsLocal();
            console.log('[OfflineFirst] Filmes locais encontrados:', localFilms.length);

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
            // Garantir que cada PDF tenha um ID (necessário para seleção na UI)
            return localPdfs.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...pdf }) => {
                // Se não tem ID, gera um ID temporário negativo baseado no _localId
                let finalId = _remoteId as number || pdf.id;
                if (!finalId && _localId) {
                    const timestamp = parseInt(_localId.split('_')[1] || String(Date.now()));
                    finalId = -timestamp;
                }
                return { ...pdf, id: finalId };
            });
        }
    } catch (error) {
        const localPdfs = await offlineDb.getAllPdfsLocal();
        return localPdfs.map(({ _localId, _syncStatus, _lastModified, _syncedAt, _remoteId, ...pdf }) => {
            let finalId = _remoteId as number || pdf.id;
            if (!finalId && _localId) {
                const timestamp = parseInt(_localId.split('_')[1] || String(Date.now()));
                finalId = -timestamp;
            }
            return { ...pdf, id: finalId };
        });
    }
}

export async function savePDF(pdf: SavedPDF): Promise<SavedPDF> {
    const localPdf = await offlineDb.savePdfLocal(pdf);

    if (isOnlineNow()) {
        syncAllPending().catch(console.error);
    }

    // Garantir que o PDF retornado tenha um ID (necessário para seleção na UI)
    // Usa _remoteId, ou pdf.id original, ou gera um ID temporário baseado no timestamp do _localId
    let finalId = localPdf._remoteId as number || pdf.id;
    if (!finalId && localPdf._localId) {
        // Gera um ID temporário negativo (para diferenciar de IDs reais que são positivos)
        const timestamp = parseInt(localPdf._localId.split('_')[1] || String(Date.now()));
        finalId = -timestamp; // ID negativo para identificar como local
        console.log('[OfflineFirst] Gerado ID temporário para PDF:', finalId);
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
