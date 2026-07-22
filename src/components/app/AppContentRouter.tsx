import React, { ReactNode, Suspense, lazy } from 'react';
import { Bolt, ClipboardPaste, Plus, Ruler, Sparkles, UserCheck, Users } from 'lucide-react';
import { Client, Film, Agendamento, AgendamentoServiceStatus, ProposalOption, ProposalPricingMode, SavedPDF, UserInfo, UIMeasurement } from '../../../types';
import MeasurementList from '../../../components/MeasurementList';
import ProposalOptionsCarousel from '../../../components/ProposalOptionsCarousel';
import { FeatureGate } from '../../../components/subscription/SubscriptionComponents';
import { PremiumFeatureSection } from '../../../components/subscription/PremiumFeatureSection';
import { NumpadConfig } from '../../hooks/useMeasurementEditor';
import ActionButton from '../../../components/ui/ActionButton';
import ContentState from '../../../components/ui/ContentState';
import { getMeasurementClipboardCount } from '../../lib/measurementClipboard';

const DashboardView = lazy(() => import('../../../components/views/DashboardView'));
const UserSettingsView = lazy(() => import('../../../components/views/UserSettingsView'));
const PdfHistoryView = lazy(() => import('../../../components/views/PdfHistoryView'));
const ProposalCenterView = lazy(() => import('../../../components/views/ProposalCenterView'));
const FilmListView = lazy(() => import('../../../components/views/FilmListView'));
const AgendaView = lazy(() => import('../../../components/views/AgendaView'));
const EstoqueView = lazy(() => import('../../../components/views/EstoqueView'));
const FornecedoresView = lazy(() => import('../../../components/views/FornecedoresView'));
const ServicoQrView = lazy(() => import('../../../components/views/ServicoQrView'));
const ClientHubView = lazy(() => import('../../../components/views/ClientHubView'));
const ClientListView = lazy(() => import('../../../components/views/ClientListView'));
const AdminUsers = lazy(() => import('../../../components/AdminUsers').then(module => ({ default: module.AdminUsers })));
const UserAccount = lazy(() => import('../../../components/UserAccount').then(module => ({ default: module.UserAccount })));

type ActiveTab = 'dashboard' | 'client' | 'cliente_hub' | 'clients_list' | 'films' | 'settings' | 'history' | 'proposals' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores';

interface AppContentRouterProps {
    activeTab: ActiveTab;
    isLoading: boolean;
    userInfo: UserInfo | null;
    organizationId?: string;
    isOwner: boolean;
    isInstalled: boolean;
    allSavedPdfs: SavedPDF[];
    hasLoadedAllPdfs: boolean;
    onRequireAllPdfs: () => Promise<void>;
    historyPdfs: SavedPDF[];
    historyHasMore: boolean;
    isHistoryPageLoading: boolean;
    onLoadMoreHistoryPdfs: () => Promise<void>;
    onEnsureCompleteHistory: () => Promise<void>;
    clients: Client[];
    clientListClients: Client[];
    hasLoadedAllClients: boolean;
    clientListHasMore: boolean;
    isClientListLoading: boolean;
    onLoadMoreClientList: () => Promise<void>;
    onSearchClientList: (term: string) => Promise<void>;
    clientTotalCount: number;
    dormantClientCount: number;
    agendamentos: Agendamento[];
    films: Film[];
    initialEstoqueAction: { action: 'scan', code: string } | { action: 'ai', tab: 'bobinas' | 'retalhos' } | null;
    onInitialEstoqueActionConsumed?: () => void;
    selectedClientId: number | null;
    measurements: UIMeasurement[];
    proposalOptions: ProposalOption[];
    activeOptionId: number | null;
    pricingMode: ProposalPricingMode;
    totals: { totalM2: number; totalQuantity: number };
    numpadConfig: NumpadConfig;
    swipeDirection: 'left' | 'right' | null;
    swipeDistance: number;
    clientLoadingView: ReactNode;
    estoqueLoadingView: ReactNode;
    defaultLoadingView: ReactNode;
    onSaveUserInfo: (info: UserInfo) => Promise<void>;
    onOpenPaymentMethods: () => void;
    onOpenApiKeyModal: (provider: 'gemini' | 'openai') => void;
    onPromptPwaInstall: () => void;
    onDeletePdf: (pdfId: number) => void;
    onDownloadPdf: (pdfId: number) => Promise<void>;
    onUpdatePdfStatus: (pdfId: number, status: SavedPDF['status']) => Promise<void>;
    onSchedulePdf: (info: any) => void;
    onGenerateCombinedPdf: (clientId: number) => Promise<void>;
    onNavigateToOption: (clientId: number, optionId: number) => void;
    onEditAgendamento: (agendamento: Agendamento) => void;
    onUpdateAgendamentoServiceStatus: (agendamento: Agendamento, serviceStatus: AgendamentoServiceStatus) => void;
    onCompleteAgendamentoWithValue: (agendamento: Agendamento, finalValue: number) => void;
    onContinueAgendamento: (agendamento: Agendamento) => void;
    onRescheduleAgendamento: (agendamento: Agendamento) => void;
    onCreateNewAgendamento: (date: Date) => void;
    onAddFilm: () => void;
    onEditFilm: (film: Film | null) => void;
    onDeleteFilm: (filmName: string) => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
    onOpenClientModal: (mode: 'add' | 'edit') => void;
    onOpenClientFromList: (clientId: number) => void;
    onNavigateBack: () => void;
    onOpenAIQuickProposal: () => void;
    onCreateProposal: () => void;
    onTabChange: (tab: ActiveTab) => void;
    onSelectOption: (optionId: number) => void;
    onRenameOption: (optionId: number, newName: string) => void;
    onDeleteOption: (optionId: number) => void;
    onAddOption: () => void;
    onSelectPricingMode: (pricingMode: ProposalPricingMode) => void;
    onOpenProposalPaymentConfig: () => void;
    onOpenProposalExpenses: () => void;
    hasCustomProposalPaymentConfig: boolean;
    hasActiveExpenses: boolean;
    onSwipeDirectionChange: (direction: 'left' | 'right' | null, distance: number) => void;
    onAddMeasurement: () => void;
    onOpenLocationImport: () => void;
    onMeasurementsChange: (measurements: UIMeasurement[]) => void;
    onPersistMeasurementsChange?: (measurements: UIMeasurement[]) => Promise<void>;
    onOpenFilmModal: (film: Film | null) => void;
    onOpenFilmSelectionModal: (measurementId: number) => void;
    onOpenClearAllModal: () => void;
    onOpenApplyFilmToAllModal: () => void;
    onOpenNumpad: (measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => void;
    onOpenEditModal: (measurement: UIMeasurement) => void;
    onOpenDiscountModal: (measurement: UIMeasurement) => void;
    onDeleteMeasurement: (measurementId: number) => void;
    onDeleteMeasurementImmediate: (id: number) => void;
    onPasteCopiedMeasurements?: () => void | Promise<void>;
    onTogglePin?: (id: number) => void;
    onAddNewClient?: (clientName: string) => void;
    isClientsLoading?: boolean;
}

export const AppContentRouter: React.FC<AppContentRouterProps> = ({
    activeTab,
    isLoading,
    userInfo,
    organizationId,
    isOwner,
    isInstalled,
    allSavedPdfs,
    hasLoadedAllPdfs,
    onRequireAllPdfs,
    historyPdfs,
    historyHasMore,
    isHistoryPageLoading,
    onLoadMoreHistoryPdfs,
    onEnsureCompleteHistory,
    clients,
    clientListClients,
    hasLoadedAllClients,
    clientListHasMore,
    isClientListLoading,
    onLoadMoreClientList,
    onSearchClientList,
    clientTotalCount,
    dormantClientCount,
    agendamentos,
    films,
    initialEstoqueAction,
    onInitialEstoqueActionConsumed,
    selectedClientId,
    measurements,
    proposalOptions,
    activeOptionId,
    pricingMode,
    totals,
    numpadConfig,
    swipeDirection,
    swipeDistance,
    clientLoadingView,
    estoqueLoadingView,
    defaultLoadingView,
    onSaveUserInfo,
    onOpenPaymentMethods,
    onOpenApiKeyModal,
    onPromptPwaInstall,
    onDeletePdf,
    onDownloadPdf,
    onUpdatePdfStatus,
    onSchedulePdf,
    onGenerateCombinedPdf,
    onNavigateToOption,
    onEditAgendamento,
    onUpdateAgendamentoServiceStatus,
    onCompleteAgendamentoWithValue,
    onContinueAgendamento,
    onRescheduleAgendamento,
    onCreateNewAgendamento,
    onAddFilm,
    onEditFilm,
    onDeleteFilm,
    onOpenGallery,
    onOpenClientModal,
    onOpenClientFromList,
    onNavigateBack,
    onOpenAIQuickProposal,
    onCreateProposal,
    onTabChange,
    onSelectOption,
    onRenameOption,
    onDeleteOption,
    onAddOption,
    onSelectPricingMode,
    onOpenProposalPaymentConfig,
    onOpenProposalExpenses,
    hasCustomProposalPaymentConfig,
    hasActiveExpenses,
    onSwipeDirectionChange,
    onAddMeasurement,
    onOpenLocationImport,
    onMeasurementsChange,
    onPersistMeasurementsChange,
    onOpenFilmModal,
    onOpenFilmSelectionModal,
    onOpenClearAllModal,
    onOpenApplyFilmToAllModal,
    onOpenNumpad,
    onOpenEditModal,
    onOpenDiscountModal,
    onDeleteMeasurement,
    onDeleteMeasurementImmediate,
    onPasteCopiedMeasurements,
    onTogglePin,
    onAddNewClient,
    isClientsLoading = false
}) => {
    const copiedMeasurementsCount = getMeasurementClipboardCount();
    const mobileProposalOptionsSlot = proposalOptions.length > 0 && activeOptionId ? (
        <div className="sm:hidden">
            <ProposalOptionsCarousel
                options={proposalOptions}
                activeOptionId={activeOptionId}
                onSelectOption={onSelectOption}
                onRenameOption={onRenameOption}
                onDeleteOption={onDeleteOption}
                onAddOption={onAddOption}
                onSelectPricingMode={onSelectPricingMode}
                onOpenPaymentConfig={onOpenProposalPaymentConfig}
                onOpenExpenses={onOpenProposalExpenses}
                hasActivePaymentOverride={hasCustomProposalPaymentConfig}
                hasActiveExpenses={hasActiveExpenses}
                onSwipeDirectionChange={onSwipeDirectionChange}
                showPricingMode={false}
            />
        </div>
    ) : null;

    const renderDeferred = (content: ReactNode, fallback: ReactNode = defaultLoadingView) => (
        <Suspense fallback={fallback}>{content}</Suspense>
    );

    if (isLoading) {
        if (activeTab === 'client') return <>{clientLoadingView}</>;
        if (activeTab === 'estoque') return <>{estoqueLoadingView}</>;
        return <>{defaultLoadingView}</>;
    }

    if (activeTab === 'settings') {
        if (!userInfo) return null;

        return renderDeferred(
            <UserSettingsView
                userInfo={{
                    ...userInfo,
                    organizationId: organizationId || undefined,
                    isOwner
                }}
                onSave={onSaveUserInfo}
                onOpenPaymentMethods={onOpenPaymentMethods}
                onOpenApiKeyModal={onOpenApiKeyModal}
                isPwaInstalled={isInstalled}
                onPromptPwaInstall={onPromptPwaInstall}
                onNavigateToCatalog={() => onTabChange('films')}
            />
        );
    }

    if (activeTab === 'admin') {
        return renderDeferred(<AdminUsers />);
    }

    if (activeTab === 'account') {
        return renderDeferred(<UserAccount />);
    }

    if (activeTab === 'dashboard') {
        return renderDeferred(
            <DashboardView
                allSavedPdfs={allSavedPdfs}
                usePagedPdfData={!hasLoadedAllPdfs}
                onRequireAllPdfs={onRequireAllPdfs}
                useDeferredClientData={!hasLoadedAllClients}
                clientTotalCount={clientTotalCount}
                dormantClientCount={dormantClientCount}
                clients={clients}
                agendamentos={agendamentos}
                films={films}
                onTabChange={onTabChange}
                onOpenAIQuickProposal={onOpenAIQuickProposal}
                onOpenClientModal={onOpenClientModal}
                onCreateProposal={onCreateProposal}
            />,
            defaultLoadingView
        );
    }

    if (activeTab === 'history') {
        return renderDeferred(
            <PdfHistoryView
                pdfs={historyPdfs}
                hasMoreServerPdfs={historyHasMore}
                isLoadingMoreServerPdfs={isHistoryPageLoading}
                onLoadMoreServerPdfs={onLoadMoreHistoryPdfs}
                onEnsureCompleteServerHistory={onEnsureCompleteHistory}
                clients={clients}
                agendamentos={agendamentos}
                films={films}
                googleReviewsLink={userInfo?.socialLinks?.googleReviews}
                onDelete={onDeletePdf}
                onDownload={onDownloadPdf}
                onUpdateStatus={onUpdatePdfStatus}
                onSchedule={onSchedulePdf}
                onOpenInAgenda={(agendamento) => {
                    onTabChange('agenda');
                    onEditAgendamento(agendamento);
                }}
                onGenerateCombinedPdf={onGenerateCombinedPdf}
                onNavigateToOption={onNavigateToOption}
            />,
            defaultLoadingView
        );
    }

    if (activeTab === 'proposals') {
        return renderDeferred(
            <ProposalCenterView onOpenHistory={() => onTabChange('history')} />,
            defaultLoadingView
        );
    }

    if (activeTab === 'agenda') {
        return renderDeferred(
            <AgendaView
                agendamentos={agendamentos}
                pdfs={allSavedPdfs}
                clients={clients}
                onEditAgendamento={onEditAgendamento}
                onUpdateServiceStatus={onUpdateAgendamentoServiceStatus}
                onCompleteAgendamentoWithValue={onCompleteAgendamentoWithValue}
                onContinueAgendamento={onContinueAgendamento}
                onRescheduleAgendamento={onRescheduleAgendamento}
                onCreateNewAgendamento={onCreateNewAgendamento}
                googleReviewsLink={userInfo?.socialLinks?.googleReviews}
                userInfo={userInfo}
            />,
            defaultLoadingView
        );
    }

    if (activeTab === 'films') {
        return renderDeferred(
            <FilmListView
                films={films}
                onAdd={onAddFilm}
                onEdit={onEditFilm}
                onDelete={onDeleteFilm}
                onOpenGallery={onOpenGallery}
            />,
            defaultLoadingView
        );
    }

    if (activeTab === 'estoque') {
        return renderDeferred(
            <FeatureGate
                moduleId="estoque"
                fallback={
                    <PremiumFeatureSection
                        moduleId="estoque"
                        title="Controle de Estoque"
                        description="Organize bobinas, retalhos e consumo com um fluxo premium mais claro e profissional."
                    />
                }
            >
                <EstoqueView
                    films={films}
                    initialAction={initialEstoqueAction}
                    onInitialActionConsumed={onInitialEstoqueActionConsumed}
                    userInfo={userInfo}
                    onOpenApiKeyModal={() => onOpenApiKeyModal('gemini')}
                />
            </FeatureGate>,
            estoqueLoadingView
        );
    }

    if (activeTab === 'fornecedores') {
        return renderDeferred(<FornecedoresView />, defaultLoadingView);
    }

    if (activeTab === 'qr_code') {
        return renderDeferred(
            <FeatureGate
                moduleId="qr_servicos"
                fallback={
                    <PremiumFeatureSection
                        moduleId="qr_servicos"
                        title="QR Code de Servicos"
                        description="Gere etiquetas, entregue garantia e abra uma experiencia publica mais premium para o cliente."
                    />
                }
            >
                <ServicoQrView
                    userInfo={userInfo}
                    films={films}
                    clients={clients}
                    isClientsLoading={isClientsLoading}
                    onTogglePin={onTogglePin}
                    onAddNewClient={onAddNewClient}
                />
            </FeatureGate>,
            defaultLoadingView
        );
    }

    if (activeTab === 'clients_list') {
        return renderDeferred(
            <ClientListView
                clients={hasLoadedAllClients ? clients : clientListClients}
                pdfs={allSavedPdfs}
                isLoading={isClientsLoading || isClientListLoading}
                onOpenClient={onOpenClientFromList}
                onAddClient={() => onOpenClientModal('add')}
                onTogglePin={(id) => onTogglePin?.(id)}
                hasMoreServerClients={!hasLoadedAllClients && clientListHasMore}
                isLoadingMoreClients={isClientListLoading}
                onLoadMoreClients={onLoadMoreClientList}
                onSearchClients={hasLoadedAllClients ? undefined : onSearchClientList}
            />,
            defaultLoadingView
        );
    }

    if (activeTab === 'cliente_hub') {
        const hubClient = clients.find(client => client.id === selectedClientId) ?? null;
        return renderDeferred(
            <ClientHubView
                client={hubClient}
                pdfs={allSavedPdfs}
                agendamentos={agendamentos}
                onNavigateToOption={onNavigateToOption}
                onDownloadPdf={onDownloadPdf}
                onUpdatePdfStatus={onUpdatePdfStatus}
                onEditAgendamento={onEditAgendamento}
                onEditClient={() => onOpenClientModal('edit')}
                onNewProposal={() => onTabChange('client')}
                onBack={onNavigateBack}
            />,
            defaultLoadingView
        );
    }

    if (clients.length === 0) {
        return (
            <div className="space-y-4">
                <ContentState
                    icon={<Users className="h-7 w-7" aria-hidden="true" />}
                    title="Crie seu primeiro cliente"
                    description="Tudo começa com um cliente. Adicione os dados para começar a gerar orçamentos."
                />
                <div className="flex flex-wrap justify-center gap-3">
                    <ActionButton
                        onClick={onOpenAIQuickProposal}
                        variant="primary"
                        size="lg"
                        icon={<Bolt className="h-4 w-4" aria-hidden="true" />}
                    >
                        Proposta rapida com IA
                    </ActionButton>
                    <ActionButton
                        onClick={() => onOpenClientModal('add')}
                        variant="secondary"
                        size="lg"
                        icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    >
                        Adicionar Cliente
                    </ActionButton>
                </div>
            </div>
        );
    }

    if (selectedClientId && measurements.length > 0) {
        return (
            <MeasurementList
                measurements={measurements}
                films={films}
                pricingMode={pricingMode}
                onSelectPricingMode={onSelectPricingMode}
                clientId={selectedClientId}
                optionId={activeOptionId}
                onMeasurementsChange={onMeasurementsChange}
                onPersistMeasurementsChange={onPersistMeasurementsChange}
                onOpenFilmModal={onOpenFilmModal}
                onOpenFilmSelectionModal={onOpenFilmSelectionModal}
                onOpenClearAllModal={onOpenClearAllModal}
                onOpenApplyFilmToAllModal={onOpenApplyFilmToAllModal}
                numpadConfig={numpadConfig}
                onOpenNumpad={onOpenNumpad}
                activeMeasurementId={numpadConfig.measurementId}
                onOpenEditModal={onOpenEditModal}
                onOpenDiscountModal={onOpenDiscountModal}
                swipeDirection={swipeDirection}
                swipeDistance={swipeDistance}
                onDeleteMeasurement={onDeleteMeasurement}
                onDeleteMeasurementImmediate={onDeleteMeasurementImmediate}
                onPasteCopiedMeasurements={onPasteCopiedMeasurements}
                totalM2={totals.totalM2}
                totalQuantity={totals.totalQuantity}
                proposalOptionsSlot={mobileProposalOptionsSlot}
            />
        );
    }

    if (selectedClientId && measurements.length === 0) {
        return (
            <div className="min-h-[380px] opacity-0 animate-fade-in rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
                <div className="grid min-h-[330px] gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
                    <div className="text-center lg:text-left">
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] shadow-[var(--shadow-hairline)] lg:mx-0">
                            <Ruler className="h-8 w-8" aria-hidden="true" />
                        </div>
                        <p className="ui-kicker">Proposta pronta para começar</p>
                        <h3 className="mt-2 text-2xl font-bold leading-tight text-[var(--text-strong)]">Adicione a primeira medida</h3>
                        <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--text-muted)]">
                            Registre largura, altura, quantidade e película para montar o valor do atendimento com mais precisão.
                        </p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                            <ActionButton
                                onClick={onAddMeasurement}
                                variant="primary"
                                size="lg"
                                icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                            >
                                Adicionar Medida
                            </ActionButton>
                            {copiedMeasurementsCount > 0 && onPasteCopiedMeasurements && (
                                <ActionButton
                                    onClick={() => { void onPasteCopiedMeasurements(); }}
                                    variant="secondary"
                                    size="lg"
                                    icon={<ClipboardPaste className="h-4 w-4" aria-hidden="true" />}
                                >
                                    Colar {copiedMeasurementsCount === 1 ? '1 Medida' : `${copiedMeasurementsCount} Medidas`}
                                </ActionButton>
                            )}
                        </div>
                    </div>
                    <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-hairline)]">
                        <p className="ui-kicker">Fluxo recomendado</p>
                        <div className="mt-4 space-y-3">
                            <div className="flex gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                                    <Ruler className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-[var(--text-strong)]">Medidas</p>
                                    <p className="text-xs text-[var(--text-muted)]">Informe dimensoes e quantidade.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-[var(--text-strong)]">IA ou manual</p>
                                    <p className="text-xs text-[var(--text-muted)]">Use IA quando o pedido vier em texto.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    <Bolt className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-[var(--text-strong)]">PDF</p>
                                    <p className="text-xs text-[var(--text-muted)]">Finalize quando os valores estiverem prontos.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="text-center p-8 flex flex-col items-center justify-center h-full min-h-[350px] opacity-0 animate-fade-in rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
            <div className="w-16 h-16 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-[var(--radius-panel)] flex items-center justify-center mb-5 shadow-[var(--shadow-hairline)] text-[var(--text-muted)]">
                <UserCheck className="h-8 w-8" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-strong)] mb-2">Nenhum Cliente Selecionado</h3>
            <p className="text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed text-sm mb-6">
                Escolha um cliente no menu acima para ver suas medidas.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
                <ActionButton
                    onClick={onOpenAIQuickProposal}
                    variant="primary"
                    size="md"
                    icon={<Bolt className="h-4 w-4" aria-hidden="true" />}
                >
                    Proposta rapida com IA
                </ActionButton>
                <ActionButton
                    onClick={() => onOpenClientModal('add')}
                    variant="secondary"
                    size="md"
                    icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                >
                    Adicionar Cliente
                </ActionButton>
            </div>
        </div>
    );
};
