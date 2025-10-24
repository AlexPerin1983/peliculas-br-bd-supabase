import { useState, useCallback } from 'react';
import { Client } from '../../types';
import * as db from '../../services/db';

export const useClients = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

    const loadClients = useCallback(async (clientIdToSelect?: number) => {
        const storedClients = await db.getAllClients();
        setClients(storedClients);
        if (clientIdToSelect) {
            setSelectedClientId(clientIdToSelect);
        } else if (storedClients.length > 0) {
            setSelectedClientId(storedClients[0].id!);
        } else {
            setSelectedClientId(null);
        }
    }, []);

    const saveClient = useCallback(async (client: Omit<Client, 'id'>, mode: 'add' | 'edit', currentId?: number) => {
        let savedClient: Client;
        if (mode === 'edit' && currentId) {
            savedClient = await db.saveClient({ ...client, id: currentId });
            setClients(prev => prev.map(c => c.id === currentId ? savedClient : c));
        } else {
            savedClient = await db.saveClient(client);
            setClients(prev => [savedClient, ...prev]);
        }
        setSelectedClientId(savedClient.id!);
        return savedClient;
    }, []);

    const deleteClient = useCallback(async (clientId: number) => {
        await db.deleteClient(clientId);
        await db.deleteProposalOptions(clientId);
        
        const pdfsForClient = await db.getPDFsForClient(clientId);
        for (const pdf of pdfsForClient) {
            if (pdf.id) {
                await db.deletePDF(pdf.id);
            }
        }

        const remainingClients = clients.filter(c => c.id !== clientId);
        setClients(remainingClients);
        setSelectedClientId(remainingClients.length > 0 ? remainingClients[0].id! : null);
    }, [clients]);

    return {
        clients,
        selectedClientId,
        setSelectedClientId,
        loadClients,
        saveClient,
        deleteClient
    };
};