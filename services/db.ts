import { Client, Measurement, UserInfo, Film, SavedPDF, Agendamento, ProposalOption, ActiveTab } from '../types';
import { mockUserInfo } from './mockData';

// --- IndexedDB Setup (Simplified Wrapper) ---
const DB_NAME = 'PeliculasBrasilDB';
const DB_VERSION = 1;
const STORES = ['userInfo', 'clients', 'films', 'pdfs', 'agendamentos', 'proposalOptions'];

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            STORES.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    // Use 'id' as keyPath for all, autoIncrement for most, except userInfo
                    db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: storeName !== 'userInfo' && storeName !== 'films' && storeName !== 'proposalOptions' });
                }
            });
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            reject('Error opening database');
        };
    });
};

const transaction = async (storeName: string, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => void): Promise<any> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);

        tx.oncomplete = () => resolve(undefined);
        tx.onerror = (event) => reject((event.target as IDBRequest).error);

        try {
            callback(store);
        } catch (e) {
            reject(e);
        }
    });
};

const get = async (storeName: string, key: IDBValidKey): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        await transaction(storeName, 'readonly', (store) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    });
};

const getAll = async (storeName: string): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
        await transaction(storeName, 'readonly', (store) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    });
};

const put = async (storeName: string, value: any): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        await transaction(storeName, 'readwrite', (store) => {
            const request = store.put(value);
            request.onsuccess = () => resolve({ ...value, id: request.result || value.id });
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    });
};

const remove = async (storeName: string, key: IDBValidKey): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        await transaction(storeName, 'readwrite', (store) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    });
};

// --- Public API Functions ---

// User Info
export const getUserInfo = async (): Promise<UserInfo> => {
    const info = await get('userInfo', 'info');
    if (!info) {
        await put('userInfo', mockUserInfo);
        return mockUserInfo;
    }
    return info;
};

export const saveUserInfo = async (info: UserInfo): Promise<UserInfo> => {
    return put('userInfo', { ...info, id: 'info' });
};

// Clients
export const getAllClients = async (): Promise<Client[]> => {
    return getAll('clients');
};

export const saveClient = async (client: Omit<Client, 'id'> | Client): Promise<Client> => {
    const clientToSave: Client = { ...client, lastUpdated: new Date().toISOString() } as Client;
    return put('clients', clientToSave);
};

export const deleteClient = async (clientId: number): Promise<void> => {
    return remove('clients', clientId);
};

// Proposal Options (Measurements)
// Assuming proposalOptions store holds records keyed by clientId, containing an array of options.
export const getProposalOptions = async (clientId: number): Promise<ProposalOption[]> => {
    const record = await get('proposalOptions', clientId);
    return record ? record.options : [];
};

export const saveProposalOptions = async (clientId: number, options: ProposalOption[]): Promise<void> => {
    const proposalRecord = { id: clientId, options };
    await put('proposalOptions', proposalRecord);
};

export const deleteProposalOptions = async (clientId: number): Promise<void> => {
    return remove('proposalOptions', clientId);
};

// Films
export const getAllFilms = async (): Promise<Film[]> => {
    return getAll('films');
};

export const saveFilm = async (film: Film): Promise<Film> => {
    // Films are keyed by 'nome' (name)
    return put('films', { ...film, id: film.nome });
};

export const deleteFilm = async (filmName: string): Promise<void> => {
    return remove('films', filmName);
};

export const updateMeasurementFilmName = async (oldName: string, newName: string): Promise<void> => {
    // This is a complex operation requiring iteration over all proposal options.
    // Simplified implementation: iterate through all proposal option records and update the film name in measurements.
    const allProposalRecords: { id: number, options: ProposalOption[] }[] = await getAll('proposalOptions');
    
    const updatedRecords = allProposalRecords.map(record => {
        const updatedOptions = record.options.map(option => ({
            ...option,
            measurements: option.measurements.map(m => 
                m.pelicula === oldName ? { ...m, pelicula: newName } : m
            )
        }));
        return { ...record, options: updatedOptions };
    });
    
    await transaction('proposalOptions', 'readwrite', (store) => {
        updatedRecords.forEach(record => store.put(record));
    });
};

// PDFs
export const getPDFsForClient = async (clientId: number): Promise<SavedPDF[]> => {
    const allPdfs: SavedPDF[] = await getAll('pdfs');
    return allPdfs.filter(pdf => pdf.clienteId === clientId);
};

export const savePDF = async (pdf: Omit<SavedPDF, 'id'> | SavedPDF): Promise<SavedPDF> => {
    return put('pdfs', pdf);
};

export const deletePDF = async (pdfId: number): Promise<void> => {
    return remove('pdfs', pdfId);
};

export const getLatestPdfIdForClient = async (clientId: number): Promise<number | null> => {
    const pdfs = await getPDFsForClient(clientId);
    const latest = pdfs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return latest?.id || null;
};

// Agendamentos
export const getAllAgendamentos = async (): Promise<Agendamento[]> => {
    return getAll('agendamentos');
};

export const saveAgendamento = async (agendamento: Omit<Agendamento, 'id'> | Agendamento): Promise<Agendamento> => {
    return put('agendamentos', agendamento);
};

export const deleteAgendamento = async (agendamentoId: number): Promise<void> => {
    return remove('agendamentos', agendamentoId);
};

export const deleteAgendamentosForClient = async (clientId: number): Promise<void> => {
    const allAgendamentos: Agendamento[] = await getAll('agendamentos');
    const clientAgendamentos = allAgendamentos.filter(ag => ag.clienteId === clientId);
    
    await transaction('agendamentos', 'readwrite', (store) => {
        clientAgendamentos.forEach(ag => {
            if (ag.id) store.delete(ag.id);
        });
    });
};