import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import './src/estoque-dark-mode.css';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Client, Measurement, UserInfo, Film, PaymentMethods, SavedPDF, Agendamento, ProposalOption, SchedulingInfo, ExtractedClientData, Totals } from './types';
import { CuttingOptimizer } from './utils/CuttingOptimizer';
import * as db from './services/db';
import * as estoqueDb from './services/estoqueDb';
import { supabase } from './services/supabaseClient';
// pdfGenerator será importado dinamicamente para code splitting
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
import InfoModal from './components/modals/InfoModal';
import AgendamentoModal from './components/modals/AgendamentoModal';
import DiscountModal from './components/modals/DiscountModal';
import GeneralDiscountModal from './components/modals/GeneralDiscountModal';
import AIMeasurementModal from './components/modals/AIMeasurementModal';
import AIClientModal from './components/modals/AIClientModal';
import AIFilmModal from './components/modals/AIFilmModal';
import ApiKeyModal from './components/modals/ApiKeyModal';
import ProposalOptionsCarousel from './components/ProposalOptionsCarousel';
import CuttingOptimizationPanel from './components/CuttingOptimizationPanel';
import ImageGalleryModal from './components/modals/ImageGalleryModal';
import LocationImportModal from './components/modals/LocationImportModal';
import ServicoQrModal from './components/modals/ServicoQrModal';
import UpdateNotification from './components/UpdateNotification';
import UpdateBanner from './components/UpdateBanner';
import { ModalsContainer } from './components/ModalsContainer';
import { usePwaInstallPrompt } from './src/hooks/usePwaInstallPrompt';
import { usePwaUpdate } from './src/hooks/usePwaUpdate';

import { useError } from './src/contexts/ErrorContext';
import { Skeleton, CardSkeleton } from './components/ui/Skeleton';
import Toast from './components/ui/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminUsers } from './components/AdminUsers';
import { useAuth } from './contexts/AuthContext';
import { UserAccount } from './components/UserAccount';
import { FeatureGate, UpgradePrompt } from './components/subscription/SubscriptionComponents';
import { useSubscription } from './contexts/SubscriptionContext';
import SyncStatusIndicator from './components/SyncStatusIndicator';
import { initSyncService } from './services/syncService';



import UserSettingsView from './components/views/UserSettingsView';
import PdfHistoryView from './components/views/PdfHistoryView';
import FilmListView from './components/views/FilmListView';
import AgendaView from './components/views/AgendaView';
import EstoqueView from './components/views/EstoqueView';


type UIMeasurement = Measurement & { isNew?: boolean };
type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque';

type NumpadConfig = {
    isOpen: boolean;
    measurementId: number | null;
    field: 'largura' | 'altura' | 'quantidade' | null;
    currentValue: string;
    shouldClearOnNextInput: boolean;
};




const App: React.FC = () => {
    const { isAdmin, user: authUser, organizationId, isOwner } = useAuth();
    const { showError } = useError();
    const { deferredPrompt, promptInstall, isInstalled } = usePwaInstallPrompt();
    const { newVersionAvailable, handleUpdate } = usePwaUpdate();
    const { hasModule, modules } = useSubscription();

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

    // Processar convite pendente após login
    useEffect(() => {
        const checkPendingInvite = async () => {
            const pendingCode = localStorage.getItem('pendingInviteCode');
            if (authUser && pendingCode) {
                try {
                    console.log('Processando convite pendente:', pendingCode);
                    const { data, error } = await supabase.rpc('redeem_invite', { code: pendingCode });

                    if (error) throw error;

                    if (data && data.success) {
                        alert('Convite aceito com sucesso! Você agora faz parte da organização.');
                        localStorage.removeItem('pendingInviteCode');
                        window.location.reload(); // Recarregar para atualizar permissões
                    } else {
                        console.error('Erro ao processar convite:', data?.error);
                        localStorage.removeItem('pendingInviteCode');
                    }
                } catch (err) {
                    console.error('Erro ao resgatar convite:', err);
                    localStorage.removeItem('pendingInviteCode');
                }
            }
        };

        checkPendingInvite();
    }, [authUser]);
    const [clientModalMode, setClientModalMode] = useState<'add' | 'edit'>('add');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isFilmModalOpen, setIsFilmModalOpen] = useState(false);
    const [editingFilm, setEditingFilm] = useState<Film | null>(null);
    const [pdfGenerationStatus, setPdfGenerationStatus] = useState<'idle' | 'generating' | 'success'>('idle');
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);

    // Deep Linking State
    const [initialEstoqueAction, setInitialEstoqueAction] = useState<{ action: 'scan', code: string } | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const action = params.get('action');
        const code = params.get('code');

        if (tab === 'estoque') {
            setActiveTab('estoque');
            if (action === 'scan' && code) {
                setInitialEstoqueAction({ action: 'scan', code });
            }
            // Limpar URL para não reprocessar ao recarregar
            window.history.replaceState({}, '', '/');
        }
    }, []);
    const [filmToDeleteName, setFilmToDeleteName] = useState<string | null>(null);
    const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
    const [pdfToDeleteId, setPdfToDeleteId] = useState<number | null>(null);
    const [isFilmSelectionModalOpen, setIsFilmSelectionModalOpen] = useState(false);
    const [isApplyFilmToAllModalOpen, setIsApplyFilmToAllModalOpen] = useState(false);
    const [newFilmName, setNewFilmName] = useState<string>('');
    const [filmToApplyToAll, setFilmToApplyToAll] = useState<string | null>(null);
    const [editingMeasurementIdForFilm, setEditingMeasurementIdForFilm] = useState<number | null>(null);
    const [newClientName, setNewClientName] = useState<string>('');

    // ... (existing code)


    const [editingMeasurement, setEditingMeasurement] = useState<UIMeasurement | null>(null);
    const [schedulingInfo, setSchedulingInfo] = useState<SchedulingInfo | null>(null);
    const [agendamentoToDelete, setAgendamentoToDelete] = useState<Agendamento | null>(null);
    const [postClientSaveAction, setPostClientSaveAction] = useState<'openAgendamentoModal' | null>(null);
    const [editingMeasurementForDiscount, setEditingMeasurementForDiscount] = useState<UIMeasurement | null>(null);
    const [editingMeasurementBasePrice, setEditingMeasurementBasePrice] = useState<number>(0);
    const [isAIMeasurementModalOpen, setIsAIMeasurementModalOpen] = useState(false);
    const [isAIClientModalOpen, setIsAIClientModalOpen] = useState(false);
    const [aiClientData, setAiClientData] = useState<Partial<Client> | undefined>(undefined);
    const [isAIFilmModalOpen, setIsAIFilmModalOpen] = useState(false);
    const [aiFilmData, setAiFilmData] = useState<Partial<Film> | undefined>(undefined);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [apiKeyModalProvider, setApiKeyModalProvider] = useState<'gemini' | 'openai'>('gemini');
    const [isGeneralDiscountModalOpen, setIsGeneralDiscountModalOpen] = useState(false);
    const [isDuplicateAllModalOpen, setIsDuplicateAllModalOpen] = useState(false);
    const [isLocationImportModalOpen, setIsLocationImportModalOpen] = useState(false);
    const [isServicoQrModalOpen, setIsServicoQrModalOpen] = useState(false);
    const [measurementToDeleteId, setMeasurementToDeleteId] = useState<number | null>(null);
    const [isDeleteProposalOptionModalOpen, setIsDeleteProposalOptionModalOpen] = useState(false);
    const [proposalOptionToDeleteId, setProposalOptionToDeleteId] = useState<number | null>(null);

    // Estados para modais de upgrade de módulos premium
    const [showQrUpgradeModal, setShowQrUpgradeModal] = useState(false);
    const [showIaUpgradeModal, setShowIaUpgradeModal] = useState(false);

    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
    const [infoModalConfig, setInfoModalConfig] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
    const [isSaveBeforePdfModalOpen, setIsSaveBeforePdfModalOpen] = useState(false);
    const [isExitConfirmModalOpen, setIsExitConfirmModalOpen] = useState(false);

    // Undo states
    const [deletedMeasurement, setDeletedMeasurement] = useState<UIMeasurement | null>(null);
    const [deletedMeasurementIndex, setDeletedMeasurementIndex] = useState<number | null>(null);
    const [showUndoToast, setShowUndoToast] = useState(false);



    const [numpadConfig, setNumpadConfig] = useState<NumpadConfig>({
        isOpen: false,
        measurementId: null,
        field: null,
        currentValue: '',
        shouldClearOnNextInput: false,
    });

    const mainRef = useRef<HTMLElement>(null);
    const numpadRef = useRef<HTMLDivElement>(null);
    const backButtonPressedOnce = useRef(false);
    const backButtonTimeout = useRef<NodeJS.Timeout | null>(null);



    // Handle URL parameters (shortcuts, share target, etc.)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);

        // Handle tab parameter from shortcuts
        const tabParam = urlParams.get('tab');
        if (tabParam && ['client', 'films', 'settings', 'history', 'agenda', 'sales'].includes(tabParam)) {
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

    // Intercepta o botão voltar do navegador/Android
    useEffect(() => {
        const handleBackButton = (event: PopStateEvent) => {
            // Se o teclado numérico estiver aberto, fecha ele primeiro
            if (numpadConfig.isOpen) {
                event.preventDefault();
                handleNumpadClose();
                // Adiciona um estado ao histórico para manter o usuário na página
                window.history.pushState(null, '', window.location.pathname);
                return;
            }

            // Se algum modal estiver aberto, não mostra confirmação de saída
            if (isClientModalOpen || isFilmModalOpen || editingMeasurement ||
                isFilmSelectionModalOpen || isGalleryOpen || schedulingInfo) {
                return;
            }

            // Previne a navegação padrão
            event.preventDefault();

            // Se já pressionou uma vez recentemente, mostra o modal
            if (backButtonPressedOnce.current) {
                setIsExitConfirmModalOpen(true);
                window.history.pushState(null, '', window.location.pathname);
            } else {
                // Primeira vez, apenas marca e adiciona estado ao histórico
                backButtonPressedOnce.current = true;
                window.history.pushState(null, '', window.location.pathname);

                // Mostra um toast informando
                handleShowInfo('Pressione voltar novamente para sair');

                // Reseta após 2 segundos
                if (backButtonTimeout.current) {
                    clearTimeout(backButtonTimeout.current);
                }
                backButtonTimeout.current = setTimeout(() => {
                    backButtonPressedOnce.current = false;
                }, 2000);
            }
        };

        // Adiciona um estado inicial ao histórico
        window.history.pushState(null, '', window.location.pathname);

        window.addEventListener('popstate', handleBackButton);

        return () => {
            window.removeEventListener('popstate', handleBackButton);
            if (backButtonTimeout.current) {
                clearTimeout(backButtonTimeout.current);
            }
        };
    }, [numpadConfig.isOpen, isClientModalOpen, isFilmModalOpen, editingMeasurement,
        isFilmSelectionModalOpen, isGalleryOpen, schedulingInfo]);

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
            // Inicializar serviço de sincronização offline
            initSyncService();

            // Só carrega dados se houver usuário autenticado
            if (!authUser) {
                console.log('[App init] Sem usuário autenticado, pulando carregamento');
                setIsLoading(false);
                return;
            }

            console.log('[App init] Usuário autenticado, carregando dados...', authUser.id);
            setIsLoading(true);

            // Carregar todos os dados em paralelo para trocas de abas instantâneas
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

            setHasLoadedHistory(true);
            setHasLoadedAgendamentos(true);

            console.log('[App init] Dados essenciais carregados');
            setUserInfo(loadedUserInfo);

            // Migração automática de PDFs (roda apenas uma vez)
            const migrationKey = 'peliculas-br-bd-pdf_migration_v1';
            const migrationCompleted = localStorage.getItem(migrationKey);

            if (!migrationCompleted) {
                try {

                    const result = await db.migratePDFsWithProposalOptionId();

                    localStorage.setItem(migrationKey, 'true');
                } catch (error) {
                    console.error('Erro na migração automática:', error);
                }
            }

            setIsLoading(false);
        };
        init();
    }, [authUser?.id]); // Recarrega quando o usuário muda

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
                        name: 'Op��o 1',
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

    const handleMeasurementsChange = useCallback((newMeasurements: UIMeasurement[]) => {
        if (!activeOptionId) return;

        setProposalOptions(prev => prev.map(opt =>
            opt.id === activeOptionId
                ? { ...opt, measurements: newMeasurements }
                : opt
        ));
        setIsDirty(true);
    }, [activeOptionId]);

    useEffect(() => {
        if (!isDirty) {
            return;
        }
        const timerId = setTimeout(() => {
            handleSaveChanges();
        }, 1500);

        return () => clearTimeout(timerId);
    }, [proposalOptions, isDirty, handleSaveChanges]);




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

    const handleShowInfo = useCallback((message: string, title: string = "Aten��o") => {
        setInfoModalConfig({ isOpen: true, title, message });
    }, []);

    const handleCloseInfoModal = useCallback(() => {
        setInfoModalConfig(prev => ({ ...prev, isOpen: false }));
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
        discount: { value: '0', type: 'percentage' },
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
            name: `Op��o ${proposalOptions.length + 1}`,
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
                name: `Op��o 1`,
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

    const handleRequestDeleteProposalOption = useCallback((optionId: number) => {
        setProposalOptionToDeleteId(optionId);
        setIsDeleteProposalOptionModalOpen(true);
    }, []);

    const handleConfirmDeleteProposalOption = useCallback(() => {
        if (proposalOptionToDeleteId !== null) {
            handleDeleteProposalOption(proposalOptionToDeleteId);
            setIsDeleteProposalOptionModalOpen(false);
            setProposalOptionToDeleteId(null);
        }
    }, [proposalOptionToDeleteId, handleDeleteProposalOption]);

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
            handleShowInfo('Selecione um cliente para editar.');
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

    const handleConfirmDeleteClient = useCallback(() => {
        if (!selectedClientId) return;

        const idToDelete = selectedClientId;

        // 1. Fechar o modal imediatamente para resposta instantânea
        setIsDeleteClientModalOpen(false);

        // 2. Atualização Otimista: Remover da lista de clientes na UI imediatamente
        setClients(prev => {
            const updatedClients = prev.filter(c => c.id !== idToDelete);

            // 3. Selecionar o próximo cliente disponível ou null
            if (selectedClientId === idToDelete) {
                if (updatedClients.length > 0) {
                    setSelectedClientId(updatedClients[0].id!);
                } else {
                    setSelectedClientId(null);
                }
            }

            return updatedClients;
        });

        // 4. Processar exclusões no banco de dados em background
        setTimeout(async () => {
            try {
                // Deletar cliente e suas dependências
                await db.deleteClient(idToDelete);
                await db.deleteProposalOptions(idToDelete);

                const pdfsForClient = await db.getPDFsForClient(idToDelete);
                for (const pdf of pdfsForClient) {
                    if (pdf.id) {
                        await db.deletePDF(pdf.id);
                    }
                }

                // Atualizar outros estados se necessário (em background)
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

        if (editingMeasurementIdForFilm !== null) {
            const updatedMeasurements = measurements.map(m =>
                m.id === editingMeasurementIdForFilm ? { ...m, pelicula: newFilmData.nome } : m
            );
            handleMeasurementsChange(updatedMeasurements);
            setEditingMeasurementIdForFilm(null);
        }
    }, [loadFilms, editingMeasurementIdForFilm, measurements, handleMeasurementsChange]);

    const handleToggleClientPin = useCallback(async (clientId: number) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            const isPinned = !client.pinned;
            const updatedClient = {
                ...client,
                pinned: isPinned,
                pinnedAt: isPinned ? Date.now() : undefined
            };
            await db.saveClient(updatedClient);
            await loadClients();
        }
    }, [clients, loadClients]);

    const handleToggleFilmPin = useCallback(async (filmName: string) => {
        const film = films.find(f => f.nome === filmName);
        if (film) {
            const isPinned = !film.pinned;
            const updatedFilm = {
                ...film,
                pinned: isPinned,
                pinnedAt: isPinned ? Date.now() : undefined
            };
            await db.saveCustomFilm(updatedFilm);
            await loadFilms();
        }
    }, [films, loadFilms]);

    const handleDeleteFilm = useCallback(async (filmName: string) => {
        setFilmToDeleteName(filmName);
    }, []);

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


    const downloadBlob = useCallback((blobOrBase64: Blob | string, filename: string) => {
        let blob: Blob;

        // Se é uma string (base64), converter para Blob
        if (typeof blobOrBase64 === 'string') {
            try {
                // Formato base64: data:application/pdf;base64,xxxxx
                if (!blobOrBase64.includes(',')) {
                    console.error('[App] downloadBlob: formato base64 inválido');
                    return;
                }
                const parts = blobOrBase64.split(',');
                const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                blob = new Blob([u8arr], { type: mime });
            } catch (error) {
                console.error('[App] Erro ao converter base64 para Blob:', error);
                return;
            }
        } else {
            blob = blobOrBase64;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    const handleDownloadPdf = useCallback(async (pdf: SavedPDF, filename: string) => {
        let blob = pdf.pdfBlob;
        if (!blob && pdf.id) {
            // Se o blob não estiver presente, buscar do banco (Supabase ou Local)
            try {
                blob = await db.getPDFBlob(pdf.id) || undefined;
            } catch (error) {
                console.error('[App] Erro ao buscar blob do PDF:', error);
            }
        }

        if (blob) {
            downloadBlob(blob, filename);
        } else {
            handleShowInfo("Não foi possível baixar o PDF.");
        }
    }, [downloadBlob, handleShowInfo]);

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
                const discountObj = m.discount || { value: '0', type: 'percentage' };
                const discountValue = parseFloat(String(discountObj.value).replace(',', '.')) || 0;

                if (discountObj.type === 'percentage' && discountValue > 0) {
                    itemDiscountAmount = basePrice * (discountValue / 100);
                } else if (discountObj.type === 'fixed' && discountValue > 0) {
                    itemDiscountAmount = discountValue;
                }

                const finalItemPrice = Math.max(0, basePrice - itemDiscountAmount);

                acc.totalM2 += m2;
                acc.subtotal += basePrice;
                acc.totalItemDiscount += itemDiscountAmount;
                acc.priceAfterItemDiscounts += finalItemPrice;
                acc.totalQuantity += quantidade; // Adicionando a quantidade total
            }
            return acc;
        }, { totalM2: 0, subtotal: 0, totalItemDiscount: 0, priceAfterItemDiscounts: 0, totalQuantity: 0 }); // Inicializando totalQuantity

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

        const groupedByFilm: { [key: string]: Measurement[] } = {};
        measurements.filter(m => m.active).forEach(m => {
            if (!groupedByFilm[m.pelicula]) groupedByFilm[m.pelicula] = [];
            groupedByFilm[m.pelicula].push(m);
        });

        let totalLinearMeters = 0;
        let linearMeterCost = 0;

        Object.entries(groupedByFilm).forEach(([filmName, filmMeasurements]) => {
            const film = films.find(f => f.nome === filmName);
            const rollWidth = 152; // Default roll width in cm

            const optimizer = new CuttingOptimizer({
                rollWidth,
                bladeWidth: 0,
                allowRotation: true
            });

            filmMeasurements.forEach(m => {
                const qty = Math.max(1, Math.floor(m.quantidade || 1));
                const w = parseFloat(String(m.largura).replace(',', '.')) * 100;
                const h = parseFloat(String(m.altura).replace(',', '.')) * 100;
                if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
                    for (let i = 0; i < qty; i++) {
                        optimizer.addItem(w, h);
                    }
                }
            });

            const optimizationResult = optimizer.optimize();
            const linearMeters = optimizationResult.totalHeight / 100;
            totalLinearMeters += linearMeters;

            if (film?.precoMetroLinear) {
                linearMeterCost += linearMeters * film.precoMetroLinear;
            }
        });

        return {
            ...result,
            generalDiscountAmount,
            finalTotal,
            totalLinearMeters,
            linearMeterCost
        };
    }, [measurements, films, generalDiscount]);

    const executePdfGeneration = useCallback(async () => {
        const activeMeasurements = measurements.filter(m => m.active && parseFloat(String(m.largura).replace(',', '.')) > 0 && parseFloat(String(m.altura).replace(',', '.')) > 0);
        if (activeMeasurements.length === 0) {
            handleShowInfo("Não há medidas válidas para gerar um orçamento.");
            return;
        }

        setPdfGenerationStatus('generating');
        try {
            // Importação dinâmica do módulo pdfGenerator para code splitting
            const { generatePDF } = await import('./services/pdfGenerator');
            // Passando o nome da opção de proposta para o gerador de PDF
            const pdfBlob = await generatePDF(selectedClient!, userInfo!, activeMeasurements, films, generalDiscount, totals, activeOption!.name);
            const filename = `orcamento_${selectedClient!.nome.replace(/\s+/g, '_').toLowerCase()}_${activeOption!.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;

            const generalDiscountForDb: SavedPDF['generalDiscount'] = {
                ...generalDiscount,
                value: parseFloat(String(generalDiscount.value).replace(',', '.')) || 0,
                type: generalDiscount.value ? generalDiscount.type : 'none',
            };

            const validityDays = userInfo!.proposalValidityDays || 60;
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
                proposalOptionName: activeOption!.name,
                proposalOptionId: activeOption!.id
            };
            await db.savePDF(pdfToSave);

            downloadBlob(pdfBlob, filename);

            setPdfGenerationStatus('success');

            if (hasLoadedHistory) {
                await loadAllPdfs();
            }
        } catch (error) {
            console.error("Erro ao gerar ou salvar PDF:", error);
            handleShowInfo("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
            setPdfGenerationStatus('idle');
        }
    }, [measurements, films, generalDiscount, totals, selectedClient, userInfo, activeOption, selectedClientId, downloadBlob, hasLoadedHistory, loadAllPdfs, handleShowInfo]);

    const handleGeneratePdf = useCallback(async () => {
        if (!selectedClient || !userInfo || !activeOption) {
            handleShowInfo("Selecione um cliente e preencha as informações da empresa antes de gerar o PDF.");
            return;
        }
        if (isDirty) {
            setIsSaveBeforePdfModalOpen(true);
            return;
        }
        await executePdfGeneration();
    }, [selectedClient, userInfo, activeOption, isDirty, handleShowInfo, executePdfGeneration]);

    const handleConfirmSaveBeforePdf = useCallback(async () => {
        await handleSaveChanges();
        setIsSaveBeforePdfModalOpen(false);
        await executePdfGeneration();
    }, [handleSaveChanges, executePdfGeneration]);

    const handleGenerateCombinedPdf = useCallback(async (selectedPdfs: SavedPDF[]) => {
        if (!userInfo || selectedPdfs.length === 0) return;

        setPdfGenerationStatus('generating');
        try {
            const client = clients.find(c => c.id === selectedPdfs[0].clienteId);
            if (!client) throw new Error("Cliente não encontrado para os orçamentos selecionados.");

            // Importação dinâmica do módulo pdfGenerator para code splitting
            const { generateCombinedPDF } = await import('./services/pdfGenerator');
            const pdfBlob = await generateCombinedPDF(client, userInfo, selectedPdfs, films);

            const firstOptionName = selectedPdfs[0].proposalOptionName || 'Opcao';
            const filename = `orcamento_combinado_${client.nome.replace(/\s+/g, '_').toLowerCase()}_${firstOptionName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;

            downloadBlob(pdfBlob, filename);

            setPdfGenerationStatus('success');
        } catch (error) {
            console.error("Erro ao gerar PDF combinado:", error);
            handleShowInfo(`Ocorreu um erro ao gerar o PDF combinado: ${error instanceof Error ? error.message : String(error)} `);
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

    const blobToBase64 = (blob: Blob): Promise<{ mimeType: string, data: string }> => {
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
                model: "gemini-2.0-flash-exp",
            });

            const prompt = `
                Você é um assistente especialista em extração de dados de clientes.Sua tarefa é extrair o máximo de informações de contato, endereço completo(incluindo CEP, logradouro, número, bairro, cidade e UF) e documento(CPF ou CNPJ) de um cliente a partir da entrada fornecida(texto, imagem ou áudio).
                
                ** Instrução Principal:** Analise todo o texto de entrada em busca de dados.Não pare no primeiro dado encontrado.
                
                ** Regra para Nome:** Identifique o nome do cliente.Se a entrada for apenas "Nome Telefone", separe - os.
                
                ** Regra de Extração de Números(CRÍTICO):**
            Varra o texto procurando por sequências numéricas.Use palavras - chave como "cep", "cpf", "cnpj", "tel", "cel" como dicas fortes, mas identifique também números soltos baseando - se na contagem de dígitos(ignorando símbolos):
                  - ** CNPJ:** 14 dígitos. (Ex: 28533595000160).Se encontrar, preencha o campo 'cpfCnpj'.
                  - ** CPF:** 11 dígitos. (Ex: 12345678900).Se encontrar, preencha o campo 'cpfCnpj'.
                  - ** Telefone:** 10 ou 11 dígitos(DDD + Número). (Ex: 83999998888).
                  - ** CEP:** 8 dígitos. (Ex: 58056170).
                
                ** Regra Crítica para Telefone:** Remova código de país(+55).Mantenha apenas DDD + Número.
                
                ** Formatação de Saída:** Retorne TODOS os campos numéricos(Telefone, CPF, CNPJ, CEP) APENAS com dígitos(string pura de números), removendo qualquer formatação original(pontos, traços, espaços).
                
                ** Endereço:** Tente separar inteligentemente o logradouro, número, bairro e cidade se estiverem misturados.
                
                ** Regra para UF:** O campo UF deve conter APENAS a sigla do estado(2 letras). ** SE NÃO ENCONTRAR, RETORNE UMA STRING VAZIA "".JAMAIS RETORNE A PALAVRA "string".**

            Responda APENAS com um objeto JSON válido, sem markdown, contendo os campos: nome, telefone, email, cpfCnpj, cep, logradouro, numero, complemento, bairro, cidade, uf.
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

            const result = await model.generateContent(parts);
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

                        return extractedData as ExtractedClientData;
                    } catch (e2) {
                        // Se a correção falhar, lança o erro original
                        throw new Error(`A resposta da IA não é um JSON válido.Erro: ${e instanceof Error ? e.message : 'JSON malformado'} `);
                    }
                }

                throw new Error(`A resposta da IA não é um JSON válido.Erro: ${e instanceof Error ? e.message : 'JSON malformado'} `);
            }

        } catch (error) {
            console.error("Erro ao processar dados do cliente com Gemini:", error);
            throw error; // Re-throw para ser capturado pelo handleProcessAIClientInput
        }
    };

    const processClientDataWithOpenAI = async (input: { type: 'text' | 'image'; data: string | File[] }): Promise<ExtractedClientData | null> => {
        showError("O preenchimento de dados do cliente com OpenAI ainda não está totalmente implementado. Por favor, use o Gemini ou preencha manualmente.");
        return null;
    };

    const handleProcessAIClientInput = useCallback(async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        // Modo OCR Local - usa processamento local
        if (userInfo?.aiConfig?.provider === 'local_ocr') {
            if (input.type === 'audio') {
                showError("O modo OCR Local não suporta áudio. Por favor, envie uma imagem ou texto.");
                return;
            }

            setIsProcessingAI(true);
            try {
                let text = '';

                if (input.type === 'text') {
                    text = input.data as string;
                } else {
                    const files = input.data as File[];
                    if (!files || files.length === 0) {
                        throw new Error("Nenhuma imagem fornecida.");
                    }
                    const { performOCR } = await import('./src/lib/ocr');
                    const ocrResult = await performOCR(files[0]);
                    text = ocrResult.text;
                }

                console.log("[OCR Local] Texto extraído para cliente:", text);

                const { extractClientFromOCR } = await import('./src/lib/parsePrint');
                const extractedData = extractClientFromOCR(text, 100);

                if (extractedData) {
                    setAiClientData(extractedData);
                    setIsAIClientModalOpen(false);
                    setIsClientModalOpen(true);
                } else {
                    showError("Não foi possível extrair dados do cliente. Tente reformular a entrada.");
                }
            } catch (error) {
                console.error("Erro ao processar cliente com OCR local:", error);
                showError(`Erro no OCR: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsProcessingAI(false);
            }
            return;
        }

        // Modo Gemini/OpenAI - requer API key
        if (!userInfo?.aiConfig?.apiKey || !userInfo?.aiConfig?.provider) {
            showError("Por favor, configure seu provedor e chave de API na aba 'Empresa' para usar esta funcionalidade.");
            return;
        }

        setIsProcessingAI(true);
        let extractedData: ExtractedClientData | null = null;

        try {
            if (userInfo.aiConfig.provider === 'gemini') {
                extractedData = await processClientDataWithGemini(input);
            } else if (userInfo.aiConfig.provider === 'openai') {
                if (input.type === 'audio') {
                    showError("O provedor OpenAI não suporta entrada de áudio para esta funcionalidade.");
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
            showError(`Ocorreu um erro com a IA: ${error instanceof Error ? error.message : String(error)} `);
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, showError]);

    const handleProcessAIFilmInput = useCallback(async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        // Modo OCR Local - usa processamento local para película
        if (userInfo?.aiConfig?.provider === 'local_ocr') {
            if (input.type === 'audio') {
                showError("O modo OCR Local não suporta áudio. Por favor, envie uma imagem ou texto.");
                return;
            }

            setIsProcessingAI(true);
            try {
                let text = '';

                if (input.type === 'text') {
                    text = input.data as string;
                } else {
                    const files = input.data as File[];
                    if (!files || files.length === 0) {
                        throw new Error("Nenhuma imagem fornecida.");
                    }
                    const { performOCR } = await import('./src/lib/ocr');
                    const ocrResult = await performOCR(files[0]);
                    text = ocrResult.text;
                }

                console.log("[OCR Local] Texto extraído para película:", text);

                // Parser simples para dados de película
                const filmData: Partial<Film> = {};
                const lines = text.split('\n').filter(l => l.trim().length > 2);
                if (lines.length > 0) {
                    filmData.nome = lines[0].trim();
                }

                const uvMatch = text.match(/UV[:\s]*([\d,\.]+)\s*%?/i);
                if (uvMatch) filmData.uv = parseFloat(uvMatch[1].replace(',', '.'));

                const irMatch = text.match(/IR[:\s]*([\d,\.]+)\s*%?/i);
                if (irMatch) filmData.ir = parseFloat(irMatch[1].replace(',', '.'));

                const vtlMatch = text.match(/VTL[:\s]*([\d,\.]+)\s*%?/i);
                if (vtlMatch) filmData.vtl = parseFloat(vtlMatch[1].replace(',', '.'));

                const tserMatch = text.match(/TSER[:\s]*([\d,\.]+)\s*%?/i);
                if (tserMatch) filmData.tser = parseFloat(tserMatch[1].replace(',', '.'));

                const precoMatch = text.match(/(?:pre[çc]o|valor|R\$)[:\s]*([\d,\.]+)/i);
                if (precoMatch) filmData.preco = parseFloat(precoMatch[1].replace(',', '.'));

                if (Object.keys(filmData).length > 0) {
                    setAiFilmData(filmData);
                    setIsAIFilmModalOpen(false);
                    setNewFilmName(filmData.nome || '');
                    setIsFilmModalOpen(true);
                } else {
                    showError("Não foi possível extrair dados da película. Tente reformular a entrada.");
                }
            } catch (error) {
                console.error("Erro ao processar película com OCR local:", error);
                showError(`Erro no OCR: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsProcessingAI(false);
            }
            return;
        }

        // Modo Gemini/OpenAI - requer API key
        if (!userInfo?.aiConfig?.apiKey || !userInfo?.aiConfig?.provider) {
            showError("Por favor, configure seu provedor e chave de API na aba 'Empresa' para usar esta funcionalidade.");
            return;
        }

        setIsProcessingAI(true);

        try {
            const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

            const prompt = `Você é um assistente especialista em extração de dados de películas automotivas (insulfilm). Sua tarefa é extrair o máximo de informações técnicas de películas a partir da entrada fornecida (texto ou imagem). Retorne APENAS um objeto JSON válido, sem markdown. Campos: nome, preco (apenas números), uv (%), ir (%), vtl (%), tser (%), espessura (micras), garantiaFabricante (anos), precoMetroLinear. Se algum campo não for encontrado, NÃO inclua no JSON.`;

            const parts: any[] = [prompt];

            if (input.type === 'text') {
                parts.push(input.data as string);
            } else if (input.type === 'image') {
                for (const file of input.data as File[]) {
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve) => {
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.readAsDataURL(file);
                    });
                    const base64Data = await base64Promise;
                    parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
                }
            } else {
                showError("Entrada de áudio ainda não é suportada para películas.");
                setIsProcessingAI(false);
                return;
            }

            const result = await model.generateContent(parts);
            const responseText = result.response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const filmData = JSON.parse(jsonMatch[0]);
                setAiFilmData(filmData);
                setIsAIFilmModalOpen(false);
                setNewFilmName(filmData.nome || '');
                setIsFilmModalOpen(true);
            } else {
                showError("Não foi possível extrair dados da película. Tente reformular a entrada.");
            }
        } catch (error) {
            console.error("Erro ao processar dados da película com IA:", error);
            showError(`Ocorreu um erro com a IA: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, showError]);

    const processWithGemini = async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        try {
            const genAI = new GoogleGenerativeAI(userInfo!.aiConfig!.apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash-exp",
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
                Você é um assistente especialista para uma empresa de instalação de películas de vidro.Sua tarefa é extrair dados de medidas de uma entrada fornecida pelo usuário.
                A entrada pode ser texto, imagem(de uma lista, rascunho ou foto) ou áudio.
        Extraia as seguintes informações para cada medida: largura, altura, quantidade e uma descrição do ambiente / local(ex: "sala", "quarto", "janela da cozinha").
                As medidas estão em metros.Se o usuário disser '1 e meio por 2', interprete como 1, 50m por 2,00m.Sempre formate as medidas com duas casas decimais e vírgula como separador.
                O ambiente deve ser uma descrição curta e útil.
                Responda APENAS com um objeto JSON válido que corresponda ao schema fornecido.Não inclua nenhuma outra explicação ou texto.
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

            const result = await model.generateContent(parts);
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
                        discount: { value: '0', type: 'percentage' },
                    }));

                    if (newMeasurements.length > 0) {
                        handleMeasurementsChange([...measurements.map(m => ({ ...m, isNew: false })), ...newMeasurements]);
                        setIsAIMeasurementModalOpen(false);
                    } else {
                        showError("Nenhuma medida foi extraída. Tente novamente com mais detalhes.");
                    }
                } else {
                    throw new Error("A resposta da IA não está no formato de array esperado.");
                }
            } catch (e) {
                console.error("Erro de JSON.parse:", e);
                throw new Error(`A resposta da IA não é um JSON válido.Erro: ${e instanceof Error ? e.message : 'JSON malformado'} `);
            }
        } catch (error) {
            console.error("Erro ao processar com Gemini:", error);
            throw error;
        }
    };

    const processWithOpenAI = async (input: { type: 'text' | 'image'; data: string | File[] }) => {
        try {
            const prompt = `Você é um assistente especialista para uma empresa de instalação de películas de vidro.Sua tarefa é extrair dados de medidas da entrada fornecida pelo usuário.Extraia as seguintes informações para cada medida: largura, altura, quantidade e uma descrição do ambiente / local(ex: "sala", "quarto", "janela da cozinha").As medidas estão em metros.Se o usuário disser '1 e meio por 2', interprete como 1, 50m por 2,00m.Sempre formate as medidas com duas casas decimais e vírgula como separador.O ambiente deve ser uma descrição curta e útil.`;

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
                    { type: 'image_url', image_url: { url: `data:${mimeType}; base64, ${data} ` } }
                ];
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userInfo!.aiConfig!.apiKey} `
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
                throw new Error(`OpenAI API Error: ${errorData.error.message} `);
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
                    discount: { value: '0', type: 'percentage' },
                }));

                handleMeasurementsChange([...measurements.map(m => ({ ...m, isNew: false })), ...newMeasurements]);
                setIsAIMeasurementModalOpen(false);
            } else {
                showError("Nenhuma medida foi extraída com OpenAI. Tente novamente com mais detalhes.");
            }

        } catch (error) {
            console.error("Erro ao processar com OpenAI:", error);
            throw error;
        }
    }

    const handleProcessAIInput = async (input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }) => {
        // Modo OCR Local - usa processamento local
        if (userInfo?.aiConfig?.provider === 'local_ocr') {
            if (input.type === 'audio') {
                showError("O modo OCR Local não suporta áudio. Por favor, envie uma imagem ou texto.");
                return;
            }

            setIsProcessingAI(true);
            try {
                let text = '';

                if (input.type === 'text') {
                    text = input.data as string;
                } else {
                    const files = input.data as File[];
                    if (!files || files.length === 0) {
                        throw new Error("Nenhuma imagem fornecida.");
                    }
                    // Importar dinamicamente o OCR
                    const { performOCR } = await import('./src/lib/ocr');
                    const ocrResult = await performOCR(files[0]);
                    text = ocrResult.text;
                }

                console.log("[OCR Local] Texto extraído para medidas:", text);

                // Importar parser dinamicamente
                const { extractMeasurementsFromOCR } = await import('./src/lib/parsePrint');
                const extractedData = extractMeasurementsFromOCR(text, 100);

                if (extractedData && extractedData.length > 0) {
                    const newMeasurements: UIMeasurement[] = extractedData.map((item, index) => ({
                        id: Date.now() + index,
                        largura: item.largura || '',
                        altura: item.altura || '',
                        quantidade: item.quantidade || 1,
                        ambiente: item.local || 'Desconhecido',
                        tipoAplicacao: 'Desconhecido',
                        pelicula: films[0]?.nome || 'Nenhuma',
                        active: true,
                        isNew: index === 0,
                        discount: { value: '0', type: 'percentage' },
                    }));

                    handleMeasurementsChange([...measurements.map(m => ({ ...m, isNew: false })), ...newMeasurements]);
                    setIsAIMeasurementModalOpen(false);
                } else {
                    showError("Nenhuma medida foi extraída. Tente novamente com mais detalhes.");
                }
            } catch (error) {
                console.error("Erro ao processar com OCR local:", error);
                showError(`Erro no OCR: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsProcessingAI(false);
            }
            return;
        }

        // Modo Gemini/OpenAI - requer API key
        if (!userInfo?.aiConfig?.apiKey) {
            showError("Por favor, configure sua chave de API na aba 'Empresa' para usar esta funcionalidade.");
            return;
        }

        setIsProcessingAI(true);

        try {
            if (userInfo.aiConfig.provider === 'gemini') {
                await processWithGemini(input);
            } else if (userInfo.aiConfig.provider === 'openai') {
                if (input.type === 'audio') {
                    showError("O provedor OpenAI não suporta entrada de áudio nesta aplicação.");
                    return;
                }
                await processWithOpenAI(input as { type: 'text' | 'image'; data: string | File[] });
            }
        } catch (error) {
            console.error("Erro ao processar com IA:", error);
            showError(`Ocorreu um erro com a IA: ${error instanceof Error ? error.message : String(error)} `);
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
        if (hasLoadedAgendamentos) {
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
            handleShowInfo("Não foi possível atualizar o status do orçamento.");
        }
    }, [loadAllPdfs]);


    const toggleFullScreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full - screen mode: ${err.message} (${err.name})`);
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

        // Se a medida sendo editada for a mesma que recebeu a nova película, atualiza o estado da modal também
        if (editingMeasurement && editingMeasurement.id === editingMeasurementIdForFilm) {
            setEditingMeasurement(prev => prev ? { ...prev, pelicula: filmName } : null);
        }

        setIsFilmSelectionModalOpen(false);
        setEditingMeasurementIdForFilm(null);
    }, [editingMeasurementIdForFilm, measurements, handleMeasurementsChange, editingMeasurement]);

    const handleApplyFilmToAll = useCallback((filmName: string | null) => {
        if (filmName) {
            const updatedMeasurements = measurements.map(m => ({ ...m, pelicula: filmName }));
            handleMeasurementsChange(updatedMeasurements);
            setFilmToApplyToAll(null);
            setIsApplyFilmToAllModalOpen(false);
        }
    }, [measurements, handleMeasurementsChange]);



    const handleAddNewClientFromSelection = useCallback((clientName: string) => {
        setIsClientSelectionModalOpen(false);
        setClientModalMode('add');
        setNewClientName(clientName);
        setAiClientData(undefined);
        setIsClientModalOpen(true);
    }, []);

    const handleAddNewFilmFromSelection = useCallback((filmName: string) => {
        setIsFilmSelectionModalOpen(false);
        setNewFilmName(filmName);
        handleOpenFilmModal(null);
    }, [handleOpenFilmModal]);

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

    const handleImmediateDeleteMeasurement = useCallback((measurementId: number) => {
        const measurementIndex = measurements.findIndex(m => m.id === measurementId);
        const measurement = measurements[measurementIndex];

        if (measurement && measurementIndex !== -1) {
            // Save for undo
            setDeletedMeasurement(measurement);
            setDeletedMeasurementIndex(measurementIndex);
            setShowUndoToast(true);

            // Delete
            handleMeasurementsChange(measurements.filter(m => m.id !== measurementId));
        }
    }, [measurements, handleMeasurementsChange]);

    const handleUndoDelete = useCallback(() => {
        if (deletedMeasurement && deletedMeasurementIndex !== null) {
            const newMeasurements = [...measurements];
            newMeasurements.splice(deletedMeasurementIndex, 0, deletedMeasurement);
            handleMeasurementsChange(newMeasurements);

            // Clear undo state
            setDeletedMeasurement(null);
            setDeletedMeasurementIndex(null);
            setShowUndoToast(false);
        }
    }, [deletedMeasurement, deletedMeasurementIndex, measurements, handleMeasurementsChange]);

    const handleDismissUndo = useCallback(() => {
        setDeletedMeasurement(null);
        setDeletedMeasurementIndex(null);
        setShowUndoToast(false);
    }, []);



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
            handleShowInfo("N�o foi poss�vel salvar o agendamento. Tente novamente.");
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
            handleShowInfo("N�o foi poss�vel excluir o agendamento. Tente novamente.");
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

    const handleOpenDiscountModal = useCallback((measurement: UIMeasurement, basePrice: number = 0) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurementForDiscount(measurement);
        setEditingMeasurementBasePrice(basePrice);
    }, [numpadConfig.isOpen, handleNumpadClose]);

    const handleCloseDiscountModal = useCallback(() => {
        setEditingMeasurementForDiscount(null);
        setEditingMeasurementBasePrice(0);
    }, []);

    const handleSaveDiscount = useCallback((discount: { value: string; type: 'percentage' | 'fixed' }) => {
        if (!editingMeasurementForDiscount) return;

        const updatedMeasurements = measurements.map(m =>
            m.id === editingMeasurementForDiscount.id ? { ...m, discount } : m
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
        if (hasModule('ia_ocr')) {
            setIsClientModalOpen(false);
            setIsAIClientModalOpen(true);
        } else {
            setShowIaUpgradeModal(true);
        }
    }, [hasModule]);

    const handleOpenAIFilmModal = useCallback(() => {
        if (hasModule('ia_ocr')) {
            setIsAIFilmModalOpen(true);
        } else {
            setShowIaUpgradeModal(true);
        }
    }, [hasModule]);

    const handleProcessAIMeasurementInput = useCallback(async (
        input: { type: 'text' | 'image' | 'audio'; data: string | File[] | Blob }
    ) => {
        if (!userInfo?.aiConfig?.apiKey) {
            handleShowInfo("Por favor, configure sua chave de API na aba 'Empresa' para usar esta funcionalidade.");
            return;
        }

        setIsProcessingAI(true);
        try {
            const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

            const prompt = `Você é um assistente especialista em extração de medidas de janelas/vidros para instalação de películas.

Sua tarefa é extrair as medidas e retornar um array JSON.

**REGRAS DE AGRUPAMENTO (CRÍTICO):**
1. AGRUPE medidas idênticas (mesma largura, altura e local) em um único item.
2. Se a entrada for "5 janelas de 1.20 x 2.10 na sala", retorne UM ÚNICO item com quantidade: 5.
3. NÃO crie itens separados para a mesma medida repetida.

**REGRAS DE AMBIENTE:**
1. O campo "local" deve SEMPRE incluir o ambiente mencionado (Sala, Quarto, Cozinha, etc).
2. Ex: "Janela da Sala", "Vidro Fixo do Escritório".
3. Se não houver ambiente, use genérico (ex: "Janela").

**OUTRAS REGRAS:**
1. Largura e Altura devem ser strings com vírgula como decimal (ex: "1,20").

FORMATO DE RESPOSTA (JSON PURO):
[
  { "local": "Janela da Sala", "largura": "1,20", "altura": "2,10", "quantidade": 5 }
]

Se não conseguir extrair, retorne: []`;

            const parts: any[] = [prompt];

            if (input.type === 'text') {
                parts.push(input.data as string);
            } else if (input.type === 'image') {
                for (const file of input.data as File[]) {
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve) => {
                        reader.onloadend = () => {
                            const base64 = (reader.result as string).split(',')[1];
                            resolve(base64);
                        };
                        reader.readAsDataURL(file);
                    });
                    const base64Data = await base64Promise;
                    parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
                }
            } else if (input.type === 'audio') {
                const blob = input.data as Blob;
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                    reader.readAsDataURL(blob);
                });
                const base64Data = await base64Promise;
                parts.push({ inlineData: { mimeType: blob.type, data: base64Data } });
            }

            const result = await model.generateContent(parts);
            const responseText = result.response.text();

            // Parse JSON
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                handleShowInfo("N�o foi poss�vel extrair medidas. Tente reformular.");
                return;
            }

            const extractedMeasurements = JSON.parse(jsonMatch[0]);

            if (!Array.isArray(extractedMeasurements) || extractedMeasurements.length === 0) {
                handleShowInfo("Nenhuma medida foi encontrada. Tente novamente.");
                return;
            }

            // Adiciona as medidas extraídas
            const newMeasurements = extractedMeasurements.map((m: any, index: number) => ({
                ...createEmptyMeasurement(),
                id: Date.now() + index, // Garante ID único
                ambiente: m.local || '', // Mapeia 'local' do JSON para 'ambiente' do objeto Measurement
                largura: m.largura || '',
                altura: m.altura || '',
                quantidade: m.quantidade || 1,
                isNew: false
            }));


            handleMeasurementsChange([...measurements, ...newMeasurements]);
            setIsAIMeasurementModalOpen(false);
            handleShowInfo(`${newMeasurements.length} medida(s) adicionada(s) com sucesso!`);

        } catch (error) {
            console.error("Erro ao processar medidas com IA:", error);
            handleShowInfo(`Erro: ${error instanceof Error ? error.message : 'Tente novamente'}`);
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, measurements, handleMeasurementsChange, createEmptyMeasurement]);


    const LoadingSpinner = () => (
        <div className="w-full p-4">
            <CardSkeleton count={3} />
        </div>
    );


    const handlePromptPwaInstall = useCallback(() => {
        if (deferredPrompt) {
            promptInstall();
        } else {
            alert("Para instalar, use o menu 'Compartilhar' do seu navegador e selecione 'Adicionar � Tela de In�cio'.");
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

    const handleNavigateToOption = useCallback((clientId: number, optionId: number) => {
        // Muda para a aba de cliente
        setActiveTab('client');
        // Seleciona o cliente
        setSelectedClientId(clientId);
        // Aguarda um momento para garantir que o cliente foi carregado, então seleciona a opção
        setTimeout(() => {
            setActiveOptionId(optionId);
        }, 100);
    }, []);


    const ClientViewSkeleton = () => (
        <div className="animate-pulse space-y-6">
            {/* Client Bar Skeleton */}
            <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                    <Skeleton variant="circular" width={44} height={44} />
                    <div className="flex-1 space-y-2">
                        <Skeleton variant="text" height={20} width="50%" />
                        <Skeleton variant="text" height={12} width="30%" />
                    </div>
                </div>
                <Skeleton variant="rounded" width={32} height={32} className="rounded-lg" />
            </div>

            {/* Carousel Skeleton */}
            <div className="flex gap-2 overflow-hidden py-2">
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} variant="rounded" width={110} height={38} className="flex-shrink-0 rounded-full" />
                ))}
            </div>

            {/* Measurement List Skeleton */}
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-4 shadow-sm">
                        <div className="flex justify-between items-center">
                            <Skeleton variant="text" height={24} width="35%" />
                            <div className="flex gap-2">
                                <Skeleton variant="rounded" width={60} height={24} className="rounded-full" />
                                <Skeleton variant="circular" width={24} height={24} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Skeleton variant="text" height={12} width="40%" />
                                <Skeleton variant="rounded" height={42} className="rounded-lg" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton variant="text" height={12} width="40%" />
                                <Skeleton variant="rounded" height={42} className="rounded-lg" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton variant="text" height={12} width="40%" />
                                <Skeleton variant="rounded" height={42} className="rounded-lg" />
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <Skeleton variant="text" height={16} width="40%" />
                            <Skeleton variant="text" height={16} width="20%" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions Bar Skeleton (Bottom) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 sm:relative sm:bg-transparent sm:border-none sm:p-0 sm:mt-6">
                <div className="max-w-2xl mx-auto flex gap-3">
                    <Skeleton variant="rounded" height={52} width="100%" className="rounded-xl" />
                    <Skeleton variant="rounded" height={52} width="100%" className="rounded-xl" />
                </div>
            </div>
        </div>
    );

    const EstoqueSkeleton = () => (
        <div className="animate-pulse space-y-4">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
                <Skeleton variant="text" height={28} width="30%" />
                <Skeleton variant="rounded" height={40} width={120} className="rounded-xl" />
            </div>

            {/* Filter Tabs Skeleton */}
            <div className="flex gap-2 overflow-hidden py-2">
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} variant="rounded" width={100} height={36} className="flex-shrink-0 rounded-full" />
                ))}
            </div>

            {/* Stock Items Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                            <Skeleton variant="text" height={20} width="60%" />
                            <Skeleton variant="circular" width={24} height={24} />
                        </div>
                        <Skeleton variant="rounded" height={4} width="100%" className="rounded-full" />
                        <div className="flex justify-between items-center">
                            <Skeleton variant="text" height={16} width="30%" />
                            <Skeleton variant="text" height={16} width="20%" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderContent = () => {
        if (isLoading) {
            if (activeTab === 'client') return <ClientViewSkeleton />;
            if (activeTab === 'estoque') return <EstoqueSkeleton />;
            return <LoadingSpinner />;
        }

        if (activeTab === 'settings') {
            if (userInfo) {
                return (
                    <UserSettingsView
                        userInfo={{
                            ...userInfo,
                            organizationId: organizationId || undefined,
                            isOwner: isOwner
                        }}
                        onSave={handleSaveUserInfo}
                        onOpenPaymentMethods={() => setIsPaymentModalOpen(true)}
                        onOpenApiKeyModal={handleOpenApiKeyModal}
                        isPwaInstalled={isInstalled}
                        onPromptPwaInstall={handlePromptPwaInstall}
                    />
                );
            }
            return null;
        }

        if (activeTab === 'admin') {
            return <AdminUsers />;
        }

        if (activeTab === 'account') {
            return <UserAccount />;
        }

        if (activeTab === 'history') {
            return (
                <PdfHistoryView
                    pdfs={allSavedPdfs}
                    clients={clients}
                    agendamentos={agendamentos}
                    onDelete={handleRequestDeletePdf}
                    onDownload={handleDownloadPdf}
                    onUpdateStatus={handleUpdatePdfStatus}
                    onSchedule={handleOpenAgendamentoModal}
                    onGenerateCombinedPdf={handleGenerateCombinedPdf}
                    onNavigateToOption={handleNavigateToOption}
                />
            );
        }

        if (activeTab === 'agenda') {
            return (
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
            );
        }


        if (activeTab === 'films') {
            return (
                <FilmListView
                    films={films}
                    onAdd={() => handleOpenFilmModal(null)}
                    onEdit={handleOpenFilmModal}
                    onDelete={handleRequestDeleteFilm}
                    onOpenGallery={handleOpenGallery}
                />
            );
        }

        if (activeTab === 'estoque') {
            return (
                <FeatureGate moduleId="estoque">
                    <EstoqueView films={films} initialAction={initialEstoqueAction} />
                </FeatureGate>
            );
        }

        if (clients.length === 0) {
            return (
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[300px] bg-slate-50 dark:bg-slate-900 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-users fa-2x text-slate-500 dark:text-slate-400"></i>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Crie seu Primeiro Cliente</h3>
                    <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-xs mx-auto">Tudo comea com um cliente. Adicione os dados para comear a gerar oramentos.</p>
                    <button
                        onClick={() => handleOpenClientModal('add')}
                        className="mt-6 px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition duration-300 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 flex items-center gap-2"
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
                    clientId={selectedClientId}
                    optionId={activeOptionId}
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
                    onDeleteMeasurementImmediate={handleImmediateDeleteMeasurement}
                    totalM2={totals.totalM2}
                    totalQuantity={totals.totalQuantity}
                />
            );
        }
        if (selectedClientId && measurements.length === 0) {
            return (
                <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[350px] opacity-0 animate-fade-in">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                        <i className="fas fa-ruler-combined text-4xl text-slate-400 dark:text-slate-500"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Nenhuma Medida Ainda</h3>
                    <p className="text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed mb-6 text-sm">
                        Adicione as dimensões das janelas ou busque medidas de um local conhecido.
                    </p>
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <button
                            onClick={addMeasurement}
                            className="w-full px-6 py-3.5 bg-slate-800 dark:bg-slate-700 text-white font-semibold rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-3"
                        >
                            <i className="fas fa-plus text-lg"></i>
                            <span>Adicionar Medida</span>
                        </button>
                        <button
                            onClick={() => setIsLocationImportModalOpen(true)}
                            className="w-full px-6 py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-3"
                        >
                            <i className="fas fa-building text-lg"></i>
                            <span>Buscar por Localização</span>
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 max-w-xs">
                        <i className="fas fa-info-circle mr-1"></i>
                        Busque por condomínio ou empresa para importar medidas já cadastradas
                    </p>
                </div>
            );
        }
        return (
            <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[350px] opacity-0 animate-fade-in">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <i className="fas fa-user-check text-4xl text-slate-400 dark:text-slate-500"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Nenhum Cliente Selecionado</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed text-sm">
                    Escolha um cliente no menu acima para ver suas medidas.
                </p>
            </div>
        );
    }

    const measurementToDelete = measurements.find(m => m.id === measurementToDeleteId);

    const modalProps = {
        isClientModalOpen,
        setIsClientModalOpen,
        clientModalMode,
        selectedClient,
        newClientName,
        setNewClientName,
        aiClientData,
        setAiClientData,
        handleSaveClient,
        handleOpenAIClientModal,
        isClientSelectionModalOpen,
        setIsClientSelectionModalOpen,
        clients,
        setSelectedClientId,
        isLoading,
        handleAddNewClientFromSelection,
        handleToggleClientPin,
        isPaymentModalOpen,
        setIsPaymentModalOpen,
        userInfo,
        handleSavePaymentMethods,
        editingMeasurement,
        setEditingMeasurement,
        handleSaveMeasurement: handleUpdateEditingMeasurement,
        handleCloseEditMeasurementModal,
        films,
        handleUpdateEditingMeasurement,
        handleDeleteMeasurementFromEditModal,
        handleOpenFilmModal,
        handleOpenFilmSelectionModal,
        numpadConfig,
        handleOpenNumpad,
        isFilmModalOpen,
        setIsFilmModalOpen,
        setEditingFilm,
        setEditingMeasurementIdForFilm,
        setNewFilmName,
        setAiFilmData,
        handleSaveFilm,
        handleDeleteFilm,
        editingFilm,
        newFilmName,
        aiFilmData,
        setIsAIFilmModalOpen,
        handleOpenAIFilmModal,
        isFilmSelectionModalOpen,
        setIsFilmSelectionModalOpen,
        handleSelectFilm: handleSelectFilmForMeasurement,
        handleAddNewFilm: handleAddNewFilmFromSelection,
        handleEditFilm: handleEditFilmFromSelection,
        handleRequestDeleteFilm,
        handleToggleFilmPin,
        isApplyFilmToAllModalOpen,
        setIsApplyFilmToAllModalOpen,
        handleApplyFilmToAll,
        schedulingInfo,
        setSchedulingInfo,
        handleCloseAgendamentoModal,
        handleSaveAgendamento,
        handleRequestDeleteAgendamento,
        agendamentos,
        handleAddNewClientFromAgendamento,
        infoModalConfig,
        setInfoModalConfig,
        handleCloseInfoModal,
        isSaveBeforePdfModalOpen,
        setIsSaveBeforePdfModalOpen,
        handleConfirmSaveBeforePdf,
        isClearAllModalOpen,
        setIsClearAllModalOpen,
        handleConfirmClearAll,
        filmToDeleteName,
        setFilmToDeleteName,
        handleConfirmDeleteFilm,
        filmToApplyToAll,
        setFilmToApplyToAll,

        isDeleteClientModalOpen,
        setIsDeleteClientModalOpen,
        handleConfirmDeleteClient,
        pdfToDeleteId,
        setPdfToDeleteId,
        handleConfirmDeletePdf,
        agendamentoToDelete,
        setAgendamentoToDelete,
        handleConfirmDeleteAgendamento,
        isExitConfirmModalOpen,
        setIsExitConfirmModalOpen,
        pdfGenerationStatus,
        handleClosePdfStatusModal,
        handleGoToHistoryFromPdf,
        isProcessingAI,
        isAIClientModalOpen,
        setIsAIClientModalOpen,
        handleProcessAIClientInput,
        isAIFilmModalOpen,

        handleProcessAIFilmInput,
        isAIMeasurementModalOpen,
        setIsAIMeasurementModalOpen,
        handleProcessAIMeasurementInput,
        isApiKeyModalOpen,
        setIsApiKeyModalOpen,
        handleSaveApiKey,
        apiKeyModalProvider,
        isGalleryOpen,
        handleCloseGallery,
        galleryImages,
        galleryInitialIndex,
        isDuplicateAllModalOpen,
        setIsDuplicateAllModalOpen,
        activeOption,
        handleConfirmDuplicateAll,
        measurementToDeleteId,
        setMeasurementToDeleteId,
        handleConfirmDeleteIndividualMeasurement,
        measurementToDelete,
        isDeleteProposalOptionModalOpen,
        setIsDeleteProposalOptionModalOpen,
        handleConfirmDeleteProposalOption,
        proposalOptionToDeleteName: proposalOptions.find(opt => opt.id === proposalOptionToDeleteId)?.name || null,

        // Discount Modal
        editingMeasurementForDiscount,
        handleCloseDiscountModal,
        handleSaveDiscount,
        editingMeasurementBasePrice,
        onOpenLocationImport: () => setIsLocationImportModalOpen(true),
    };




    return (
        <div className="h-full font-roboto flex flex-col">
            <ProtectedRoute>
                {/* Banner de atualização automática */}
                <UpdateBanner />

                <main ref={mainRef} className="flex-grow overflow-y-auto pb-32 sm:pb-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
                    <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-40 border-b border-slate-200/50 dark:border-slate-800/50">
                        <div className="container mx-auto px-4 w-full max-w-2xl">
                            <div className="py-2 sm:py-3">
                                <Header
                                    activeTab={activeTab}
                                    onTabChange={handleTabChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="container mx-auto px-0.5 sm:px-4 py-4 sm:py-8 w-full max-w-2xl">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 sm:p-6">
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
                                        <div className="bg-slate-100 dark:bg-slate-900 p-2 px-2 rounded-xl">
                                            <div className="relative z-20">
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
                                            </div>

                                            {proposalOptions.length > 0 && activeOptionId && (
                                                <ProposalOptionsCarousel
                                                    options={proposalOptions}
                                                    activeOptionId={activeOptionId}
                                                    onSelectOption={setActiveOptionId}
                                                    onRenameOption={handleRenameProposalOption}
                                                    onDeleteOption={handleRequestDeleteProposalOption}
                                                    onAddOption={handleAddProposalOption}
                                                    onSwipeDirectionChange={handleSwipeDirectionChange}
                                                />
                                            )}

                                            <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in">
                                                {renderContent()}

                                                {/* Otimizador de Corte - Dentro do grupo de medidas */}
                                                {measurements.length > 0 && selectedClientId && (
                                                    <div className="mt-4 mb-4 sm:mb-0">
                                                        <CuttingOptimizationPanel
                                                            measurements={measurements}
                                                            clientId={selectedClientId ?? undefined}
                                                            optionId={activeOptionId ?? undefined}
                                                            films={films}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in">
                                            {renderContent()}
                                        </div>
                                    )}
                                </>
                            ) : ['history', 'agenda'].includes(activeTab) ? (
                                <div className="bg-blue-50 dark:bg-slate-900 -m-4 sm:-m-6 p-4 sm:p-6 rounded-2xl">
                                    <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in">
                                        {renderContent()}
                                    </div>
                                </div>
                            ) : (
                                <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in">
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
                                            onOpenAIModal={() => {
                                                if (hasModule('ia_ocr')) {
                                                    setIsAIMeasurementModalOpen(true);
                                                } else {
                                                    setShowIaUpgradeModal(true);
                                                }
                                            }}
                                        />
                                    </div>
                                    <MobileFooter
                                        totals={totals}
                                        generalDiscount={generalDiscount}
                                        onOpenGeneralDiscountModal={() => setIsGeneralDiscountModalOpen(true)}
                                        onUpdateGeneralDiscount={handleGeneralDiscountChange}
                                        onAddMeasurement={addMeasurement}
                                        onDuplicateMeasurements={duplicateAllMeasurements}
                                        onGeneratePdf={handleGeneratePdf}
                                        isGeneratingPdf={pdfGenerationStatus === 'generating'}
                                        onOpenAIModal={() => {
                                            if (hasModule('ia_ocr')) {
                                                setIsAIMeasurementModalOpen(true);
                                            } else {
                                                setShowIaUpgradeModal(true);
                                            }
                                        }}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </main>


                <ModalsContainer {...modalProps} />
                <CustomNumpad
                    ref={numpadRef}
                    isOpen={numpadConfig.isOpen}
                    onInput={handleNumpadInput}
                    onDelete={handleNumpadDelete}
                    onDone={handleNumpadDone}
                    onClose={handleNumpadClose}
                    onDuplicate={handleNumpadDuplicate}
                    onClear={handleNumpadClear}
                    onAddGroup={handleNumpadAddGroup}
                    activeField={numpadConfig.field}
                />

                {/* Botão Flutuante - QR Code de Serviços */}
                {userInfo && (
                    <button
                        onClick={() => {
                            if (hasModule('qr_servicos')) {
                                setIsServicoQrModalOpen(true);
                            } else {
                                setShowQrUpgradeModal(true);
                            }
                        }}
                        className={`fixed bottom-36 sm:bottom-8 right-4 sm:right-8 ${hasModule('qr_servicos')
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                            : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600'
                            } text-white p-4 rounded-full shadow-2xl z-[9999] transition-all duration-300 hover:scale-110 flex items-center justify-center border-2 border-white relative`}
                        title={hasModule('qr_servicos') ? "Gerar QR Code de Serviço" : "QR Code Serviços (PRO)"}
                        style={{ width: '60px', height: '60px' }}
                    >
                        <i className="fas fa-qrcode text-2xl"></i>
                        {!hasModule('qr_servicos') && (
                            <span className="absolute -top-1 -right-1 bg-white text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md">
                                PRO
                            </span>
                        )}
                    </button>
                )}

                <LocationImportModal
                    isOpen={isLocationImportModalOpen}
                    onClose={() => setIsLocationImportModalOpen(false)}
                    onImportMeasurements={(importedMeasurements) => {
                        handleMeasurementsChange([...measurements, ...importedMeasurements]);
                        setIsLocationImportModalOpen(false);
                    }}
                    currentFilm={films[0]?.nome}
                />

                {newVersionAvailable && (
                    <UpdateNotification onUpdate={handleUpdate} />
                )}
                {showUndoToast && deletedMeasurement && (
                    <Toast
                        message="Medida excluída"
                        onUndo={handleUndoDelete}
                        onDismiss={handleDismissUndo}
                        duration={5000}
                    />
                )}

                <ServicoQrModal
                    isOpen={isServicoQrModalOpen}
                    onClose={() => setIsServicoQrModalOpen(false)}
                    userInfo={userInfo}
                    films={films}
                    clients={clients}
                    isClientsLoading={isLoading}
                    onTogglePin={handleToggleClientPin}
                    onAddNewClient={handleAddNewClientFromSelection}
                />

                {/* Modal de Upgrade - QR Code Serviços */}
                {showQrUpgradeModal && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                            <UpgradePrompt
                                module={modules.find(m => m.id === 'qr_servicos')}
                                onUpgradeClick={() => {
                                    setShowQrUpgradeModal(false);
                                    setActiveTab('account');
                                }}
                            />
                            <button
                                onClick={() => setShowQrUpgradeModal(false)}
                                className="w-full mt-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal de Upgrade - IA/OCR */}
                {showIaUpgradeModal && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                            <UpgradePrompt
                                module={modules.find(m => m.id === 'ia_ocr')}
                                onUpgradeClick={() => {
                                    setShowIaUpgradeModal(false);
                                    setActiveTab('account');
                                }}
                            />
                            <button
                                onClick={() => setShowIaUpgradeModal(false)}
                                className="w-full mt-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}
            </ProtectedRoute>
        </div>
    );
};

export default App;

