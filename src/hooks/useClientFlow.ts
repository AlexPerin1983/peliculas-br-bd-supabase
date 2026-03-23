import { Dispatch, SetStateAction, useCallback, useEffect, useMemo } from 'react';
import * as db from '../../services/db';
import { Client, SchedulingInfo, UserInfo } from '../../types';

type SetActiveTab = Dispatch<SetStateAction<'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores'>>;

interface UseClientFlowParams {
    clients: Client[];
    setClients: Dispatch<SetStateAction<Client[]>>;
    selectedClientId: number | null;
    setSelectedClientId: Dispatch<SetStateAction<number | null>>;
    setActiveTab: SetActiveTab;
    setActiveOptionId: Dispatch<SetStateAction<number | null>>;
    userInfo: UserInfo | null;
    setUserInfo: Dispatch<SetStateAction<UserInfo | null>>;
    clientModalMode: 'add' | 'edit';
    postClientSaveAction: 'openAgendamentoModal' | null;
    setPostClientSaveAction: Dispatch<SetStateAction<'openAgendamentoModal' | null>>;
    setClientTransitionKey: Dispatch<SetStateAction<number>>;
    setIsClientModalOpen: Dispatch<SetStateAction<boolean>>;
    setNewClientName: Dispatch<SetStateAction<string>>;
    setAiClientData: Dispatch<SetStateAction<Partial<Client> | undefined>>;
    setIsDeleteClientModalOpen: Dispatch<SetStateAction<boolean>>;
    loadClients: (clientIdToSelect?: number, shouldReorder?: boolean) => Promise<void>;
    loadAllPdfs: () => Promise<void>;
    loadAgendamentos: () => Promise<void>;
    hasLoadedHistory: boolean;
    hasLoadedAgendamentos: boolean;
    handleOpenAgendamentoModal: (info: SchedulingInfo) => void;
}

export function useClientFlow({
    clients,
    setClients,
    selectedClientId,
    setSelectedClientId,
    setActiveTab,
    setActiveOptionId,
    userInfo,
    setUserInfo,
    clientModalMode,
    postClientSaveAction,
    setPostClientSaveAction,
    setClientTransitionKey,
    setIsClientModalOpen,
    setNewClientName,
    setAiClientData,
    setIsDeleteClientModalOpen,
    loadClients,
    loadAllPdfs,
    loadAgendamentos,
    hasLoadedHistory,
    hasLoadedAgendamentos,
    handleOpenAgendamentoModal
}: UseClientFlowParams) {
    useEffect(() => {
        if (selectedClientId !== null && userInfo && userInfo.lastSelectedClientId !== selectedClientId) {
            const updatedUserInfo = { ...userInfo, lastSelectedClientId: selectedClientId };
            setUserInfo(updatedUserInfo);
            db.saveUserInfo(updatedUserInfo);
        }

        setClientTransitionKey(previous => previous + 1);
    }, [selectedClientId, userInfo, setUserInfo, setClientTransitionKey]);

    const selectedClient = useMemo(() => {
        return clients.find(client => client.id === selectedClientId) || null;
    }, [clients, selectedClientId]);

    const handleSaveClient = useCallback(async (client: Omit<Client, 'id'>) => {
        let savedClient: Client;

        if (clientModalMode === 'edit' && selectedClientId) {
            savedClient = await db.saveClient({ ...client, id: selectedClientId });
        } else {
            savedClient = await db.saveClient(client);
        }

        await loadClients(savedClient.id!);
        setIsClientModalOpen(false);
        setNewClientName('');
        setAiClientData(undefined);

        if (postClientSaveAction === 'openAgendamentoModal') {
            handleOpenAgendamentoModal({
                agendamento: { clienteId: savedClient.id }
            });
            setPostClientSaveAction(null);
        }
    }, [
        clientModalMode,
        selectedClientId,
        loadClients,
        setIsClientModalOpen,
        setNewClientName,
        setAiClientData,
        postClientSaveAction,
        handleOpenAgendamentoModal,
        setPostClientSaveAction
    ]);

    const handleConfirmDeleteClient = useCallback(() => {
        if (!selectedClientId) return;

        const idToDelete = selectedClientId;
        setIsDeleteClientModalOpen(false);

        setClients(previous => {
            const updatedClients = previous.filter(client => client.id !== idToDelete);

            if (selectedClientId === idToDelete) {
                if (updatedClients.length > 0) {
                    setSelectedClientId(updatedClients[0].id!);
                } else {
                    setSelectedClientId(null);
                }
            }

            return updatedClients;
        });

        setTimeout(async () => {
            try {
                await db.deleteClient(idToDelete);
                await db.deleteProposalOptions(idToDelete);

                const pdfsForClient = await db.getPDFsForClient(idToDelete);
                for (const pdf of pdfsForClient) {
                    if (pdf.id) {
                        await db.deletePDF(pdf.id);
                    }
                }

                if (hasLoadedHistory) {
                    loadAllPdfs();
                }
                if (hasLoadedAgendamentos) {
                    loadAgendamentos();
                }
            } catch (error) {
                console.error('Erro ao deletar cliente no background:', error);
                loadClients();
            }
        }, 50);
    }, [
        selectedClientId,
        setIsDeleteClientModalOpen,
        setClients,
        setSelectedClientId,
        hasLoadedHistory,
        hasLoadedAgendamentos,
        loadAllPdfs,
        loadAgendamentos,
        loadClients
    ]);

    const handleToggleClientPin = useCallback(async (clientId: number) => {
        const client = clients.find(item => item.id === clientId);
        if (!client) return;

        const isPinned = !client.pinned;
        const updatedClient = {
            ...client,
            pinned: isPinned,
            pinnedAt: isPinned ? Date.now() : undefined
        };

        await db.saveClient(updatedClient);
        await loadClients();
    }, [clients, loadClients]);

    const goToNextClient = useCallback(() => {
        if (clients.length <= 1 || !selectedClientId) return;

        const currentIndex = clients.findIndex(client => client.id === selectedClientId);
        const nextIndex = (currentIndex + 1) % clients.length;
        setSelectedClientId(clients[nextIndex].id!);
    }, [clients, selectedClientId, setSelectedClientId]);

    const goToPrevClient = useCallback(() => {
        if (clients.length <= 1 || !selectedClientId) return;

        const currentIndex = clients.findIndex(client => client.id === selectedClientId);
        const prevIndex = (currentIndex - 1 + clients.length) % clients.length;
        setSelectedClientId(clients[prevIndex].id!);
    }, [clients, selectedClientId, setSelectedClientId]);

    const handleNavigateToOption = useCallback((clientId: number, optionId: number) => {
        setActiveTab('client');
        setSelectedClientId(clientId);
        setActiveOptionId(optionId);
    }, [setActiveOptionId, setActiveTab, setSelectedClientId]);

    return {
        selectedClient,
        handleSaveClient,
        handleConfirmDeleteClient,
        handleToggleClientPin,
        goToNextClient,
        goToPrevClient,
        handleNavigateToOption
    };
}
