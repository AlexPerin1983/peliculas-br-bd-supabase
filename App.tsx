import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { Client, Measurement, UserInfo, Film, PaymentMethods, SavedPDF, Agendamento, ProposalOption } from './types';
import * as db from './services/db';
import { generatePDF, generateCombinedPDF } from './services/pdfGenerator';
import Header from './components/Header';
import ClientBar from './components/ClientBar';
import MeasurementList from './components/MeasurementList';
import SummaryBar from './components/SummaryBar';
import ActionsBar from './components/ActionsBar';
import MobileFooter from './components/MobileFooter';
import ClientModal from './components/modals/ClientModal';
import ClientSelectionModal from './components/modals/ClientSelectionModal';
import PaymentMethodsModal from './components/modals/PaymentMethodsModal';
import FilmModal from './components/modals/FilmModal';
import ConfirmationModal from './components/modals/ConfirmationModal';
import CustomNumpad from './components/ui/CustomNumpad';
import FilmSelectionModal from './components/modals/FilmSelectionModal';
import PdfGenerationStatusModal from './components/modals/PdfGenerationStatusModal';
import EditMeasurementModal from './components/modals/EditMeasurementModal';
import AgendamentoModal from './components/modals/AgendamentoModal';
import DiscountModal from './components/modals/DiscountModal';
import GeneralDiscountModal from './components/modals/GeneralDiscountModal';
import AIMeasurementModal from './components/modals/AIMeasurementModal';
import AIClientModal from './components/modals/AIClientModal';
import ApiKeyModal from './components/modals/ApiKeyModal';
import ProposalOptionsCarousel from './components/ProposalOptionsCarousel';
import ImageGalleryModal from './components/modals/ImageGalleryModal';
import UpdateNotification from './components/UpdateNotification';
import { usePwaInstallPrompt } from './src/hooks/usePwaInstallPrompt';
import { usePwaUpdate } from './src/hooks/usePwaUpdate';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";


const UserSettingsView = lazy(() => import('./components/views/UserSettingsView'));
const PdfHistoryView = lazy(() => import('./components/views/PdfHistoryView'));
const FilmListView = lazy(() => import('./components/views/FilmListView'));
const AgendaView = lazy(() => import('./components/views/AgendaView'));


type UIMeasurement = Measurement & { isNew?: boolean };
type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda';

type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: 'largura' | 'altura' | 'quantidade' | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};

export type SchedulingInfo = {
    pdf: SavedPDF;
    agendamento?: Agendamento;
} | {
    agendamento: Partial<Agendamento>;
    pdf?: SavedPDF;
};

interface ExtractedClientData {
    nome?: string;
    telefone?: string;
    email?: string;
    cpfCnpj?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
}


const App: React.FC = () => {
    const { deferredPrompt, promptInstall, isInstalled } = usePwaInstallPrompt();
    const { newVersionAvailable, handleUpdate } = usePwaUpdate();
    
    const [isLoading, setIsLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [proposalOptions, setProposalOptions] = useState<ProposalOption[]>([]);
    const [activeOptionId, setActiveOptionId] = useState<number | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [films, setFilms] = useState<Film[]>([]);
    const [allSavedPdfs, setAllSavedPdfs] = useState<SavedPDF[]>([]);
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    const [activeTab, setActiveTab] = useState<ActiveTab>('client');
    const [isDirty, setIsDirty] = useState(false);
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
    const [hasLoadedAgendamentos, setHasLoadedAgendamentos] = useState(false);
    const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
    const [swipeDistance, setSwipeDistance] = useState(0);
    const [clientTransitionKey, setClientTransitionKey] = useState(0);


    // Modal States
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isClientSelectionModalOpen, setIsClientSelectionModalOpen] = useState(false);
    const [clientModalMode, setClientModalMode] = useState<'add' | 'edit'>('add');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isFilmModalOpen, setIsFilmModalOpen] = useState(false);
    const [editingFilm, setEditingFilm] = useState<Film | null>(null);
    const [pdfGenerationStatus, setPdfGenerationStatus] = useState<'idle' | 'generating' | 'success'>('idle');
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
    const [filmToDeleteName, setFilmToDeleteName] = useState<string | null>(null);
    const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
    const [pdfToDeleteId, setPdfToDeleteId] = useState<number | null>(null);
    const [isFilmSelectionModalOpen, setIsFilmSelectionModalOpen] = useState(false);
    const [isApplyFilmToAllModalOpen, setIsApplyFilmToAllModalOpen] = useState(false);
    const [filmToApplyToAll, setFilmToApplyToAll] = useState<string | null>(null);
    const [editingMeasurementIdForFilm, setEditingMeasurementIdForFilm] = useState<number | null>(null);
    const [newClientName, setNewClientName] = useState<string>('');
    const [editingMeasurement, setEditingMeasurement] = useState<UIMeasurement | null>(null);
    const [schedulingInfo, setSchedulingInfo] = useState<SchedulingInfo | null>(null);
    const [agendamentoToDelete, setAgendamentoToDelete] = useState<Agendamento | null>(null);
    const [postClientSaveAction, setPostClientSaveAction] = useState<'openAgendamentoModal' | null>(null);
    const [editingMeasurementForDiscount, setEditingMeasurementForDiscount] = useState<UIMeasurement | null>(null);
    const [isAIMeasurementModalOpen, setIsAIMeasurementModalOpen] = useState(false);
    const [isAIClientModalOpen, setIsAIClientModalOpen] = useState(false);
    const [aiClientData, setAiClientData] = useState<Partial<Client> | undefined>(undefined);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [apiKeyModalProvider, setApiKeyModalProvider] = useState<'gemini' | 'openai'>('gemini');
    const [isGeneralDiscountModalOpen, setIsGeneralDiscountModalOpen] = useState(false);
    const [isDuplicateAllModalOpen, setIsDuplicateAllModalOpen] = useState(false); 
    const [measurementToDeleteId, setMeasurementToDeleteId] = useState<number | null>(null); 
    
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);


    const [numpadConfig, setNumpadConfig] = useState<NumpadConfig>({
        isOpen: false,
        measurementId: null,
        field: null,
        currentValue: '',
        shouldClearOnNextInput: false,
    });
    
    const mainRef = useRef<HTMLElement>(null);
    const numpadRef = useRef<HTMLDivElement>(null);

    // Handle URL parameters (shortcuts, share target, etc.)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Handle tab parameter from shortcuts
        const tabParam = urlParams.get('tab');
        if (tabParam && ['client', 'films', 'settings', 'history', 'agenda'].includes(tabParam)) {
            setActiveTab(tabParam as ActiveTab);
        }
        
        // Handle action parameter
        const actionParam = urlParams.get('action');
        if (actionParam === 'new') {
            // Open new client modal after loading
            setTimeout(() => {
                setClientModalMode('add');
                setIsClientModalOpen(true);
            }, 500);
        }
        
        // Handle share target parameters
        const sharedTitle = urlParams.get('title');
        const sharedText = urlParams.get('text');
        const sharedUrl = urlParams.get('url');
        
        if (sharedText || sharedTitle) {
            // If text was shared, open AI modal with the text
            setTimeout(() => {
                setIsAIMeasurementModalOpen(true);
            }, 500);
        }
        
        // Clear URL parameters after processing
        if (urlParams.toString()) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    useEffect(() => {
        const mainEl = mainRef.current;
        if (!mainEl) return;
    
        if (numpadConfig.isOpen) {
            const timer = setTimeout(() => {
                if (numpadRef.current) {
                    const numpadHeight = numpadRef.current.offsetHeight;
                    mainEl.style.paddingBottom = `${numpadHeight}px`;
    
                    if (numpadConfig.measurementId) {
                        const activeElement = mainEl.querySelector(`[data-measurement-id='${numpadConfig.measurementId}']`);
                        if (activeElement) {
                            const elementRect = activeElement.getBoundingClientRect();
                            const mainRect = mainEl.getBoundingClientRect();
                            
                            const targetY = mainRect.top + (mainEl.clientHeight * 0.3);
                            const scrollAmount = elementRect.top - targetY;

                            mainEl.scrollBy({
                                top: scrollAmount,
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            }, 250);
            return () => clearTimeout(timer);
        } else {
            mainEl.style.paddingBottom = '';
        }
    }, [numpadConfig.isOpen, numpadConfig.measurementId]);

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
    }, [userInfo?.lastSelectedClientId]);

    const loadFilms = useCallback(async () => {
        const customFilms = await db.getAllCustomFilms();
        const sortedFilms = customFilms.sort((a, b) => a.nome.localeCompare(b.nome));
        setFilms(sortedFilms);
    }, []);

    const loadAllPdfs = useCallback(async () => {
        const pdfs = await db.getAllPDFs();
        setAllSavedPdfs(pdfs);
    }, []);
    
    const loadAgendamentos = useCallback(async () => {
        const data = await db.getAllAgendamentos();
        setAgendamentos(data);
    }, []);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            const loadedUserInfo = await db.getUserInfo();
            setUserInfo(loadedUserInfo);
            
            await loadClients(); 
            await loadFilms();
            
            setIsLoading(false);
        };
        init();
    }, []);

    useEffect(() => {
        if (selectedClientId !== null && userInfo && userInfo.lastSelectedClientId !== selectedClientId) {
            const updatedUserInfo = { ...userInfo, lastSelectedClientId: selectedClientId };
            setUserInfo(updatedUserInfo);
            db.saveUserInfo(updatedUserInfo);
        }
        setClientTransitionKey(prev => prev + 1);
    }, [selectedClientId, userInfo]);

    useEffect(() => {
        const loadDataForClient = async () => {
            if (selectedClientId) {
                const savedOptions = await db.getProposalOptions(selectedClientId);
                
                if (savedOptions.length === 0) {
                    const defaultOption: ProposalOption = {
                        id: Date.now(),
                        name: 'Opção 1',
                        measurements: [],
                        generalDiscount: { value: '', type: 'percentage' }
                    };
                    setProposalOptions([defaultOption]);
                    setActiveOptionId(defaultOption.id);
                } else {
                    setProposalOptions(savedOptions);
                    setActiveOptionId(savedOptions[0].id);
                }
                setIsDirty(false);
            } else {
                setProposalOptions([]);
                setActiveOptionId(null);
                setIsDirty(false);
            }
        };
        loadDataForClient();
    }, [selectedClientId]);

    const activeOption = useMemo(() => {
        return proposalOptions.find(opt => opt.id === activeOptionId) || null;
    }, [proposalOptions, activeOptionId]);

    const measurements = activeOption?.measurements || [];
    const generalDiscount = activeOption?.generalDiscount || { value: '', type: 'percentage' as const };

    const handleSaveChanges = useCallback(async () => {
        if (selectedClientId && proposalOptions.length > 0) {
            await db.saveProposalOptions(selectedClientId, proposalOptions);
            setIsDirty(false);
            
            await loadClients(selectedClientId);
        }
    }, [selectedClientId, proposalOptions, loadClients]);

    useEffect(() => {
        if (!isDirty) {
            return;
        }
        const timerId = setTimeout(() => {
            handleSaveChanges();
        }, 1500);

        return () => clearTimeout(timerId);
    }, [proposalOptions, isDirty, handleSaveChanges]);


    const handleMeasurementsChange = useCallback((newMeasurements: UIMeasurement[]) => {
        if (!activeOptionId) return;
        
        setProposalOptions(prev => prev.map(opt =>
            opt.id === activeOptionId
                ? { ...opt, measurements: newMeasurements }
                : opt
        ));
        setIsDirty(true);
    }, [activeOptionId]);

    const handleGeneralDiscountChange = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        if (!activeOptionId) return;
        
        setProposalOptions(prev => prev.map(opt =>
            opt.id === activeOptionId
                ? { ...opt, generalDiscount: discount }
                : opt
        ));
        setIsDirty(true);
    }, [activeOptionId]);

    const handleSwipeDirectionChange = useCallback((direction: 'left' | 'right' | null, distance: number) => {
        setSwipeDirection(direction);
        setSwipeDistance(distance);
    }, []);

    const createEmptyMeasurement = useCallback((): Measurement => ({
        id: Date.now(),
        largura: '',
        altura: '',
        quantidade: 1,
        ambiente: 'Desconhecido',
        tipoAplicacao: 'Desconhecido',
        pelicula: films[0]?.nome || 'Nenhuma',
        active: true,
        discount: 0,
        discountType: 'percentage',
    }), [films]);
    
    const addMeasurement = useCallback(() => {
        const newMeasurement: UIMeasurement = { ...createEmptyMeasurement(), isNew: true };
        const updatedMeasurements = [
            ...measurements.map(m => ({ ...m, isNew: false })),
            newMeasurement, 
        ];
        handleMeasurementsChange(updatedMeasurements);
    }, [createEmptyMeasurement, measurements, handleMeasurementsChange]);
    
    const duplicateAllMeasurements = useCallback(() => {
        if (!activeOption) return;
        
        setIsDuplicateAllModalOpen(true);
    }, [activeOption]);
    
    const handleConfirmDuplicateAll = useCallback(() => {
        if (!activeOption) return;
        
        const newOption: ProposalOption = {
            id: Date.now(),
            name: `Opção ${proposalOptions.length + 1}`,
            measurements: activeOption.measurements.map((m, index) => ({
                ...m,
                id: Date.now() + index,
                isNew: false
            })),
            generalDiscount: { ...activeOption.generalDiscount }
        };
        
        setProposalOptions(prev => [...prev, newOption]);
        setActiveOptionId(newOption.id);
        setIsDirty(true);
        setIsDuplicateAllModalOpen(false);
    }, [activeOption, proposalOptions.length]);

    const handleAddProposalOption = useCallback(() => {
        setProposalOptions(prevOptions => {
            const newOption: ProposalOption = {
                id: Date.now(),
                name: `Opção 1`,
                measurements: [],
                generalDiscount: { value: '', type: 'percentage' }
            };
            
            const newOptions = [...prevOptions, newOption];
            setActiveOptionId(newOption.id);
            setIsDirty(true);
            return newOptions;
        });
    }, []);

    const handleRenameProposalOption = useCallback((optionId: number, newName: string) => {
        setProposalOptions(prev => prev.map(opt =>
            opt.id === optionId ? { ...opt, name: newName } : opt
        ));
        setIsDirty(true);
    }, []);

    const handleDeleteProposalOption = useCallback((optionId: number) => {
        const remainingOptions = proposalOptions.filter(opt => opt.id !== optionId);
        setProposalOptions(remainingOptions);
        
        if (activeOptionId === optionId && remainingOptions.length > 0) {
            setActiveOptionId(remainingOptions[0].id);
        }
        setIsDirty(true);
    }, [proposalOptions, activeOptionId]);

    const handleConfirmClearAll = useCallback(() => {
        handleMeasurementsChange([]);
        setIsClearAllModalOpen(false);
    }, [handleMeasurementsChange]);

    const selectedClient = useMemo(() => {
        return clients.find(c => c.id === selectedClientId) || null;
    }, [clients, selectedClientId]);
    
    // Função auxiliar para salvar o valor atual do Numpad no Measurement
    const saveCurrentNumpadValue = useCallback((config: NumpadConfig, currentMeasurements: UIMeasurement[]) => {
        const { measurementId, field, currentValue } = config;
        if (measurementId === null || field === null) return currentMeasurements;

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            // Garante que o valor seja salvo com vírgula, se for numérico
            finalValue = (String(currentValue) === '' || String(currentValue) === '.') ? '0' : String(currentValue).replace('.', ',');
        }

        return currentMeasurements.map(m =>
            m.id === measurementId ? { ...m, [field]: finalValue } : m
        );
    }, []);

    const handleNumpadClose = useCallback(() => {
        setNumpadConfig(prev => {
            // Salva o valor atual antes de fechar
            const updatedMeasurements = saveCurrentNumpadValue(prev, measurements);
            handleMeasurementsChange(updatedMeasurements);
            
            return { isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false };
        });
    }, [measurements, handleMeasurementsChange, saveCurrentNumpadValue]);

    const handleOpenClientModal = useCallback((mode: 'add' | 'edit') => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setClientModalMode(mode);
        if (mode === 'edit' && !selectedClientId) {
            alert('Selecione um cliente para editar.');
            return;
        }
        setAiClientData(undefined);
        setIsClientModalOpen(true);
    }, [selectedClientId, numpadConfig.isOpen, handleNumpadClose]);
    
    const handleOpenAgendamentoModal = useCallback((info: SchedulingInfo) => {
        setSchedulingInfo(info);
    }, []);

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
    }, [clientModalMode, selectedClientId, postClientSaveAction, handleOpenAgendamentoModal, loadClients]);

    const handleDeleteClient = useCallback(() => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        if (!selectedClientId) {
            return;
        }
        setIsDeleteClientModalOpen(true);
    }, [selectedClientId, numpadConfig.isOpen, handleNumpadClose]);

    const handleConfirmDeleteClient = useCallback(async () => {
        if (!selectedClientId) return;

        await db.deleteClient(selectedClientId);
        await db.deleteProposalOptions(selectedClientId);
        
        const pdfsForClient = await db.getPDFsForClient(selectedClientId);
        for (const pdf of pdfsForClient) {
            if (pdf.id) {
                await db.deletePDF(pdf.id);
            }
        }

        await loadClients();
        
        if (hasLoadedHistory) {
            await loadAllPdfs();
        }
        if (hasLoadedAgendamentos) {
            await loadAgendamentos();
        }
        
        setIsDeleteClientModalOpen(false);
    }, [selectedClientId, hasLoadedHistory, loadAllPdfs, hasLoadedAgendamentos, loadAgendamentos, loadClients]);
    
    const handleSaveUserInfo = useCallback(async (info: UserInfo) => {
        await db.saveUserInfo(info);
        setUserInfo(info);
    }, []);

    const handleSavePaymentMethods = useCallback(async (methods: PaymentMethods) => {
        if (userInfo) {
            const updatedUserInfo = { ...userInfo, payment_methods: methods };
            await db.saveUserInfo(updatedUserInfo);
            setUserInfo(updatedUserInfo);
            setIsPaymentModalOpen(false);
        }
    }, [userInfo]);
    
    const handleOpenFilmModal = useCallback((film: Film | null) => {
        setEditingFilm(film);
        setIsFilmModalOpen(true);
    }, []);

    const handleEditFilmFromSelection = useCallback((film: Film) => {
        setIsFilmSelectionModalOpen(false);
        setIsApplyFilmToAllModalOpen(false);
        setEditingMeasurementIdForFilm(null);
        
        handleOpenFilmModal(film);
    }, [handleOpenFilmModal]);

    const handleSaveFilm = useCallback(async (newFilmData: Film, originalFilm: Film | null) => {
        if (originalFilm && originalFilm.nome !== newFilmData.nome) {
            await db.deleteCustomFilm(originalFilm.nome);
        }
    
        await db.saveCustomFilm(newFilmData);
        await loadFilms();
        setIsFilmModalOpen(false);
        setEditingFilm(null);
    }, [loadFilms]);

    const handleDeleteFilm = useCallback(async (filmName: string) => {
        if (window.confirm(`Tem certeza que deseja excluir a película "${filmName}"?`)) {
            await db.deleteCustomFilm(filmName);
            await loadFilms();
            setIsFilmModalOpen(false);
            setEditingFilm(null);
        }
    }, [loadFilms]);

    const handleRequestDeleteFilm = useCallback((filmName: string) => {
        setIsFilmSelectionModalOpen(false);
        setFilmToDeleteName(filmName);
    }, []);

    const handleConfirmDeleteFilm = useCallback(async () => {
        if (filmToDeleteName === null) return;
        await db.deleteCustomFilm(filmToDeleteName);
        await loadFilms();
        setFilmToDeleteName(null);
    }, [filmToDeleteName, loadFilms]);


    const downloadBlob = useCallback((blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);
    
    const totals = useMemo(() => {
        const result = measurements.reduce((acc, m) => {
            if (m.active) {
                const largura = parseFloat(m.largura.replace(',', '.')) || 0;
                const altura = parseFloat(m.altura.replace(',', '.')) || 0;
                const quantidade = parseInt(String(m.quantidade), 10) || 0;
                const m2 = largura * altura * quantidade;
                const film = films.find(f => f.nome === m.pelicula);
                
                let pricePerM2 = 0;
                if (film) {
                    if (film.preco > 0) {
                        pricePerM2 = film.preco;
                    } else if (film.maoDeObra && film.maoDeObra > 0) {
                        pricePerM2 = film.maoDeObra;
                    }
                }
                
                const basePrice = pricePerM2 * m2;

                let itemDiscountAmount = 0;
                const discountValue = m.discount || 0;
                if (m.discountType === 'percentage' && discountValue > 0) {
                    itemDiscountAmount = basePrice * (discountValue / 100);
                } else if (m.discountType === 'fixed' && discountValue > 0) {
                    itemDiscountAmount = discountValue;
                }
                
                const finalItemPrice = Math.max(0, basePrice - itemDiscountAmount);
                
                acc.totalM2 += m2;
                acc.subtotal += basePrice;
                acc.totalItemDiscount += itemDiscountAmount;
                acc.priceAfterItemDiscounts += finalItemPrice;
            }
            return acc;
        }, { totalM2: 0, subtotal: 0, totalItemDiscount: 0, priceAfterItemDiscounts: 0 });

        let generalDiscountAmount = 0;
        const discountInputValue = parseFloat(String(generalDiscount.value).replace(',', '.')) || 0;
        if (discountInputValue > 0) {
            if (generalDiscount.type === 'percentage') {
                generalDiscountAmount = result.priceAfterItemDiscounts * (discountInputValue / 100);
            } else if (generalDiscount.type === 'fixed') {
                generalDiscountAmount = discountInputValue;
            }
        }
        
        const finalTotal = Math.max(0, result.priceAfterItemDiscounts - generalDiscountAmount);

        return {
            ...result,
            generalDiscountAmount,
            finalTotal,
        };
    }, [measurements, films, generalDiscount]);

    const handleGeneratePdf = useCallback(async () => {
        if (!selectedClient || !userInfo || !activeOption) {
            alert("Selecione um cliente e preencha as informações da empresa antes de gerar o PDF.");
            return;
        }
        if (isDirty) {
            if(window.confirm("Você tem alterações não salvas. Deseja salvar antes de gerar o PDF?")) {
                await handleSaveChanges();
            } else {
                alert("Geração de PDF cancelada. Salve ou descarte suas alterações.");
                return;
            }
        }
        const activeMeasurements = measurements.filter(m => m.active && parseFloat(String(m.largura).replace(',', '.')) > 0 && parseFloat(String(m.altura).replace(',', '.')) > 0);
        if(activeMeasurements.length === 0) {
            alert("Não há medidas válidas para gerar um orçamento.");
            return;
        }

        setPdfGenerationStatus('generating');
        try {
            // Passando o nome da opção de proposta para o gerador de PDF
            const pdfBlob = await generatePDF(selectedClient, userInfo, activeMeasurements, films, generalDiscount, totals, activeOption.name);
            const filename = `orcamento_${selectedClient.nome.replace(/\s+/g, '_').toLowerCase()}_${activeOption.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
            
            const generalDiscountForDb: SavedPDF['generalDiscount'] = {
                ...generalDiscount,
                value: parseFloat(String(generalDiscount.value).replace(',', '.')) || 0,
                type: generalDiscount.value ? generalDiscount.type : 'none',
            };
            
            const validityDays = userInfo.proposalValidityDays || 60;
            const issueDate = new Date();
            const expirationDate = new Date();
            expirationDate.setDate(issueDate.getDate() + validityDays);

            const pdfToSave: Omit<SavedPDF, 'id'> = {
                clienteId: selectedClientId!,
                date: issueDate.toISOString(),
                expirationDate: expirationDate.toISOString(),
                totalPreco: totals.finalTotal,
                totalM2: totals.totalM2,
                subtotal: totals.subtotal,
                generalDiscountAmount: totals.generalDiscountAmount,
                generalDiscount: generalDiscountForDb,
                pdfBlob: pdfBlob,
                nomeArquivo: filename,
                measurements: activeMeasurements.map(({ isNew, ...rest }) => rest),
                status: 'pending',
                proposalOptionName: activeOption.name
            };
            await db.savePDF(pdfToSave);
            
            downloadBlob(pdfBlob, filename);
            
            setPdfGenerationStatus('success');
            
            if (hasLoadedHistory) {
                await loadAllPdfs();
            }
        } catch (error) {
            console.error("Erro ao gerar ou salvar PDF:", error);
            alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
            setPdfGenerationStatus('idle');
        }
    }, [selectedClient, userInfo, activeOption, isDirty, handleSaveChanges, measurements, films, generalDiscount, totals, selectedClientId, downloadBlob, hasLoadedHistory, loadAllPdfs]);

    const handleGenerateCombinedPdf = useCallback(async (selectedPdfs: SavedPDF[]) => {
        if (!userInfo || selectedPdfs.length === 0) return;

        setPdfGenerationStatus('generating');
        try {
            const client = clients.find(c => c.id === selectedPdfs[0].clienteId);
            if (!client) throw new Error("Cliente não encontrado para os orçamentos selecionados.");

            const pdfBlob = await generateCombinedPDF(client, userInfo, selectedPdfs, films);
            
            const firstOptionName = selectedPdfs[0].proposalOptionName || 'Opcao';
            const filename = `orcamento_combinado_${client.nome.replace(/\s+/g, '_').toLowerCase()}_${firstOptionName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
            
            downloadBlob(pdfBlob, filename);
            
            setPdfGenerationStatus('success');
        } catch (error) {
            console.error("Erro ao gerar PDF combinado:", error);
            alert(`Ocorreu um erro ao gerar o PDF combinado: ${error instanceof Error ? error.message : String(error)}`);
            setPdfGenerationStatus('idle');
        }
    }, [userInfo, clients, films, downloadBlob]);

    const handleGoToHistoryFromPdf = useCallback(() => {
        setPdfGenerationStatus('idle');
        setActiveTab('history');
    }, []);

    const handleClosePdfStatusModal = useCallback(() => {
        setPdfGenerationStatus('idle');
    }, []);

    const blobToBase64 = (blob: Blob): Promise<{mimeType: string, data: string}> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                const parts = base64data.split(',');
                const mimeType = parts[0].match(/:(.*?);/)?.[1] || blob.type;
                resolve({ mimeType, data: parts[1] });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const processClientDataWithGemini = async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }): Promise<ExtractedClientData | null> => {
        if (!userInfo?.aiConfig?.apiKey) {
            throw new Error("Chave de API do Gemini não configurada.");
        }
        
        try {
            const genAI = new GoogleGenerativeAI(userInfo!.aiConfig!.apiKey);
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: SchemaType.OBJECT,
                        properties: {
                            nome: { type: SchemaType.STRING, description: 'Nome completo do cliente.' },
                            telefone: { type: SchemaType.STRING, description: 'Telefone do cliente, apenas dígitos. Ex: 83999998888' },
                            email: { type: SchemaType.STRING, description: 'Email do cliente.' },
                            cpfCnpj: { type: SchemaType.STRING, description: 'CPF ou CNPJ do cliente, apenas dígitos.' },
                            cep: { type: SchemaType.STRING, description: 'CEP do endereço, apenas dígitos.' },
                            logradouro: { type: SchemaType.STRING, description: 'Rua ou Logradouro.' },
                            numero: { type: SchemaType.STRING, description: 'Número do endereço.' },
                            complemento: { type: SchemaType.STRING, description: 'Complemento (opcional).' },
                            bairro: { type: SchemaType.STRING, description: 'Bairro.' },
                            cidade: { type: SchemaType.STRING, description: 'Cidade.' },
                            uf: { type: SchemaType.STRING, description: 'Estado (UF).' },
                        },
                    }
                }
            });
    
            const prompt = `
                Você é um assistente especialista em extração de dados de clientes. Sua tarefa é extrair o máximo de informações de contato, endereço completo (incluindo CEP, logradouro, número, bairro, cidade e UF) e documento (CPF ou CNPJ) de um cliente a partir da entrada fornecida (texto, imagem ou áudio).
                
                **Regra Crítica para Telefone:** O telefone deve ser extraído APENAS com o DDD e o número (máximo 11 dígitos). Remova qualquer código de país (ex: +55) se presente. Ex: Se for "+55 83 99999-8888", extraia "83999998888".
                
                Formate os campos de telefone, CPF/CNPJ e CEP APENAS com dígitos, sem pontuação ou espaços.
                
                **Regra para UF:** O campo UF deve conter APENAS a sigla do estado (2 letras).
                
                Responda APENAS com um objeto JSON válido que corresponda ao schema fornecido. Não inclua nenhuma outra explicação ou texto.
            `;
    
            const parts: any[] = [prompt];
    
            if (input.type === 'text') {
                parts.push(input.data as string);
            } else if (input.type === 'image') {
                for (const file of input.data as File[]) {
                    const { mimeType, data } = await blobToBase64(file);
                    parts.push({ inlineData: { mimeType, data } });
                }
            } else if (input.type === 'audio') {
                const { mimeType, data } = await blobToBase64(input.data as Blob);
                    parts.push({ inlineData: { mimeType, data } });
            }
    
            const result = await model.generateContent({ contents: parts });
            const response = await result.response;
            
            // Tenta fazer o parse do JSON
            try {
                const extractedData = JSON.parse(response.text());
                return extractedData as ExtractedClientData;
            } catch (e) {
                console.error("Erro de JSON.parse:", e);
                // Se o parse falhar, tenta limpar a string (removendo caracteres extras antes/depois do JSON)
                const jsonText = response.text().trim();
                const start = jsonText.indexOf('{');
                const end = jsonText.lastIndexOf('}');
                
                if (start !== -1 && end !== -1 && end > start) {
                    const cleanedJson = jsonText.substring(start, end + 1);
                    try {
                        const extractedData = JSON.parse(cleanedJson);
                        console.log("JSON corrigido com sucesso.");
                        return extractedData as ExtractedClientData;
                    } catch (e2) {
                        // Se a correção falhar, lança o erro original
                        throw new Error(`A resposta da IA não é um JSON válido. Erro: ${e instanceof Error ? e.message : 'JSON malformado'}`);
                    }
                }
                
                throw new Error(`A resposta da IA não é um JSON válido. Erro: ${e instanceof Error ? e.message : 'JSON malformado'}`);
            }

        } catch (error) {
            console.error("Erro ao processar dados do cliente com Gemini:", error);
            throw error; // Re-throw para ser capturado pelo handleProcessAIClientInput
        }
    };

    const processClientDataWithOpenAI = async (input: { type: 'text' | 'image'; data: string | File[] }): Promise<ExtractedClientData | null> => {
        alert("O preenchimento de dados do cliente com OpenAI ainda não está totalmente implementado. Por favor, use o Gemini ou preencha manualmente.");
        return null;
    };

    const handleProcessAIClientInput = useCallback(async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        if (!userInfo?.aiConfig?.apiKey || !userInfo?.aiConfig?.provider) {
            alert("Por favor, configure seu provedor e chave de API na aba 'Empresa' para usar esta funcionalidade.");
            return;
        }
    
        setIsProcessingAI(true);
        let extractedData: ExtractedClientData | null = null;
    
        try {
            if (userInfo.aiConfig.provider === 'gemini') {
                extractedData = await processClientDataWithGemini(input);
            } else if (userInfo.aiConfig.provider === 'openai') {
                if (input.type === 'audio') {
                    alert("O provedor OpenAI não suporta entrada de áudio para esta funcionalidade.");
                    return;
                }
                extractedData = await processClientDataWithOpenAI(input as { type: 'text' | 'image'; data: string | File[] });
            }
            
            if (extractedData) {
                setAiClientData(extractedData);
                setIsAIClientModalOpen(false);
                setIsClientModalOpen(true);
            }

        } catch (error) {
            console.error("Erro ao processar dados do cliente com IA:", error);
            alert(`Ocorreu um erro com a IA: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo]);

    const processWithGemini = async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        try {
            const genAI = new GoogleGenerativeAI(userInfo!.aiConfig!.apiKey);
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                largura: { 
                                    type: SchemaType.STRING, 
                                    description: 'Largura em metros, com vírgula como separador decimal. Ex: "1,50"' 
                                },
                                altura: { 
                                    type: SchemaType.STRING, 
                                    description: 'Altura em metros, com vírgula como separador decimal. Ex: "2,10"' 
                                },
                                quantidade: { 
                                    type: SchemaType.NUMBER, 
                                    description: 'A quantidade de itens com essa medida.' 
                                },
                                ambiente: { 
                                    type: SchemaType.STRING, 
                                    description: 'O local ou descrição do item. Ex: "Janela da Sala", "Porta do Quarto"' 
                                },
                            },
                            required: ['largura', 'altura', 'quantidade', 'ambiente'],
                        },
                    }
                }
            });
    
            const prompt = `
                Você é um assistente especialista para uma empresa de instalação de películas de vidro. Sua tarefa é extrair dados de medidas de uma entrada fornecida pelo usuário.
                A entrada pode ser texto, imagem (de uma lista, rascunho ou foto) ou áudio.
                Extraia as seguintes informações para cada medida: largura, altura, quantidade e uma descrição do ambiente/local (ex: "sala", "quarto", "janela da cozinha").
                As medidas estão em metros. Se o usuário disser '1 e meio por 2', interprete como 1,50m por 2,00m. Sempre formate as medidas com duas casas decimais e vírgula como separador.
                O ambiente deve ser uma descrição curta e útil.
                Responda APENAS com um objeto JSON válido que corresponda ao schema fornecido. Não inclua nenhuma outra explicação ou texto.
            `;
    
            const parts: any[] = [prompt];
    
            if (input.type === 'text') {
                parts.push(input.data as string);
            } else if (input.type === 'image') {
                for (const file of input.data as File[]) {
                    const { mimeType, data } = await blobToBase64(file);
                    parts.push({ inlineData: { mimeType, data } });
                }
            } else if (input.type === 'audio') {
                const { mimeType, data } = await blobToBase64(input.data as Blob);
                    parts.push({ inlineData: { mimeType, data } });
            }
    
            const result = await model.generateContent({ contents: parts });
            const response = await result.response;
            
            try {
                const extractedData = JSON.parse(response.text());
    
                if (Array.isArray(extractedData)) {
                    const newMeasurements: UIMeasurement[] = extractedData.map((item: any, index: number) => ({
                        id: Date.now() + index,
                        largura: item.largura || '',
                        altura: item.altura || '',
                        quantidade: item.quantidade || 1,
                        ambiente: item.ambiente || 'Desconhecido',
                        tipoAplicacao: 'Desconhecido',
                        pelicula: films[0]?.nome || 'Nenhuma',
                        active: true,
                        isNew: index === 0,
                        discount: 0,
                        discountType: 'percentage',
                    }));
        
                    if (newMeasurements.length > 0) {
                        handleMeasurementsChange([...measurements.map(m => ({...m, isNew: false})), ...newMeasurements]);
                        setIsAIMeasurementModalOpen(false);
                    } else {
                        alert("Nenhuma medida foi extraída. Tente novamente com mais detalhes.");
                    }
                } else {
                    throw new Error("A resposta da IA não está no formato de array esperado.");
                }
            } catch (e) {
                console.error("Erro de JSON.parse:", e);
                throw new Error(`A resposta da IA não é um JSON válido. Erro: ${e instanceof Error ? e.message : 'JSON malformado'}`);
            }
        } catch (error) {
            console.error("Erro ao processar com Gemini:", error);
            throw error;
        }
    };

    const processWithOpenAI = async (input: { type: 'text' | 'image'; data: string | File[] }) => {
        try {
            const prompt = `Você é um assistente especialista para uma empresa de instalação de películas de vidro. Sua tarefa é extrair dados de medidas da entrada fornecida pelo usuário. Extraia as seguintes informações para cada medida: largura, altura, quantidade e uma descrição do ambiente/local (ex: "sala", "quarto", "janela da cozinha"). As medidas estão em metros. Se o usuário disser '1 e meio por 2', interprete como 1,50m por 2,00m. Sempre formate as medidas com duas casas decimais e vírgula como separador. O ambiente deve ser uma descrição curta e útil.`;

            const tools = [
                {
                    type: "function" as const,
                    function: {
                        name: "extract_measurements",
                        description: "Extrai os dados de medidas da entrada do usuário.",
                        parameters: {
                            type: "object",
                            properties: {
                                largura: { type: "string", description: "Largura em metros, com vírgula. Ex: '1,50'" },
                                altura: { type: "string", description: "Altura em metros, com vírgula. Ex: '2,10'" },
                                quantidade: { type: "number", description: "Quantidade de itens." },
                                ambiente: { type: "string", description: "Local do item. Ex: 'Janela da Sala'" }
                            },
                            required: ["largura", "altura", "quantidade", "ambiente"]
                        }
                    }
                }
            ];

            let userContent: any;

            if (input.type === 'text') {
                userContent = [{ type: 'text', text: input.data as string }];
            } else if (input.type === 'image') {
                const file = (input.data as File[])[0];
                const { mimeType, data } = await blobToBase64(file);
                userContent = [
                    { type: 'text', text: 'Extraia as medidas desta imagem.' },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } }
                ];
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userInfo!.aiConfig!.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: prompt },
                        { role: 'user', content: userContent }
                    ],
                    tools: tools,
                    tool_choice: { "type": "function", "function": { "name": "extract_measurements" } }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API Error: ${errorData.error.message}`);
            }

            const data = await response.json();
            const toolCall = data.choices[0].message.tool_calls?.[0];

            if (!toolCall || toolCall.type !== 'function') {
                throw new Error("A resposta da IA (OpenAI) não continha os dados esperados.");
            }

            const extractedData = JSON.parse(toolCall.function.arguments);
            const newMeasurementsData = extractedData.measurements || [];

            if (Array.isArray(newMeasurementsData) && newMeasurementsData.length > 0) {
                const newMeasurements: UIMeasurement[] = newMeasurementsData.map((item: any, index: number) => ({
                    id: Date.now() + index,
                    largura: item.largura || '',
                    altura: item.altura || '',
                    quantidade: item.quantidade || 1,
                    ambiente: item.ambiente || 'Desconhecido',
                    tipoAplicacao: 'Desconhecido',
                    pelicula: films[0]?.nome || 'Nenhuma',
                    active: true,
                    isNew: index === 0,
                    discount: 0,
                    discountType: 'percentage',
                }));
    
                handleMeasurementsChange([...measurements.map(m => ({...m, isNew: false})), ...newMeasurements]);
                setIsAIMeasurementModalOpen(false);
            } else {
                alert("Nenhuma medida foi extraída com OpenAI. Tente novamente com mais detalhes.");
            }

        } catch (error) {
            console.error("Erro ao processar com OpenAI:", error);
            throw error;
        }
    }

    const handleProcessAIInput = async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        if (!userInfo?.aiConfig?.apiKey) {
            alert("Por favor, configure sua chave de API na aba 'Empresa' para usar esta funcionalidade.");
            return;
        }
    
        setIsProcessingAI(true);
    
        try {
            if (userInfo.aiConfig.provider === 'gemini') {
                await processWithGemini(input);
            } else if (userInfo.aiConfig.provider === 'openai') {
                if (input.type === 'audio') {
                    alert("O provedor OpenAI não suporta entrada de áudio nesta aplicação.");
                    return;
                }
                await processWithOpenAI(input as { type: 'text' | 'image'; data: string | File[] });
            }
        } catch (error) {
            console.error("Erro ao processar com IA:", error);
            alert(`Ocorreu um erro com a IA: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessingAI(false);
        }
    };

    const handleRequestDeletePdf = useCallback((pdfId: number) => {
        setPdfToDeleteId(pdfId);
    }, []);

    const handleConfirmDeletePdf = useCallback(async () => {
        if (pdfToDeleteId === null) return;
        await db.deletePDF(pdfToDeleteId);
        await loadAllPdfs();
        if(hasLoadedAgendamentos) {
            await loadAgendamentos();
        }
        setPdfToDeleteId(null);
    }, [pdfToDeleteId, loadAllPdfs, hasLoadedAgendamentos, loadAgendamentos]);
    
    const handleUpdatePdfStatus = useCallback(async (pdfId: number, status: SavedPDF['status']) => {
        try {
            const allPdfsFromDb = await db.getAllPDFs();
            const pdfToUpdate = allPdfsFromDb.find(p => p.id === pdfId);
            
            if (pdfToUpdate) {
                const updatedPdf = { ...pdfToUpdate, status };
                await db.updatePDF(updatedPdf);
                await loadAllPdfs();
            }
        } catch (error) {
            console.error("Failed to update PDF status", error);
            alert("Não foi possível atualizar o status do orçamento.");
        }
    }, [loadAllPdfs]);


    const toggleFullScreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }, []);

    const handleOpenNumpad = useCallback((measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => {
        setNumpadConfig(prev => {
            const isSameButton = prev.isOpen && prev.measurementId === measurementId && prev.field === field;
            
            // 1. Se o Numpad já estava aberto em um campo diferente, salve o valor anterior.
            if (prev.isOpen && (prev.measurementId !== measurementId || prev.field !== field)) {
                const updatedMeasurements = saveCurrentNumpadValue(prev, measurements);
                handleMeasurementsChange(updatedMeasurements);
            }
            
            if (isSameButton) {
                return {
                    ...prev,
                    shouldClearOnNextInput: false,
                };
            }

            // 2. Abre o Numpad no novo campo
            return {
                isOpen: true,
                measurementId,
                field,
                currentValue: String(currentValue).replace(',', '.'),
                shouldClearOnNextInput: true,
            };
        });
    }, [measurements, handleMeasurementsChange, saveCurrentNumpadValue]);

    const handleNumpadDone = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) return;

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (String(currentValue) === '' || String(currentValue) === '.') ? '0' : String(currentValue).replace('.', ',');
        }

        const updatedMeasurements = measurements.map(m =>
            m.id === measurementId ? { ...m, [field]: finalValue } : m
        );
        handleMeasurementsChange(updatedMeasurements);

        const fieldSequence: Array<'largura' | 'altura' | 'quantidade'> = ['largura', 'altura', 'quantidade'];
        const currentIndex = fieldSequence.indexOf(field);
        const nextIndex = currentIndex + 1;

        if (nextIndex < fieldSequence.length) {
            const nextField = fieldSequence[nextIndex];
            const currentMeasurement = updatedMeasurements.find(m => m.id === measurementId);
            const nextValue = currentMeasurement ? currentMeasurement[nextField] : '';

            setNumpadConfig({
                isOpen: true,
                measurementId,
                field: nextField,
                currentValue: String(nextValue).replace(',', '.'),
                shouldClearOnNextInput: true,
            });
        } else {
            setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
        }
    }, [numpadConfig, measurements, handleMeasurementsChange]);

    const handleNumpadInput = useCallback((value: string) => {
        setNumpadConfig(prev => {
            const shouldClear = prev.shouldClearOnNextInput;
            let newValue = prev.currentValue;

            const char = value === ',' ? '.' : value;

            if (char === '.') {
                if (prev.field !== 'quantidade') {
                    newValue = shouldClear ? '0.' : (newValue.includes('.') ? newValue : newValue + '.');
                }
            } else {
                newValue = shouldClear ? char : newValue + char;
            }

            const isWidthOrHeight = prev.field === 'largura' || prev.field === 'altura';
            const matchesPattern = /^\d\.\d{2}$/.test(newValue);

            if (isWidthOrHeight && matchesPattern) {
                const finalValue = newValue.replace('.', ',');
                const measurementsWithSavedValue = measurements.map(m =>
                    m.id === prev.measurementId ? { ...m, [prev.field!]: finalValue } : m
                );
                handleMeasurementsChange(measurementsWithSavedValue);

                const fieldSequence: Array<'largura' | 'altura' | 'quantidade'> = ['largura', 'altura', 'quantidade'];
                const currentIndex = fieldSequence.indexOf(prev.field!);
                const nextIndex = currentIndex + 1;

                if (nextIndex < fieldSequence.length) {
                    const nextField = fieldSequence[nextIndex];
                    const currentMeasurement = measurementsWithSavedValue.find(m => m.id === prev.measurementId);
                    const nextValueForField = currentMeasurement ? currentMeasurement[nextField] : '';
                    
                    return {
                        isOpen: true,
                        measurementId: prev.measurementId,
                        field: nextField,
                        currentValue: String(nextValueForField).replace(',', '.'),
                        shouldClearOnNextInput: true,
                    };
                } else {
                    // Se for o último campo, salva e fecha
                    return { isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false };
                }
            }

            return { ...prev, currentValue: newValue, shouldClearOnNextInput: false };
        });
    }, [measurements, handleMeasurementsChange]);

    const handleNumpadDelete = useCallback(() => {
        setNumpadConfig(prev => ({ 
            ...prev, 
            currentValue: prev.currentValue.slice(0, -1),
            shouldClearOnNextInput: false 
        }));
    }, []);

    const handleNumpadDuplicate = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) return;

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (String(currentValue) === '' || String(currentValue) === '.') ? '0' : String(currentValue).replace('.', ',');
        }

        const measurementsWithSavedValue = measurements.map(m =>
            m.id === measurementId ? { ...m, [field]: finalValue } : m
        );
        
        const measurementToDuplicate = measurementsWithSavedValue.find(m => m.id === measurementId);
        
        if (measurementToDuplicate) {
            const newMeasurement: UIMeasurement = { 
                ...measurementToDuplicate, 
                id: Date.now(), 
                isNew: false
            };
            
            const index = measurementsWithSavedValue.findIndex(m => m.id === measurementId);
            const finalMeasurements = [...measurementsWithSavedValue];
            finalMeasurements.splice(index + 1, 0, newMeasurement);
            
            handleMeasurementsChange(finalMeasurements.map(m => 
                m.id === newMeasurement.id ? m : { ...m, isNew: false }
            ));

            setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
        }
    }, [numpadConfig, measurements, handleMeasurementsChange]);

    const handleNumpadClear = useCallback(() => {
        const { measurementId, field } = numpadConfig;
        if (measurementId === null) return;

        const updatedMeasurements = measurements.map(m =>
            m.id === measurementId ? { ...m, largura: '', altura: '', quantidade: 1 } : m
        );
        handleMeasurementsChange(updatedMeasurements);

        setNumpadConfig(prev => ({
            ...prev,
            currentValue: field === 'quantidade' ? '1' : '',
            shouldClearOnNextInput: true,
        }));
    }, [numpadConfig, measurements, handleMeasurementsChange]);

    const handleNumpadAddGroup = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
    
        setProposalOptions(currentOptions => {
            if (!activeOptionId) return currentOptions;
            
            return currentOptions.map(opt => {
                if (opt.id !== activeOptionId) return opt;
                
                let measurementsWithSavedValue = opt.measurements;
                if (measurementId !== null && field !== null) {
                    let finalValue: string | number;
                    if (field === 'quantidade') {
                        finalValue = parseInt(String(currentValue), 10) || 1;
                    } else {
                        finalValue = (String(currentValue) === '' || String(currentValue) === '.') ? '0' : String(currentValue).replace('.', ',');
                    }
                    measurementsWithSavedValue = opt.measurements.map(m =>
                        m.id === measurementId ? { ...m, [field]: finalValue } : m
                    );
                }
        
                const newMeasurement: UIMeasurement = { ...createEmptyMeasurement(), isNew: true };
                const finalMeasurements = [
                    ...measurementsWithSavedValue.map(m => ({ ...m, isNew: false })),
                    newMeasurement,
                ];
                
                return { ...opt, measurements: finalMeasurements };
            });
        });
    
        setIsDirty(true);
        
        setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
    }, [numpadConfig, createEmptyMeasurement, activeOptionId]);

    const handleTabChange = useCallback((tab: ActiveTab) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setActiveTab(tab);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleOpenFilmSelectionModal = useCallback((measurementId: number) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurementIdForFilm(measurementId);
        setIsFilmSelectionModalOpen(true);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleSelectFilmForMeasurement = useCallback((filmName: string) => {
        if (editingMeasurementIdForFilm === null) return;

        const updatedMeasurements = measurements.map(m => 
            m.id === editingMeasurementIdForFilm ? { ...m, pelicula: filmName } : m
        );
        handleMeasurementsChange(updatedMeasurements);
        
        setIsFilmSelectionModalOpen(false);
        setEditingMeasurementIdForFilm(null);
    }, [editingMeasurementIdForFilm, measurements, handleMeasurementsChange]);

    const handleApplyFilmToAll = useCallback((filmName: string) => {
        setIsApplyFilmToAllModalOpen(false);
        setFilmToApplyToAll(filmName);
    }, []);
    
    const handleConfirmApplyFilmToAll = useCallback(() => {
        if (!filmToApplyToAll) return;

        const updatedMeasurements = measurements.map(m => ({ ...m, pelicula: filmToApplyToAll }));
        handleMeasurementsChange(updatedMeasurements);
        setFilmToApplyToAll(null);
    }, [filmToApplyToAll, measurements, handleMeasurementsChange]);

    const handleAddNewFilmFromSelection = useCallback((filmName: string) => {
        setIsFilmSelectionModalOpen(false);
        setIsApplyFilmToAllModalOpen(false);
        setEditingMeasurementIdForFilm(null);
        const newFilmTemplate: Film = {
            nome: filmName,
            preco: 0,
            maoDeObra: 0, // Adicionado
            garantiaFabricante: 0,
            garantiaMaoDeObra: 30,
            uv: 0,
            ir: 0,
            vtl: 0,
            espessura: 0,
            tser: 0,
            imagens: [],
        };
        handleOpenFilmModal(newFilmTemplate);
    }, [handleOpenFilmModal]);
    
    const handleAddNewClientFromSelection = useCallback((clientName: string) => {
        setIsClientSelectionModalOpen(false);
        setClientModalMode('add');
        setNewClientName(clientName);
        setAiClientData(undefined);
        setIsClientModalOpen(true);
    }, []);

    const handleOpenEditMeasurementModal = useCallback((measurement: UIMeasurement) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurement(measurement);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleCloseEditMeasurementModal = useCallback(() => {
        setEditingMeasurement(null);
    }, []);

    const handleUpdateEditingMeasurement = useCallback((updatedData: Partial<Measurement>) => {
        if (!editingMeasurement) return;
        const updatedMeasurement = { ...editingMeasurement, ...updatedData };
        setEditingMeasurement(updatedMeasurement);
        const newMeasurements = measurements.map(m => m.id === updatedMeasurement.id ? updatedMeasurement : m);
        handleMeasurementsChange(newMeasurements);
    }, [editingMeasurement, measurements, handleMeasurementsChange]);
    
    const handleRequestDeleteMeasurement = useCallback((measurementId: number) => {
        handleCloseEditMeasurementModal(); 
        setMeasurementToDeleteId(measurementId); 
    }, [handleCloseEditMeasurementModal]);
    
    const handleConfirmDeleteIndividualMeasurement = useCallback(() => {
        if (measurementToDeleteId !== null) {
            handleMeasurementsChange(measurements.filter(m => m.id !== measurementToDeleteId));
            setMeasurementToDeleteId(null);
        }
    }, [measurementToDeleteId, measurements, handleMeasurementsChange]);
    
    const handleDeleteMeasurementFromEditModal = useCallback(() => {
        if (editingMeasurement) {
            handleRequestDeleteMeasurement(editingMeasurement.id);
        }
    }, [editingMeasurement, handleRequestDeleteMeasurement]);
    
    const handleDeleteMeasurementFromGroup = useCallback((measurementId: number) => {
        handleRequestDeleteMeasurement(measurementId);
    }, [handleRequestDeleteMeasurement]);


    const handleCloseAgendamentoModal = useCallback(() => {
        setSchedulingInfo(null);
    }, []);

    const handleSaveAgendamento = useCallback(async (agendamentoData: Omit<Agendamento, 'id'> | Agendamento) => {
        try {
            const savedAgendamento = await db.saveAgendamento(agendamentoData);
    
            if (savedAgendamento.pdfId) {
                const allPdfsFromDb = await db.getAllPDFs();
                const pdfToUpdate = allPdfsFromDb.find(p => p.id === savedAgendamento.pdfId);
                
                if (pdfToUpdate && pdfToUpdate.agendamentoId !== savedAgendamento.id) {
                    await db.updatePDF({ ...pdfToUpdate, agendamentoId: savedAgendamento.id });
                }
            }
            
            await Promise.all([loadAgendamentos(), loadAllPdfs()]);
    
            handleCloseAgendamentoModal();
        } catch (error) {
            console.error("Erro ao salvar agendamento:", error);
            alert("Não foi possível salvar o agendamento. Tente novamente.");
        }
    }, [handleCloseAgendamentoModal, loadAgendamentos, loadAllPdfs]);

    const handleRequestDeleteAgendamento = useCallback((agendamento: Agendamento) => {
        handleCloseAgendamentoModal();
        setAgendamentoToDelete(agendamento);
    }, [handleCloseAgendamentoModal]);

    const handleConfirmDeleteAgendamento = useCallback(async () => {
        if (!agendamentoToDelete?.id) return;

        try {
            const agendamentoId = agendamentoToDelete.id;
            const allPdfsFromDb = await db.getAllPDFs();
            const pdfToUnlink = allPdfsFromDb.find(p => p.agendamentoId === agendamentoId);
            
            await db.deleteAgendamento(agendamentoId);
            
            if (pdfToUnlink) {
                const updatedPdf = { ...pdfToUnlink };
                delete updatedPdf.agendamentoId;
                await db.updatePDF(updatedPdf);
            }
            
            await Promise.all([loadAgendamentos(), loadAllPdfs()]);
        } catch (error) {
            console.error("Erro ao excluir agendamento:", error);
            alert("Não foi possível excluir o agendamento. Tente novamente.");
        } finally {
            setAgendamentoToDelete(null);
        }
    }, [agendamentoToDelete, loadAgendamentos, loadAllPdfs]);
    
    const handleAddNewClientFromAgendamento = useCallback((clientName: string) => {
        handleCloseAgendamentoModal();
        setPostClientSaveAction('openAgendamentoModal');
        setClientModalMode('add');
        setNewClientName(clientName);
        setAiClientData(undefined);
        setIsClientModalOpen(true);
    }, [handleCloseAgendamentoModal]);

    const handleCreateNewAgendamento = useCallback((date: Date) => {
        const startDate = new Date(date);
        startDate.setHours(9, 0, 0, 0);

        handleOpenAgendamentoModal({
            agendamento: {
                start: startDate.toISOString(),
            }
        });
    }, [handleOpenAgendamentoModal]);

    const handleOpenClientSelectionModal = useCallback(() => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setIsClientSelectionModalOpen(true);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleOpenDiscountModal = useCallback((measurement: UIMeasurement) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurementForDiscount(measurement);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleCloseDiscountModal = useCallback(() => {
        setEditingMeasurementForDiscount(null);
    }, []);

    const handleSaveDiscount = useCallback((discount: number, discountType: 'percentage' | 'fixed') => {
        if (!editingMeasurementForDiscount) return;
        
        const updatedMeasurements = measurements.map(m => 
            m.id === editingMeasurementForDiscount.id ? { ...m, discount, discountType } : m
        );
        handleMeasurementsChange(updatedMeasurements);
        handleCloseDiscountModal();
    }, [editingMeasurementForDiscount, measurements, handleMeasurementsChange, handleCloseDiscountModal]);

    const handleOpenApiKeyModal = useCallback((provider: 'gemini' | 'openai') => {
        setApiKeyModalProvider(provider);
        setIsApiKeyModalOpen(true);
    }, []);

    const handleSaveApiKey = useCallback(async (apiKey: string) => {
        if (userInfo) {
            const updatedUserInfo = {
                ...userInfo,
                aiConfig: {
                    ...(userInfo.aiConfig || { provider: 'gemini' }),
                    provider: apiKeyModalProvider,
                    apiKey: apiKey,
                }
            };
            await handleSaveUserInfo(updatedUserInfo);
            setIsApiKeyModalOpen(false);
        }
    }, [userInfo, handleSaveUserInfo, apiKeyModalProvider]);

    const handleSaveGeneralDiscount = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        handleGeneralDiscountChange(discount);
        setIsGeneralDiscountModalOpen(false);
    }, [handleGeneralDiscountChange]);
    
    const handleOpenGallery = useCallback((images: string[], initialIndex: number) => {
        setIsGalleryOpen(true);
        setGalleryImages(images);
        setGalleryInitialIndex(initialIndex);
    }, []);

    const handleCloseGallery = useCallback(() => {
        setIsGalleryOpen(false);
        setGalleryImages([]);
        setGalleryInitialIndex(0);
    }, []);

    const handleOpenAIClientModal = useCallback(() => {
        setIsClientModalOpen(false);
        setIsAIClientModalOpen(true);
    }, []);


    const LoadingSpinner = () => (
        <div className="flex items-center justify-center h-full min-h-[300px]">
            <div className="loader"></div>
        </div>
    );

    const handlePromptPwaInstall = useCallback(() => {
        if (deferredPrompt) {
            promptInstall();
        } else {
            alert("Para instalar, use o menu 'Compartilhar' do seu navegador e selecione 'Adicionar à Tela de Início'.");
        }
    }, [deferredPrompt, promptInstall]);

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


    const renderContent = () => {
        if (isLoading) {
            return <LoadingSpinner />;
        }

        if (activeTab === 'settings') {
            if (userInfo) {
                return (
                    <Suspense fallback={<LoadingSpinner />}>
                        <UserSettingsView
                            userInfo={userInfo}
                            onSave={handleSaveUserInfo}
                            onOpenPaymentMethods={() => setIsPaymentModalOpen(true)}
                            onOpenApiKeyModal={handleOpenApiKeyModal}
                            isPwaInstalled={isInstalled}
                            onPromptPwaInstall={handlePromptPwaInstall}
                        />
                    </Suspense>
                );
            }
            return null;
        }

        if (activeTab === 'history') {
            if (!hasLoadedHistory) {
                loadAllPdfs();
                setHasLoadedHistory(true);
            }
            return (
                <Suspense fallback={<LoadingSpinner />}>
                    <PdfHistoryView
                        pdfs={allSavedPdfs}
                        clients={clients}
                        agendamentos={agendamentos}
                        onDelete={handleRequestDeletePdf}
                        onDownload={downloadBlob}
                        onUpdateStatus={handleUpdatePdfStatus}
                        onSchedule={handleOpenAgendamentoModal}
                        onGenerateCombinedPdf={handleGenerateCombinedPdf}
                    />
                </Suspense>
            );
        }
        
        if (activeTab === 'agenda') {
            if (!hasLoadedAgendamentos) {
                loadAgendamentos();
                setHasLoadedAgendamentos(true);
            }
            return (
                <Suspense fallback={<LoadingSpinner />}>
                    <AgendaView
                        agendamentos={agendamentos}
                        pdfs={allSavedPdfs}
                        clients={clients}
                        onEditAgendamento={(agendamento) => {
                            const pdf = allSavedPdfs.find(p => p.id === agendamento.pdfId);
                            setSchedulingInfo({ agendamento, pdf });
                        }}
                        onCreateNewAgendamento={handleCreateNewAgendamento}
                    />
                </Suspense>
            );
        }


        if (activeTab === 'films') {
            return (
                <Suspense fallback={<LoadingSpinner />}>
                    <FilmListView
                        films={films}
                        onAdd={() => handleOpenFilmModal(null)}
                        onEdit={handleOpenFilmModal}
                        onDelete={handleRequestDeleteFilm}
                        onOpenGallery={handleOpenGallery}
                    />
                </Suspense>
            );
        }

        if (clients.length === 0) {
            return (
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[300px] bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-users fa-2x text-slate-500"></i>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Crie seu Primeiro Cliente</h3>
                    <p className="mt-2 text-slate-600 max-w-xs mx-auto">Tudo começa com um cliente. Adicione os dados para começar a gerar orçamentos.</p>
                    <button
                        onClick={() => handleOpenClientModal('add')}
                        className="mt-6 px-6 py-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition duration-300 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar Cliente
                    </button>
                </div>
            );
        }
        if (selectedClientId && measurements.length > 0) {
             return (
                <MeasurementList
                    measurements={measurements}
                    films={films}
                    onMeasurementsChange={handleMeasurementsChange}
                    onOpenFilmModal={handleOpenFilmModal}
                    onOpenFilmSelectionModal={handleOpenFilmSelectionModal}
                    onOpenClearAllModal={() => setIsClearAllModalOpen(true)}
                    onOpenApplyFilmToAllModal={() => setIsApplyFilmToAllModalOpen(true)}
                    numpadConfig={numpadConfig}
                    onOpenNumpad={handleOpenNumpad}
                    activeMeasurementId={numpadConfig.measurementId}
                    onOpenEditModal={handleOpenEditMeasurementModal}
                    onOpenDiscountModal={handleOpenDiscountModal}
                    swipeDirection={swipeDirection}
                    swipeDistance={swipeDistance}
                    onDeleteMeasurement={handleDeleteMeasurementFromGroup}
                    totalM2={totals.totalM2}
                />
            );
        }
        if (selectedClientId && measurements.length === 0) {
             return (
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[300px] bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-ruler-combined fa-2x text-slate-500"></i>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Adicione a Primeira Medida</h3>
                    <p className="mt-2 text-slate-600 max-w-xs mx-auto">Insira as dimensões (largura, altura, etc.) para calcular o orçamento deste cliente.</p>
                    <button
                        onClick={addMeasurement}
                        className="mt-6 px-6 py-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition duration-300 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Adicionar Medida
                    </button>
                </div>
            );
        }
         return (
            <div className="text-center text-slate-500 p-8 flex flex-col items-center justify-center h-full min-h-[300px]">
                <i className="fas fa-user-check fa-3x mb-4 text-slate-300"></i>
                <h3 className="text-xl font-semibold">Selecione um Cliente</h3>
                <p>Use o menu acima para escolher um cliente e ver suas medidas.</p>
            </div>
        );
    }

    const measurementToDelete = measurements.find(m => m.id === measurementToDeleteId);

    return (
        <div className="h-full font-roboto flex flex-col">
            <main ref={mainRef} className="flex-grow overflow-y-auto pb-36 sm:pb-0">
                <div className="sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-slate-200">
                    <div className="container mx-auto px-2 sm:px-4 w-full max-w-2xl">
                        <div className="pt-2 pb-1 sm:py-3">
                            <Header
                                activeTab={activeTab}
                                onTabChange={handleTabChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-0.5 sm:px-4 py-4 sm:py-8 w-full max-w-2xl">
                    <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                       {deferredPrompt && !isInstalled && (
                            <div className="mb-4 p-3 bg-blue-100 border border-blue-200 rounded-lg flex justify-between items-center">
                                <p className="text-sm text-blue-800 font-medium">Instale o app para usar offline!</p>
                                <button 
                                    onClick={handlePromptPwaInstall}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Instalar
                                </button>
                            </div>
                       )}
                       
                       {activeTab === 'client' ? (
                           <>
                               {clients.length > 0 ? (
                                   <div className="bg-slate-100 p-2 px-2 rounded-xl">
                                       <ClientBar
                                           key={clientTransitionKey}
                                           selectedClient={selectedClient}
                                           onSelectClientClick={handleOpenClientSelectionModal}
                                           onAddClient={() => handleOpenClientModal('add')}
                                           onEditClient={() => handleOpenClientModal('edit')}
                                           onDeleteClient={handleDeleteClient}
                                           onSwipeLeft={goToNextClient}
                                           onSwipeRight={goToPrevClient}
                                       />
                                       
                                       {proposalOptions.length > 0 && activeOptionId && (
                                           <ProposalOptionsCarousel
                                               options={proposalOptions}
                                               activeOptionId={activeOptionId}
                                               onSelectOption={setActiveOptionId}
                                               onRenameOption={handleRenameProposalOption}
                                               onDeleteOption={handleDeleteProposalOption}
                                               onAddOption={handleAddProposalOption}
                                               onSwipeDirectionChange={handleSwipeDirectionChange}
                                           />
                                       )}
                                       
                                       <div id="contentContainer" className="w-full min-h-[300px]">
                                           {renderContent()}
                                       </div>
                                   </div>
                               ) : (
                                   <div id="contentContainer" className="w-full min-h-[300px]">
                                       {renderContent()}
                                   </div>
                               )}
                           </>
                       ) : ['history', 'agenda'].includes(activeTab) ? (
                           <div className="bg-blue-50 -m-4 sm:-m-6 p-4 sm:p-6 rounded-2xl">
                               <div id="contentContainer" className="w-full min-h-[300px]">
                                   {renderContent()}
                               </div>
                           </div>
                       ) : (
                           <div id="contentContainer" className="w-full min-h-[300px]">
                               {renderContent()}
                           </div>
                       )}


                        {activeTab === 'client' && selectedClientId && (
                            <>
                                <div className="hidden sm:block mt-6 pt-6 border-t border-slate-200">
                                   <SummaryBar 
                                        totals={totals}
                                        generalDiscount={generalDiscount}
                                        onOpenGeneralDiscountModal={() => setIsGeneralDiscountModalOpen(true)}
                                        isDesktop
                                    />
                                   <ActionsBar
                                        onAddMeasurement={addMeasurement}
                                        onDuplicateMeasurements={duplicateAllMeasurements}
                                        onGeneratePdf={handleGeneratePdf}
                                        isGeneratingPdf={pdfGenerationStatus === 'generating'}
                                        onOpenAIModal={() => setIsAIMeasurementModalOpen(true)}
                                   />
                                </div>
                                <MobileFooter
                                    totals={totals}
                                    generalDiscount={generalDiscount}
                                    onOpenGeneralDiscountModal={() => setIsGeneralDiscountModalOpen(true)}
                                    onAddMeasurement={addMeasurement}
                                    onDuplicateMeasurements={duplicateAllMeasurements}
                                    onGeneratePdf={handleGeneratePdf}
                                    isGeneratingPdf={pdfGenerationStatus === 'generating'}
                                    onOpenAIModal={() => setIsAIMeasurementModalOpen(true)}
                                />
                            </>
                        )}
                    </div>
                </div>
            </main>

            {newVersionAvailable && (
                <UpdateNotification onUpdate={handleUpdate} />
            )}
            
            {isClientModalOpen && (
                <ClientModal
                    isOpen={isClientModalOpen}
                    onClose={() => {
                        setIsClientModalOpen(false);
                        setNewClientName('');
                        setAiClientData(undefined);
                    }}
                    onSave={handleSaveClient}
                    mode={clientModalMode}
                    client={clientModalMode === 'edit' ? selectedClient : null}
                    initialName={newClientName}
                    aiData={aiClientData}
                    onOpenAIModal={handleOpenAIClientModal}
                />
            )}
            {isClientSelectionModalOpen && (
                <ClientSelectionModal
                    isOpen={isClientSelectionModalOpen}
                    onClose={() => setIsClientSelectionModalOpen(false)}
                    clients={clients}
                    onClientSelect={setSelectedClientId}
                    isLoading={isLoading}
                    onAddNewClient={handleAddNewClientFromSelection}
                />
            )}
            {isPaymentModalOpen && userInfo && (
                <PaymentMethodsModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSave={handleSavePaymentMethods}
                    paymentMethods={userInfo.payment_methods}
                />
            )}
            {isFilmModalOpen && (
                 <FilmModal
                    isOpen={isFilmModalOpen}
                    onClose={() => {
                        setIsFilmModalOpen(false);
                        setEditingFilm(null);
                    }}
                    onSave={handleSaveFilm}
                    onDelete={handleDeleteFilm}
                    film={editingFilm}
                 />
            )}
            {isFilmSelectionModalOpen && (
                <FilmSelectionModal
                    isOpen={isFilmSelectionModalOpen}
                    onClose={() => {
                        setIsFilmSelectionModalOpen(false);
                        setEditingMeasurementIdForFilm(null);
                    }}
                    films={films}
                    onSelect={handleSelectFilmForMeasurement}
                    onAddNewFilm={handleAddNewFilmFromSelection}
                    onEditFilm={handleEditFilmFromSelection}
                    onDeleteFilm={handleRequestDeleteFilm}
                />
            )}
             {isApplyFilmToAllModalOpen && (
                <FilmSelectionModal
                    isOpen={isApplyFilmToAllModalOpen}
                    onClose={() => setIsApplyFilmToAllModalOpen(false)}
                    films={films}
                    onSelect={handleApplyFilmToAll}
                    onAddNewFilm={handleAddNewFilmFromSelection}
                    onEditFilm={handleEditFilmFromSelection}
                    onDeleteFilm={handleRequestDeleteFilm}
                />
            )}
             {schedulingInfo && (
                <AgendamentoModal
                    isOpen={!!schedulingInfo}
                    onClose={handleCloseAgendamentoModal}
                    onSave={handleSaveAgendamento}
                    onDelete={handleRequestDeleteAgendamento}
                    schedulingInfo={schedulingInfo}
                    clients={clients}
                    onAddNewClient={handleAddNewClientFromAgendamento}
                    userInfo={userInfo}
                    agendamentos={agendamentos}
                />
            )}
            {editingMeasurement && (
                <EditMeasurementModal
                    isOpen={!!editingMeasurement}
                    onClose={handleCloseEditMeasurementModal}
                    measurement={editingMeasurement}
                    films={films}
                    onUpdate={handleUpdateEditingMeasurement}
                    onDelete={handleDeleteMeasurementFromEditModal}
                    onDuplicate={() => {
                        const measurementToDuplicate = measurements.find(m => m.id === editingMeasurement.id);
                        if (measurementToDuplicate) {
                            const newMeasurement: UIMeasurement = { 
                                ...measurementToDuplicate, 
                                id: Date.now(), 
                                isNew: false
                            };
                            const index = measurements.findIndex(m => m.id === measurementToDuplicate.id);
                            const newMeasurements = [...measurements];
                            newMeasurements.splice(index + 1, 0, newMeasurement);
                            handleMeasurementsChange(newMeasurements);
                        }
                        handleCloseEditMeasurementModal();
                    }}
                    onOpenFilmModal={handleOpenFilmModal}
                    onOpenFilmSelectionModal={handleOpenFilmSelectionModal}
                    numpadConfig={numpadConfig}
                    onOpenNumpad={handleOpenNumpad}
                />
            )}
            {isClearAllModalOpen && (
                <ConfirmationModal
                    isOpen={isClearAllModalOpen}
                    onClose={() => setIsClearAllModalOpen(false)}
                    onConfirm={handleConfirmClearAll}
                    title="Confirmar Exclusão Total"
                    message="Tem certeza que deseja apagar TODAS as medidas para esta opção? Esta ação não pode ser desfeita."
                    confirmButtonText="Sim, Excluir Tudo"
                    confirmButtonVariant="danger"
                />
            )}
             {filmToDeleteName !== null && (
                <ConfirmationModal
                    isOpen={filmToDeleteName !== null}
                    onClose={() => setFilmToDeleteName(null)}
                    onConfirm={handleConfirmDeleteFilm}
                    title="Confirmar Exclusão de Película"
                    message={<>Tem certeza que deseja apagar a película <strong>{filmToDeleteName}</strong>? Esta ação não pode ser desfeita.</>}
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
            {filmToApplyToAll !== null && (
                <ConfirmationModal
                    isOpen={filmToApplyToAll !== null}
                    onClose={() => setFilmToApplyToAll(null)}
                    onConfirm={handleConfirmApplyFilmToAll}
                    title="Aplicar Película a Todos"
                    message={<>Tem certeza que deseja aplicar a película <strong>{filmToApplyToAll}</strong> a todas as {measurements.length} medidas? Isso substituirá as películas já selecionadas.</>}
                    confirmButtonText="Sim, Aplicar a Todas"
                />
            )}
            {isDeleteClientModalOpen && selectedClient && (
                <ConfirmationModal
                    isOpen={isDeleteClientModalOpen}
                    onClose={() => setIsDeleteClientModalOpen(false)}
                    onConfirm={handleConfirmDeleteClient}
                    title="Confirmar Exclusão de Cliente"
                    message={
                        <>
                            <p className="text-slate-700">Tem certeza que deseja apagar o cliente <strong>{selectedClient.nome}</strong>?</p>
                            <div className="mt-4 bg-red-50 p-3 rounded-lg border border-red-200 text-sm text-red-800">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <i className="fas fa-exclamation-triangle text-red-500 h-5 w-5" aria-hidden="true"></i>
                                    </div>
                                    <div className="ml-3">
                                        <p>
                                            Todas as suas medidas, opções de proposta e histórico de orçamentos (PDFs) serão <strong>perdidos permanentemente</strong>. Esta ação não pode ser desfeita.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    }
                    confirmButtonText="Sim, Excluir Cliente"
                    confirmButtonVariant="danger"
                />
            )}
            {pdfToDeleteId !== null && (
                <ConfirmationModal
                    isOpen={pdfToDeleteId !== null}
                    onClose={() => setPdfToDeleteId(null)}
                    onConfirm={handleConfirmDeletePdf}
                    title="Confirmar Exclusão de Orçamento"
                    message="Tem certeza que deseja apagar este orçamento do histórico? Esta ação não pode ser desfeita."
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
            {agendamentoToDelete && (
                <ConfirmationModal
                    isOpen={!!agendamentoToDelete}
                    onClose={() => setAgendamentoToDelete(null)}
                    onConfirm={handleConfirmDeleteAgendamento}
                    title="Confirmar Exclusão"
                    message={
                        <>
                            Tem certeza que deseja apagar o agendamento para <strong>{agendamentoToDelete.clienteNome}</strong> em <strong>{new Date(agendamentoToDelete.start).toLocaleDateString('pt-BR')}</strong>?
                        </>
                    }
                    confirmButtonText="Sim, Excluir Agendamento"
                    confirmButtonVariant="danger"
                />
            )}
             {pdfGenerationStatus !== 'idle' && (
                <PdfGenerationStatusModal
                    status={pdfGenerationStatus as 'generating' | 'success'}
                    onClose={handleClosePdfStatusModal}
                    onGoToHistory={handleGoToHistoryFromPdf}
                />
            )}
             {editingMeasurementForDiscount && (
                <DiscountModal
                    isOpen={!!editingMeasurementForDiscount}
                    onClose={handleCloseDiscountModal}
                    onSave={handleSaveDiscount}
                    initialValue={editingMeasurementForDiscount.discount}
                    initialType={editingMeasurementForDiscount.discountType}
                />
            )}
            {isGeneralDiscountModalOpen && (
                <GeneralDiscountModal
                    isOpen={isGeneralDiscountModalOpen}
                    onClose={() => setIsGeneralDiscountModalOpen(false)}
                    onSave={handleSaveGeneralDiscount}
                    initialValue={generalDiscount.value}
                    initialType={generalDiscount.type}
                />
            )}
            {isAIMeasurementModalOpen && (
                <AIMeasurementModal
                    isOpen={isAIMeasurementModalOpen}
                    onClose={() => setIsAIMeasurementModalOpen(false)}
                    onProcess={handleProcessAIInput}
                    isProcessing={isProcessingAI}
                    provider={userInfo?.aiConfig?.provider || 'gemini'}
                />
            )}
            {isAIClientModalOpen && (
                <AIClientModal
                    isOpen={isAIClientModalOpen}
                    onClose={() => setIsAIClientModalOpen(false)}
                    onProcess={handleProcessAIClientInput}
                    isProcessing={isProcessingAI}
                    provider={userInfo?.aiConfig?.provider || 'gemini'}
                />
            )}
            {isApiKeyModalOpen && userInfo && (
                <ApiKeyModal
                    isOpen={isApiKeyModalOpen}
                    onClose={() => setIsApiKeyModalOpen(false)}
                    onSave={handleSaveApiKey}
                    currentApiKey={userInfo.aiConfig?.provider === apiKeyModalProvider ? userInfo.aiConfig?.apiKey : ''}
                    provider={apiKeyModalProvider}
                />
            )}
            {numpadConfig.isOpen && (
                <CustomNumpad
                    ref={numpadRef}
                    onInput={handleNumpadInput}
                    onDelete={handleNumpadDelete}
                    onDone={handleNumpadDone}
                    onClose={handleNumpadClose}
                    onDuplicate={handleNumpadDuplicate}
                    onClear={handleNumpadClear}
                    onAddGroup={handleNumpadAddGroup}
                    activeField={numpadConfig.field}
                />
            )}
            {isGalleryOpen && (
                <ImageGalleryModal
                    isOpen={isGalleryOpen}
                    onClose={handleCloseGallery}
                    images={galleryImages}
                    initialIndex={galleryInitialIndex}
                />
            )}
            {isDuplicateAllModalOpen && activeOption && (
                <ConfirmationModal
                    isOpen={isDuplicateAllModalOpen}
                    onClose={() => setIsDuplicateAllModalOpen(false)}
                    onConfirm={handleConfirmDuplicateAll}
                    title="Duplicar Opção de Proposta"
                    message={
                        <>
                            <p className="text-slate-700">
                                Você está prestes a duplicar a opção atual "<strong>{activeOption.name}</strong>" ({activeOption.measurements.length} medidas) e criar uma nova opção de proposta.
                            </p>
                            <p className="mt-2 text-sm text-slate-600">
                                Deseja continuar?
                            </p>
                        </>
                    }
                    confirmButtonText="Sim, Duplicar Opção"
                />
            )}
            {measurementToDeleteId !== null && measurementToDelete && (
                <ConfirmationModal
                    isOpen={measurementToDeleteId !== null}
                    onClose={() => setMeasurementToDeleteId(null)}
                    onConfirm={handleConfirmDeleteIndividualMeasurement}
                    title="Confirmar Exclusão de Medida"
                    message={
                        <>
                            Tem certeza que deseja apagar a medida de <strong>{measurementToDelete.largura}x{measurementToDelete.altura}</strong> ({measurementToDelete.ambiente})?
                            Esta ação não pode ser desfeita.
                        </>
                    }
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
        </div>
    );
};

export default App;