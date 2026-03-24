import React, { ReactNode, Suspense, lazy } from 'react';
import { Client, Film, Agendamento, SavedPDF, UserInfo, UIMeasurement } from '../../../types';
import MeasurementList from '../../../components/MeasurementList';
import { FeatureGate } from '../../../components/subscription/SubscriptionComponents';
import { NumpadConfig } from '../../hooks/useMeasurementEditor';
import ActionButton from '../../../components/ui/ActionButton';
import ContentState from '../../../components/ui/ContentState';

const UserSettingsView = lazy(() => import('../../../components/views/UserSettingsView'));
const PdfHistoryView = lazy(() => import('../../../components/views/PdfHistoryView'));
const FilmListView = lazy(() => import('../../../components/views/FilmListView'));
const AgendaView = lazy(() => import('../../../components/views/AgendaView'));
const EstoqueView = lazy(() => import('../../../components/views/EstoqueView'));
const FornecedoresView = lazy(() => import('../../../components/views/FornecedoresView'));
const AdminUsers = lazy(() => import('../../../components/AdminUsers').then(module => ({ default: module.AdminUsers })));
const UserAccount = lazy(() => import('../../../components/UserAccount').then(module => ({ default: module.UserAccount })));

type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores';

interface AppContentRouterProps {
    activeTab: ActiveTab;
    isLoading: boolean;
    userInfo: UserInfo | null;
    organizationId?: string;
    isOwner: boolean;
    isInstalled: boolean;
    allSavedPdfs: SavedPDF[];
    clients: Client[];
    agendamentos: Agendamento[];
    films: Film[];
    initialEstoqueAction: { action: 'scan', code: string } | null;
    selectedClientId: number | null;
    measurements: UIMeasurement[];
    activeOptionId: number | null;
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
    onCreateNewAgendamento: (date: Date) => void;
    onAddFilm: () => void;
    onEditFilm: (film: Film | null) => void;
    onDeleteFilm: (filmName: string) => void;
    onOpenGallery: (images: string[], initialIndex: number) => void;
    onOpenClientModal: (mode: 'add' | 'edit') => void;
    onAddMeasurement: () => void;
    onOpenLocationImport: () => void;
    onMeasurementsChange: (measurements: UIMeasurement[]) => void;
    onOpenFilmModal: (film: Film | null) => void;
    onOpenFilmSelectionModal: (measurementId: number) => void;
    onOpenClearAllModal: () => void;
    onOpenApplyFilmToAllModal: () => void;
    onOpenNumpad: (measurementId: number, field: 'largura' | 'altura' | 'quantidade', currentValue: string | number) => void;
    onOpenEditModal: (measurement: UIMeasurement) => void;
    onOpenDiscountModal: (measurement: UIMeasurement) => void;
    onDeleteMeasurement: (measurementId: number) => void;
    onDeleteMeasurementImmediate: (id: number) => void;
}

export const AppContentRouter: React.FC<AppContentRouterProps> = ({
    activeTab,
    isLoading,
    userInfo,
    organizationId,
    isOwner,
    isInstalled,
    allSavedPdfs,
    clients,
    agendamentos,
    films,
    initialEstoqueAction,
    selectedClientId,
    measurements,
    activeOptionId,
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
    onCreateNewAgendamento,
    onAddFilm,
    onEditFilm,
    onDeleteFilm,
    onOpenGallery,
    onOpenClientModal,
    onAddMeasurement,
    onOpenLocationImport,
    onMeasurementsChange,
    onOpenFilmModal,
    onOpenFilmSelectionModal,
    onOpenClearAllModal,
    onOpenApplyFilmToAllModal,
    onOpenNumpad,
    onOpenEditModal,
    onOpenDiscountModal,
    onDeleteMeasurement,
    onDeleteMeasurementImmediate
}) => {
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
            />
        );
    }

    if (activeTab === 'admin') {
        return renderDeferred(<AdminUsers />);
    }

    if (activeTab === 'account') {
        return renderDeferred(<UserAccount />);
    }

    if (activeTab === 'history') {
        return renderDeferred(
            <PdfHistoryView
                pdfs={allSavedPdfs}
                clients={clients}
                agendamentos={agendamentos}
                films={films}
                onDelete={onDeletePdf}
                onDownload={onDownloadPdf}
                onUpdateStatus={onUpdatePdfStatus}
                onSchedule={onSchedulePdf}
                onGenerateCombinedPdf={onGenerateCombinedPdf}
                onNavigateToOption={onNavigateToOption}
            />,
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
                onCreateNewAgendamento={onCreateNewAgendamento}
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
            <FeatureGate moduleId="estoque">
                <EstoqueView films={films} initialAction={initialEstoqueAction} />
            </FeatureGate>,
            estoqueLoadingView
        );
    }

    if (activeTab === 'fornecedores') {
        return renderDeferred(<FornecedoresView />, defaultLoadingView);
    }

    if (clients.length === 0) {
        return (
            <div className="space-y-4">
                <ContentState
                    iconClassName="fas fa-users"
                    title="Crie seu primeiro cliente"
                    description="Tudo começa com um cliente. Adicione os dados para começar a gerar orçamentos."
                />
                <div className="flex justify-center">
                    <ActionButton
                        onClick={() => onOpenClientModal('add')}
                        variant="primary"
                        size="lg"
                        iconClassName="fas fa-plus"
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
                clientId={selectedClientId}
                optionId={activeOptionId}
                onMeasurementsChange={onMeasurementsChange}
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
                    Adicione as dimensoes das janelas ou busque medidas de um local conhecido.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={onAddMeasurement}
                        className="w-full px-6 py-3.5 bg-slate-800 dark:bg-slate-700 text-white font-semibold rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-3"
                    >
                        <i className="fas fa-plus text-lg"></i>
                        <span>Adicionar Medida</span>
                    </button>
                    <button
                        onClick={onOpenLocationImport}
                        className="w-full px-6 py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-3"
                    >
                        <i className="fas fa-building text-lg"></i>
                        <span>Buscar por Localizacao</span>
                    </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 max-w-xs">
                    <i className="fas fa-info-circle mr-1"></i>
                    Busque por condominio ou empresa para importar medidas ja cadastradas
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
};
