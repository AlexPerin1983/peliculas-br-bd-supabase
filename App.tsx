import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import './src/estoque-dark-mode.css';
import { Client, Measurement, UserInfo, Film, PaymentMethods, SavedPDF, Agendamento, AgendamentoServiceStatus, SchedulingInfo, ExtractedClientData, UIMeasurement, ProposalExpense, ProposalOption, ProposalDiscount, AIInput } from './types';
import { CuttingOptimizer } from './utils/CuttingOptimizer';
import * as db from './services/db';
import { supabase } from './services/supabaseClient';
// pdfGenerator será importado dinamicamente para code splitting
import Header from './components/Header';
import PaymentMethodsModal from './components/modals/PaymentMethodsModal';
import CustomNumpad from './components/ui/CustomNumpad';
import ProposalExpensesModal from './components/modals/ProposalExpensesModal';
import LocationImportModal from './components/modals/LocationImportModal';
import UpdateNotification from './components/UpdateNotification';
import UpdateBanner from './components/UpdateBanner';
import { ModalsContainer } from './components/ModalsContainer';
import { usePwaInstallPrompt } from './src/hooks/usePwaInstallPrompt';
import { usePwaUpdate } from './src/hooks/usePwaUpdate';
import { useAppBootstrap } from './src/hooks/useAppBootstrap';
import { useProposalEditor } from './src/hooks/useProposalEditor';
import { useMeasurementEditor } from './src/hooks/useMeasurementEditor';
import { useProposalPaymentOverrides } from './src/hooks/useProposalPaymentOverrides';
import { useProposalTotals } from './src/hooks/useProposalTotals';
import { usePdfActions } from './src/hooks/usePdfActions';
import { useClientFlow } from './src/hooks/useClientFlow';
import { useFilmFlow } from './src/hooks/useFilmFlow';
import { useSchedulingFlow } from './src/hooks/useSchedulingFlow';
import { AppContentRouter } from './src/components/app/AppContentRouter';
import { AppClientWorkspace } from './src/components/app/AppClientWorkspace';

import { useError } from './src/contexts/ErrorContext';
import { useFeedback } from './src/contexts/FeedbackContext';
import { Skeleton, CardSkeleton } from './components/ui/Skeleton';
import Toast from './components/ui/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { BillingReturnModal, type BillingReturnMode, type BillingReturnStatus } from './components/subscription/BillingReturnModal';
import { PremiumFeatureSection } from './components/subscription/PremiumFeatureSection';
import { useSubscription } from './contexts/SubscriptionContext';
import SyncStatusIndicator from './components/SyncStatusIndicator';
import { OrganizationSetup } from './components/OrganizationSetup';
import { getSubscriptionInfo } from './services/subscriptionService';

import { getFornecedores } from './services/fornecedorService';
import { matchFilmFromExtractedText } from './services/filmMatchingService';
import DesktopSidebar from './components/layout/DesktopSidebar';
import AIQuickFab from './components/AIQuickFab';
import OnboardingTour from './components/onboarding/OnboardingTour';
import { seedExampleDataIfNeeded } from './services/seedData';
import { GEMINI_TEXT_MODEL } from './src/lib/geminiModel';
import { createPastedMeasurementsFromClipboard } from './src/lib/measurementClipboard';


type ActiveTab = 'dashboard' | 'client' | 'cliente_hub' | 'clients_list' | 'films' | 'settings' | 'history' | 'proposals' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores' | 'assistentes';

interface BillingReturnState {
    status: BillingReturnStatus;
    mode: BillingReturnMode;
    moduleId: string | null;
    attempts: number;
}

interface QuickProposalMeasurement {
    local?: string;
    ambiente?: string;
    largura?: string | number;
    altura?: string | number;
    quantidade?: number;
    peliculaDetectada?: string;
    tipoAplicacao?: string;
    observacao?: string;
}

interface QuickProposalExtraction {
    cliente?: Partial<ExtractedClientData>;
    medidas?: QuickProposalMeasurement[];
    observacoes?: string;
}

// Função para sanitizar nomes com problemas de encoding para uso em filenames
const sanitizeForFilename = (name: string): string => {
    if (!name) return name;

    // Padrões comuns de encoding corrompido para "Opção"
    const corruptedPatterns = [
        { pattern: /Op[?\uFFFD]{1,4}o/gi, replacement: 'Opcao' },
        { pattern: /Op\?+o/gi, replacement: 'Opcao' },
        { pattern: /Op[\x00-\x1F]+o/gi, replacement: 'Opcao' },
        { pattern: /ção/gi, replacement: 'cao' },
        { pattern: /ã/gi, replacement: 'a' },
        { pattern: /[?\uFFFD]+/g, replacement: '' },
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

const extractFirstJsonObject = (rawText: string): string | null => {
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

        if (char === '{') {
            if (depth === 0) {
                startIndex = i;
            }
            depth += 1;
            continue;
        }

        if (char === '}' && depth > 0) {
            depth -= 1;
            if (depth === 0 && startIndex >= 0) {
                return text.slice(startIndex, i + 1);
            }
        }
    }

    return null;
};

const formatModuleIdLabel = (moduleId: string | null): string => {
    if (!moduleId) {
        return 'seu modulo premium';
    }

    return moduleId
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const App: React.FC = () => {
    const { isAdmin, user: authUser, organizationId, isOwner, refreshProfile } = useAuth();
    const { showError } = useError();
    const { showAlert, showToast } = useFeedback();
    const { deferredPrompt, promptInstall, isInstalled } = usePwaInstallPrompt();
    const { newVersionAvailable, handleUpdate } = usePwaUpdate();
    const { hasModule, refresh: refreshSubscription, modules: subscriptionModules } = useSubscription();
    const needsOrganizationSetup = !!authUser && !organizationId;

    const [isLoading, setIsLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(() => {
        // Restauracao instantanea do cliente selecionado (espelho local do valor
        // que tambem fica salvo no Supabase em UserInfo.lastSelectedClientId).
        const saved = localStorage.getItem('peliculas-br-selected-client-id');
        const parsed = saved ? Number(saved) : NaN;
        return Number.isFinite(parsed) ? parsed : null;
    });
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [films, setFilms] = useState<Film[]>([]);
    const [allSavedPdfs, setAllSavedPdfs] = useState<SavedPDF[]>([]);
    const [historyPdfs, setHistoryPdfs] = useState<SavedPDF[]>([]);
    const [historyHasMore, setHistoryHasMore] = useState(false);
    const [historyNextOffset, setHistoryNextOffset] = useState(0);
    const [hasLoadedAllPdfs, setHasLoadedAllPdfs] = useState(false);
    const [isHistoryPageLoading, setIsHistoryPageLoading] = useState(false);
    const isLoadingAllPdfsRef = useRef(false);
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    // Marcacao de status operacional vinda de uma notificacao push (deep link/acao).
    const [pendingServiceStatusMark, setPendingServiceStatusMark] = useState<{ id: number; status: AgendamentoServiceStatus } | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
        const saved = localStorage.getItem('peliculas-br-active-tab');
        if (saved && ['dashboard', 'client', 'films', 'settings', 'history', 'proposals', 'agenda', 'sales', 'admin', 'account', 'estoque', 'qr_code', 'fornecedores', 'assistentes'].includes(saved)) {
            return saved as ActiveTab;
        }
        return 'dashboard';
    });
    const initialPdfLoadRef = useRef<'all' | 'history' | 'deferred'>(
        activeTab === 'history' ? 'history' : activeTab === 'dashboard' ? 'deferred' : 'all'
    );
    const historyPageRequestedRef = useRef(activeTab === 'history');
    const [billingReturnState, setBillingReturnState] = useState<BillingReturnState | null>(null);
    const [isBillingReturnVisible, setIsBillingReturnVisible] = useState(false);
    // Pilha de abas visitadas para o botao "voltar" estilo navegacao nativa.
    const [tabHistory, setTabHistory] = useState<ActiveTab[]>([]);

    // Persist active tab to localStorage
    useEffect(() => {
        localStorage.setItem('peliculas-br-active-tab', activeTab);
    }, [activeTab]);

    // Persist selected client to localStorage para reabrir no mesmo cliente.
    useEffect(() => {
        if (selectedClientId == null) {
            localStorage.removeItem('peliculas-br-selected-client-id');
        } else {
            localStorage.setItem('peliculas-br-selected-client-id', String(selectedClientId));
        }
    }, [selectedClientId]);
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
                        showToast('Convite aceito com sucesso! Você agora faz parte da organização.', { tone: 'success', duration: 1800 });
                        localStorage.removeItem('pendingInviteCode');
                        window.setTimeout(() => {
                            window.location.reload();
                        }, 1400); // Recarregar para atualizar permissões
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
    const [isProposalPaymentModalOpen, setIsProposalPaymentModalOpen] = useState(false);
    const [isFilmModalOpen, setIsFilmModalOpen] = useState(false);
    const [editingFilm, setEditingFilm] = useState<Film | null>(null);
    const [pdfGenerationStatus, setPdfGenerationStatus] = useState<'idle' | 'generating' | 'success'>('idle');
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);

    // Deep Linking State
    const [initialEstoqueAction, setInitialEstoqueAction] = useState<{ action: 'scan', code: string } | { action: 'ai', tab: 'bobinas' | 'retalhos' } | null>(null);

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
            // Limpar apenas os parametros consumidos e preservar outros retornos do app.
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete('tab');
            nextUrl.searchParams.delete('action');
            nextUrl.searchParams.delete('code');
            window.history.replaceState(
                {},
                '',
                `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
            );
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
    // Seletor de pelicula aberto a partir do modal "Duplicar Opcao" (quando nao ha favoritas).
    const [isDuplicateFilmSelectorOpen, setIsDuplicateFilmSelectorOpen] = useState(false);
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
    const [isAIQuickProposalModalOpen, setIsAIQuickProposalModalOpen] = useState(false);
    const [aiClientData, setAiClientData] = useState<Partial<Client> | undefined>(undefined);
    const [isAIFilmModalOpen, setIsAIFilmModalOpen] = useState(false);
    const [aiFilmData, setAiFilmData] = useState<Partial<Film> | undefined>(undefined);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [apiKeyModalProvider, setApiKeyModalProvider] = useState<'gemini' | 'openai'>('gemini');
    const [isGeneralDiscountModalOpen, setIsGeneralDiscountModalOpen] = useState(false);
    const [isProposalExpensesModalOpen, setIsProposalExpensesModalOpen] = useState(false);
    const [isDuplicateAllModalOpen, setIsDuplicateAllModalOpen] = useState(false);
    const [isLocationImportModalOpen, setIsLocationImportModalOpen] = useState(false);
    const [isDeleteProposalOptionModalOpen, setIsDeleteProposalOptionModalOpen] = useState(false);
    const [proposalOptionToDeleteId, setProposalOptionToDeleteId] = useState<number | null>(null);
    const [isDeletingProposalOption, setIsDeletingProposalOption] = useState(false);

    // Estados para modais de upgrade de módulos premium
    const [showQrUpgradeModal, setShowQrUpgradeModal] = useState(false);
    const [showIaUpgradeModal, setShowIaUpgradeModal] = useState(false);

    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
    const [isSaveBeforePdfModalOpen, setIsSaveBeforePdfModalOpen] = useState(false);
    const [isExitConfirmModalOpen, setIsExitConfirmModalOpen] = useState(false);

    // Undo states
    

    const mainRef = useRef<HTMLElement>(null);
    const numpadRef = useRef<HTMLDivElement>(null);
    const backButtonPressedOnce = useRef(false);
    const backButtonTimeout = useRef<NodeJS.Timeout | null>(null);

    // Salva/restaura a posicao de rolagem por aba, para reabrir exatamente no
    // mesmo ponto mesmo que o sistema descarte o app em segundo plano.
    useEffect(() => {
        const el = mainRef.current;
        if (!el) return;

        const STORAGE_KEY = 'peliculas-br-scroll-pos';
        const readMap = (): Record<string, number> => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                return raw ? (JSON.parse(raw) as Record<string, number>) : {};
            } catch {
                return {};
            }
        };
        const writeScroll = (value: number) => {
            try {
                const map = readMap();
                map[activeTab] = value;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
            } catch {
                // ignora
            }
        };

        // Restaura a posicao salva, tentando por alguns frames ate o conteudo
        // assincrono crescer o suficiente.
        const target = readMap()[activeTab] ?? 0;
        let attempts = 0;
        let rafId = 0;
        const tryRestore = () => {
            const current = mainRef.current;
            if (!current) return;
            current.scrollTop = target;
            attempts += 1;
            if (attempts < 10 && Math.abs(current.scrollTop - target) > 2) {
                rafId = requestAnimationFrame(tryRestore);
            }
        };
        if (target > 0) {
            rafId = requestAnimationFrame(tryRestore);
        }

        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                if (mainRef.current) writeScroll(mainRef.current.scrollTop);
            });
        };
        const onPersist = () => {
            if (mainRef.current) writeScroll(mainRef.current.scrollTop);
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('pagehide', onPersist);
        document.addEventListener('visibilitychange', onPersist);

        return () => {
            cancelAnimationFrame(rafId);
            el.removeEventListener('scroll', onScroll);
            window.removeEventListener('pagehide', onPersist);
            document.removeEventListener('visibilitychange', onPersist);
            onPersist();
        };
    }, [activeTab]);



    // Handle URL parameters (shortcuts, share target, etc.)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);

        // Handle tab parameter from shortcuts
        const tabParam = urlParams.get('tab');
        const upgradeParam = urlParams.get('upgrade');

        if (upgradeParam) {
            setActiveTab('account');
        } else if (
            tabParam &&
            ['dashboard', 'client', 'films', 'settings', 'history', 'proposals', 'agenda', 'sales', 'account'].includes(tabParam)
        ) {
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

        // Deep link da notificacao "atendimento encerrado": marca o status operacional.
        const markAgendamentoParam = urlParams.get('markAgendamento');
        const serviceStatusParam = urlParams.get('serviceStatus');
        if (markAgendamentoParam) {
            const agendamentoId = Number(markAgendamentoParam);
            const validStatuses: AgendamentoServiceStatus[] = ['completed', 'cancelled', 'no_show'];
            setActiveTab('agenda');
            if (Number.isFinite(agendamentoId) && validStatuses.includes(serviceStatusParam as AgendamentoServiceStatus)) {
                setPendingServiceStatusMark({ id: agendamentoId, status: serviceStatusParam as AgendamentoServiceStatus });
            }
        }

        const consumedParams = ['tab', 'action', 'title', 'text', 'url', 'markAgendamento', 'serviceStatus'];
        if (consumedParams.some((key) => urlParams.has(key))) {
            const nextUrl = new URL(window.location.href);
            consumedParams.forEach((key) => nextUrl.searchParams.delete(key));
            window.history.replaceState(
                {},
                '',
                `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
            );
        }
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const billingState = params.get('billing');
        const moduleId = params.get('module_id');
        const modeParam = params.get('mode');

        if (!billingState) {
            return;
        }

        const syncBillingState = async () => {
            if (billingState === 'abacate-success') {
                setBillingReturnState({
                    status: 'waiting',
                    mode: modeParam === 'subscription' ? 'subscription' : 'pix',
                    moduleId,
                    attempts: 0
                });
                setIsBillingReturnVisible(true);
            } else if (billingState === 'abacate-cancelled') {
                setBillingReturnState({
                    status: 'cancelled',
                    mode: modeParam === 'subscription' ? 'subscription' : 'pix',
                    moduleId,
                    attempts: 0
                });
                setIsBillingReturnVisible(true);
            }

            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete('billing');
            nextUrl.searchParams.delete('session_id');
            nextUrl.searchParams.delete('module_id');
            nextUrl.searchParams.delete('mode');
            window.history.replaceState(
                {},
                '',
                `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
            );
        };

        void syncBillingState();
    }, []);

    useEffect(() => {
        if (!billingReturnState || billingReturnState.status !== 'waiting' || !billingReturnState.moduleId) {
            return;
        }

        let cancelled = false;

        const pollBillingActivation = async () => {
            const maxAttempts = 8;

            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                if (cancelled) {
                    return;
                }

                setBillingReturnState((current) =>
                    current && current.status === 'waiting'
                        ? { ...current, attempts: attempt }
                        : current
                );

                await refreshSubscription();
                const latestInfo = await getSubscriptionInfo(true);

                if (latestInfo.active_modules.includes(billingReturnState.moduleId!)) {
                    if (!cancelled) {
                        setBillingReturnState((current) =>
                            current
                                ? {
                                      ...current,
                                      status: 'confirmed'
                                  }
                                : current
                        );
                        showToast('Pagamento confirmado. O acesso ja foi liberado na sua conta.', {
                            tone: 'success',
                            duration: 2400
                        });
                    }
                    return;
                }

                if (attempt < maxAttempts) {
                    await new Promise((resolve) => window.setTimeout(resolve, 2500));
                }
            }

            if (!cancelled) {
                setBillingReturnState((current) =>
                    current
                        ? {
                              ...current,
                              status: 'timeout'
                          }
                        : current
                );
                showToast(
                    'Recebemos o retorno do checkout, mas a confirmação ainda não chegou. Atualize a tela em instantes.',
                    {
                        tone: 'warning',
                        duration: 3200
                    }
                );
            }
        };

        void pollBillingActivation();

        return () => {
            cancelled = true;
        };
    }, [billingReturnState?.status, billingReturnState?.moduleId, refreshSubscription, showToast]);

    const handleCloseBillingReturn = useCallback(() => {
        setIsBillingReturnVisible(false);
        setBillingReturnState((current) =>
            current?.status === 'waiting' ? current : null
        );
    }, []);

    const billingReturnModuleName = useMemo(() => {
        if (!billingReturnState?.moduleId) {
            return 'seu modulo premium';
        }

        const matchedModule = subscriptionModules.find(
            (module) => module.id === billingReturnState.moduleId
        );

        return matchedModule?.name || formatModuleIdLabel(billingReturnState.moduleId);
    }, [billingReturnState?.moduleId, subscriptionModules]);

    const {
        loadClients,
        loadFilms,
        loadAllPdfs,
        loadPdfHistoryPage,
        loadAgendamentos
    } = useAppBootstrap({
        authUserId: needsOrganizationSetup ? undefined : authUser?.id,
        lastSelectedClientId: userInfo?.lastSelectedClientId,
        setIsLoading,
        setClients,
        setSelectedClientId,
        setUserInfo,
        setFilms,
        setAllSavedPdfs,
        setHistoryPdfs,
        setHistoryHasMore,
        setHistoryNextOffset,
        setHasLoadedAllPdfs,
        initialPdfLoad: initialPdfLoadRef.current,
        setAgendamentos,
        setHasLoadedHistory,
        setHasLoadedAgendamentos
    });

    const handleLoadMoreHistoryPdfs = useCallback(async () => {
        if (isHistoryPageLoading || !historyHasMore || hasLoadedAllPdfs) return;
        setIsHistoryPageLoading(true);
        try {
            await loadPdfHistoryPage();
        } finally {
            setIsHistoryPageLoading(false);
        }
    }, [hasLoadedAllPdfs, historyHasMore, isHistoryPageLoading, loadPdfHistoryPage]);

    const handleEnsureCompleteHistory = useCallback(async () => {
        if (isHistoryPageLoading || !historyHasMore || hasLoadedAllPdfs) return;
        setIsHistoryPageLoading(true);
        try {
            let offset = historyNextOffset;
            let hasMore = true;
            const loaded: SavedPDF[] = [];

            while (hasMore) {
                const page = await db.getPDFPage({ offset, limit: 100 });
                loaded.push(...page.pdfs);
                offset = page.nextOffset;
                hasMore = page.hasMore;
            }

            setHistoryPdfs(current => {
                const byId = new Map(current.map(pdf => [pdf.id, pdf]));
                loaded.forEach(pdf => byId.set(pdf.id, pdf));
                return [...byId.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });
            setHistoryNextOffset(offset);
            setHistoryHasMore(false);
        } finally {
            setIsHistoryPageLoading(false);
        }
    }, [hasLoadedAllPdfs, historyHasMore, historyNextOffset, isHistoryPageLoading]);

    useEffect(() => {
        if (!authUser?.id || activeTab === 'history' || activeTab === 'dashboard' || hasLoadedAllPdfs || isLoading || isLoadingAllPdfsRef.current) return;

        isLoadingAllPdfsRef.current = true;
        setIsLoading(true);
        loadAllPdfs()
            .catch(error => console.error('Erro ao carregar dados completos de orcamentos:', error))
            .finally(() => {
                isLoadingAllPdfsRef.current = false;
                setIsLoading(false);
            });
    }, [activeTab, authUser?.id, hasLoadedAllPdfs, isLoading, loadAllPdfs]);

    useEffect(() => {
        if (!authUser?.id || activeTab !== 'history' || hasLoadedAllPdfs || isLoading || historyPageRequestedRef.current) return;

        historyPageRequestedRef.current = true;
        setIsHistoryPageLoading(true);
        loadPdfHistoryPage({ reset: true })
            .catch(error => console.error('Erro ao carregar primeira pagina do historico:', error))
            .finally(() => setIsHistoryPageLoading(false));
    }, [activeTab, authUser?.id, hasLoadedAllPdfs, isLoading, loadPdfHistoryPage]);

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
        handleMeasurementsChangeWithPersistence,
        handleGeneralDiscountChange,
        handleProposalPricingModeChange,
        handleProposalExpensesChange,
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
        effectivePaymentConfig,
        hasActiveOverride: hasActiveProposalPaymentOverride,
        saveActiveOverride: saveProposalPaymentOverride,
        clearActiveOverride: clearProposalPaymentOverride,
        renameOverride: renameProposalPaymentOverride,
        deleteOverride: deleteProposalPaymentOverride
    } = useProposalPaymentOverrides({
        selectedClientId,
        activeOptionName: activeOption?.name || null,
        userInfo
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
        handleMeasurementsChangeWithPersistence,
        createEmptyMeasurement
    });
    const [isDeletingMeasurement, setIsDeletingMeasurement] = useState(false);

    const handlePasteCopiedMeasurements = useCallback(async () => {
        const pastedMeasurements = createPastedMeasurementsFromClipboard(measurements);

        if (pastedMeasurements.length === 0) {
            showToast('Nenhuma medida copiada para colar.', { tone: 'warning' });
            return;
        }

        const nextMeasurements = [
            ...measurements.map(measurement => ({ ...measurement, isNew: false })),
            ...pastedMeasurements
        ];

        try {
            await handleMeasurementsChangeWithPersistence(nextMeasurements);
            showToast(`${pastedMeasurements.length} ${pastedMeasurements.length === 1 ? 'medida colada' : 'medidas coladas'} neste cliente.`, { tone: 'success' });
        } catch (error) {
            console.error('Erro ao colar medidas copiadas:', error);
            showToast('Não foi possível colar as medidas copiadas.', { tone: 'error' });
        }
    }, [handleMeasurementsChangeWithPersistence, measurements, showToast]);

    const handleSwipeDirectionChange = useCallback((direction: 'left' | 'right' | null, distance: number) => {
        setSwipeDirection(direction);
        setSwipeDistance(distance);
    }, []);

    const handleShowInfo = useCallback((message: string, title: string = "Atenção") => {
        showAlert({ title, message, tone: title.toLowerCase().includes('erro') ? 'error' : 'info' });
    }, [showAlert]);

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
            if (isClientModalOpen || isPaymentModalOpen || isProposalPaymentModalOpen || isProposalExpensesModalOpen || isFilmModalOpen || editingMeasurement ||
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
                showToast('Pressione voltar novamente para sair', { tone: 'info', duration: 2000 });

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
    }, [numpadConfig.isOpen, isClientModalOpen, isPaymentModalOpen, isProposalPaymentModalOpen, isProposalExpensesModalOpen, isFilmModalOpen, editingMeasurement,
        isFilmSelectionModalOpen, isGalleryOpen, schedulingInfo, handleNumpadClose, showToast]);

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

    // Duplica ja aplicando uma pelicula (favorita) em todos os grupos.
    const handleDuplicateWithFilm = useCallback((filmName: string) => {
        duplicateActiveOption(filmName);
        setIsDuplicateAllModalOpen(false);
    }, [duplicateActiveOption]);

    // Sem favoritas: abre o seletor de pelicula; ao escolher, duplica aplicando a todos.
    const handleOpenDuplicateFilmSelector = useCallback(() => {
        setIsDuplicateAllModalOpen(false);
        setIsDuplicateFilmSelectorOpen(true);
    }, []);

    const handleSelectFilmForDuplicate = useCallback((filmName: string) => {
        duplicateActiveOption(filmName);
        setIsDuplicateFilmSelectorOpen(false);
    }, [duplicateActiveOption]);

    const handleRequestDeleteProposalOption = useCallback((optionId: number) => {
        setProposalOptionToDeleteId(optionId);
        setIsDeleteProposalOptionModalOpen(true);
    }, []);

    const handleRenameProposalOption = useCallback((optionId: number, newName: string) => {
        const optionToRename = proposalOptions.find(option => option.id === optionId);
        renameProposalOption(optionId, newName);

        if (selectedClientId && optionToRename && optionToRename.name !== newName) {
            renameProposalPaymentOverride(selectedClientId, optionToRename.name, newName);
        }
    }, [proposalOptions, renameProposalOption, renameProposalPaymentOverride, selectedClientId]);

    const handleConfirmDeleteProposalOption = useCallback(() => {
        if (proposalOptionToDeleteId === null) return;

        setIsDeletingProposalOption(true);
        window.requestAnimationFrame(() => {
            try {
                const optionToDelete = proposalOptions.find(option => option.id === proposalOptionToDeleteId);
                deleteProposalOption(proposalOptionToDeleteId);
                if (selectedClientId && optionToDelete) {
                    deleteProposalPaymentOverride(selectedClientId, optionToDelete.name);
                }
                setIsDeleteProposalOptionModalOpen(false);
                setProposalOptionToDeleteId(null);
            } finally {
                setIsDeletingProposalOption(false);
            }
        });
    }, [proposalOptionToDeleteId, proposalOptions, deleteProposalOption, deleteProposalPaymentOverride, selectedClientId]);

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
        handleUpdateAgendamentoServiceStatus,
        handleCompleteAgendamentoWithValue,
        handleContinueAgendamento,
        handleRequestDeleteAgendamento,
        handleConfirmDeleteAgendamento,
        handleCreateNewAgendamento,
        handleEditAgendamento,
        handleRescheduleAgendamento,
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

    // Escuta o service worker para aplicar o status quando o app ja esta aberto
    // e o usuario toca em um botao da notificacao de encerramento.
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleSwMessage = (event: MessageEvent) => {
            const data = event.data;
            if (!data || data.type !== 'MARK_SERVICE_STATUS') return;

            const agendamentoId = Number(data.agendamentoId);
            const validStatuses: AgendamentoServiceStatus[] = ['completed', 'cancelled', 'no_show'];
            if (Number.isFinite(agendamentoId) && validStatuses.includes(data.serviceStatus)) {
                setActiveTab('agenda');
                setPendingServiceStatusMark({ id: agendamentoId, status: data.serviceStatus });
            }
        };

        navigator.serviceWorker.addEventListener('message', handleSwMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }, []);

    // Aplica a marcacao pendente assim que o agendamento alvo estiver carregado.
    useEffect(() => {
        if (!pendingServiceStatusMark) return;

        const target = agendamentos.find(item => item.id === pendingServiceStatusMark.id);
        if (!target) return;

        void handleUpdateAgendamentoServiceStatus(target, pendingServiceStatusMark.status);
        setPendingServiceStatusMark(null);
    }, [pendingServiceStatusMark, agendamentos, handleUpdateAgendamentoServiceStatus]);

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
        const nextUserInfo = { ...info, isFallback: false };
        await db.saveUserInfo(nextUserInfo);
        setUserInfo(nextUserInfo);
    }, []);

    const handleSavePaymentMethods = useCallback(async (methods: PaymentMethods, _options?: { prazoPagamento: string }) => {
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

    const handleSaveProposalPaymentConfig = useCallback(async (methods: PaymentMethods, options?: { prazoPagamento: string }) => {
        await saveProposalPaymentOverride({
            paymentMethods: methods,
            prazoPagamento: options?.prazoPagamento || ''
        });
        setIsProposalPaymentModalOpen(false);
    }, [saveProposalPaymentOverride]);

    const handleResetProposalPaymentConfig = useCallback(async () => {
        await clearProposalPaymentOverride();
        setIsProposalPaymentModalOpen(false);
    }, [clearProposalPaymentOverride]);

    const {
        handleDownloadPdf,
        handleShareGeneratedPdf,
        canShareGeneratedPdf,
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
        proposalPaymentConfig: effectivePaymentConfig,
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

    const processClientDataWithGemini = async (input: AIInput): Promise<ExtractedClientData | null> => {
        if (!userInfo?.aiConfig?.apiKey) {
            throw new Error("Chave de API do Gemini não configurada.");
        }

        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(userInfo!.aiConfig!.apiKey);
            const model = genAI.getGenerativeModel({
                model: GEMINI_TEXT_MODEL,
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
                
                ** Regra para UF:** O campo UF deve conter APENAS a sigla do estado(2 letras). ** SE N?O ENCONTRAR, RETORNE UMA STRING VAZIA "".JAMAIS RETORNE A PALAVRA "string".**

            Responda APENAS com um objeto JSON válido, sem markdown, contendo os campos: nome, telefone, email, cpfCnpj, cep, logradouro, numero, complemento, bairro, cidade, uf.
            `;

            const parts: any[] = [prompt];

            if (input.text && input.text.trim()) {
                parts.push(input.text);
            }
            if (input.images && input.images.length > 0) {
                for (const file of input.images) {
                    const { mimeType, data } = await blobToBase64(file);
                    parts.push({ inlineData: { mimeType, data } });
                }
            }
            if (input.audio) {
                const { mimeType, data } = await blobToBase64(input.audio);
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

    const normalizeQuickProposalDimension = (value: string | number | undefined): string => {
        if (value === undefined || value === null) return '';

        const rawValue = String(value).trim().replace(/\s/g, '');
        if (!rawValue) return '';

        const numericValue = parseFloat(rawValue.replace(',', '.').replace(/[^\d.]/g, ''));
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
            return rawValue.replace('.', ',');
        }

        const metersValue = numericValue > 20 ? numericValue / 100 : numericValue;
        return metersValue.toFixed(2).replace('.', ',');
    };

    const buildQuickProposalClient = (clientData?: Partial<ExtractedClientData>): Omit<Client, 'id'> => ({
        nome: clientData?.nome?.trim() || 'Cliente sem nome',
        telefone: clientData?.telefone?.replace(/\D/g, '') || '',
        email: clientData?.email?.trim() || '',
        cpfCnpj: clientData?.cpfCnpj?.replace(/\D/g, '') || '',
        cep: clientData?.cep?.replace(/\D/g, '') || '',
        logradouro: clientData?.logradouro?.trim() || '',
        numero: String(clientData?.numero || '').trim(),
        complemento: clientData?.complemento?.trim() || '',
        bairro: clientData?.bairro?.trim() || '',
        cidade: clientData?.cidade?.trim() || '',
        uf: clientData?.uf?.trim().slice(0, 2).toUpperCase() || '',
        lastUpdated: new Date().toISOString()
    });

    const createQuickProposalMeasurements = (items: QuickProposalMeasurement[]): UIMeasurement[] => {
        const highConfidenceThreshold = 0.85;
        const suggestionConfidenceThreshold = 0.6;

        return items
            .map((item, index) => {
                const largura = normalizeQuickProposalDimension(item.largura);
                const altura = normalizeQuickProposalDimension(item.altura);
                if (!largura || !altura) {
                    return null;
                }

                const baseMeasurement: UIMeasurement = {
                    ...createEmptyMeasurement(),
                    id: Date.now() + index,
                    ambiente: item.local || item.ambiente || 'Ambiente',
                    largura,
                    altura,
                    quantidade: Math.max(1, Math.floor(Number(item.quantidade) || 1)),
                    tipoAplicacao: item.tipoAplicacao || 'Desconhecido',
                    observation: item.observacao || undefined,
                    isNew: index === 0
                };

                if (!films.length || !item.peliculaDetectada) {
                    return baseMeasurement;
                }

                const filmMatch = matchFilmFromExtractedText(item.peliculaDetectada, films);
                if (filmMatch.matchedFilmName && filmMatch.confidence >= highConfidenceThreshold) {
                    return {
                        ...baseMeasurement,
                        pelicula: filmMatch.matchedFilmName
                    };
                }

                if (filmMatch.matchedFilmName && filmMatch.confidence >= suggestionConfidenceThreshold) {
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
            })
            .filter((measurement): measurement is UIMeasurement => Boolean(measurement));
    };

    const processQuickProposalWithGemini = async (
        input: AIInput
    ): Promise<QuickProposalExtraction> => {
        if (!userInfo?.aiConfig?.apiKey) {
            throw new Error("Chave de API do Gemini não configurada.");
        }

        const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
        const model = genAI.getGenerativeModel({
            model: GEMINI_TEXT_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        cliente: {
                            type: SchemaType.OBJECT,
                            properties: {
                                nome: { type: SchemaType.STRING },
                                telefone: { type: SchemaType.STRING },
                                email: { type: SchemaType.STRING },
                                cpfCnpj: { type: SchemaType.STRING },
                                cep: { type: SchemaType.STRING },
                                logradouro: { type: SchemaType.STRING },
                                numero: { type: SchemaType.STRING },
                                complemento: { type: SchemaType.STRING },
                                bairro: { type: SchemaType.STRING },
                                cidade: { type: SchemaType.STRING },
                                uf: { type: SchemaType.STRING }
                            }
                        },
                        medidas: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    local: { type: SchemaType.STRING },
                                    largura: { type: SchemaType.STRING },
                                    altura: { type: SchemaType.STRING },
                                    quantidade: { type: SchemaType.NUMBER },
                                    peliculaDetectada: { type: SchemaType.STRING },
                                    tipoAplicacao: { type: SchemaType.STRING },
                                    observacao: { type: SchemaType.STRING }
                                }
                            }
                        },
                        observacoes: { type: SchemaType.STRING }
                    },
                    required: ['cliente', 'medidas']
                }
            }
        });

        const prompt = `Voce e um assistente para uma empresa de instalacao de peliculas em vidros.

Extraia do conteudo uma proposta completa para revisao humana.

Retorne APENAS JSON valido com:
- cliente: nome, telefone, email, cpfCnpj, cep, logradouro, numero, complemento, bairro, cidade, uf.
- medidas: lista com local, largura, altura, quantidade, peliculaDetectada, tipoAplicacao e observacao.
- observacoes: texto curto com qualquer informacao util que nao coube nos campos.

Regras:
1. Telefone, CPF/CNPJ e CEP devem vir apenas com digitos.
2. UF deve ter apenas 2 letras ou string vazia.
3. Largura e altura devem estar em metros, como string com virgula e duas casas. Ex: "1,20".
4. Se uma medida estiver em centimetros, converta para metros. Ex: 120 x 150 cm vira "1,20" x "1,50".
5. Agrupe medidas identicas no mesmo local, somando quantidade.
6. Nunca invente pelicula. Se nao estiver claro, use string vazia em peliculaDetectada.
7. Se faltar nome do cliente, use "Cliente sem nome".
8. Se nao houver medidas validas, retorne medidas como array vazio.`;

        const parts: any[] = [prompt];

        if (input.text && input.text.trim()) {
            parts.push(input.text);
        }
        if (input.images && input.images.length > 0) {
            for (const file of input.images) {
                const { mimeType, data } = await blobToBase64(file);
                parts.push({ inlineData: { mimeType, data } });
            }
        }
        if (input.audio) {
            const { mimeType, data } = await blobToBase64(input.audio);
            parts.push({ inlineData: { mimeType, data } });
        }

        const result = await model.generateContent(parts);
        const responseText = result.response.text();
        const jsonText = extractFirstJsonObject(responseText);
        if (!jsonText) {
            throw new Error("A IA não retornou um JSON válido para a proposta.");
        }

        return JSON.parse(jsonText) as QuickProposalExtraction;
    };

    const handleProcessAIQuickProposalInput = useCallback(async (input: AIInput) => {
        if (!userInfo?.aiConfig?.apiKey || userInfo.aiConfig.provider !== 'gemini') {
            handleShowInfo("A proposta rapida usa o Gemini. Configure o provedor e a chave de API na aba 'Empresa'.");
            return;
        }

        setIsProcessingAI(true);
        try {
            const extracted = await processQuickProposalWithGemini(input);
            const quickMeasurements = createQuickProposalMeasurements(extracted.medidas || []);

            if (quickMeasurements.length === 0) {
                handleShowInfo("Não foi possível encontrar medidas válidas para montar a proposta.");
                return;
            }

            const savedClient = await db.saveClient(buildQuickProposalClient(extracted.cliente));
            if (!savedClient.id) {
                throw new Error("Não foi possível identificar o cliente salvo.");
            }

            const proposalOptionId = Date.now();
            const proposalOption: ProposalOption = {
                id: proposalOptionId,
                name: 'Opcao 1',
                measurements: quickMeasurements.map(({ isNew, ...measurement }) => measurement),
                generalDiscount: { value: '', type: 'fixed', operation: 'discount', pricingMode: 'complete' }
            };

            await db.saveProposalOptions(savedClient.id, [proposalOption]);
            await loadClients(savedClient.id);
            setActiveTab('client');
            setActiveOptionId(proposalOptionId);
            setIsAIQuickProposalModalOpen(false);

            const suggestionCount = quickMeasurements.filter(measurement => measurement.aiFilmSuggestion).length;
            const suggestionText = suggestionCount > 0
                ? ` ${suggestionCount} película(s) ficaram como sugestão para revisar.`
                : '';
            showToast(`Proposta criada para revisao com ${quickMeasurements.length} medida(s).${suggestionText}`, {
                tone: 'success',
                duration: 2800
            });
        } catch (error) {
            console.error("Erro ao criar proposta rapida com IA:", error);
            handleShowInfo(`Erro: ${error instanceof Error ? error.message : 'Tente novamente'}`);
            throw error;
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, createEmptyMeasurement, films, loadClients, handleShowInfo, showToast]);

    const handleProcessAIClientInput = useCallback(async (input: AIInput) => {
        if (!userInfo?.aiConfig?.apiKey) {
            // Sem IA ativada: leva direto para a tela de ativacao em vez de um beco sem saida.
            setApiKeyModalProvider('gemini');
            setIsApiKeyModalOpen(true);
            return;
        }

        const hasContent = (input.text && input.text.trim()) || (input.images && input.images.length > 0) || !!input.audio;
        if (!hasContent) {
            showError("Adicione texto, imagem ou áudio para extrair os dados do cliente.");
            return;
        }

        setIsProcessingAI(true);

        try {
            const extractedData = await processClientDataWithGemini(input);

            if (extractedData) {
                setAiClientData(extractedData);
                setIsAIClientModalOpen(false);
                setIsClientModalOpen(true);
            } else {
                showError("Não foi possível extrair dados do cliente. Tente reformular a entrada.");
            }
        } catch (error) {
            console.error("Erro ao processar dados do cliente com IA:", error);
            showError(`Ocorreu um erro com a IA: ${error instanceof Error ? error.message : String(error)} `);
        } finally {
            setIsProcessingAI(false);
        }
    }, [userInfo, showError]);

    const handleProcessAIFilmInput = useCallback(async (input: AIInput) => {
        if (!userInfo?.aiConfig?.apiKey) {
            // Sem IA ativada: leva direto para a tela de ativacao em vez de um beco sem saida.
            setApiKeyModalProvider('gemini');
            setIsApiKeyModalOpen(true);
            return;
        }

        const hasContent = (input.text && input.text.trim()) || (input.images && input.images.length > 0) || !!input.audio;
        if (!hasContent) {
            showError("Adicione texto, imagem ou áudio para extrair os dados da película.");
            return;
        }

        setIsProcessingAI(true);

        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
            const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });

            const prompt = `Você é um assistente especialista em extração de dados de películas automotivas (insulfilm). Sua tarefa é extrair o máximo de informações técnicas de películas a partir da entrada fornecida (texto, imagem ou áudio). Retorne APENAS um objeto JSON válido, sem markdown. Campos: nome, preco (apenas números), uv (%), ir (%), vtl (%), tser (%), espessura (micras), garantiaFabricante (anos), precoMetroLinear. Se algum campo não for encontrado, N?O inclua no JSON.`;

            const parts: any[] = [prompt];

            if (input.text && input.text.trim()) {
                parts.push(input.text);
            }
            if (input.images && input.images.length > 0) {
                for (const file of input.images) {
                    const { mimeType, data } = await blobToBase64(file);
                    parts.push({ inlineData: { mimeType, data } });
                }
            }
            if (input.audio) {
                const { mimeType, data } = await blobToBase64(input.audio);
                parts.push({ inlineData: { mimeType, data } });
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
            const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(userInfo!.aiConfig!.apiKey);
            const model = genAI.getGenerativeModel({
                model: GEMINI_TEXT_MODEL,
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

        // Modo Gemini/OpenAI - requer IA ativada
        if (!userInfo?.aiConfig?.apiKey) {
            // Leva direto para a tela de ativacao em vez de um beco sem saida.
            setApiKeyModalProvider('gemini');
            setIsApiKeyModalOpen(true);
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
        const currentPdf = allSavedPdfs.find(pdf => pdf.id === pdfId);

        // Atualiza estado imediatamente para refletir na UI sem esperar o banco
        setAllSavedPdfs((prev: SavedPDF[]) => prev.map(p => p.id === pdfId ? { ...p, status } : p));
        try {
            let pdfToUpdate = currentPdf;
            if (!pdfToUpdate) {
                const allPdfsFromDb = await db.getAllPDFs();
                pdfToUpdate = allPdfsFromDb.find(p => p.id === pdfId);
            }

            if (pdfToUpdate) {
                await db.updatePDF({ ...pdfToUpdate, status });
            }
        } catch (error) {
            console.error("Failed to update PDF status", error);
            handleShowInfo("Não foi possível atualizar o status do orçamento.");
            await loadAllPdfs(); // reverte em caso de erro
        }
    }, [allSavedPdfs, loadAllPdfs, handleShowInfo]);


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

        setActiveTab(prev => {
            if (tab !== prev) {
                // Empilha a aba atual para permitir voltar; evita repetir o topo.
                setTabHistory(history => (history[history.length - 1] === prev ? history : [...history, prev]));
            }
            return tab;
        });

        if (tab === 'qr_code' && !hasModule('qr_servicos')) {
            setShowQrUpgradeModal(true);
        }
    }, [numpadConfig.isOpen, handleNumpadClose, hasModule]);

    const handleOpenClientHub = useCallback(() => {
        handleTabChange('cliente_hub');
    }, [handleTabChange]);

    const handleOpenClientFromList = useCallback((clientId: number) => {
        setSelectedClientId(clientId);
        handleTabChange('cliente_hub');
    }, [handleTabChange]);

    const handleGoBack = useCallback(() => {
        if (numpadConfig.isOpen) {
            handleNumpadClose();
        }
        setTabHistory(history => {
            if (history.length === 0) return history;
            const previous = history[history.length - 1];
            setActiveTab(previous);
            return history.slice(0, -1);
        });
    }, [numpadConfig.isOpen, handleNumpadClose]);

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
            const nextAiConfig = {
                ...(userInfo.aiConfig || { provider: 'gemini' as const }),
                provider: apiKeyModalProvider,
                apiKey
            };
            const updatedUserInfo = await db.updateAIConfigOnly(nextAiConfig);
            if (updatedUserInfo) {
                setUserInfo(updatedUserInfo);
            } else {
                setUserInfo({ ...userInfo, aiConfig: nextAiConfig, isFallback: false });
            }
            setIsApiKeyModalOpen(false);
        }
    }, [userInfo, apiKeyModalProvider]);

    // Porteiro único da IA: garante que o recurso está liberado (modulo comprado)
    // e que a IA foi ativada (chave configurada). Se faltar algo, leva o usuario
    // direto para a tela certa — upgrade ou ativacao — em vez de deixar ele
    // abrir a funcao, digitar tudo e so depois descobrir que falta configurar.
    const ensureAiReady = useCallback((): boolean => {
        if (!hasModule('ia_ocr')) {
            setShowIaUpgradeModal(true);
            return false;
        }
        if (!userInfo?.aiConfig?.apiKey) {
            handleOpenApiKeyModal('gemini');
            return false;
        }
        return true;
    }, [hasModule, userInfo, handleOpenApiKeyModal]);

    const handleSaveGeneralDiscount = useCallback((discount: ProposalDiscount) => {
        handleGeneralDiscountChange(discount);
        setIsGeneralDiscountModalOpen(false);
    }, [handleGeneralDiscountChange]);

    const handleSaveProposalExpenses = useCallback((expenses: ProposalExpense[]) => {
        handleProposalExpensesChange(expenses);
        setIsProposalExpensesModalOpen(false);
    }, [handleProposalExpensesChange]);

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
        if (!ensureAiReady()) return;
        setIsClientModalOpen(false);
        setIsAIClientModalOpen(true);
    }, [ensureAiReady]);

    const handleOpenAIQuickProposalModal = useCallback(() => {
        if (!ensureAiReady()) return;
        setIsClientModalOpen(false);
        setIsAIClientModalOpen(false);
        setIsAIMeasurementModalOpen(false);
        setIsAIQuickProposalModalOpen(true);
    }, [ensureAiReady]);

    const handleOpenAIFilmModal = useCallback(() => {
        if (!ensureAiReady()) return;
        setIsAIFilmModalOpen(true);
    }, [ensureAiReady]);

    const handleQuickFabEstoqueAI = useCallback((tab: 'bobinas' | 'retalhos') => {
        if (!ensureAiReady()) return;
        setInitialEstoqueAction({ action: 'ai', tab });
        handleTabChange('estoque');
    }, [ensureAiReady, handleTabChange]);

    const handleClearInitialEstoqueAction = useCallback(() => {
        setInitialEstoqueAction(null);
    }, []);

    const handleQuickFabAgenda = useCallback(() => {
        handleCreateNewAgendamento(new Date());
    }, [handleCreateNewAgendamento]);

    const handleProcessAIMeasurementInput = useCallback(async (input: AIInput) => {
        if (!userInfo?.aiConfig?.apiKey) {
            // Leva direto para a tela de ativacao em vez de um beco sem saida.
            setApiKeyModalProvider('gemini');
            setIsApiKeyModalOpen(true);
            return;
        }

        const hasContent = (input.text && input.text.trim()) || (input.images && input.images.length > 0) || !!input.audio;
        if (!hasContent) {
            handleShowInfo("Adicione texto, imagem ou áudio para extrair as medidas.");
            return;
        }

        setIsProcessingAI(true);
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(userInfo.aiConfig.apiKey);
            const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });

            const prompt = `Você é um assistente especialista em extração de medidas de janelas/vidros para instalação de películas.

Sua tarefa é extrair as medidas e retornar um array JSON.

**REGRAS DE AGRUPAMENTO (CRÍTICO):**
1. AGRUPE medidas idênticas (mesma largura, altura e local) em um único item.
2. Se a entrada for "5 janelas de 1.20 x 2.10 na sala", retorne UM ÚNICO item com quantidade: 5.
3. N?O crie itens separados para a mesma medida repetida.

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

            if (input.text && input.text.trim()) {
                parts.push(input.text);
            }
            if (input.images && input.images.length > 0) {
                for (const file of input.images) {
                    const { mimeType, data } = await blobToBase64(file);
                    parts.push({ inlineData: { mimeType, data } });
                }
            }
            if (input.audio) {
                const { mimeType, data } = await blobToBase64(input.audio);
                parts.push({ inlineData: { mimeType, data } });
            }

            const result = await model.generateContent(parts);
            const responseText = result.response.text();

            const extractedJson = extractFirstJsonArray(responseText);
            if (!extractedJson) {
                handleShowInfo("Não foi possível extrair medidas. Tente reformular.");
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
            showAlert({
                title: 'Instalar aplicativo',
                message: "Para instalar, use o menu 'Compartilhar' do seu navegador e selecione 'Adicionar ?  Tela de Início'.",
                tone: 'info'
            });
        }
    }, [deferredPrompt, promptInstall, showAlert]);

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
            hasLoadedAllPdfs={hasLoadedAllPdfs}
            onRequireAllPdfs={loadAllPdfs}
            historyPdfs={hasLoadedAllPdfs ? allSavedPdfs : historyPdfs}
            historyHasMore={!hasLoadedAllPdfs && historyHasMore}
            isHistoryPageLoading={isHistoryPageLoading}
            onLoadMoreHistoryPdfs={handleLoadMoreHistoryPdfs}
            onEnsureCompleteHistory={handleEnsureCompleteHistory}
            clients={clients}
            agendamentos={agendamentos}
            films={films}
            initialEstoqueAction={initialEstoqueAction}
            onInitialEstoqueActionConsumed={handleClearInitialEstoqueAction}
            selectedClientId={selectedClientId}
            measurements={measurements}
            proposalOptions={proposalOptions}
            activeOptionId={activeOptionId}
            pricingMode={generalDiscount.pricingMode === 'labor_only' ? 'labor_only' : 'complete'}
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
            onUpdateAgendamentoServiceStatus={handleUpdateAgendamentoServiceStatus}
            onCompleteAgendamentoWithValue={handleCompleteAgendamentoWithValue}
            onContinueAgendamento={handleContinueAgendamento}
            onRescheduleAgendamento={handleRescheduleAgendamento}
            onCreateNewAgendamento={handleCreateNewAgendamento}
            onAddFilm={() => handleOpenFilmModal(null)}
            onEditFilm={handleOpenFilmModal}
            onDeleteFilm={handleRequestDeleteFilm}
            onOpenGallery={handleOpenGallery}
            onOpenClientModal={handleOpenClientModal}
            onOpenClientFromList={handleOpenClientFromList}
            onNavigateBack={handleGoBack}
            onOpenAIQuickProposal={handleOpenAIQuickProposalModal}
            onCreateProposal={handleOpenClientSelectionModal}
            onTabChange={handleTabChange}
            onSelectOption={setActiveOptionId}
            onRenameOption={handleRenameProposalOption}
            onDeleteOption={handleRequestDeleteProposalOption}
            onAddOption={addProposalOption}
            onSelectPricingMode={handleProposalPricingModeChange}
            onOpenProposalPaymentConfig={() => setIsProposalPaymentModalOpen(true)}
            onOpenProposalExpenses={() => setIsProposalExpensesModalOpen(true)}
            hasCustomProposalPaymentConfig={hasActiveProposalPaymentOverride}
            hasActiveExpenses={totals.operationalExpenses > 0}
            onSwipeDirectionChange={handleSwipeDirectionChange}
            onAddMeasurement={addMeasurement}
            onOpenLocationImport={() => setIsLocationImportModalOpen(true)}
            onMeasurementsChange={handleMeasurementsChange}
            onPersistMeasurementsChange={handleMeasurementsChangeWithPersistence}
            onOpenFilmModal={handleOpenFilmModal}
            onOpenFilmSelectionModal={handleOpenFilmSelectionModal}
            onOpenClearAllModal={() => setIsClearAllModalOpen(true)}
            onOpenApplyFilmToAllModal={() => setIsApplyFilmToAllModalOpen(true)}
            onOpenNumpad={handleOpenNumpad}
            onOpenEditModal={handleOpenEditMeasurementModal}
            onOpenDiscountModal={handleOpenDiscountModal}
            onDeleteMeasurement={handleDeleteMeasurementFromGroup}
            onDeleteMeasurementImmediate={handleImmediateDeleteMeasurement}
            onPasteCopiedMeasurements={handlePasteCopiedMeasurements}
            onTogglePin={handleToggleClientPin}
            onAddNewClient={handleAddNewClientFromSelection}
            isClientsLoading={isLoading}
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
        allSavedPdfs,
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
        handleShareGeneratedPdf,
        canShareGeneratedPdf,
        isProcessingAI,
        isAIQuickProposalModalOpen,
        setIsAIQuickProposalModalOpen,
        handleProcessAIQuickProposalInput,
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
        handleDuplicateWithFilm,
        handleOpenDuplicateFilmSelector,
        isDuplicateFilmSelectorOpen,
        setIsDuplicateFilmSelectorOpen,
        handleSelectFilmForDuplicate,
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
        isGeneralDiscountModalOpen,
        setIsGeneralDiscountModalOpen,
        handleSaveGeneralDiscount,
        generalDiscount,
        onOpenLocationImport: () => setIsLocationImportModalOpen(true),
    };

    const handleOrganizationSetupCompleted = useCallback(async (organizationName: string, logo?: string) => {
        // Cria dados de exemplo antes de carregar o app, para que o primeiro
        // acesso não apareça vazio. refreshProfile() em seguida dispara o
        // bootstrap, que já carrega os exemplos recém-criados.
        try {
            await seedExampleDataIfNeeded();
        } catch (error) {
            console.error('Erro ao criar dados de exemplo:', error);
        }

        // Se o usuário já enviou uma logo no cadastro, persiste antes de carregar
        // o perfil para que ela apareça desde o início (já vem otimizada).
        if (logo) {
            try {
                const current = await db.getUserInfo();
                if (current) {
                    await db.saveUserInfo({ ...current, logo, isFallback: false });
                }
            } catch (error) {
                console.error('Erro ao salvar a logo inicial:', error);
            }
        }

        await refreshProfile();
        showToast(`Empresa "${organizationName}" criada com sucesso.`, {
            tone: 'success',
            duration: 2200
        });
    }, [refreshProfile, showToast]);


    const wideWorkspaceClass = ['dashboard', 'history', 'proposals', 'estoque', 'films', 'fornecedores', 'agenda', 'settings', 'qr_code', 'account', 'assistentes', 'admin', 'cliente_hub', 'clients_list'].includes(activeTab)
        ? 'mx-auto w-full max-w-[1480px]'
        : activeTab === 'client'
            ? 'mx-auto w-full max-w-[1480px]'
            : 'container mx-auto w-full max-w-2xl lg:max-w-5xl';

    const useNativeSurface = ['dashboard', 'client', 'cliente_hub', 'clients_list', 'history', 'proposals', 'estoque', 'films', 'fornecedores', 'agenda', 'settings', 'qr_code', 'account', 'assistentes'].includes(activeTab);



    return (
        <div className="flex h-full flex-col overflow-hidden bg-[var(--app-bg)] font-sans lg:flex-row">
            <ProtectedRoute>
                {needsOrganizationSetup ? (
                    <OrganizationSetup
                        initialEmail={authUser?.email || ''}
                        initialOwnerName={
                            authUser?.user_metadata?.full_name ||
                            authUser?.user_metadata?.name ||
                            ''
                        }
                        onCompleted={handleOrganizationSetupCompleted}
                    />
                ) : (
                    <>
                <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
                <OnboardingTour onNavigate={handleTabChange} />

                <div className="flex-grow flex flex-col min-w-0 h-full overflow-hidden">
                    <UpdateBanner />

                    <main ref={mainRef} className="flex-grow overflow-y-auto bg-[var(--app-bg)] pb-32 transition-colors duration-500 sm:pb-0 lg:pb-0">
                        <div className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--app-bg)_88%,transparent)] backdrop-blur-md">
                            <div className={`${wideWorkspaceClass} px-4`}>
                                <div className="py-2 sm:py-3 lg:py-4">
                                    <Header
                                        activeTab={activeTab}
                                        onTabChange={handleTabChange}
                                        onGoBack={handleGoBack}
                                        canGoBack={tabHistory.length > 0}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={`${wideWorkspaceClass} px-2 py-4 sm:px-4 sm:py-6 lg:px-6`}>
                            <div className={useNativeSurface
                                ? 'bg-transparent p-0'
                                : 'rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6'}
                            >
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
                                        onOpenClientHub={handleOpenClientHub}
                                        onAddClient={() => handleOpenClientModal('add')}
                                        onAddClientAI={handleOpenAIClientModal}
                                        onOpenAIQuickProposal={handleOpenAIQuickProposalModal}
                                        onEditClient={() => handleOpenClientModal('edit')}
                                        onDeleteClient={handleDeleteClient}
                                        onSwipeLeft={goToNextClient}
                                        onSwipeRight={goToPrevClient}
                                         onSelectOption={setActiveOptionId}
                                         onRenameOption={handleRenameProposalOption}
                                         onDeleteOption={handleRequestDeleteProposalOption}
                                         onAddOption={addProposalOption}
                                         onSelectPricingMode={handleProposalPricingModeChange}
                                         onOpenProposalPaymentConfig={() => setIsProposalPaymentModalOpen(true)}
                                         onOpenProposalExpenses={() => setIsProposalExpensesModalOpen(true)}
                                         hasCustomProposalPaymentConfig={hasActiveProposalPaymentOverride}
                                         hasActiveExpenses={totals.operationalExpenses > 0}
                                         onSwipeDirectionChange={handleSwipeDirectionChange}
                                        onOpenGeneralDiscountModal={() => setIsGeneralDiscountModalOpen(true)}
                                        onUpdateGeneralDiscount={handleGeneralDiscountChange}
                                        onAddMeasurement={addMeasurement}
                                        onDuplicateMeasurements={duplicateAllMeasurements}
                                        onGeneratePdf={handleGeneratePdf}
                                        onOpenAIModal={() => {
                                            if (!ensureAiReady()) return;
                                            setIsAIMeasurementModalOpen(true);
                                        }}
                                        defaultHideMeasurements={!!userInfo?.hideMeasurementsInPdf}
                                    />
                                ) : ['history', 'proposals', 'agenda'].includes(activeTab) ? (
                                    <div className={activeTab === 'history'
                                        ? 'rounded-none bg-transparent'
                                        : 'rounded-none bg-transparent'}
                                    >
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


                      {userInfo?.aiConfig?.quickFab && (
                          <AIQuickFab
                              onCreateProposal={handleOpenAIQuickProposalModal}
                              onCreateClient={handleOpenAIClientModal}
                              onCreateBobina={() => handleQuickFabEstoqueAI('bobinas')}
                              onCreateRetalho={() => handleQuickFabEstoqueAI('retalhos')}
                              onCreateAgenda={handleQuickFabAgenda}
                          />
                      )}

                      <ModalsContainer {...modalProps} />
                      {billingReturnState && (
                          <BillingReturnModal
                              isOpen={isBillingReturnVisible}
                              status={billingReturnState.status}
                              mode={billingReturnState.mode}
                              moduleName={billingReturnModuleName}
                              attempts={billingReturnState.attempts}
                              onClose={handleCloseBillingReturn}
                          />
                      )}
                      {userInfo && selectedClientId && activeOption && (
                          <PaymentMethodsModal
                              isOpen={isProposalPaymentModalOpen}
                              onClose={() => setIsProposalPaymentModalOpen(false)}
                              onSave={handleSaveProposalPaymentConfig}
                              onResetToDefault={hasActiveProposalPaymentOverride ? handleResetProposalPaymentConfig : undefined}
                              paymentMethods={effectivePaymentConfig.paymentMethods}
                              prazoPagamento={effectivePaymentConfig.prazoPagamento}
                              showPrazoPagamentoField
                              title="Pagamento desta proposta"
                              description="Por padrão, o PDF usa as formas de pagamento da empresa. Aqui você pode personalizar apenas a proposta ativa sem alterar o cadastro geral."
                              saveLabel="Salvar nesta proposta"
                              resetLabel="Usar padrao da empresa"
                          />
                      )}
                      {selectedClientId && activeOption && (
                          <ProposalExpensesModal
                              isOpen={isProposalExpensesModalOpen}
                              onClose={() => setIsProposalExpensesModalOpen(false)}
                              onSave={handleSaveProposalExpenses}
                              expenses={generalDiscount.expenses || []}
                              totals={totals}
                          />
                      )}
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

                    {/* Modal de Upgrade - QR Code Serviços */}
                    {showQrUpgradeModal && (
                        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                            <div className="max-w-2xl w-full">
                                <PremiumFeatureSection
                                    moduleId="qr_servicos"
                                    title="QR Code de Servicos"
                                    description="Ative o modulo premium para gerar QR, pagina publica e uma entrega mais profissional."
                                    variant="inline"
                                />
                                <button
                                    onClick={() => setShowQrUpgradeModal(false)}
                                    className="w-full mt-4 rounded-2xl bg-slate-900 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Modal de Upgrade - IA/OCR */}
                    {showIaUpgradeModal && (
                        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                            <div className="max-w-2xl w-full">
                                <PremiumFeatureSection
                                    moduleId="ia_ocr"
                                    title="Inteligencia Artificial"
                                    description="Contrate a IA pelo mesmo modal premium e mantenha a experiencia mais clara para a equipe."
                                    variant="inline"
                                />
                                <button
                                    onClick={() => setShowIaUpgradeModal(false)}
                                    className="w-full mt-4 rounded-2xl bg-slate-900 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                    </>
                )}
            </ProtectedRoute>
        </div>
    );
};

export default App;



