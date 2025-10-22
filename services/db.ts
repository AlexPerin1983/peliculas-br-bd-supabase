import { Client, Measurement, UserInfo, Film, SavedPDF, Agendamento } from '../types';
import { mockUserInfo } from './mockData';

const DB_NAME = 'ClientesDB';
const DB_VERSION = 5;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const transaction = (event.target as IDBOpenDBRequest).transaction;

            if (!db.objectStoreNames.contains('clientes')) {
                db.createObjectStore('clientes', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('medidas')) {
                db.createObjectStore('medidas', { keyPath: 'clienteId' });
            }
            if (!db.objectStoreNames.contains('usuario')) {
                db.createObjectStore('usuario', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('peliculas_personalizadas')) {
                db.createObjectStore('peliculas_personalizadas', { keyPath: 'nome' });
            }
            if (!db.objectStoreNames.contains('pdfs_salvos')) {
                const pdfStore = db.createObjectStore('pdfs_salvos', { keyPath: 'id', autoIncrement: true });
                pdfStore.createIndex('clienteId', 'clienteId', { unique: false });
            }
            
            if (event.oldVersion < 5) {
                if (!db.objectStoreNames.contains('agendamentos')) {
                    const appointmentStore = db.createObjectStore('agendamentos', { keyPath: 'id', autoIncrement: true });
                    appointmentStore.createIndex('pdfId', 'pdfId', { unique: false });
                    appointmentStore.createIndex('clienteId', 'clienteId', { unique: false });
                    appointmentStore.createIndex('start', 'start', { unique: false });
                }
            }


            // Populate with default data only on initial database creation
            if (event.oldVersion < 1) {
                const userStore = transaction!.objectStore('usuario');
                userStore.put(mockUserInfo);
            }

            // Migration for v4: Update PIX key type from 'cpf_cnpj' to null
            if (event.oldVersion < 4) {
                const userStore = transaction!.objectStore('usuario');
                const getRequest = userStore.get('info');
                getRequest.onsuccess = () => {
                    const userInfo = getRequest.result as UserInfo;
                    if (userInfo && userInfo.payment_methods) {
                        const updatedMethods = userInfo.payment_methods.map(method => {
                            if (method.tipo === 'pix' && (method.tipo_chave_pix as any) === 'cpf_cnpj') {
                                // Reset to null, forcing the user to select either CPF or CNPJ.
                                return { ...method, tipo_chave_pix: null };
                            }
                            return method;
                        });
                        const updatedUserInfo = { ...userInfo, payment_methods: updatedMethods };
                        userStore.put(updatedUserInfo);
                    }
                };
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            console.error("Database error:", request.error);
            dbPromise = null; // Reset promise on error
            reject(request.error);
        };
    });

    return dbPromise;
};

// Generic CRUD functions
const getStore = async (storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> => {
    const db = await openDB();
    return db.transaction(storeName, mode).objectStore(storeName);
};

const dbGet = async <T,>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
    });
};

const dbGetAll = async <T,>(storeName: string): Promise<T[]> => {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
    });
};

const dbPut = async <T,>(storeName: string, value: any): Promise<T> => {
    // We get the store and transaction. We will wait for the transaction to complete
    // to ensure data is fully persisted before resolving the promise.
    const store = await getStore(storeName, 'readwrite');
    const transaction = store.transaction;
    
    return new Promise<T>((resolve, reject) => {
        const request = store.put(value);

        // The 'oncomplete' event fires after all requests in the transaction have completed
        // successfully and the changes have been committed to the database.
        // This is a more robust approach than resolving on 'request.onsuccess', as it
        // guarantees data persistence and prevents potential race conditions where the
        // application state might be updated before the data is saved.
        transaction.oncomplete = () => {
            // When adding a new item to a store with an auto-incrementing key,
            // 'value.id' will be undefined. After the 'put' operation, 'request.result'
            // will hold the newly generated ID. We construct the complete object to return.
            if (value.id === undefined && typeof request.result !== 'undefined') {
                resolve({ ...value, id: request.result } as T);
            } else {
                // For updates, the original 'value' object already contains the correct ID.
                resolve(value as T);
            }
        };

        // If any request in the transaction fails, the transaction is aborted
        // and this event fires.
        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
};

const dbDelete = async (storeName: string, key: IDBValidKey): Promise<void> => {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

// Client functions
export const getAllClients = () => dbGetAll<Client>('clientes');
export const saveClient = (client: Omit<Client, 'id'> | Client) => dbPut<Client>('clientes', client);
export const deleteClient = (id: number) => dbDelete('clientes', id);

// Measurement functions
export const getMeasurements = async (clientId: number): Promise<Measurement[] | null> => {
    const result = await dbGet<{ clienteId: number, medidas: Measurement[] }>('medidas', clientId);
    return result ? result.medidas : null;
};
export const saveMeasurements = (clientId: number, medidas: Measurement[]) => dbPut('medidas', { clienteId: clientId, medidas });
export const deleteMeasurements = (clientId: number) => dbDelete('medidas', clientId);

// UserInfo functions
export const getUserInfo = async (): Promise<UserInfo> => {
    const infoFromDb = await dbGet<UserInfo>('usuario', 'info');
    // Merge with mock data to provide defaults for fields that might be missing in an older DB.
    // This ensures the UserInfo object is always complete.
    return { ...mockUserInfo, ...(infoFromDb || {}) };
};
export const saveUserInfo = (userInfo: UserInfo) => dbPut<UserInfo>('usuario', userInfo);

// Custom Film functions
export const getAllCustomFilms = () => dbGetAll<Film>('peliculas_personalizadas');
export const saveCustomFilm = (film: Film) => dbPut<Film>('peliculas_personalizadas', film);
export const deleteCustomFilm = (filmName: string) => dbDelete('peliculas_personalizadas', filmName);

// Saved PDF functions
export const savePDF = (pdfData: Omit<SavedPDF, 'id'>) => dbPut<SavedPDF>('pdfs_salvos', pdfData);
export const updatePDF = (pdfData: SavedPDF) => dbPut<SavedPDF>('pdfs_salvos', pdfData);
export const getAllPDFs = () => dbGetAll<SavedPDF>('pdfs_salvos');
export const getPDFsForClient = async (clientId: number): Promise<SavedPDF[]> => {
    const store = await getStore('pdfs_salvos', 'readonly');
    const index = store.index('clienteId');
    return new Promise((resolve, reject) => {
        const request = index.getAll(clientId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};
export const deletePDF = async (id: number) => {
    const pdf = await dbGet<SavedPDF>('pdfs_salvos', id);
    if (pdf && pdf.agendamentoId) {
        await deleteAgendamento(pdf.agendamentoId);
    }
    return dbDelete('pdfs_salvos', id);
};

// Agendamento functions
export const getAllAgendamentos = () => dbGetAll<Agendamento>('agendamentos');
export const saveAgendamento = (agendamento: Agendamento | Omit<Agendamento, 'id'>) => dbPut<Agendamento>('agendamentos', agendamento);
export const deleteAgendamento = (id: number) => dbDelete('agendamentos', id);
export const getAgendamentoByPdfId = async (pdfId: number): Promise<Agendamento | undefined> => {
    const store = await getStore('agendamentos', 'readonly');
    const index = store.index('pdfId');
    return new Promise((resolve, reject) => {
        const request = index.get(pdfId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};