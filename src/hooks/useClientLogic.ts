import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Client, Measurement, UserInfo, Film, PaymentMethods, SavedPDF, Agendamento, ProposalOption, SchedulingInfo, ExtractedClientData } from '../../types';
import * as db from '../../services/db';
import { generatePDF, generateCombinedPDF } from '../../services/pdfGenerator';
import { useAIProcessing } from './useAIProcessing';
import { useNumpad } from './useNumpad';

interface UseClientLogicProps {
    userInfo: UserInfo | null;
    setUserInfo: (info: UserInfo) => void;
    showError: (message: string) => void;
    postClientSaveAction: 'openAgendamentoModal' | null;
    setPostClientSaveAction: (action: 'openAgendamentoModal' | null) => void;

    hasLoadedHistory: boolean;
    loadAllPdfs: () => Promise<void>;
    hasLoadedAgendamentos: boolean;
    loadAgendamentos: () => Promise<void>;
    numpadConfig?: { isOpen: boolean }; // Optional if managed internally
    handleNumpadClose?: () => void; // Optional if managed internally
}

export const useClientLogic = ({
    userInfo,
    setUserInfo,
    showError,
    postClientSaveAction,
    setPostClientSaveAction,

    hasLoadedHistory,
    loadAllPdfs,
    hasLoadedAgendamentos,
    loadAgendamentos,
}: UseClientLogicProps) => {
    // --- States ---

    // Clients
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isClientSelectionModalOpen, setIsClientSelectionModalOpen] = useState(false);
    const [clientModalMode, setClientModalMode] = useState<'add' | 'edit'>('add');
    const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState<string>('');
    const [aiClientData, setAiClientData] = useState<Partial<Client> | undefined>(undefined);
    const [clientTransitionKey, setClientTransitionKey] = useState(0);
    const [isAIClientModalOpen, setIsAIClientModalOpen] = useState(false);

    // Films
    const [films, setFilms] = useState<Film[]>([]);
    const [isFilmModalOpen, setIsFilmModalOpen] = useState(false);
    const [editingFilm, setEditingFilm] = useState<Film | null>(null);
    const [isFilmSelectionModalOpen, setIsFilmSelectionModalOpen] = useState(false);
    const [isApplyFilmToAllModalOpen, setIsApplyFilmToAllModalOpen] = useState(false);
    const [newFilmName, setNewFilmName] = useState<string>('');
    const [filmToApplyToAll, setFilmToApplyToAll] = useState<string | null>(null);
    const [editingMeasurementIdForFilm, setEditingMeasurementIdForFilm] = useState<number | null>(null);
    const [filmToDeleteName, setFilmToDeleteName] = useState<string | null>(null);
    const [isAIFilmModalOpen, setIsAIFilmModalOpen] = useState(false);
    const [aiFilmData, setAiFilmData] = useState<Partial<Film> | undefined>(undefined);

    // Proposal Options & Measurements
    const [proposalOptions, setProposalOptions] = useState<ProposalOption[]>([]);
    const [activeOptionId, setActiveOptionId] = useState<number | null>(null);
    const [editingMeasurement, setEditingMeasurement] = useState<(Measurement & { isNew?: boolean }) | null>(null);
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
    const [editingMeasurementForDiscount, setEditingMeasurementForDiscount] = useState<(Measurement & { isNew?: boolean }) | null>(null);
    const [isAIMeasurementModalOpen, setIsAIMeasurementModalOpen] = useState(false);
    const [isDuplicateAllModalOpen, setIsDuplicateAllModalOpen] = useState(false);
    const [measurementToDeleteId, setMeasurementToDeleteId] = useState<number | null>(null);
    const [deletedMeasurement, setDeletedMeasurement] = useState<(Measurement & { isNew?: boolean }) | null>(null);
    const [deletedMeasurementIndex, setDeletedMeasurementIndex] = useState<number | null>(null);
    const [showUndoToast, setShowUndoToast] = useState(false);

    // General UI/App State
    const [isLoading, setIsLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [pdfGenerationStatus, setPdfGenerationStatus] = useState<'idle' | 'generating' | 'success'>('idle');
    const [pdfToDeleteId, setPdfToDeleteId] = useState<number | null>(null);
    const [schedulingInfo, setSchedulingInfo] = useState<SchedulingInfo | null>(null);
    const [agendamentoToDelete, setAgendamentoToDelete] = useState<Agendamento | null>(null);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [apiKeyModalProvider, setApiKeyModalProvider] = useState<'gemini' | 'openai'>('gemini');
    const [isGeneralDiscountModalOpen, setIsGeneralDiscountModalOpen] = useState(false);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
    const [infoModalConfig, setInfoModalConfig] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
    const [isSaveBeforePdfModalOpen, setIsSaveBeforePdfModalOpen] = useState(false);
    const [isExitConfirmModalOpen, setIsExitConfirmModalOpen] = useState(false);

    // --- Derived State ---
    const selectedClient = useMemo(() => {
        return clients.find(c => c.id === selectedClientId) || null;
    }, [clients, selectedClientId]);

    const activeOption = useMemo(() => {
        return proposalOptions.find(opt => opt.id === activeOptionId) || null;
    }, [proposalOptions, activeOptionId]);

    const measurements = useMemo(() => activeOption?.measurements || [], [activeOption]);
    const generalDiscount = useMemo(() => activeOption?.generalDiscount || { value: '', type: 'percentage' as const }, [activeOption]);

    const totals = useMemo(() => {
        let totalM2 = 0;
        let totalQuantity = 0;
        let subtotal = 0;

        measurements.forEach(m => {
            const width = parseFloat(m.largura.replace(',', '.')) || 0;
            const height = parseFloat(m.altura.replace(',', '.')) || 0;
            const quantity = m.quantidade || 0;
            const area = width * height * quantity;
            totalM2 += area;
            totalQuantity += quantity;

            const film = films.find(f => f.nome === m.pelicula);
            if (film) {
                const pricePerM2 = film.preco || 0;
                let itemTotal = area * pricePerM2;

                if (m.discount) {
                    const discountValue = parseFloat(m.discount.value.replace(',', '.')) || 0;
                    if (m.discount.type === 'percentage') {
                        itemTotal -= itemTotal * (discountValue / 100);
                    } else {
                        itemTotal -= discountValue;
                    }
                }
                subtotal += itemTotal;
            }
        });

        let finalTotal = subtotal;
        if (generalDiscount.value) {
            const discountValue = parseFloat(generalDiscount.value.replace(',', '.')) || 0;
            if (generalDiscount.type === 'percentage') {
                finalTotal -= finalTotal * (discountValue / 100);
            } else {
                finalTotal -= discountValue;
            }
        }

        return { totalM2, totalQuantity, subtotal, finalTotal };
    }, [measurements, films, generalDiscount]);

    // --- Hooks ---
    const { processClientWithAI, processFilmWithAI, isProcessingAI } = useAIProcessing(userInfo, showError);

    const handleMeasurementsChange = useCallback((newMeasurements: Measurement[]) => {
        if (activeOptionId) {
            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? { ...opt, measurements: newMeasurements } : opt
            ));
            setIsDirty(true);
        }
    }, [activeOptionId]);

    const {
        numpadConfig,
        openNumpad: handleOpenNumpad,
        closeNumpad: handleNumpadClose,
        handleInput: handleNumpadInput,
        handleDelete: handleNumpadDelete,
        handleDone: handleNumpadDone,
        handleClear: handleNumpadClear
    } = useNumpad(measurements, handleMeasurementsChange);

    // --- Handlers ---

    // Agendamentos Helper
    const handleOpenAgendamentoModal = useCallback((pdf?: SavedPDF, agendamento?: Agendamento) => {
        if (pdf) {
            setSchedulingInfo({ pdf });
        } else if (agendamento) {
            setSchedulingInfo({ agendamento });
        } else {
            setSchedulingInfo({ agendamento: {} });
        }
    }, []);

    // Clients
    const loadClients = useCallback(async (clientIdToSelect?: number, shouldReorder: boolean = true) => {
        const storedClients = await db.getAllClients();
        let finalClients = storedClients;

        if (shouldReorder) {
            finalClients = storedClients.sort((a, b) => {
                const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
                const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
                return dateB - dateA;
            });
        }

        setClients(finalClients);

        let idToSelect = clientIdToSelect;
        if (!idToSelect && userInfo?.lastSelectedClientId) {
            const lastClient = finalClients.find(c => c.id === userInfo.lastSelectedClientId);
            if (lastClient) idToSelect = lastClient.id;
        }

        if (idToSelect) {
            setSelectedClientId(idToSelect);
        } else if (finalClients.length > 0) {
            setSelectedClientId(finalClients[0].id!);
        } else {
            setSelectedClientId(null);
        }
    }, [userInfo?.lastSelectedClientId]);

    const handleOpenClientModal = useCallback((mode: 'add' | 'edit') => {
        if (numpadConfig.isOpen) handleNumpadClose();
        setClientModalMode(mode);
        if (mode === 'edit' && !selectedClientId) {
            showError('Selecione um cliente para editar.');
            return;
        }
        setAiClientData(undefined);
        setIsClientModalOpen(true);
    }, [selectedClientId, numpadConfig.isOpen, handleNumpadClose, showError]);

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
            handleOpenAgendamentoModal({ agendamento: { clienteId: savedClient.id } });
            setPostClientSaveAction(null);
        }
    }, [clientModalMode, selectedClientId, postClientSaveAction, handleOpenAgendamentoModal, loadClients, setPostClientSaveAction]);

    const handleDeleteClient = useCallback(() => {
        if (numpadConfig.isOpen) handleNumpadClose();
        if (!selectedClientId) return;
        setIsDeleteClientModalOpen(true);
    }, [selectedClientId, numpadConfig.isOpen, handleNumpadClose]);

    const handleConfirmDeleteClient = useCallback(async () => {
        if (!selectedClientId) return;
        await db.deleteClient(selectedClientId);
        await db.deleteProposalOptions(selectedClientId);
        const pdfsForClient = await db.getPDFsForClient(selectedClientId);
        for (const pdf of pdfsForClient) {
            if (pdf.id) await db.deletePDF(pdf.id);
        }
        await loadClients();
        if (hasLoadedHistory) await loadAllPdfs();
        if (hasLoadedAgendamentos) await loadAgendamentos();
        setIsDeleteClientModalOpen(false);
    }, [selectedClientId, hasLoadedHistory, loadAllPdfs, hasLoadedAgendamentos, loadAgendamentos, loadClients]);

    const handleOpenClientSelectionModal = useCallback(() => {
        if (numpadConfig.isOpen) handleNumpadClose();
        setIsClientSelectionModalOpen(true);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleAddNewClientFromSelection = useCallback((clientName: string) => {
        setIsClientSelectionModalOpen(false);
        setClientModalMode('add');
        setNewClientName(clientName);
        setAiClientData(undefined);
        setIsClientModalOpen(true);
    }, []);

    const handleToggleClientPin = useCallback(async (clientId: number) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            const isPinned = !client.pinned;
            const updatedClient = { ...client, pinned: isPinned, pinnedAt: isPinned ? Date.now() : undefined };
            await db.saveClient(updatedClient);
            await loadClients();
        }
    }, [clients, loadClients]);

    const handleOpenAIClientModal = useCallback(() => {
        setIsClientModalOpen(false);
        setIsAIClientModalOpen(true);
    }, []);

    const goToNextClient = useCallback(() => {
        if (clients.length <= 1 || !selectedClientId) return;
        const currentIndex = clients.findIndex(c => c.id === selectedClientId);
        const nextIndex = (currentIndex + 1) % clients.length;
        setSelectedClientId(clients[nextIndex].id!);
    }, [clients, selectedClientId]);

    const goToPrevClient = useCallback(() => {
        if (clients.length <= 1 || !selectedClientId) return;
        const currentIndex = clients.findIndex(c => c.id === selectedClientId);
        const prevIndex = (currentIndex - 1 + clients.length) % clients.length;
        setSelectedClientId(clients[prevIndex].id!);
    }, [clients, selectedClientId]);

    // Films
    const loadFilms = useCallback(async () => {
        const customFilms = await db.getAllCustomFilms();
        const sortedFilms = customFilms.sort((a, b) => a.nome.localeCompare(b.nome));
        setFilms(sortedFilms);
    }, []);

    const handleOpenFilmModal = useCallback((film: Film | null) => {
        setEditingFilm(film);
        setNewFilmName(film ? film.nome : '');
        setAiFilmData(undefined);
        setIsFilmModalOpen(true);
    }, []);

    const handleSaveFilm = useCallback(async (film: Film) => {
        await db.saveCustomFilm(film);
        await loadFilms();
        setIsFilmModalOpen(false);
        setEditingFilm(null);
        setNewFilmName('');
        setAiFilmData(undefined);
    }, [loadFilms]);

    const handleDeleteFilm = useCallback(async (filmName: string) => {
        await db.deleteCustomFilm(filmName);
        await loadFilms();
        setIsFilmModalOpen(false);
        setEditingFilm(null);
    }, [loadFilms]);

    const handleRequestDeleteFilm = useCallback((film: Film) => {
        setFilmToDeleteName(film.nome);
        setEditingFilm(film); // Use editingFilm to store the film to delete temporarily or use a separate state
        // Actually we need the ID, so let's use editingFilm
        setIsFilmModalOpen(false); // Close edit modal if open
        // We need a confirmation modal for this
        // Assuming ConfirmationModal uses filmToDeleteName
    }, []);

    const handleConfirmDeleteFilm = useCallback(async () => {
        if (filmToDeleteName) {
            await handleDeleteFilm(filmToDeleteName);
            setFilmToDeleteName(null);
        }
    }, [filmToDeleteName, handleDeleteFilm]);

    const handleOpenFilmSelectionModal = useCallback((measurementId: number) => {
        setEditingMeasurementIdForFilm(measurementId);
        setIsFilmSelectionModalOpen(true);
    }, []);

    const handleSelectFilmForMeasurement = useCallback((filmName: string) => {
        if (editingMeasurementIdForFilm !== null && activeOptionId) {
            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? {
                    ...opt,
                    measurements: opt.measurements.map(m =>
                        m.id === editingMeasurementIdForFilm ? { ...m, pelicula: filmName } : m
                    )
                } : opt
            ));
            setIsDirty(true);
            setIsFilmSelectionModalOpen(false);
            setEditingMeasurementIdForFilm(null);
        }
    }, [editingMeasurementIdForFilm, activeOptionId]);

    const handleAddNewFilmFromSelection = useCallback((filmName: string) => {
        setIsFilmSelectionModalOpen(false);
        handleOpenFilmModal({ id: 0, nome: filmName, preco: 0 } as Film); // 0 id indicates new
    }, [handleOpenFilmModal]);

    const handleEditFilmFromSelection = useCallback((film: Film) => {
        setIsFilmSelectionModalOpen(false);
        handleOpenFilmModal(film);
    }, [handleOpenFilmModal]);

    const handleToggleFilmPin = useCallback(async (filmId: number) => {
        const film = films.find(f => f.id === filmId);
        if (film) {
            const isPinned = !film.pinned;
            await db.saveCustomFilm({ ...film, pinned: isPinned, pinnedAt: isPinned ? Date.now() : undefined });
            await loadFilms();
        }
    }, [films, loadFilms]);

    const handleApplyFilmToAll = useCallback((filmName: string) => {
        setFilmToApplyToAll(filmName);
        setIsApplyFilmToAllModalOpen(true);
    }, []);

    const handleConfirmApplyFilmToAll = useCallback(() => {
        if (filmToApplyToAll && activeOptionId) {
            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? {
                    ...opt,
                    measurements: opt.measurements.map(m => ({ ...m, pelicula: filmToApplyToAll }))
                } : opt
            ));
            setIsDirty(true);
            setIsApplyFilmToAllModalOpen(false);
            setFilmToApplyToAll(null);
            setIsFilmSelectionModalOpen(false);
        }
    }, [filmToApplyToAll, activeOptionId]);

    // Proposal Options
    const loadProposalOptions = useCallback(async (clientId: number) => {
        const options = await db.getProposalOptions(clientId);
        if (options.length === 0) {
            // Create default option
            const defaultOption: ProposalOption = {
                id: Date.now(),
                name: 'Opção 1',
                measurements: [],
                generalDiscount: { value: '', type: 'percentage' }
            };
            setProposalOptions([defaultOption]);
            setActiveOptionId(defaultOption.id);
        } else {
            setProposalOptions(options);
            setActiveOptionId(options[0].id);
        }
    }, []);

    const handleAddProposalOption = useCallback(() => {
        setProposalOptions(prev => {
            const newOption: ProposalOption = {
                id: Date.now(),
                name: `Opção ${prev.length + 1}`,
                measurements: [],
                generalDiscount: { value: '', type: 'percentage' }
            };
            const newOptions = [...prev, newOption];
            setActiveOptionId(newOption.id);
            return newOptions;
        });
        setIsDirty(true);
    }, []);

    const handleRenameProposalOption = useCallback((id: number, newName: string) => {
        setProposalOptions(prev => prev.map(opt => opt.id === id ? { ...opt, name: newName } : opt));
        setIsDirty(true);
    }, []);

    const handleDeleteProposalOption = useCallback((id: number) => {
        setProposalOptions(prev => {
            const newOptions = prev.filter(opt => opt.id !== id);
            if (newOptions.length === 0) {
                // Ensure at least one option exists
                const defaultOption: ProposalOption = {
                    id: Date.now(),
                    name: 'Opção 1',
                    measurements: [],
                    generalDiscount: { value: '', type: 'percentage' }
                };
                setActiveOptionId(defaultOption.id);
                return [defaultOption];
            }
            if (activeOptionId === id) {
                setActiveOptionId(newOptions[0].id);
            }
            return newOptions;
        });
        setIsDirty(true);
    }, [activeOptionId]);

    const handleSwipeDirectionChange = useCallback((direction: 'left' | 'right' | null) => {
        // Optional: handle visual feedback
    }, []);

    // Measurements
    const addMeasurement = useCallback(() => {
        if (!activeOptionId) return;
        const newMeasurement: Measurement = {
            id: Date.now(),
            largura: '',
            altura: '',
            quantidade: 1,
            ambiente: '',
            pelicula: '',
            discount: { value: '0', type: 'percentage' }
        };

        setProposalOptions(prev => prev.map(opt =>
            opt.id === activeOptionId ? { ...opt, measurements: [...opt.measurements, newMeasurement] } : opt
        ));
        setIsDirty(true);

        // Open numpad for the new measurement
        setTimeout(() => {
            handleOpenNumpad(newMeasurement.id, 'largura', '');
        }, 100);
    }, [activeOptionId, handleOpenNumpad]);

    const duplicateAllMeasurements = useCallback(() => {
        setIsDuplicateAllModalOpen(true);
    }, []);

    const handleConfirmDuplicateAll = useCallback(() => {
        if (!activeOptionId) return;
        setProposalOptions(prev => prev.map(opt => {
            if (opt.id === activeOptionId) {
                const duplicatedMeasurements = opt.measurements.map(m => ({
                    ...m,
                    id: Date.now() + Math.random(), // Ensure unique IDs
                }));
                return { ...opt, measurements: [...opt.measurements, ...duplicatedMeasurements] };
            }
            return opt;
        }));
        setIsDirty(true);
        setIsDuplicateAllModalOpen(false);
    }, [activeOptionId]);

    const handleOpenEditMeasurementModal = useCallback((measurement: Measurement) => {
        setEditingMeasurement(measurement);
    }, []);

    const handleCloseEditMeasurementModal = useCallback(() => {
        setEditingMeasurement(null);
    }, []);

    const handleUpdateEditingMeasurement = useCallback((updatedMeasurement: Measurement) => {
        if (activeOptionId) {
            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? {
                    ...opt,
                    measurements: opt.measurements.map(m => m.id === updatedMeasurement.id ? updatedMeasurement : m)
                } : opt
            ));
            setIsDirty(true);
            setEditingMeasurement(updatedMeasurement);
        }
    }, [activeOptionId]);

    const handleDeleteMeasurementFromEditModal = useCallback(() => {
        if (editingMeasurement && activeOptionId) {
            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? {
                    ...opt,
                    measurements: opt.measurements.filter(m => m.id !== editingMeasurement.id)
                } : opt
            ));
            setIsDirty(true);
            setEditingMeasurement(null);
        }
    }, [editingMeasurement, activeOptionId]);

    const handleDeleteMeasurementFromGroup = useCallback((id: number) => {
        setMeasurementToDeleteId(id);
    }, []);

    const handleConfirmDeleteIndividualMeasurement = useCallback(() => {
        if (measurementToDeleteId && activeOptionId) {
            // Find measurement for undo
            const option = proposalOptions.find(opt => opt.id === activeOptionId);
            const measurement = option?.measurements.find(m => m.id === measurementToDeleteId);
            const index = option?.measurements.findIndex(m => m.id === measurementToDeleteId);

            if (measurement && index !== undefined) {
                setDeletedMeasurement(measurement);
                setDeletedMeasurementIndex(index);
                setShowUndoToast(true);
            }

            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? {
                    ...opt,
                    measurements: opt.measurements.filter(m => m.id !== measurementToDeleteId)
                } : opt
            ));
            setIsDirty(true);
            setMeasurementToDeleteId(null);
        }
    }, [measurementToDeleteId, activeOptionId, proposalOptions]);

    const handleImmediateDeleteMeasurement = useCallback((id: number) => {
        if (activeOptionId) {
            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? {
                    ...opt,
                    measurements: opt.measurements.filter(m => m.id !== id)
                } : opt
            ));
            setIsDirty(true);
        }
    }, [activeOptionId]);

    const handleUndoDelete = useCallback(() => {
        if (deletedMeasurement && deletedMeasurementIndex !== null && activeOptionId) {
            setProposalOptions(prev => prev.map(opt => {
                if (opt.id === activeOptionId) {
                    const newMeasurements = [...opt.measurements];
                    newMeasurements.splice(deletedMeasurementIndex, 0, deletedMeasurement);
                    return { ...opt, measurements: newMeasurements };
                }
                return opt;
            }));
            setIsDirty(true);
            setDeletedMeasurement(null);
            setDeletedMeasurementIndex(null);
            setShowUndoToast(false);
        }
    }, [deletedMeasurement, deletedMeasurementIndex, activeOptionId]);

    const handleDismissUndo = useCallback(() => {
        setDeletedMeasurement(null);
        setDeletedMeasurementIndex(null);
        setShowUndoToast(false);
    }, []);

    const handleConfirmClearAll = useCallback(() => {
        if (activeOptionId) {
            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? { ...opt, measurements: [] } : opt
            ));
            setIsDirty(true);
            setIsClearAllModalOpen(false);
        }
    }, [activeOptionId]);

    // Discounts
    const handleOpenDiscountModal = useCallback((measurement: Measurement) => {
        setEditingMeasurementForDiscount(measurement);
    }, []);

    const handleCloseDiscountModal = useCallback(() => {
        setEditingMeasurementForDiscount(null);
    }, []);

    const handleSaveDiscount = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        if (editingMeasurementForDiscount && activeOptionId) {
            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? {
                    ...opt,
                    measurements: opt.measurements.map(m =>
                        m.id === editingMeasurementForDiscount.id ? { ...m, discount } : m
                    )
                } : opt
            ));
            setIsDirty(true);
            setEditingMeasurementForDiscount(null);
        }
    }, [editingMeasurementForDiscount, activeOptionId]);

    const handleGeneralDiscountChange = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        if (activeOptionId) {
            setProposalOptions(prev => prev.map(opt =>
                opt.id === activeOptionId ? { ...opt, generalDiscount: discount } : opt
            ));
            setIsDirty(true);
        }
    }, [activeOptionId]);

    const handleSaveGeneralDiscount = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        handleGeneralDiscountChange(discount);
        setIsGeneralDiscountModalOpen(false);
    }, [handleGeneralDiscountChange]);

    // PDF & Saving
    const handleSaveChanges = useCallback(async () => {
        if (!selectedClient) return;

        // Save client info
        await db.saveClient({ ...selectedClient, lastUpdated: new Date().toISOString() });

        // Save proposal options
        const updatedProposalOptions = proposalOptions.map(opt => ({
            ...opt,
            measurements: opt.measurements.map(({ isNew, ...m }) => m) // Remove isNew flag before saving
        }));
        await db.saveProposalOptions(selectedClient.id!, updatedProposalOptions);

        setIsDirty(false);
        // Optionally, trigger a refresh or show a success message
    }, [selectedClient, proposalOptions]);

    const handleGeneratePdf = useCallback(async () => {
        if (!selectedClient || !activeOption || !userInfo) return;

        if (isDirty) {
            setIsSaveBeforePdfModalOpen(true);
            return;
        }

        setPdfGenerationStatus('generating');
        try {
            const pdfBlob = await generatePDF(selectedClient, userInfo, activeOption.measurements, films, activeOption.generalDiscount, totals, activeOption.name);
            const savedPdf = await db.savePDF({
                clienteId: selectedClient.id!,
                clientName: selectedClient.nome,
                date: new Date().toISOString(),
                blob: pdfBlob,
                proposalOptionId: activeOption.id
            });

            // Open PDF
            const url = URL.createObjectURL(pdfBlob);
            window.open(url, '_blank');

            setPdfGenerationStatus('success');
            await loadAllPdfs();
        } catch (error) {
            console.error("Error generating PDF:", error);
            showError("Erro ao gerar PDF.");
            setPdfGenerationStatus('idle');
        }
    }, [selectedClient, activeOption, userInfo, films, totals, isDirty, loadAllPdfs, showError]);

    const handleConfirmSaveBeforePdf = useCallback(async () => {
        setIsSaveBeforePdfModalOpen(false);
        await handleSaveChanges();
        handleGeneratePdf();
    }, [handleSaveChanges, handleGeneratePdf]);

    const handleClosePdfStatusModal = useCallback(() => {
        setPdfGenerationStatus('idle');
    }, []);

    const handleGoToHistoryFromPdf = useCallback(() => {
        setPdfGenerationStatus('idle');
        // Navigation should be handled by App via a callback or effect if needed, 
        // but here we just close the modal.
        // If we need to change tab, we might need a prop or return a request.
    }, []);

    const handleConfirmDeletePdf = useCallback(async () => {
        if (pdfToDeleteId) {
            await db.deletePDF(pdfToDeleteId);
            await loadAllPdfs();
            setPdfToDeleteId(null);
        }
    }, [pdfToDeleteId, loadAllPdfs]);

    // Agendamentos
    const handleCloseAgendamentoModal = useCallback(() => {
        setSchedulingInfo(null);
    }, []);

    const handleSaveAgendamento = useCallback(async (agendamento: Agendamento) => {
        await db.saveAgendamento(agendamento);
        await loadAgendamentos();
        setSchedulingInfo(null);
    }, [loadAgendamentos]);

    const handleRequestDeleteAgendamento = useCallback((agendamento: Agendamento) => {
        setAgendamentoToDelete(agendamento);
    }, []);

    const handleConfirmDeleteAgendamento = useCallback(async () => {
        if (agendamentoToDelete && agendamentoToDelete.id) {
            await db.deleteAgendamento(agendamentoToDelete.id);
            await loadAgendamentos();
            setAgendamentoToDelete(null);
            setSchedulingInfo(null); // Close modal if open
        }
    }, [agendamentoToDelete, loadAgendamentos]);



    const handleAddNewClientFromAgendamento = useCallback((clientData: ExtractedClientData) => {
        setSchedulingInfo(null);
        setClientModalMode('add');
        setNewClientName(clientData.nome || '');
        setIsClientModalOpen(true);
    }, []);

    const handleCreateNewAgendamento = useCallback(() => {
        handleOpenAgendamentoModal();
    }, [handleOpenAgendamentoModal]);

    // AI Handlers
    const handleProcessAIInput = useCallback(async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        // This is for measurements AI - not implemented in useAIProcessing yet or handled differently
        // Assuming we might want to implement it later or it was there.
        // For now, let's just close the modal.
        setIsAIMeasurementModalOpen(false);
        showError("Funcionalidade de IA para medidas em desenvolvimento.");
    }, [showError]);

    const handleProcessAIClientInput = useCallback(async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        const data = await processClientWithAI(input);
        if (data) {
            setAiClientData(data);
            setIsAIClientModalOpen(false);
            setIsClientModalOpen(true);
            setClientModalMode('add'); // Or edit?
            if (data.nome) setNewClientName(data.nome);
        }
    }, [processClientWithAI]);

    const handleProcessAIFilmInput = useCallback(async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        const data = await processFilmWithAI(input);
        if (data) {
            setAiFilmData(data);
            setIsAIFilmModalOpen(false);
            setIsFilmModalOpen(true);
            if (data.nome) setNewFilmName(data.nome);
        }
    }, [processFilmWithAI]);

    const handleSaveApiKey = useCallback((key: string, provider: 'gemini' | 'openai') => {
        if (userInfo) {
            const updatedUserInfo = { ...userInfo, aiConfig: { apiKey: key, provider } };
            setUserInfo(updatedUserInfo);
            db.saveUserInfo(updatedUserInfo);
        }
        setIsApiKeyModalOpen(false);
    }, [userInfo, setUserInfo]);

    // Agendamentos


    // Gallery
    const handleOpenGallery = useCallback((images: string[], initialIndex: number = 0) => {
        setGalleryImages(images);
        setGalleryInitialIndex(initialIndex);
        setIsGalleryOpen(true);
    }, []);

    const handleCloseGallery = useCallback(() => {
        setIsGalleryOpen(false);
        setGalleryImages([]);
    }, []);

    // Info Modal
    const handleCloseInfoModal = useCallback(() => {
        setInfoModalConfig(prev => ({ ...prev, isOpen: false }));
    }, []);

    const handleShowInfo = useCallback((message: string, title: string = 'Informação') => {
        setInfoModalConfig({ isOpen: true, title, message });
    }, []);

    // Misc
    const handleNumpadAddGroup = useCallback(() => {
        // Logic to add a group of measurements?
        // For now, just close numpad
        handleNumpadClose();
    }, [handleNumpadClose]);

    const handleNumpadDuplicate = useCallback(() => {
        if (numpadConfig.measurementId && activeOptionId) {
            const option = proposalOptions.find(opt => opt.id === activeOptionId);
            const measurement = option?.measurements.find(m => m.id === numpadConfig.measurementId);
            if (measurement) {
                const newMeasurement = { ...measurement, id: Date.now() };
                setProposalOptions(prev => prev.map(opt =>
                    opt.id === activeOptionId ? { ...opt, measurements: [...opt.measurements, newMeasurement] } : opt
                ));
                setIsDirty(true);
            }
        }
    }, [numpadConfig.measurementId, activeOptionId, proposalOptions]);

    const handleUpdate = useCallback(() => {
        window.location.reload();
    }, []);

    const handleSavePaymentMethods = useCallback(async (methods: PaymentMethods) => {
        if (userInfo) {
            const updatedUserInfo = { ...userInfo, paymentMethods: methods };
            setUserInfo(updatedUserInfo);
            await db.saveUserInfo(updatedUserInfo);
            setIsPaymentModalOpen(false);
        }
    }, [userInfo, setUserInfo]);

    // Effects
    useEffect(() => {
        loadFilms();
    }, [loadFilms]);

    useEffect(() => {
        loadClients();
    }, [loadClients]);

    useEffect(() => {
        if (selectedClientId) {
            loadProposalOptions(selectedClientId);
        } else {
            setProposalOptions([]);
            setActiveOptionId(null);
        }
    }, [selectedClientId, loadProposalOptions]);

    useEffect(() => {
        if (selectedClientId !== null && userInfo && userInfo.lastSelectedClientId !== selectedClientId) {
            const updatedUserInfo = { ...userInfo, lastSelectedClientId: selectedClientId };
            setUserInfo(updatedUserInfo);
            db.saveUserInfo(updatedUserInfo);
        }
        setClientTransitionKey(prev => prev + 1);
    }, [selectedClientId, userInfo, setUserInfo]);

    return {
        // State
        clients,
        setClients,
        selectedClientId,
        setSelectedClientId,
        selectedClient,
        isClientModalOpen,
        setIsClientModalOpen,
        isClientSelectionModalOpen,
        setIsClientSelectionModalOpen,
        clientModalMode,
        setClientModalMode,
        isDeleteClientModalOpen,
        setIsDeleteClientModalOpen,
        newClientName,
        setNewClientName,
        aiClientData,
        setAiClientData,
        clientTransitionKey,
        isAIClientModalOpen,
        setIsAIClientModalOpen,
        films,
        isFilmModalOpen,
        setIsFilmModalOpen,
        editingFilm,
        setEditingFilm,
        isFilmSelectionModalOpen,
        setIsFilmSelectionModalOpen,
        isApplyFilmToAllModalOpen,
        setIsApplyFilmToAllModalOpen,
        newFilmName,
        setNewFilmName,
        filmToApplyToAll,
        setFilmToApplyToAll,
        editingMeasurementIdForFilm,
        setEditingMeasurementIdForFilm,
        filmToDeleteName,
        setFilmToDeleteName,
        isAIFilmModalOpen,
        setIsAIFilmModalOpen,
        aiFilmData,
        setAiFilmData,
        proposalOptions,
        activeOptionId,
        setActiveOptionId,
        activeOption,
        measurements,
        totals,
        generalDiscount,
        editingMeasurement,
        isClearAllModalOpen,
        setIsClearAllModalOpen,
        editingMeasurementForDiscount,
        isAIMeasurementModalOpen,
        setIsAIMeasurementModalOpen,
        isDuplicateAllModalOpen,
        setIsDuplicateAllModalOpen,
        measurementToDeleteId,
        setMeasurementToDeleteId,
        deletedMeasurement,
        showUndoToast,
        isLoading,
        setIsLoading,
        isDirty,
        isPaymentModalOpen,
        setIsPaymentModalOpen,
        pdfGenerationStatus,
        pdfToDeleteId,
        setPdfToDeleteId,
        schedulingInfo,
        setSchedulingInfo,
        agendamentoToDelete,
        setAgendamentoToDelete,
        isApiKeyModalOpen,
        setIsApiKeyModalOpen,
        apiKeyModalProvider,
        isGeneralDiscountModalOpen,
        setIsGeneralDiscountModalOpen,
        isGalleryOpen,
        galleryImages,
        galleryInitialIndex,
        infoModalConfig,
        isSaveBeforePdfModalOpen,
        setIsSaveBeforePdfModalOpen,
        isExitConfirmModalOpen,
        setIsExitConfirmModalOpen,
        numpadConfig,
        isProcessingAI,

        // Handlers
        loadClients,
        loadFilms,
        handleOpenClientModal,
        handleSaveClient,
        handleDeleteClient,
        handleConfirmDeleteClient,
        handleOpenClientSelectionModal,
        handleAddNewClientFromSelection,
        handleToggleClientPin,
        handleOpenAIClientModal,
        goToNextClient,
        goToPrevClient,
        handleOpenFilmModal,
        handleSaveFilm,
        handleDeleteFilm,
        handleRequestDeleteFilm,
        handleConfirmDeleteFilm,
        handleOpenFilmSelectionModal,
        handleSelectFilmForMeasurement,
        handleAddNewFilmFromSelection,
        handleEditFilmFromSelection,
        handleToggleFilmPin,
        handleApplyFilmToAll,
        handleConfirmApplyFilmToAll,
        handleAddProposalOption,
        handleRenameProposalOption,
        handleDeleteProposalOption,
        handleSwipeDirectionChange,
        addMeasurement,
        duplicateAllMeasurements,
        handleConfirmDuplicateAll,
        handleOpenEditMeasurementModal,
        handleCloseEditMeasurementModal,
        handleUpdateEditingMeasurement,
        handleDeleteMeasurementFromEditModal,
        handleDeleteMeasurementFromGroup,
        handleConfirmDeleteIndividualMeasurement,
        handleImmediateDeleteMeasurement,
        handleUndoDelete,
        handleDismissUndo,
        handleConfirmClearAll,
        handleOpenDiscountModal,
        handleCloseDiscountModal,
        handleSaveDiscount,
        handleGeneralDiscountChange,
        handleSaveGeneralDiscount,
        handleSaveChanges,
        handleGeneratePdf,
        handleConfirmSaveBeforePdf,
        handleClosePdfStatusModal,
        handleGoToHistoryFromPdf,
        handleConfirmDeletePdf,
        handleOpenAgendamentoModal,
        handleCloseAgendamentoModal,
        handleSaveAgendamento,
        handleRequestDeleteAgendamento,
        handleConfirmDeleteAgendamento,
        handleAddNewClientFromAgendamento,
        handleCreateNewAgendamento,
        handleProcessAIInput,
        handleProcessAIClientInput,
        handleProcessAIFilmInput,
        handleSaveApiKey,
        handleOpenGallery,
        handleCloseGallery,
        handleCloseInfoModal,
        handleShowInfo,
        handleOpenNumpad,
        handleNumpadClose,
        handleNumpadInput,
        handleNumpadDelete,
        handleNumpadDone,
        handleNumpadDuplicate,
        handleNumpadClear,
        handleNumpadAddGroup,
        handleUpdate,
        handleSavePaymentMethods,
        handleMeasurementsChange
    };
};
