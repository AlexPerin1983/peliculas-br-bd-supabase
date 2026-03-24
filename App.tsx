import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import './src/estoque-dark-mode.css';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Client, Measurement, UserInfo, Film, PaymentMethods, SavedPDF, Agendamento, SchedulingInfo, ExtractedClientData, Totals, UIMeasurement } from './types';
import { CuttingOptimizer } from './utils/CuttingOptimizer';
import * as db from './services/db';
import { supabase } from './services/supabaseClient';
// pdfGenerator será importado dinamicamente para code splitting
import Header from './components/Header';
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
import ImageGalleryModal from './components/modals/ImageGalleryModal';
import LocationImportModal from './components/modals/LocationImportModal';
import ServicoQrModal from './components/modals/ServicoQrModal';
import UpdateNotification from './components/UpdateNotification';
import UpdateBanner from './components/UpdateBanner';
import { ModalsContainer } from './components/ModalsContainer';
import { usePwaInstallPrompt } from './src/hooks/usePwaInstallPrompt';
import { usePwaUpdate } from './src/hooks/usePwaUpdate';
import { useAppBootstrap } from './src/hooks/useAppBootstrap';
import { useProposalEditor } from './src/hooks/useProposalEditor';
import { useMeasurementEditor } from './src/hooks/useMeasurementEditor';
import { useProposalTotals } from './src/hooks/useProposalTotals';
import { usePdfActions } from './src/hooks/usePdfActions';
import { useClientFlow } from './src/hooks/useClientFlow';
import { useFilmFlow } from './src/hooks/useFilmFlow';
import { useSchedulingFlow } from './src/hooks/useSchedulingFlow';
import { AppContentRouter } from './src/components/app/AppContentRouter';
import { AppClientWorkspace } from './src/components/app/AppClientWorkspace';

import { useError } from './src/contexts/ErrorContext';
import { Skeleton, CardSkeleton } from './components/ui/Skeleton';
import Toast from './components/ui/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { UpgradePrompt } from './components/subscription/SubscriptionComponents';
import { useSubscription } from './contexts/SubscriptionContext';
import SyncStatusIndicator from './components/SyncStatusIndicator';

import { getFornecedores } from './services/fornecedorService';
import { matchFilmFromExtractedText } from './services/filmMatchingService';
import DesktopSidebar from './components/layout/DesktopSidebar';


type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores';

// Função para sanitizar nomes com problemas de encoding para uso em filenames
const sanitizeForFilename = (name: string): string => {
    if (!name) return name;

    // Padrões comuns de encoding corrompido para "Opção"
    const corruptedPatterns = [
        { pattern: /Op[�\uFFFD]{1,4}o/gi, replacement: 'Opcao' },
        { pattern: /Op\?+o/gi, replacement: 'Opcao' },
        { pattern: /Op[\x00-\x1F]+o/gi, replacement: 'Opcao' },
        { pattern: /ção/gi, replacement: 'cao' },
        { pattern: /ã/gi, replacement: 'a' },
        { pattern: /[�\uFFFD]+/g, replacement: '' },
    ];

    let sanitized = name;

    for (const { pattern, replacement } of corruptedPatterns) {
        sanitized = sanitized.replace(pattern, replacement);
    }

    // Remover caracteres inválidos para filenames
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '');

    return sanitized;
};

const extractFirstJsonArray = (rawText: string): string | null => {
    if (!rawText) return null;

    const text = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    let startIndex = -1;
    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
                continue;
            }

            if (char === '\\') {
                isEscaped = true;
                continue;
            }

            if (char === '"') {
                inString = false;
            }

            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '[') {
            if (depth === 0) {
                startIndex = i;
            }
            depth += 1;
            continue;
        }

        if (char === ']' && depth > 0) {
            depth -= 1;
            if (depth === 0 && startIndex >= 0) {
                return text.slice(startIndex, i + 1);
            }
        }
    }

    return null;
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
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [films, setFilms] = useState<Film[]>([]);
    const [allSavedPdfs, setAllSavedPdfs] = useState<SavedPDF[]>([]);
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
        const saved = localStorage.getItem('peliculas-br-active-tab');
        if (saved && ['client', 'films', 'settings', 'history', 'agenda', 'sales', 'admin', 'account', 'estoque', 'fornecedores'].includes(saved)) {
            return saved as ActiveTab;
        }
        return 'client';
    });

    // Persist active tab to localStorage
    useEffect(() => {
        localStorage.setItem('peliculas-br-active-tab', activeTab);
    }, [activeTab]);
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
    const [isDeletingFilm, setIsDeletingFilm] = useState(false);
    const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
    const [isDeletingClient, setIsDeletingClient] = useState(false);
    const [pdfToDeleteId, setPdfToDeleteId] = useState<number | null>(null);
    const [isDeletingPdf, setIsDeletingPdf] = useState(false);
    const [isFilmSelectionModalOpen, setIsFilmSelectionModalOpen] = useState(false);
    const [isApplyFilmToAllModalOpen, setIsApplyFilmToAllModalOpen] = useState(false);
    const [newFilmName, setNewFilmName] = useState<string>('');
    const [filmToApplyToAll, setFilmToApplyToAll] = useState<string | null>(null);
    const [editingMeasurementIdForFilm, setEditingMeasurementIdForFilm] = useState<number | null>(null);
    const [newClientName, setNewClientName] = useState<string>('');

    // ... (existing code)


    const [schedulingInfo, setSchedulingInfo] = useState<SchedulingInfo | null>(null);
    const [agendamentoToDelete, setAgendamentoToDelete] = useState<Agendamento | null>(null);
    const [isDeletingAgendamento, setIsDeletingAgendamento] = useState(false);
    const [postClientSaveAction, setPostClientSaveAction] = useState<'openAgendamentoModal' | null>(null);
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
    const [isDeleteProposalOptionModalOpen, setIsDeleteProposalOptionModalOpen] = useState(false);
    const [proposalOptionToDeleteId, setProposalOptionToDeleteId] = useState<number | null>(null);
    const [isDeletingProposalOption, setIsDeletingProposalOption] = useState(false);

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

    const {
        loadClients,
        loadFilms,
        loadAllPdfs,
        loadAgendamentos
    } = useAppBootstrap({
        authUserId: authUser?.id,
        lastSelectedClientId: userInfo?.lastSelectedClientId,
        setIsLoading,
        setClients,
        setSelectedClientId,
        setUserInfo,
        setFilms,
        setAllSavedPdfs,
        setAgendamentos,
        setHasLoadedHistory,
        setHasLoadedAgendamentos
    });

    const {
        proposalOptions,
        activeOptionId,
        setActiveOptionId,
        activeOption,
        measurements,
        generalDiscount,
        isDirty,
        handleSaveChanges,
        handleMeasurementsChange,
        handleGeneralDiscountChange,
        createEmptyMeasurement,
        addMeasurement,
        duplicateActiveOption,
        addProposalOption,
        renameProposalOption,
        deleteProposalOption,
        clearMeasurements
    } = useProposalEditor({
        selectedClientId,
        films,
        loadClients
    });

    const {
        numpadConfig,
        editingMeasurement,
        setEditingMeasurement,
        editingMeasurementForDiscount,
        editingMeasurementBasePrice,
        measurementToDeleteId,
        setMeasurementToDeleteId,
        deletedMeasurement,
        showUndoToast,
        handleOpenNumpad,
        handleNumpadClose,
        handleNumpadDone,
        handleNumpadInput,
        handleNumpadDelete,
        handleNumpadDuplicate,
        handleNumpadClear,
        handleNumpadAddGroup,
        handleOpenEditMeasurementModal,
        handleCloseEditMeasurementModal,
        handleUpdateEditingMeasurement,
        handleRequestDeleteMeasurement,
        handleConfirmDeleteIndividualMeasurement,
        handleDeleteMeasurementFromEditModal,
        handleDeleteMeasurementFromGroup,
        handleImmediateDeleteMeasurement,
        handleUndoDelete,
        handleDismissUndo,
        handleOpenDiscountModal,
        handleCloseDiscountModal,
        handleSaveDiscount
    } = useMeasurementEditor({
        measurements,
        handleMeasurementsChange,
        createEmptyMeasurement
    });
    const [isDeletingMeasurement, setIsDeletingMeasurement] = useState(false);

    const handleSwipeDirectionChange = useCallback((direction: 'left' | 'right' | null, distance: number) => {
        setSwipeDirection(direction);
        setSwipeDistance(distance);
    }, []);

    const handleShowInfo = useCallback((message: string, title: string = "AtenÃ§Ã£o") => {
        setInfoModalConfig({ isOpen: true, title, message });
    }, []);

    const handleCloseInfoModal = useCallback(() => {
        setInfoModalConfig(prev => ({ ...prev, isOpen: false }));
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
        isFilmSelectionModalOpen, isGalleryOpen, schedulingInfo, handleNumpadClose, handleShowInfo]);

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

    const duplicateAllMeasurements = useCallback(() => {
        if (!activeOption) return;

        setIsDuplicateAllModalOpen(true);
    }, [activeOption]);

    const handleConfirmDuplicateAll = useCallback(() => {
        duplicateActiveOption();
        setIsDuplicateAllModalOpen(false);
    }, [duplicateActiveOption]);

    const handleRequestDeleteProposalOption = useCallback((optionId: number) => {
        setProposalOptionToDeleteId(optionId);
        setIsDeleteProposalOptionModalOpen(true);
    }, []);

    const handleConfirmDeleteProposalOption = useCallback(() => {
        if (proposalOptionToDeleteId === null) return;

        setIsDeletingProposalOption(true);
        window.requestAnimationFrame(() => {
            try {
                deleteProposalOption(proposalOptionToDeleteId);
                setIsDeleteProposalOptionModalOpen(false);
                setProposalOptionToDeleteId(null);
            } finally {
                setIsDeletingProposalOption(false);
            }
        });
    }, [proposalOptionToDeleteId, deleteProposalOption]);

    const handleConfirmClearAll = useCallback(() => {
        clearMeasurements();
        setIsClearAllModalOpen(false);
    }, [clearMeasurements]);

    const totals = useProposalTotals({
        measurements,
        films,
        generalDiscount
    });

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

    const {
        handleOpenAgendamentoModal,
        handleCloseAgendamentoModal,
        handleSaveAgendamento,
        handleRequestDeleteAgendamento,
        handleConfirmDeleteAgendamento,
        handleCreateNewAgendamento,
        handleEditAgendamento,
        handleGoToHistoryFromPdf
    } = useSchedulingFlow({
        allSavedPdfs,
        agendamentoToDelete,
        setAgendamentos,
        setAllSavedPdfs,
        setSchedulingInfo,
        setAgendamentoToDelete,
        setPdfGenerationStatus,
        setActiveTab,
        loadAgendamentos,
        loadAllPdfs,
        handleShowInfo
    });

    const handleConfirmDeleteAgendamentoWithFeedback = useCallback(async () => {
        setIsDeletingAgendamento(true);
        try {
            await new Promise<void>(resolve => {
                window.requestAnimationFrame(() => resolve());
            });
            await handleConfirmDeleteAgendamento();
        } finally {
            setIsDeletingAgendamento(false);
        }
    }, [handleConfirmDeleteAgendamento]);

    const {
        selectedClient,
        handleSaveClient,
        handleConfirmDeleteClient,
        handleToggleClientPin,
        goToNextClient,
        goToPrevClient,
        handleNavigateToOption
    } = useClientFlow({
        clients,
        setClients,
        setAllSavedPdfs,
        setAgendamentos,
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
        setIsDeletingClient,
        loadClients,
        loadAllPdfs,
        loadAgendamentos,
        hasLoadedHistory,
        hasLoadedAgendamentos,
        handleOpenAgendamentoModal,
        handleShowInfo
    });

    const handleDeleteClient = useCallback(() => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        if (!selectedClientId) {
            return;
        }
        setIsDeleteClientModalOpen(true);
    }, [selectedClientId, numpadConfig.isOpen, handleNumpadClose]);

    const handleSaveUserInfo = useCallback(async (info: UserInfo) => {
        await db.saveUserInfo(info);
        setUserInfo(info);
    }, []);

    const handleSavePaymentMethods = useCallback(async (methods: PaymentMethods) => {
        if (userInfo) {
            // Usa a nova função que atualiza APENAS o payment_methods no banco
            // e retorna o userInfo completo atualizado, evitando perda de logo/assinatura
            const updatedUserInfo = await db.updatePaymentMethodsOnly(methods);
            if (updatedUserInfo) {
                setUserInfo(updatedUserInfo);
            } else {
                // Fallback: atualiza apenas o campo payment_methods no estado local
                setUserInfo(prev => prev ? { ...prev, payment_methods: methods } : prev);
            }
            setIsPaymentModalOpen(false);
        }
    }, [userInfo]);

    const {
        handleDownloadPdf,
        handleGeneratePdfWithSaveCheck,
        handleConfirmSaveBeforePdf,
        handleGenerateCombinedPdf
    } = usePdfActions({
        measurements,
        films,
        generalDiscount,
        totals,
        selectedClient,
        selectedClientId,
        userInfo,
        activeOption,
        clients,
        setAllSavedPdfs,
        setPdfGenerationStatus,
        setIsSaveBeforePdfModalOpen,
        handleShowInfo,
        handleSaveChanges
    });

    const handleGeneratePdf = useCallback(async () => {
        await handleGeneratePdfWithSaveCheck(isDirty);
    }, [handleGeneratePdfWithSaveCheck, isDirty]);

    const {
        handleOpenFilmModal,
        handleEditFilmFromSelection,
        handleSaveFilm,
        handleToggleFilmPin,
        handleDeleteFilm,
        handleRequestDeleteFilm,
        handleConfirmDeleteFilm,
        handleSelectFilmForMeasurement,
        handleApplyFilmToAll,
        handleAddNewFilmFromSelection
    } = useFilmFlow({
        films,
        setFilms,
        measurements,
        editingMeasurementIdForFilm,
        editingMeasurement,
        filmToDeleteName,
        setIsDeletingFilm,
        setEditingFilm,
        setIsFilmModalOpen,
        setIsFilmSelectionModalOpen,
        setIsApplyFilmToAllModalOpen,
        setEditingMeasurementIdForFilm,
        setFilmToDeleteName,
        setFilmToApplyToAll,
        setNewFilmName,
        setEditingMeasurement,
        loadFilms,
        handleMeasurementsChange,
        handleShowInfo
    });

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
                model: "gemini-2.0-flash",
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
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
                model: "gemini-2.0-flash",
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

    const handleConfirmDeleteMeasurementWithFeedback = useCallback(async () => {
        setIsDeletingMeasurement(true);
        try {
            await new Promise<void>(resolve => {
                window.requestAnimationFrame(() => resolve());
            });
            handleConfirmDeleteIndividualMeasurement();
        } finally {
            setIsDeletingMeasurement(false);
        }
    }, [handleConfirmDeleteIndividualMeasurement]);

    const handleConfirmDeletePdf = useCallback(async () => {
        if (pdfToDeleteId === null) return;
        setIsDeletingPdf(true);
        try {
            const deletedPdfId = pdfToDeleteId;
            setAllSavedPdfs((prev: SavedPDF[]) => prev.filter(pdf => pdf.id !== deletedPdfId));
            await db.deletePDF(deletedPdfId);
            if (hasLoadedAgendamentos) {
                setAgendamentos((prev: Agendamento[]) => prev.filter(agendamento => agendamento.pdfId !== deletedPdfId));
                await loadAgendamentos();
            }
            setPdfToDeleteId(null);
        } catch (error) {
            console.error('Erro ao excluir orçamento:', error);
            await loadAllPdfs();
            if (hasLoadedAgendamentos) {
                await loadAgendamentos();
            }
            handleShowInfo('Não foi possível excluir o orçamento. Tente novamente.');
        } finally {
            setIsDeletingPdf(false);
        }
    }, [pdfToDeleteId, loadAllPdfs, hasLoadedAgendamentos, loadAgendamentos, handleShowInfo]);

    const handleUpdatePdfStatus = useCallback(async (pdfId: number, status: SavedPDF['status']) => {
        // Atualiza estado imediatamente para refletir na UI sem esperar o banco
        setAllSavedPdfs((prev: SavedPDF[]) => prev.map(p => p.id === pdfId ? { ...p, status } : p));
        try {
            const allPdfsFromDb = await db.getAllPDFs();
            const pdfToUpdate = allPdfsFromDb.find(p => p.id === pdfId);
            if (pdfToUpdate) {
                await db.updatePDF({ ...pdfToUpdate, status });
            }
        } catch (error) {
            console.error("Failed to update PDF status", error);
            handleShowInfo("Não foi possível atualizar o status do orçamento.");
            await loadAllPdfs(); // reverte em caso de erro
        }
    }, [loadAllPdfs, handleShowInfo]);


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

    const handleTabChange = useCallback((tab: ActiveTab) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }

        if (tab === 'qr_code') {
            if (hasModule('qr_servicos')) {
                setIsServicoQrModalOpen(true);
            } else {
                setShowQrUpgradeModal(true);
            }
            return;
        }

        setActiveTab(tab);
    }, [numpadConfig.isOpen, handleNumpadClose, hasModule]);

    const handleOpenFilmSelectionModal = useCallback((measurementId: number) => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setEditingMeasurementIdForFilm(measurementId);
        setIsFilmSelectionModalOpen(true);
    }, [numpadConfig.isOpen, handleNumpadClose]);



    const handleAddNewClientFromSelection = useCallback((clientName: string) => {
        setIsClientSelectionModalOpen(false);
        setClientModalMode('add');
        setNewClientName(clientName);
        setAiClientData(undefined);
        setIsClientModalOpen(true);
    }, []);

    const handleAddNewClientFromAgendamento = useCallback((clientName: string) => {
        handleCloseAgendamentoModal();
        setPostClientSaveAction('openAgendamentoModal');
        setClientModalMode('add');
        setNewClientName(clientName);
        setAiClientData(undefined);
        setIsClientModalOpen(true);
    }, [handleCloseAgendamentoModal]);

    const handleOpenClientSelectionModal = useCallback(() => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setIsClientSelectionModalOpen(true);
    }, [numpadConfig.isOpen, handleNumpadClose]);

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
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
2. Se identificar o nome ou tipo da película, retorne no campo opcional "peliculaDetectada".
3. Se não tiver confiança sobre a película, use string vazia em "peliculaDetectada".
4. Em imagens, prints, fotos de orçamento ou fotos de anotações, procure o nome da película em títulos, observações, descrições, legendas, tabelas, etiquetas, marcas e abreviações.
5. Em imagens, se houver medidas e película na mesma linha, bloco ou cartão visual, associe a película à medida correta.
6. Em imagens, prefira retornar o texto bruto mais útil da película em "peliculaDetectada" mesmo que não esteja perfeitamente padronizado. Ex: "jateada", "fumê espelhado", "blackout", "nano ceramic", "g20".
7. Nunca invente uma película. Se a imagem não deixar isso claro, use string vazia em "peliculaDetectada".

**REGRAS ESPECIAIS PARA FOTO/PRINT:**
1. Ignore textos decorativos da interface, botões, menus e propagandas.
2. Priorize textos próximos das medidas ou do item medido.
3. Se houver mais de uma película possível na imagem e não for claro qual pertence à medida, não chute.

FORMATO DE RESPOSTA (JSON PURO):
[
  { "local": "Janela da Sala", "largura": "1,20", "altura": "2,10", "quantidade": 5, "peliculaDetectada": "Fumê Espelhado" }
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

            const extractedJson = extractFirstJsonArray(responseText);
            if (!extractedJson) {
                handleShowInfo("NÃ£o foi possÃ­vel extrair medidas. Tente reformular.");
                return;
            }

            const extractedMeasurements = JSON.parse(extractedJson);

            if (!Array.isArray(extractedMeasurements) || extractedMeasurements.length === 0) {
                handleShowInfo("Nenhuma medida foi encontrada. Tente novamente.");
                return;
            }

            const highConfidenceThreshold = 0.85;
            const suggestionConfidenceThreshold = 0.6;
            let autoMatchedFilmsCount = 0;
            const suggestedFilms: string[] = [];

            // Adiciona as medidas extraídas
            const newMeasurements = extractedMeasurements.map((m: any, index: number) => {
                const baseMeasurement = {
                    ...createEmptyMeasurement(),
                    id: Date.now() + index, // Garante ID único
                    ambiente: m.local || '', // Mapeia 'local' do JSON para 'ambiente' do objeto Measurement
                    largura: m.largura || '',
                    altura: m.altura || '',
                    quantidade: m.quantidade || 1,
                    isNew: false
                };

                if (!films.length || !m.peliculaDetectada) {
                    return baseMeasurement;
                }

                const filmMatch = matchFilmFromExtractedText(m.peliculaDetectada, films);
                if (filmMatch.matchedFilmName && filmMatch.confidence >= highConfidenceThreshold) {
                    autoMatchedFilmsCount += 1;
                    return {
                        ...baseMeasurement,
                        pelicula: filmMatch.matchedFilmName
                    };
                }

                if (filmMatch.matchedFilmName && filmMatch.confidence >= suggestionConfidenceThreshold) {
                    const measurementLabel = baseMeasurement.ambiente || `Medida ${index + 1}`;
                    suggestedFilms.push(
                        `${measurementLabel}: sugestão "${filmMatch.matchedFilmName}" a partir de "${filmMatch.extractedFilmText}".`
                    );
                    return {
                        ...baseMeasurement,
                        aiFilmSuggestion: {
                            extractedText: filmMatch.extractedFilmText,
                            suggestedFilm: filmMatch.matchedFilmName,
                            confidence: filmMatch.confidence
                        }
                    };
                }

                return baseMeasurement;
            });


            handleMeasurementsChange([...measurements, ...newMeasurements]);
            setIsAIMeasurementModalOpen(false);
            if (autoMatchedFilmsCount > 0) {
                const suggestionSummary = suggestedFilms.length > 0
                    ? `\n\nSugestões para revisar manualmente:\n${suggestedFilms.slice(0, 3).join('\n')}${suggestedFilms.length > 3 ? '\n...' : ''}`
                    : '';
                handleShowInfo(`${newMeasurements.length} medida(s) adicionada(s). ${autoMatchedFilmsCount} película(s) foram reconhecidas automaticamente.${suggestionSummary}`);
            } else if (suggestedFilms.length > 0) {
                handleShowInfo(`${newMeasurements.length} medida(s) adicionada(s).\n\nSugestões de película para revisar:\n${suggestedFilms.slice(0, 3).join('\n')}${suggestedFilms.length > 3 ? '\n...' : ''}`);
            } else {
                handleShowInfo(`${newMeasurements.length} medida(s) adicionada(s) com sucesso!`);
            }

        } catch (error) {
            console.error("Erro ao processar medidas com IA:", error);
            handleShowInfo(`Erro: ${error instanceof Error ? error.message : 'Tente novamente'}`);
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, measurements, handleMeasurementsChange, createEmptyMeasurement, films]);


    const LoadingSpinner = () => (
        <div className="w-full p-4">
            <CardSkeleton count={3} />
        </div>
    );


    const handlePromptPwaInstall = useCallback(() => {
        if (deferredPrompt) {
            promptInstall();
        } else {
            alert("Para instalar, use o menu 'Compartilhar' do seu navegador e selecione 'Adicionar Ã  Tela de InÃ­cio'.");
        }
    }, [deferredPrompt, promptInstall]);

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

    const tabContent = (
        <AppContentRouter
            activeTab={activeTab}
            isLoading={isLoading}
            userInfo={userInfo}
            organizationId={organizationId || undefined}
            isOwner={isOwner}
            isInstalled={isInstalled}
            allSavedPdfs={allSavedPdfs}
            clients={clients}
            agendamentos={agendamentos}
            films={films}
            initialEstoqueAction={initialEstoqueAction}
            selectedClientId={selectedClientId}
            measurements={measurements}
            activeOptionId={activeOptionId}
            totals={{ totalM2: totals.totalM2, totalQuantity: totals.totalQuantity }}
            numpadConfig={numpadConfig}
            swipeDirection={swipeDirection}
            swipeDistance={swipeDistance}
            clientLoadingView={<ClientViewSkeleton />}
            estoqueLoadingView={<EstoqueSkeleton />}
            defaultLoadingView={<LoadingSpinner />}
            onSaveUserInfo={handleSaveUserInfo}
            onOpenPaymentMethods={() => setIsPaymentModalOpen(true)}
            onOpenApiKeyModal={handleOpenApiKeyModal}
            onPromptPwaInstall={handlePromptPwaInstall}
            onDeletePdf={handleRequestDeletePdf}
            onDownloadPdf={handleDownloadPdf}
            onUpdatePdfStatus={handleUpdatePdfStatus}
            onSchedulePdf={handleOpenAgendamentoModal}
            onGenerateCombinedPdf={handleGenerateCombinedPdf}
            onNavigateToOption={handleNavigateToOption}
            onEditAgendamento={handleEditAgendamento}
            onCreateNewAgendamento={handleCreateNewAgendamento}
            onAddFilm={() => handleOpenFilmModal(null)}
            onEditFilm={handleOpenFilmModal}
            onDeleteFilm={handleRequestDeleteFilm}
            onOpenGallery={handleOpenGallery}
            onOpenClientModal={handleOpenClientModal}
            onAddMeasurement={addMeasurement}
            onOpenLocationImport={() => setIsLocationImportModalOpen(true)}
            onMeasurementsChange={handleMeasurementsChange}
            onOpenFilmModal={handleOpenFilmModal}
            onOpenFilmSelectionModal={handleOpenFilmSelectionModal}
            onOpenClearAllModal={() => setIsClearAllModalOpen(true)}
            onOpenApplyFilmToAllModal={() => setIsApplyFilmToAllModalOpen(true)}
            onOpenNumpad={handleOpenNumpad}
            onOpenEditModal={handleOpenEditMeasurementModal}
            onOpenDiscountModal={handleOpenDiscountModal}
            onDeleteMeasurement={handleDeleteMeasurementFromGroup}
            onDeleteMeasurementImmediate={handleImmediateDeleteMeasurement}
        />
    );

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
        isDeletingFilm,
        filmToApplyToAll,
        setFilmToApplyToAll,

        isDeleteClientModalOpen,
        setIsDeleteClientModalOpen,
        handleConfirmDeleteClient,
        isDeletingClient,
        pdfToDeleteId,
        setPdfToDeleteId,
        handleConfirmDeletePdf,
        isDeletingPdf,
        agendamentoToDelete,
        setAgendamentoToDelete,
        handleConfirmDeleteAgendamento: handleConfirmDeleteAgendamentoWithFeedback,
        isDeletingAgendamento,
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
        handleConfirmDeleteIndividualMeasurement: handleConfirmDeleteMeasurementWithFeedback,
        measurementToDelete,
        isDeletingMeasurement,
        isDeleteProposalOptionModalOpen,
        setIsDeleteProposalOptionModalOpen,
        handleConfirmDeleteProposalOption,
        proposalOptionToDeleteName: proposalOptions.find(opt => opt.id === proposalOptionToDeleteId)?.name || null,
        isDeletingProposalOption,

        // Discount Modal
        editingMeasurementForDiscount,
        handleCloseDiscountModal,
        handleSaveDiscount,
        editingMeasurementBasePrice,
        onOpenLocationImport: () => setIsLocationImportModalOpen(true),
    };




    return (
        <div className="h-full font-roboto flex lg:flex-row flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
            <ProtectedRoute>
                <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />

                <div className="flex-grow flex flex-col min-w-0 h-full overflow-hidden">
                    <UpdateBanner />

                    <main ref={mainRef} className="flex-grow overflow-y-auto pb-32 lg:pb-0 sm:pb-0 transition-colors duration-500 bg-slate-50 dark:bg-slate-950">
                        <div className="sticky top-0 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md z-40 border-b border-slate-200/60 dark:border-slate-800/60">
                            <div className="container mx-auto px-4 w-full max-w-2xl lg:max-w-5xl">
                                <div className="py-2 sm:py-3 lg:py-4">
                                    <Header
                                        activeTab={activeTab}
                                        onTabChange={handleTabChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 w-full max-w-2xl lg:max-w-5xl">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-4 sm:p-6">
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
                                    <AppClientWorkspace
                                        clientsCount={clients.length}
                                        selectedClient={selectedClient}
                                        clientTransitionKey={clientTransitionKey}
                                        proposalOptions={proposalOptions}
                                        activeOptionId={activeOptionId}
                                        selectedClientId={selectedClientId}
                                        measurements={measurements}
                                        films={films}
                                        totals={totals}
                                        generalDiscount={generalDiscount}
                                        content={tabContent}
                                        isGeneratingPdf={pdfGenerationStatus === 'generating'}
                                        onSelectClientClick={handleOpenClientSelectionModal}
                                        onAddClient={() => handleOpenClientModal('add')}
                                        onAddClientAI={handleOpenAIClientModal}
                                        onEditClient={() => handleOpenClientModal('edit')}
                                        onDeleteClient={handleDeleteClient}
                                        onSwipeLeft={goToNextClient}
                                        onSwipeRight={goToPrevClient}
                                        onSelectOption={setActiveOptionId}
                                        onRenameOption={renameProposalOption}
                                        onDeleteOption={handleRequestDeleteProposalOption}
                                        onAddOption={addProposalOption}
                                        onSwipeDirectionChange={handleSwipeDirectionChange}
                                        onOpenGeneralDiscountModal={() => setIsGeneralDiscountModalOpen(true)}
                                        onUpdateGeneralDiscount={handleGeneralDiscountChange}
                                        onAddMeasurement={addMeasurement}
                                        onDuplicateMeasurements={duplicateAllMeasurements}
                                        onGeneratePdf={handleGeneratePdf}
                                        onOpenAIModal={() => {
                                            if (hasModule('ia_ocr')) {
                                                setIsAIMeasurementModalOpen(true);
                                            } else {
                                                setShowIaUpgradeModal(true);
                                            }
                                        }}
                                    />
                                ) : ['history', 'agenda'].includes(activeTab) ? (
                                    <div className="bg-blue-50 dark:bg-slate-900 -m-4 sm:-m-6 p-4 sm:p-6 rounded-2xl">
                                        <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in">
                                            {tabContent}
                                        </div>
                                    </div>
                                ) : (
                                    <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in">
                                        {tabContent}
                                    </div>
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
                </div>
            </ProtectedRoute>
        </div>
    );
};

export default App;



