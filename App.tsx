import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { Client, Measurement, UserInfo, Film, PaymentMethods, SavedPDF, Agendamento, ProposalOption, ActiveTab } from './types';
import * as db from './services/db';
import { generatePDF } from './services/pdfGenerator';
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
import { usePwaInstallPrompt } from './src/hooks/usePwaInstallPrompt';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";


const UserSettingsView = lazy(() => import('./components/views/UserSettingsView'));
const PdfHistoryView = lazy(() => import('./components/views/PdfHistoryView'));
const FilmListView = lazy(() => import('./components/views/FilmListView'));
const AgendaView = lazy(() => import('./components/views/AgendaView'));


type UIMeasurement = Measurement & { isNew?: boolean };
// type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda'; // Removido daqui, está em types.ts

type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: 'largura' | 'altura' | 'quantidade' | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};

export type SchedulingInfo = {
    agendamento: Agendamento;
    pdf?: SavedPDF;
} | {
    pdf: SavedPDF;
    agendamento?: Agendamento;
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
    
    const [isLoading, setIsLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [proposalOptions, setProposalOptions] = useState<ProposalOption[]>([]);
    const [activeOptionId, setActiveOptionId] = useState<number | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [films, setFilms] = useState<Film[]>([]);
    const [allSavedPdfs, setAllSavedPdfs] = useState<SavedPDF[]>([]);
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    const [activeTab, setActiveTab] = useState<ActiveTab>('client'); // Estado local inicializado
    const [isDirty, setIsDirty] = useState(false);
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
    const [hasLoadedAgendamentos, setHasLoadedAgendamentos] = useState(false);
    const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
    const [swipeDistance, setSwipeDistance] = useState(0);
    const [clientTransitionKey, setClientTransitionKey] = useState(0);


    // Modal States
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [clientModalMode, setClientModalMode] = useState<'add' | 'edit'>('add');
    const [clientToDeleteId, setClientToDeleteId] = useState<number | null>(null);
    const [postClientSaveAction, setPostClientSaveAction] = useState<{ type: 'select' | 'add' | 'edit', id?: number } | null>(null);
    const [isClientSelectionModalOpen, setIsClientSelectionModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isFilmModalOpen, setIsFilmModalOpen] = useState(false);
    const [filmToEdit, setFilmToEdit] = useState<Film | null>(null);
    const [filmToDeleteName, setFilmToDeleteName] = useState<string | null>(null);
    const [isFilmSelectionModalOpen, setIsFilmSelectionModalOpen] = useState(false);
    const [editingMeasurementIdForFilm, setEditingMeasurementIdForFilm] = useState<number | null>(null);
    const [isApplyFilmToAllModalOpen, setIsApplyFilmToAllModalOpen] = useState(false);
    const [filmToApplyToAll, setFilmToApplyToAll] = useState<string | null>(null);
    const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
    const [pdfToDeleteId, setPdfToDeleteId] = useState<number | null>(null);
    const [agendamentoToDelete, setAgendamentoToDelete] = useState<Agendamento | null>(null);
    const [pdfGenerationStatus, setPdfGenerationStatus] = useState<'idle' | 'generating' | 'success'>('idle');
    const [schedulingInfo, setSchedulingInfo] = useState<SchedulingInfo | null>(null);
    const [editingMeasurement, setEditingMeasurement] = useState<UIMeasurement | null>(null);
    const [measurementToDeleteId, setMeasurementToDeleteId] = useState<number | null>(null);
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
    const [editingMeasurementForDiscount, setEditingMeasurementForDiscount] = useState<UIMeasurement | null>(null);
    const [isGeneralDiscountModalOpen, setIsGeneralDiscountModalOpen] = useState(false);
    const [isAIMeasurementModalOpen, setIsAIMeasurementModalOpen] = useState(false);
    const [isAIClientModalOpen, setIsAIClientModalOpen] = useState(false);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [apiKeyModalProvider, setApiKeyModalProvider] = useState<'gemini' | 'openai'>('gemini');
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
    const [isDuplicateAllModalOpen, setIsDuplicateAllModalOpen] = useState(false);
    const [isAIClientModalOpenForClient, setIsAIClientModalOpenForClient] = useState(false);
    const [aiClientData, setAiClientData] = useState<Partial<Client> | null>(null);
    
    const mainRef = useRef<HTMLElement>(null);
    const numpadRef = useRef<HTMLDivElement>(null);
    const [numpadConfig, setNumpadConfig] = useState<NumpadConfig>({
        isOpen: false,
        measurementId: null,
        field: null,
        currentValue: '',
        shouldClearOnNextInput: false,
    });

    // --- Hooks & Handlers ---

    // Funções de Load (Declaradas aqui para serem usadas nos useEffects)
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
        const loadedFilms = await db.getAllFilms();
        setFilms(loadedFilms);
    }, []);

    const loadAllPdfs = useCallback(async () => {
        if (!selectedClientId) return;
        const loadedPdfs = await db.getPDFsForClient(selectedClientId);
        setAllSavedPdfs(loadedPdfs);
    }, [selectedClientId]);
    
    const loadAgendamentos = useCallback(async () => {
        const loadedAgendamentos = await db.getAllAgendamentos();
        setAgendamentos(loadedAgendamentos);
    }, []);

    const loadProposalOptions = useCallback(async (clientId: number) => {
        const savedOptions = await db.getProposalOptions(clientId);
        
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
    }, []);


    // Efeitos de Inicialização e Persistência
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            const loadedUserInfo = await db.getUserInfo();
            
            setUserInfo(loadedUserInfo);
            
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            const initialTab: ActiveTab = tabParam && ['client', 'films', 'settings', 'history', 'agenda'].includes(tabParam) 
                ? tabParam as ActiveTab 
                : loadedUserInfo.activeTab || 'client';
            
            setActiveTab(initialTab);
            
            await loadClients(); 
            await loadFilms();
            
            setIsLoading(false);
        };
        init();
    }, [loadClients, loadFilms]);

    useEffect(() => {
        if (selectedClientId !== null && userInfo) {
            const updatedUserInfo = { ...userInfo, lastSelectedClientId: selectedClientId };
            setUserInfo(updatedUserInfo);
            db.saveUserInfo(updatedUserInfo);
        }
        setClientTransitionKey(prev => prev + 1);
    }, [selectedClientId, userInfo]);
    
    const handleTabChange = useCallback((tab: ActiveTab) => {
        setActiveTab(tab);
    }, []);

    useEffect(() => {
        if (userInfo && userInfo.activeTab !== activeTab) {
            const updatedUserInfo = { ...userInfo, activeTab: activeTab };
            setUserInfo(updatedUserInfo);
            db.saveUserInfo(updatedUserInfo);
        }
    }, [activeTab, userInfo]);


    useEffect(() => {
        if (selectedClientId) {
            loadProposalOptions(selectedClientId);
            loadAllPdfs(); 
            loadAgendamentos(); 
        }
    }, [selectedClientId, loadProposalOptions, loadAllPdfs, loadAgendamentos]);

    const activeOption = useMemo(() => {
        return proposalOptions.find(opt => opt.id === activeOptionId) || null;
    }, [proposalOptions, activeOptionId]);

    const measurements = activeOption?.measurements || [];

    const handleSaveChanges = useCallback(async () => {
        if (selectedClientId && proposalOptions.length > 0) {
            await db.saveProposalOptions(selectedClientId, proposalOptions);
            setIsDirty(false);
            
            // Removido o reload de clientes aqui para evitar loop
        }
    }, [selectedClientId, proposalOptions]);

    useEffect(() => {
        if (isDirty) {
            const timerId = setTimeout(() => {
                handleSaveChanges();
            }, 1500);

            return () => clearTimeout(timerId);
        }
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

    const duplicateAllMeasurements = useCallback(() => {
        if (!activeOption) return;
        const newMeasurements: UIMeasurement[] = activeOption.measurements.map((m, index) => ({
            ...m,
            id: Date.now() + index,
            isNew: false,
        }));
        handleMeasurementsChange(newMeasurements);
    }, [activeOption, handleMeasurementsChange]);
    
    const handleConfirmDuplicateAll = useCallback(() => {
        duplicateAllMeasurements();
        setIsDuplicateAllModalOpen(false);
    }, [duplicateAllMeasurements]);

    const handleAddProposalOption = useCallback(() => {
        const newOption: ProposalOption = {
            id: Date.now(),
            name: `Opção ${proposalOptions.length + 1}`,
            measurements: [],
            generalDiscount: { value: '', type: 'percentage' }
        };
        
        setProposalOptions(prev => [...prev, newOption]);
        setActiveOptionId(newOption.id);
        setIsDirty(true);
    }, [proposalOptions.length]);

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
        } else if (remainingOptions.length === 0) {
            setActiveOptionId(null);
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
    
    const handleOpenClientModal = useCallback((mode: 'add' | 'edit') => {
        setClientModalMode(mode);
        setIsClientModalOpen(true);
    }, []);
    
    const handleOpenAgendamentoModal = useCallback((info: SchedulingInfo) => {
        setSchedulingInfo(info);
    }, []);

    const handleSaveClient = useCallback(async (clientData: Omit<Client, 'id'> | Client) => {
        const newClient = await db.saveClient(clientData as Client);
        
        // Atualiza a lista de clientes sem recarregar tudo
        setClients(prevClients => {
            // Se estiver editando, atualiza o cliente existente
            if ('id' in clientData && clientData.id) {
                return prevClients.map(client => 
                    client.id === clientData.id ? { ...newClient, lastUpdated: new Date().toISOString() } : client
                ).sort((a, b) => {
                    const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
                    const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
                    return dateB - dateA;
                });
            } else {
                // Se estiver adicionando, coloca o novo cliente no início
                return [newClient, ...prevClients].sort((a, b) => {
                    const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
                    const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
                    return dateB - dateA;
                });
            }
        });
        
        // Define o cliente selecionado apenas se for um novo cliente
        if (!('id' in clientData) || !clientData.id) {
            setSelectedClientId(newClient.id!);
        }
        
        if (postClientSaveAction) {
            if (postClientSaveAction.type === 'select') {
                setSelectedClientId(newClient.id!);
            } else if (postClientSaveAction.type === 'add' && newClient.id) {
                setSelectedClientId(newClient.id);
            }
            // Se for 'edit', o selectedClientId já está correto
        }
        
        if (handleOpenAgendamentoModal && schedulingInfo) {
            // Se o agendamento foi aberto antes de salvar o cliente, atualiza o cliente no agendamento
            const updatedAgendamento: Agendamento = {
                ...schedulingInfo.agendamento,
                clienteId: newClient.id!,
                clienteNome: newClient.nome,
            };
            setSchedulingInfo({ ...schedulingInfo, agendamento: updatedAgendamento });
        }
        
        setIsClientModalOpen(false);
        setPostClientSaveAction(null);
    }, [clientModalMode, selectedClientId, postClientSaveAction, handleOpenAgendamentoModal, schedulingInfo]);

    const handleDeleteClient = useCallback(() => {
        if (selectedClientId) {
            setIsDeleteClientModalOpen(true);
        }
    }, [selectedClientId]);

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
        
        // Remove agendamentos relacionados
        await db.deleteAgendamentosForClient(selectedClientId);

        // Atualiza a lista de clientes sem recarregar tudo
        setClients(prevClients => prevClients.filter(c => c.id !== selectedClientId));
        
        // Seleciona o próximo cliente ou null se não houver mais
        setClients(prevClients => {
            const remainingClients = prevClients.filter(c => c.id !== selectedClientId);
            if (remainingClients.length > 0) {
                setSelectedClientId(remainingClients[0].id!);
            } else {
                setSelectedClientId(null);
            }
            return remainingClients;
        });
        
        setIsDeleteClientModalOpen(false);
    }, [selectedClientId]);

    const handleSaveUserInfo = useCallback(async (info: UserInfo) => {
        await db.saveUserInfo(info);
        setUserInfo(info);
    }, []);

    const handleSavePaymentMethods = useCallback(async (methods: PaymentMethods) => {
        if (userInfo) {
            const updatedInfo: UserInfo = { ...userInfo, payment_methods: methods };
            await db.saveUserInfo(updatedInfo);
            setUserInfo(updatedInfo);
        }
    }, [userInfo]);
    
    const handleOpenFilmModal = useCallback((film: Film | null) => {
        setFilmToEdit(film);
        setIsFilmModalOpen(true);
    }, []);

    const handleEditFilmFromSelection = useCallback((film: Film) => {
        setFilmToEdit(film);
        setIsFilmModalOpen(true);
        setIsFilmSelectionModalOpen(false);
    }, [handleOpenFilmModal]);

    const handleSaveFilm = useCallback(async (newFilmData: Film, originalFilm: Film | null) => {
        await db.saveFilm(newFilmData);
        await loadFilms();
        setIsFilmModalOpen(false);
        setFilmToEdit(null);
        
        // Se for edição, precisamos atualizar as medidas se o nome mudou
        if (originalFilm && originalFilm.nome !== newFilmData.nome) {
            await db.updateMeasurementFilmName(originalFilm.nome, newFilmData.nome);
            await loadAllPdfs(); // Atualiza PDFs
            // Não recarrega medidas, apenas garante que o nome do filme na proposta ativa seja atualizado
            if (activeOption) {
                const updatedMeasurements = activeOption.measurements.map(m => 
                    m.pelicula === originalFilm.nome ? { ...m, pelicula: newFilmData.nome } : m
                );
                handleMeasurementsChange(updatedMeasurements);
            }
        }
    }, [loadFilms, handleMeasurementsChange, activeOption]);

    const handleDeleteFilm = useCallback(async (filmName: string) => {
        await db.deleteFilm(filmName);
        await loadFilms();
        setFilmToDeleteName(null);
        await loadAllPdfs(); // Atualiza PDFs
        
        // Se o filme excluído estava sendo usado, remove das medidas
        if (activeOption) {
            const updatedMeasurements = activeOption.measurements
                .filter(m => m.pelicula !== filmName)
                .map(m => ({ ...m, isNew: false }));
            handleMeasurementsChange(updatedMeasurements);
        }
    }, [loadFilms, handleMeasurementsChange, activeOption, loadAllPdfs]);

    const handleRequestDeleteFilm = useCallback((filmName: string) => {
        setFilmToDeleteName(filmName);
    }, []);

    const handleConfirmDeleteFilm = useCallback(async () => {
        if (filmToDeleteName) {
            await handleDeleteFilm(filmToDeleteName);
        }
    }, [filmToDeleteName, handleDeleteFilm]);


    const downloadBlob = useCallback((blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);
    
    const totals = useMemo(() => {
        const activeMeasurements = measurements.filter(m => m.active);
        const subtotal = activeMeasurements.reduce((sum, m) => {
            const price = (m.discountType === 'percentage' && m.discount > 0 && m.discount <= 100) 
                ? (m.preco * (1 - m.discount / 100)) 
                : (m.discountType === 'fixed' && m.discount > 0) 
                ? (m.preco - m.discount)
                : m.preco;
            return sum + price;
        }, 0);
        
        const totalM2 = activeMeasurements.reduce((sum, m) => {
            const largura = parseFloat(String(m.largura).replace(',', '.')) || 0;
            const altura = parseFloat(String(m.altura).replace(',', '.')) || 0;
            return sum + (largura * altura * m.quantidade);
        }, 0);

        const pricePerM2Map = new Map<string, number>();
        films.forEach(f => {
            pricePerM2Map.set(f.nome, f.preco > 0 ? f.preco : (f.maoDeObra || 0));
        });

        let priceAfterItemDiscounts = 0;
        let totalItemDiscount = 0;

        activeMeasurements.forEach(m => {
            const price = (pricePerM2Map.get(m.pelicula) || 0) * (m.largura ? parseFloat(String(m.largura).replace(',', '.')) || 0 : 0) * (m.altura ? parseFloat(String(m.altura).replace(',', '.')) || 0 : 0) * m.quantidade;
            let itemDiscountAmount = 0;
            const discountValue = m.discount || 0;
            
            if (m.discountType === 'percentage' && discountValue > 0) {
                itemDiscountAmount = price * (discountValue / 100);
            } else if (m.discountType === 'fixed' && discountValue > 0) {
                itemDiscountAmount = discountValue;
            }
            
            totalItemDiscount += itemDiscountAmount;
            priceAfterItemDiscounts += Math.max(0, price - itemDiscountAmount);
        });
        
        const generalDiscount = proposalOptions.find(opt => opt.id === activeOptionId)?.generalDiscount || { value: '', type: 'percentage' };
        const finalGeneralDiscount = generalDiscount.value ? parseFloat(String(generalDiscount.value).replace(',', '.')) || 0 : 0;
        let generalDiscountAmount = 0;
        
        if (generalDiscount.type === 'percentage' && finalGeneralDiscount > 0) {
            generalDiscountAmount = priceAfterItemDiscounts * (finalGeneralDiscount / 100);
        } else if (generalDiscount.type === 'fixed' && finalGeneralDiscount > 0) {
            generalDiscountAmount = finalGeneralDiscount;
        }
        
        const finalTotal = Math.max(0, priceAfterItemDiscounts - generalDiscountAmount);

        return {
            totalM2,
            subtotal: priceAfterItemDiscounts + totalItemDiscount, // Subtotal antes do desconto geral
            totalItemDiscount,
            priceAfterItemDiscounts,
            generalDiscountAmount,
            finalTotal
        };
    }, [measurements, films, proposalOptions, activeOptionId]);

    const handleGeneratePdf = useCallback(async () => {
        if (!selectedClient || !userInfo || !activeOption || isDirty) return;
        if (measurements.length === 0) {
            alert("Adicione pelo menos uma medida antes de gerar o PDF.");
            return;
        }
        
        setPdfGenerationStatus('generating');
        
        try {
            const pdfBlob = await generatePDF(selectedClient, userInfo, measurements, films, activeOption.generalDiscount, totals);
            
            const nomeArquivo = `Orcamento_${selectedClient.nome.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            
            const newPdf: SavedPDF = {
                clienteId: selectedClient.id!,
                date: new Date().toISOString(),
                nomeArquivo,
                totalM2: totals.totalM2,
                totalPreco: totals.finalTotal,
                pdfBlob,
                status: 'pending',
                expirationDate: new Date(Date.now() + (userInfo.proposalValidityDays || 60) * 24 * 60 * 60 * 1000).toISOString(),
                proposalOptionName: activeOption.name,
            };
            
            await db.savePDF(newPdf);
            setAllSavedPdfs(prev => [newPdf, ...prev]);
            
            setPdfGenerationStatus('success');
            
            // Se houver um agendamento pendente vinculado a este orçamento (caso de edição), atualiza o PDF ID
            if (schedulingInfo && schedulingInfo.agendamento && !schedulingInfo.agendamento.pdfId) {
                const savedPdfId = await db.getLatestPdfIdForClient(selectedClient.id!);
                if (savedPdfId) {
                    const updatedAgendamento: Agendamento = {
                        ...schedulingInfo.agendamento,
                        pdfId: savedPdfId,
                    };
                    await db.saveAgendamento(updatedAgendamento);
                    setAgendamentos(prev => prev.map(ag => ag.id === schedulingInfo.agendamento.id ? updatedAgendamento : ag));
                    setSchedulingInfo(prev => prev ? { ...prev, agendamento: updatedAgendamento } : null);
                }
            }

            downloadBlob(pdfBlob, nomeArquivo);

        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            setPdfGenerationStatus('success'); // Muda para sucesso para fechar o modal, mas mostra erro
            alert("Falha ao gerar PDF. Verifique o console.");
        }
    }, [selectedClient, userInfo, activeOption, isDirty, handleSaveChanges, measurements, films, totals, selectedClientId, downloadBlob]);

    const handleGoToHistoryFromPdf = useCallback(() => {
        setPdfGenerationStatus('idle');
        setActiveTab('history');
    }, []);

    const handleClosePdfStatusModal = useCallback(() => {
        setPdfGenerationStatus('idle');
    }, []);

    const blobToBase64 = useCallback((blob: Blob): Promise<{mimeType: string, data: string}> => {
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
    }, []);

    const processClientDataWithGemini = async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }): Promise<ExtractedClientData | null> => {
        if (!userInfo?.aiConfig?.apiKey) return null;
        
        try {
            const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            
            let prompt = "Analise o texto/imagem/áudio fornecido e extraia as seguintes informações de um cliente de instalação de películas. Retorne APENAS um objeto JSON válido com as propriedades: nome, telefone, email, cpfCnpj, cep, logradouro, numero, complemento, bairro, cidade, uf. Se uma informação não for encontrada, omita a chave ou use null. O texto é: ";
            
            let content: any[] = [];

            if (input.type === 'text' && typeof input.data === 'string') {
                content.push(input.data);
            } else if (input.type === 'image' && Array.isArray(input.data)) {
                prompt = "Analise a imagem fornecida (que contém dados de um cliente) e extraia as seguintes informações de um cliente de instalação de películas. Retorne APENAS um objeto JSON válido com as propriedades: nome, telefone, email, cpfCnpj, cep, logradouro, numero, complemento, bairro, cidade, uf. Se uma informação não for encontrada, omita a chave ou use null.";
                content.push(prompt, ...input.data.map(file => file));
            } else if (input.type === 'audio' && input.data instanceof Blob) {
                prompt = "Transcreva o áudio fornecido (que contém dados de um cliente) e extraia as seguintes informações de um cliente de instalação de películas. Retorne APENAS um objeto JSON válido com as propriedades: nome, telefone, email, cpfCnpj, cep, logradouro, numero, complemento, bairro, cidade, uf. Se uma informação não for encontrada, omita a chave ou use null. O áudio contém: ";
                content.push(prompt, input.data);
            } else {
                return null;
            }

            const result = await model.generateContent(content);
            const response = await result.response;
            const jsonText = response.text().replace(/```json|```/g, '');
            const extractedData: ExtractedClientData = JSON.parse(jsonText);
            
            return extractedData;

        } catch (error) {
            console.error("Gemini AI Error:", error);
            alert(`Erro ao processar com Gemini: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    };

    const processClientDataWithOpenAI = async (input: { type: 'text' | 'image'; data: string | File[] }): Promise<ExtractedClientData | null> => {
        if (!userInfo?.aiConfig?.apiKey) return null;
        
        try {
            const apiKey = userInfo.aiConfig.apiKey;
            const endpoint = input.type === 'text' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
            const modelName = 'gpt-4o-mini'; // Usando um modelo mais recente e barato
            
            let prompt = "Analise o texto/imagem fornecido e extraia as seguintes informações de um cliente de instalação de películas. Retorne APENAS um objeto JSON válido com as propriedades: nome, telefone, email, cpfCnpj, cep, logradouro, numero, complemento, bairro, cidade, uf. Se uma informação não for encontrada, omita a chave ou use null. ";
            
            let body: any;

            if (input.type === 'text' && typeof input.data === 'string') {
                prompt += `O texto é: ${input.data}`;
                body = {
                    model: modelName,
                    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
                    response_format: { type: "json_object" }
                };
            } else if (input.type === 'image' && Array.isArray(input.data)) {
                prompt += "A imagem contém os dados do cliente.";
                const base64Image = await blobToBase64(input.data[0]);
                
                body = {
                    model: modelName,
                    messages: [{
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: `data:${base64Image.mimeType};base64,${base64Image.data}` } }
                        ]
                    }],
                    response_format: { type: "json_object" }
                };
            } else {
                return null;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API Error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            const jsonText = data.choices[0].message.content;
            const extractedData: ExtractedClientData = JSON.parse(jsonText);
            
            return extractedData;

        } catch (error) {
            console.error("OpenAI AI Error:", error);
            alert(`Erro ao processar com OpenAI: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    };

    const handleProcessAIClientInput = useCallback(async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        if (!userInfo?.aiConfig?.apiKey || !userInfo?.aiConfig?.provider) {
            alert("Por favor, configure seu provedor e chave de API na aba 'Empresa' para usar esta funcionalidade.");
            return;
        }
    
        setIsProcessingAI(true);
        setAiClientData(null);
        try {
            let extractedData: ExtractedClientData | null = null;
            if (userInfo.aiConfig.provider === 'gemini') {
                extractedData = await processClientDataWithGemini(input as { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob });
            } else if (userInfo.aiConfig.provider === 'openai') {
                if (input.type === 'audio') {
                    alert("O provedor OpenAI não suporta entrada de áudio nesta aplicação.");
                } else {
                    extractedData = await processClientDataWithOpenAI(input as { type: 'text' | 'image'; data: string | File[] });
                }
            }
            
            if (extractedData) {
                setAiClientData(extractedData);
                setIsAIClientModalOpenForClient(true); // Abre o modal de confirmação de cliente
            }
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, processClientDataWithGemini, processClientDataWithOpenAI]);

    const processWithGemini = async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        if (!userInfo?.aiConfig?.apiKey) return;
        
        setIsProcessingAI(true);
        try {
            const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            
            let prompt = "Analise o texto/imagem/áudio fornecido e extraia as medidas de vidros. Retorne APENAS um objeto JSON válido que contenha uma lista de objetos de medida. Cada objeto de medida deve ter as propriedades: largura (m), altura (m), quantidade, ambiente (use os nomes da lista de ambientes se possível), tipoAplicacao (use os nomes da lista de tipos se possível), e pelicula (nome da película, se puder inferir). Se não puder inferir a película, use 'Desconhecido'. Se não houver medidas, retorne uma lista vazia. O texto/áudio/imagem é: ";
            
            let content: any[] = [];

            if (input.type === 'text' && typeof input.data === 'string') {
                content.push(prompt + input.data);
            } else if (input.type === 'image' && Array.isArray(input.data)) {
                prompt = "Analise a imagem fornecida (que contém um rascunho de medidas) e extraia as medidas. Retorne APENAS um objeto JSON válido que contenha uma lista de objetos de medida. Cada objeto de medida deve ter as propriedades: largura (m), altura (m), quantidade, ambiente, tipoAplicacao, e pelicula. Se não puder inferir, use 'Desconhecido'.";
                content.push(prompt, ...input.data.map(file => file));
            } else if (input.type === 'audio' && input.data instanceof Blob) {
                prompt = "Transcreva o áudio fornecido (que contém medidas) e extraia as medidas de vidros. Retorne APENAS um objeto JSON válido que contenha uma lista de objetos de medida. Cada objeto de medida deve ter as propriedades: largura (m), altura (m), quantidade, ambiente, tipoAplicacao, e pelicula. Se não puder inferir, use 'Desconhecido'.";
                content.push(prompt, input.data);
            } else {
                return;
            }

            const result = await model.generateContent(content);
            const response = await result.response;
            const jsonText = response.text().replace(/```json|```/g, '');
            const extractedMeasurements: Omit<Measurement, 'id' | 'active' | 'discount' | 'discountType'>[] = JSON.parse(jsonText);
            
            if (extractedMeasurements.length > 0) {
                const newMeasurements: UIMeasurement[] = extractedMeasurements.map((m, index) => ({
                    ...m,
                    id: Date.now() + index,
                    active: true,
                    discount: 0,
                    discountType: 'percentage',
                    largura: m.largura || '',
                    altura: m.altura || '',
                    quantidade: m.quantidade || 1,
                    ambiente: m.ambiente || 'Desconhecido',
                    tipoAplicacao: m.tipoAplicacao || 'Desconhecido',
                    pelicula: m.pelicula || films[0]?.nome || 'Desconhecido',
                    isNew: true,
                }));
                
                const updatedMeasurements = [...newMeasurements, ...measurements.map(m => ({...m, isNew: false}))];
                handleMeasurementsChange(updatedMeasurements);
                
                alert(`Sucesso! ${newMeasurements.length} medidas foram adicionadas.`);
            } else {
                alert("A IA não conseguiu extrair medidas válidas do conteúdo fornecido.");
            }

        } catch (error) {
            console.error("Gemini AI Error:", error);
            alert(`Erro ao processar com Gemini: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessingAI(false);
        }
    };

    const processWithOpenAI = async (input: { type: 'text' | 'image'; data: string | File[] }) => {
        if (!userInfo?.aiConfig?.apiKey) return;
        
        setIsProcessingAI(true);
        try {
            const apiKey = userInfo.aiConfig.apiKey;
            const endpoint = 'https://api.openai.com/v1/chat/completions';
            const modelName = 'gpt-4o-mini';
            
            let prompt = "Analise o texto/imagem fornecido e extraia as medidas de vidros. Retorne APENAS um objeto JSON válido que contenha uma lista de objetos de medida. Cada objeto de medida deve ter as propriedades: largura (m), altura (m), quantidade, ambiente, tipoAplicacao, e pelicula. Se não puder inferir, use 'Desconhecido'. Se não houver medidas, retorne uma lista vazia.";
            
            let body: any;

            if (input.type === 'text' && typeof input.data === 'string') {
                prompt += ` O texto é: ${input.data}`;
                body = {
                    model: modelName,
                    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
                    response_format: { type: "json_object" }
                };
            } else if (input.type === 'image' && Array.isArray(input.data)) {
                prompt += " A imagem contém um rascunho de medidas.";
                const base64Image = await blobToBase64(input.data[0]);
                
                body = {
                    model: modelName,
                    messages: [{
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: `data:${base64Image.mimeType};base64,${base64Image.data}` } }
                        ]
                    }],
                    response_format: { type: "json_object" }
                };
            } else {
                return;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API Error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            const jsonText = data.choices[0].message.content;
            const extractedMeasurements: Omit<Measurement, 'id' | 'active' | 'discount' | 'discountType'>[] = JSON.parse(jsonText);
            
            if (extractedMeasurements.length > 0) {
                const newMeasurements: UIMeasurement[] = extractedMeasurements.map((m, index) => ({
                    ...m,
                    id: Date.now() + index,
                    active: true,
                    discount: 0,
                    discountType: 'percentage',
                    largura: m.largura || '',
                    altura: m.altura || '',
                    quantidade: m.quantidade || 1,
                    ambiente: m.ambiente || 'Desconhecido',
                    tipoAplicacao: m.tipoAplicacao || 'Desconhecido',
                    pelicula: m.pelicula || films[0]?.nome || 'Desconhecido',
                    isNew: true,
                }));
                
                const updatedMeasurements = [...newMeasurements, ...measurements.map(m => ({...m, isNew: false}))];
                handleMeasurementsChange(updatedMeasurements);
                
                alert(`Sucesso! ${newMeasurements.length} medidas foram adicionadas.`);
            } else {
                alert("A IA não conseguiu extrair medidas válidas do conteúdo fornecido.");
            }

        } catch (error) {
            console.error("OpenAI AI Error:", error);
            alert(`Erro ao processar com OpenAI: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessingAI(false);
        }
    };

    const handleProcessAIInput = async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        if (!userInfo?.aiConfig?.apiKey || !userInfo?.aiConfig?.provider) {
            alert("Por favor, configure seu provedor e chave de API na aba 'Empresa' para usar esta funcionalidade.");
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
        setPdfToDeleteId(null);
        await loadAllPdfs();
        await loadAgendamentos(); // Para atualizar o status na agenda se houver
    }, [pdfToDeleteId, loadAllPdfs, loadAgendamentos]);
    
    const handleUpdatePdfStatus = useCallback(async (pdfId: number, status: SavedPDF['status']) => {
        const pdf = allSavedPdfs.find(p => p.id === pdfId);
        if (pdf && pdf.id) {
            const updatedPdf: SavedPDF = { ...pdf, status };
            await db.savePDF(updatedPdf);
            setAllSavedPdfs(prev => prev.map(p => p.id === pdfId ? updatedPdf : p));
        }
    }, [allSavedPdfs]);


    const toggleFullScreen = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }, []);

    const handleOpenFilmSelectionModal = useCallback((measurementId: number) => {
        setEditingMeasurementIdForFilm(measurementId);
        setIsFilmSelectionModalOpen(true);
    }, []);

    const handleSelectFilmForMeasurement = useCallback((filmName: string) => {
        if (editingMeasurementIdForFilm === null) return;
        
        const updatedMeasurements = measurements.map(m => 
            m.id === editingMeasurementIdForFilm ? { ...m, pelicula: filmName, isNew: false } : m
        );
        handleMeasurementsChange(updatedMeasurements);
        setIsFilmSelectionModalOpen(false);
        setEditingMeasurementIdForFilm(null);
    }, [editingMeasurementIdForFilm, measurements, handleMeasurementsChange]);

    const handleApplyFilmToAll = useCallback((filmName: string) => {
        setFilmToApplyToAll(filmName);
        setIsApplyFilmToAllModalOpen(true);
    }, []);
    
    const handleConfirmApplyFilmToAll = useCallback(() => {
        if (filmToApplyToAll) {
            const updatedMeasurements = measurements.map(m => ({ ...m, pelicula: filmToApplyToAll, isNew: false }));
            handleMeasurementsChange(updatedMeasurements);
            setIsApplyFilmToAllModalOpen(false);
            setFilmToApplyToAll(null);
        }
    }, [filmToApplyToAll, measurements, handleMeasurementsChange]);

    const handleAddNewFilmFromSelection = useCallback((filmName: string) => {
        handleOpenFilmModal(null); // Abre o modal de filme
        // O nome do filme será preenchido no modal de filme, mas aqui garantimos que a seleção feche
        setIsFilmSelectionModalOpen(false);
    }, [handleOpenFilmModal]);

    const handleOpenEditMeasurementModal = useCallback((measurement: UIMeasurement) => {
        setEditingMeasurement(measurement);
    }, []);

    const handleCloseEditMeasurementModal = useCallback(() => {
        setEditingMeasurement(null);
    }, []);

    const handleUpdateEditingMeasurement = useCallback((updatedData: Partial<Measurement>) => {
        if (!editingMeasurement) return;
        
        const updated = { ...editingMeasurement, ...updatedData };
        
        // Se for largura/altura/quantidade, o numpad já salvou no estado global, então só atualizamos o objeto
        if (updatedData.largura !== undefined || updatedData.altura !== undefined || updatedData.quantidade !== undefined) {
            // Se o numpad estava aberto, ele já salvou o valor final no estado global (measurements)
            // Aqui apenas garantimos que o objeto no estado local reflita o que está no estado global, se necessário.
            // Como estamos usando o numpad para salvar diretamente no handleNumpadDone, este callback é mais para campos não numéricos.
            
            // Para garantir consistência, vamos forçar a atualização no array principal
            const updatedMeasurements = measurements.map(m => m.id === editingMeasurement.id ? updated : m);
            handleMeasurementsChange(updatedMeasurements);
        } else {
            // Para outros campos (ambiente, tipo, etc.)
            const updatedMeasurements = measurements.map(m => m.id === editingMeasurement.id ? updated : m);
            handleMeasurementsChange(updatedMeasurements);
        }
        
        setEditingMeasurement(updated);
    }, [editingMeasurement, measurements, handleMeasurementsChange]);
    
    const handleRequestDeleteMeasurement = useCallback((measurementId: number) => {
        setMeasurementToDeleteId(measurementId);
        handleCloseEditMeasurementModal();
    }, [handleCloseEditMeasurementModal]);
    
    const handleConfirmDeleteIndividualMeasurement = useCallback(() => {
        if (measurementToDeleteId === null) return;
        const newMeasurements = measurements.filter(m => m.id !== measurementToDeleteId);
        handleMeasurementsChange(newMeasurements);
        setMeasurementToDeleteId(null);
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
        const savedAgendamento = await db.saveAgendamento(agendamentoData as Agendamento);
        await loadAgendamentos();
        await loadAllPdfs(); // Para atualizar o status do PDF se for o caso
        handleCloseAgendamentoModal();
    }, [handleCloseAgendamentoModal, loadAgendamentos, loadAllPdfs]);

    const handleRequestDeleteAgendamento = useCallback((agendamento: Agendamento) => {
        setAgendamentoToDelete(agendamento);
    }, []);

    const handleConfirmDeleteAgendamento = useCallback(async () => {
        if (!agendamentoToDelete || !agendamentoToDelete.id) return;
        await db.deleteAgendamento(agendamentoToDelete.id);
        setAgendamentoToDelete(null);
        await loadAgendamentos();
        await loadAllPdfs();
    }, [agendamentoToDelete, loadAgendamentos, loadAllPdfs]);
    
    const handleAddNewClientFromAgendamento = useCallback((clientName: string) => {
        setIsClientSelectionModalOpen(false);
        setPostClientSaveAction({ type: 'select', id: undefined }); // Indica que deve selecionar o novo cliente
        setIsClientModalOpen(true);
        setClientModalMode('add');
        handleCloseAgendamentoModal();
    }, [handleCloseAgendamentoModal]);

    const handleCreateNewAgendamento = useCallback((date: Date) => {
        setSchedulingInfo({ agendamento: { clienteId: selectedClientId!, clienteNome: selectedClient!.nome, start: date.toISOString(), end: new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString() } });
    }, [selectedClientId, selectedClient]);

    const handleOpenClientSelectionModal = useCallback(() => {
        setIsClientSelectionModalOpen(true);
    }, []);

    const handleOpenDiscountModal = useCallback((measurement: UIMeasurement) => {
        setEditingMeasurementForDiscount(measurement);
    }, []);

    const handleCloseDiscountModal = useCallback(() => {
        setEditingMeasurementForDiscount(null);
    }, []);

    const handleSaveDiscount = useCallback((discount: number, discountType: 'percentage' | 'fixed') => {
        if (!editingMeasurementForDiscount) return;
        
        const updatedMeasurements = measurements.map(m => 
            m.id === editingMeasurementForDiscount.id 
                ? { ...m, discount, discountType, isNew: false } 
                : m
        );
        handleMeasurementsChange(updatedMeasurements);
        setEditingMeasurementForDiscount(null);
    }, [editingMeasurementForDiscount, measurements, handleMeasurementsChange]);

    const handleOpenApiKeyModal = useCallback((provider: 'gemini' | 'openai') => {
        setApiKeyModalProvider(provider);
        setIsApiKeyModalOpen(true);
    }, []);

    const handleSaveApiKey = useCallback(async (apiKey: string) => {
        if (!userInfo) return;
        
        const updatedConfig = {
            ...userInfo.aiConfig,
            apiKey: apiKey,
        };
        
        const updatedInfo: UserInfo = { ...userInfo, aiConfig: updatedConfig };
        await handleSaveUserInfo(updatedInfo);
        setIsApiKeyModalOpen(false);
    }, [userInfo, handleSaveUserInfo]);

    const handleSaveGeneralDiscount = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        handleGeneralDiscountChange(discount);
        setIsGeneralDiscountModalOpen(false);
    }, [handleGeneralDiscountChange]);
    
    const handleOpenGallery = useCallback((images: string[], initialIndex: number) => {
        setGalleryImages(images);
        setGalleryInitialIndex(initialIndex);
        setIsGalleryOpen(true);
    }, []);

    const handleCloseGallery = useCallback(() => {
        setIsGalleryOpen(false);
    }, []);

    const handleOpenAIClientModal = useCallback(() => {
        setIsAIClientModalOpen(true);
    }, []);


    const LoadingSpinner = () => (
        <div className="flex items-center justify-center h-full min-h-[300px]">
            <div className="loader"></div>
        </div>
    );

    const handlePromptPwaInstall = useCallback(() => {
        promptInstall();
    }, [promptInstall]);

    const goToNextClient = useCallback(() => {
        if (!clients.length || !selectedClientId) return;
        const currentIndex = clients.findIndex(c => c.id === selectedClientId);
        const nextIndex = (currentIndex + 1) % clients.length;
        setSelectedClientId(clients[nextIndex].id!);
    }, [clients, selectedClientId]);

    const goToPrevClient = useCallback(() => {
        if (!clients.length || !selectedClientId) return;
        const currentIndex = clients.findIndex(c => c.id === selectedClientId);
        const prevIndex = (currentIndex - 1 + clients.length) % clients.length;
        setSelectedClientId(clients[prevIndex].id!);
    }, [clients, selectedClientId]);

    const handleAddNewClientFromSelection = useCallback((clientName: string) => {
        setPostClientSaveAction({ type: 'select' });
        setClientModalMode('add');
        setIsClientModalOpen(true);
        setIsClientSelectionModalOpen(false);
    }, []);

    const addMeasurement = useCallback(() => {
        if (!activeOption) return;
        const newMeasurement: UIMeasurement = {
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
            isNew: true,
        };
        const updatedMeasurements = [
            newMeasurement, 
            ...measurements.map(m => ({ ...m, isNew: false }))
        ];
        handleMeasurementsChange(updatedMeasurements);
        // Abre o numpad automaticamente para a nova medida
        handleOpenNumpad(newMeasurement.id, 'largura', newMeasurement.largura);
    }, [activeOption, films, measurements, handleMeasurementsChange]);

    const handleNumpadOpen = useCallback((measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => {
        const { isOpen, measurementId: prevId, field: prevField, currentValue: prevValue } = numpadConfig;

        if (isOpen && (prevId !== measurementId || prevField !== field)) {
            let finalValue: string | number;
            if (prevField === 'quantidade') {
                finalValue = parseInt(String(prevValue), 10) || 1;
            } else {
                finalValue = (prevValue === ',' || prevValue === '' || prevValue === '.') ? '0' : prevValue.replace('.', ',');
            }

            const updatedMeasurements = measurements.map(m =>
                m.id === prevId ? { ...m, [prevField!]: finalValue } : m
            );
            handleMeasurementsChange(updatedMeasurements);
        }

        setNumpadConfig(prev => {
            const isSameButton = prev.isOpen && prev.measurementId === measurementId && prev.field === field;
            
            if (isSameButton) {
                return {
                    ...prev,
                    shouldClearOnNextInput: false,
                };
            }

            return {
                isOpen: true,
                measurementId,
                field,
                currentValue: String(currentValue).replace(',', '.'),
                shouldClearOnNextInput: true,
            };
        });
    }, [numpadConfig, measurements, handleMeasurementsChange]);

    const handleNumpadClose = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) {
            setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
            return;
        }

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (currentValue === '' || currentValue === '.') ? '0' : currentValue.replace('.', ',');
        }

        const updatedMeasurements = measurements.map(m =>
            m.id === measurementId ? { ...m, [field]: finalValue } : m
        );
        handleMeasurementsChange(updatedMeasurements);
        
        setNumpadConfig({ isOpen: false, measurementId: null, field: null, currentValue: '', shouldClearOnNextInput: false });
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

    const handleNumpadDone = useCallback(() => {
        const { measurementId, field, currentValue } = numpadConfig;
        if (measurementId === null || field === null) return;

        let finalValue: string | number;
        if (field === 'quantidade') {
            finalValue = parseInt(String(currentValue), 10) || 1;
        } else {
            finalValue = (currentValue === '' || currentValue === '.') ? '0' : currentValue.replace('.', ',');
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

    const handleNumpadDuplicate = useCallback(() => {
        const { measurementId } = numpadConfig;
        if (measurementId === null) return;

        const measurementToDuplicate = measurements.find(m => m.id === measurementId);
        if (measurementToDuplicate) {
            const newMeasurement: UIMeasurement = { 
                ...measurementToDuplicate, 
                id: Date.now(), 
                isNew: true
            };
            const index = measurements.findIndex(m => m.id === measurementId);
            const newMeasurements = [...measurements];
            newMeasurements.splice(index + 1, 0, newMeasurement);
            handleMeasurementsChange(newMeasurements);
            
            // Fecha o numpad atual e abre no novo item
            setNumpadConfig({
                isOpen: true,
                measurementId: newMeasurement.id,
                field: 'largura',
                currentValue: String(newMeasurement.largura).replace(',', '.'),
                shouldClearOnNextInput: true,
            });
        }
    }, [numpadConfig, measurements, handleMeasurementsChange]);

    const handleNumpadAddGroup = useCallback(() => {
        addMeasurement();
    }, [addMeasurement]);

    const handleOpenNumpad = useCallback((measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => {
        handleNumpadOpen(measurementId, field, currentValue);
    }, [handleNumpadOpen]);


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
                            onOpenApiKeyModal={(provider) => handleOpenApiKeyModal(provider)}
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
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[300px] bg-white/50 rounded-lg border-2 border-dashed border-slate-200 mt-4">
                    <i className="fas fa-user-plus fa-3x mb-4 text-slate-300"></i>
                    <h3 className="text-xl font-semibold text-slate-800">Nenhum Cliente Cadastrado</h3>
                    <p className="mt-2 text-slate-600">Clique no botão abaixo para adicionar seu primeiro cliente.</p>
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
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[300px] bg-white/50 rounded-lg border-2 border-dashed border-slate-200 mt-4">
                    <i className="fas fa-ruler-combined fa-3x mb-4 text-slate-300"></i>
                    <h3 className="text-xl font-semibold text-slate-800">Nenhuma Medida Cadastrada</h3>
                    <p className="mt-2 text-slate-600">Adicione medidas ou use a IA para preencher automaticamente.</p>
                    <button
                        onClick={() => addMeasurement()}
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
    const generalDiscount = proposalOptions.find(opt => opt.id === activeOptionId)?.generalDiscount || { value: '', type: 'percentage' };

    return (
        <div className="h-full font-roboto flex flex-col">
            <main ref={mainRef} className="flex-grow overflow-y-auto pb-36 sm:pb-0">
                <div className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
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
                                        onDuplicateMeasurements={() => setIsDuplicateAllModalOpen(true)}
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
                                    onDuplicateMeasurements={() => setIsDuplicateAllModalOpen(true)}
                                    onGeneratePdf={handleGeneratePdf}
                                    isGeneratingPdf={pdfGenerationStatus === 'generating'}
                                    onOpenAIModal={() => setIsAIMeasurementModalOpen(true)}
                                />
                            </>
                        )}
                    </div>
                </div>
            </main>

            
            {isClientModalOpen && (
                <ClientModal
                    isOpen={isClientModalOpen}
                    onClose={() => setIsClientModalOpen(false)}
                    onSave={handleSaveClient}
                    mode={clientModalMode}
                    client={clientModalMode === 'edit' ? selectedClient : null}
                    initialName={postClientSaveAction?.type === 'add' ? (aiClientData?.nome || '') : undefined}
                    aiData={aiClientData}
                    onOpenAIModal={() => { setIsAIClientModalOpenForClient(true); setIsClientModalOpen(false); }}
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
                    onClose={() => setIsFilmModalOpen(false)}
                    onSave={handleSaveFilm}
                    onDelete={handleRequestDeleteFilm}
                    film={filmToEdit}
                />
            )}
            {isFilmSelectionModalOpen && (
                <FilmSelectionModal
                    isOpen={isFilmSelectionModalOpen}
                    onClose={() => setIsFilmSelectionModalOpen(false)}
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
                    onDelete={() => handleRequestDeleteMeasurement(editingMeasurement.id)}
                    onDuplicate={() => { /* Duplicar via Numpad ou lista principal */ }}
                    onOpenFilmModal={handleOpenFilmModal}
                    onOpenFilmSelectionModal={(mid) => handleOpenFilmSelectionModal(mid)}
                    numpadConfig={numpadConfig}
                    onOpenNumpad={handleOpenNumpad}
                />
            )}
            {isClearAllModalOpen && (
                <ConfirmationModal
                    isOpen={isClearAllModalOpen}
                    onClose={() => setIsClearAllModalOpen(false)}
                    onConfirm={handleConfirmClearAll}
                    title="Confirmar Exclusão de Todas as Medidas"
                    message="Tem certeza que deseja apagar TODAS as medidas desta opção de orçamento? Esta ação não pode ser desfeita."
                    confirmButtonText="Sim, Apagar Tudo"
                    confirmButtonVariant="danger"
                />
            )}
             {filmToDeleteName !== null && (
                <ConfirmationModal
                    isOpen={filmToDeleteName !== null}
                    onClose={() => setFilmToDeleteName(null)}
                    onConfirm={handleConfirmDeleteFilm}
                    title="Confirmar Exclusão de Película"
                    message={`Tem certeza que deseja excluir a película "${filmToDeleteName}"? Todos os orçamentos que a utilizam serão afetados.`}
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
            {filmToApplyToAll !== null && (
                <ConfirmationModal
                    isOpen={filmToApplyToAll !== null}
                    onClose={() => setIsApplyFilmToAllModalOpen(false)}
                    onConfirm={handleConfirmApplyFilmToAll}
                    title="Confirmar Aplicação em Todas as Medidas"
                    message={`Deseja aplicar a película "${filmToApplyToAll}" a TODAS as medidas ativas nesta opção? As medidas existentes terão seus valores de película substituídos.`}
                    confirmButtonText="Sim, Aplicar"
                />
            )}
            {isDeleteClientModalOpen && selectedClient && (
                <ConfirmationModal
                    isOpen={isDeleteClientModalOpen}
                    onClose={() => setIsDeleteClientModalOpen(false)}
                    onConfirm={handleConfirmDeleteClient}
                    title="Confirmar Exclusão de Cliente"
                    message={`Tem certeza que deseja excluir o cliente "${selectedClient.nome}"? TODAS as suas propostas, medidas e histórico de PDFs serão PERMANENTEMENTE excluídos do dispositivo.`}
                    confirmButtonText="Sim, Excluir Cliente"
                    confirmButtonVariant="danger"
                />
            )}
            {pdfToDeleteId !== null && (
                <ConfirmationModal
                    isOpen={pdfToDeleteId !== null}
                    onClose={() => setPdfToDeleteId(null)}
                    onConfirm={handleConfirmDeletePdf}
                    title="Confirmar Exclusão de PDF"
                    message="Tem certeza que deseja apagar este registro do histórico de PDFs? O arquivo não será baixado novamente."
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
            {agendamentoToDelete && (
                <ConfirmationModal
                    isOpen={!!agendamentoToDelete}
                    onClose={() => setAgendamentoToDelete(null)}
                    onConfirm={handleConfirmDeleteAgendamento}
                    title="Confirmar Exclusão de Agendamento"
                    message={`Tem certeza que deseja excluir o agendamento de ${agendamentoToDelete.clienteNome} em ${new Date(agendamentoToDelete.start).toLocaleDateString('pt-BR')}?`}
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
             {pdfGenerationStatus !== 'idle' && (
                <PdfGenerationStatusModal
                    status={pdfGenerationStatus === 'generating' ? 'generating' : 'success'}
                    onClose={handleClosePdfStatusModal}
                    onGoToHistory={handleGoToHistoryFromPdf}
                />
            )}
             {editingMeasurementForDiscount && (
                <DiscountModal
                    isOpen={!!editingMeasurementForDiscount}
                    onClose={handleCloseDiscountModal}
                    onSave={handleSaveDiscount}
                    initialValue={editingMeasurementForDiscount.discount || 0}
                    initialType={editingMeasurementForDiscount.discountType || 'percentage'}
                />
            )}
            {isGeneralDiscountModalOpen && (
                <GeneralDiscountModal
                    isOpen={isGeneralDiscountModalOpen}
                    onClose={() => setIsGeneralDiscountModalOpen(false)}
                    onSave={handleSaveGeneralDiscount}
                    initialValue={generalDiscount.value?.toString() || ''}
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
                    title="Confirmar Duplicação de Opção"
                    message={`Deseja duplicar a opção "${activeOption.name}"? Todas as ${activeOption.measurements.length} medidas serão copiadas para uma nova opção.`}
                    confirmButtonText="Sim, Duplicar"
                />
            )}
            {measurementToDeleteId !== null && measurementToDelete && (
                <ConfirmationModal
                    isOpen={measurementToDeleteId !== null}
                    onClose={() => setMeasurementToDeleteId(null)}
                    onConfirm={handleConfirmDeleteIndividualMeasurement}
                    title="Confirmar Exclusão de Medida"
                    message={`Tem certeza que deseja excluir esta medida?`}
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                />
            )}
        </div>
    );
};

export default App;