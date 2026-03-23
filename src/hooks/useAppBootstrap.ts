import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react';
import { Agendamento, Client, Film, SavedPDF, UserInfo } from '../../types';
import * as db from '../../services/db';
import * as estoqueDb from '../../services/estoqueDb';
import { initSyncService } from '../../services/syncService';

interface UseAppBootstrapParams {
    authUserId?: string;
    lastSelectedClientId?: number | null;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    setClients: Dispatch<SetStateAction<Client[]>>;
    setSelectedClientId: Dispatch<SetStateAction<number | null>>;
    setUserInfo: Dispatch<SetStateAction<UserInfo | null>>;
    setFilms: Dispatch<SetStateAction<Film[]>>;
    setAllSavedPdfs: Dispatch<SetStateAction<SavedPDF[]>>;
    setAgendamentos: Dispatch<SetStateAction<Agendamento[]>>;
    setHasLoadedHistory: Dispatch<SetStateAction<boolean>>;
    setHasLoadedAgendamentos: Dispatch<SetStateAction<boolean>>;
}

export function useAppBootstrap({
    authUserId,
    lastSelectedClientId,
    setIsLoading,
    setClients,
    setSelectedClientId,
    setUserInfo,
    setFilms,
    setAllSavedPdfs,
    setAgendamentos,
    setHasLoadedHistory,
    setHasLoadedAgendamentos
}: UseAppBootstrapParams) {
    const lastSelectedClientIdRef = useRef<number | null | undefined>(lastSelectedClientId);

    useEffect(() => {
        lastSelectedClientIdRef.current = lastSelectedClientId;
    }, [lastSelectedClientId]);

    const loadClients = useCallback(async (clientIdToSelect?: number, shouldReorder = true) => {
        const storedClients = await db.getAllClients();

        let finalClients = storedClients;
        if (shouldReorder) {
            finalClients = [...storedClients].sort((a, b) => {
                const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
                const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
                return dateB - dateA;
            });
        }

        setClients(finalClients);

        let idToSelect = clientIdToSelect;
        const lastKnownSelectedClientId = lastSelectedClientIdRef.current;

        if (!idToSelect && lastKnownSelectedClientId) {
            const lastClient = finalClients.find(client => client.id === lastKnownSelectedClientId);
            if (lastClient) {
                idToSelect = lastClient.id;
            }
        }

        if (idToSelect) {
            setSelectedClientId(idToSelect);
        } else if (finalClients.length > 0) {
            setSelectedClientId(finalClients[0].id!);
        } else {
            setSelectedClientId(null);
        }
    }, [setClients, setSelectedClientId]);

    const loadFilms = useCallback(async () => {
        const customFilms = await db.getAllCustomFilms();
        const sortedFilms = [...customFilms].sort((a, b) => a.nome.localeCompare(b.nome));
        setFilms(sortedFilms);
    }, [setFilms]);

    const loadAllPdfs = useCallback(async () => {
        const pdfs = await db.getAllPDFs();
        setAllSavedPdfs(pdfs);
    }, [setAllSavedPdfs]);

    const loadAgendamentos = useCallback(async () => {
        const data = await db.getAllAgendamentos();
        setAgendamentos(data);
    }, [setAgendamentos]);

    useEffect(() => {
        initSyncService();
    }, []);

    useEffect(() => {
        let isCancelled = false;

        const bootstrap = async () => {
            if (!authUserId) {
                if (!isCancelled) {
                    setIsLoading(false);
                }
                return;
            }

            if (!isCancelled) {
                setIsLoading(true);
            }

            const [loadedUserInfo] = await Promise.all([
                db.getUserInfo(),
                loadClients(),
                loadFilms(),
                loadAllPdfs(),
                loadAgendamentos(),
                estoqueDb.getAllBobinas(),
                estoqueDb.getAllRetalhos(),
                estoqueDb.getEstoqueStats()
            ]);

            if (isCancelled) {
                return;
            }

            setHasLoadedHistory(true);
            setHasLoadedAgendamentos(true);
            setUserInfo(loadedUserInfo);

            const migrationKey = 'peliculas-br-bd-pdf_migration_v1';
            const migrationCompleted = localStorage.getItem(migrationKey);

            if (!migrationCompleted) {
                try {
                    await db.migratePDFsWithProposalOptionId();
                    localStorage.setItem(migrationKey, 'true');
                } catch (error) {
                    console.error('Erro na migracao automatica:', error);
                }
            }

            setIsLoading(false);
        };

        bootstrap();

        return () => {
            isCancelled = true;
        };
    }, [
        authUserId,
        loadAgendamentos,
        loadAllPdfs,
        loadClients,
        loadFilms,
        setHasLoadedAgendamentos,
        setHasLoadedHistory,
        setIsLoading,
        setUserInfo
    ]);

    return {
        loadClients,
        loadFilms,
        loadAllPdfs,
        loadAgendamentos
    };
}
