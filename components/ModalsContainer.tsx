import React, { lazy, Suspense } from 'react';
const ClientModal = lazy(() => import('./modals/ClientModal'));
const ClientSelectionModal = lazy(() => import('./modals/ClientSelectionModal'));
const PaymentMethodsModal = lazy(() => import('./modals/PaymentMethodsModal'));
const FilmModal = lazy(() => import('./modals/FilmModal'));
const ConfirmationModal = lazy(() => import('./modals/ConfirmationModal'));
const FilmSelectionModal = lazy(() => import('./modals/FilmSelectionModal'));
const EditMeasurementModal = lazy(() => import('./modals/EditMeasurementModal'));
const AgendamentoModal = lazy(() => import('./modals/AgendamentoModal'));
const DiscountModal = lazy(() => import('./modals/DiscountModal'));
const GeneralDiscountModal = lazy(() => import('./modals/GeneralDiscountModal'));
const AIMeasurementModal = lazy(() => import('./modals/AIMeasurementModal'));
const AIClientModal = lazy(() => import('./modals/AIClientModal'));
const AIFilmModal = lazy(() => import('./modals/AIFilmModal'));
const AIFilmTableModal = lazy(() => import('./modals/AIFilmTableModal'));
const AIOptionVariationModal = lazy(() => import('./modals/AIOptionVariationModal'));
const OptionVariationReviewModal = lazy(() => import('./modals/OptionVariationReviewModal'));
import type { OptionVariationPlan, OptionVariationRow } from '../src/lib/aiOptionVariation';
const FilmImportReviewModal = lazy(() => import('./modals/FilmImportReviewModal'));
const AIQuickProposalModal = lazy(() => import('./modals/AIQuickProposalModal'));
const AIScheduleModal = lazy(() => import('./modals/AIScheduleModal'));
const ApiKeyModal = lazy(() => import('./modals/ApiKeyModal'));
const PdfGenerationStatusModal = lazy(() => import('./modals/PdfGenerationStatusModal'));
const ImageGalleryModal = lazy(() => import('./modals/ImageGalleryModal'));
import { AIInput, Client, Film, UserInfo, SavedPDF, Agendamento, ProposalOption, QuickClientDraft, SchedulingInfo, ProposalDiscount, MeasurementPriceAdjustment } from '../types';

type UIMeasurement = any; // Temporary - will be properly typed later

interface ModalsContainerProps {
    // Client Modal
    isClientModalOpen: boolean;
    setIsClientModalOpen: (value: boolean) => void;
    setNewClientName: (value: string) => void;
    setAiClientData: (value: Partial<Client> | undefined) => void;
    handleSaveClient: (client: Client) => Promise<void>;
    clientModalMode: 'add' | 'edit';
    selectedClient: Client | null;
    newClientName: string;
    aiClientData: Partial<Client> | undefined;
    handleOpenAIClientModal: () => void;

    // Client Selection Modal
    isClientSelectionModalOpen: boolean;
    setIsClientSelectionModalOpen: (value: boolean) => void;
    clients: Client[];
    setSelectedClientId: (value: number | null) => void;
    isLoading: boolean;
    handleAddNewClientFromSelection: () => void;
    handleToggleClientPin: (clientId: number) => void;

    // Payment Modal
    isPaymentModalOpen: boolean;
    setIsPaymentModalOpen: (value: boolean) => void;
    handleSavePaymentMethods: (methods: any) => void;
    userInfo: UserInfo | null;

    // Film Modal
    isFilmModalOpen: boolean;
    setIsFilmModalOpen: (value: boolean) => void;
    setEditingFilm: (value: Film | null) => void;
    setEditingMeasurementIdForFilm: (value: number | null) => void;
    setNewFilmName: (value: string) => void;
    handleSaveFilm: (film: Film) => Promise<void>;
    handleDeleteFilm: (filmName: string) => void;
    editingFilm: Film | null;
    newFilmName: string;
    aiFilmData: Partial<Film> | undefined;
    duplicatingFilm: Film | null;
    setDuplicatingFilm: (value: Film | null) => void;
    setAiFilmData: (value: Partial<Film> | undefined) => void;
    setIsAIFilmModalOpen: (value: boolean) => void;
    handleOpenAIFilmModal: () => void;

    // Film Selection Modal
    isFilmSelectionModalOpen: boolean;
    setIsFilmSelectionModalOpen: (value: boolean) => void;
    films: Film[];
    handleSelectFilm: (filmName: string) => void;
    handleAddNewFilm: (filmName: string) => void;
    handleEditFilm: (film: Film) => void;
    handleRequestDeleteFilm: (filmName: string) => void;
    handleToggleFilmPin: (filmName: string) => void;

    // Clear All Modal
    isClearAllModalOpen: boolean;
    setIsClearAllModalOpen: (value: boolean) => void;
    handleConfirmClearAll: () => void;

    // Delete Film Modal
    filmToDeleteName: string | null;
    setFilmToDeleteName: (value: string | null) => void;
    handleConfirmDeleteFilm: () => void;
    isDeletingFilm: boolean;

    // Delete Client Modal
    isDeleteClientModalOpen: boolean;
    setIsDeleteClientModalOpen: (value: boolean) => void;
    handleConfirmDeleteClient: () => void;
    isDeletingClient: boolean;

    // Delete PDF Modal
    pdfToDeleteId: number | null;
    setPdfToDeleteId: (value: number | null) => void;
    handleConfirmDeletePdf: () => void;
    isDeletingPdf: boolean;

    // Delete Agendamento Modal
    agendamentoToDelete: Agendamento | null;
    setAgendamentoToDelete: (value: Agendamento | null) => void;
    handleConfirmDeleteAgendamento: () => void;
    isDeletingAgendamento: boolean;

    // Exit Confirm Modal
    isExitConfirmModalOpen: boolean;
    setIsExitConfirmModalOpen: (value: boolean) => void;

    // PDF Generation Status Modal
    pdfGenerationStatus: 'idle' | 'generating' | 'success';
    handleClosePdfStatusModal: () => void;
    handleGoToHistoryFromPdf: () => void;
    handleShareGeneratedPdf: () => Promise<'shared' | 'downloaded' | 'unavailable'>;
    handlePreviewGeneratedPdf: () => boolean;
    canShareGeneratedPdf: boolean;
    canPreviewGeneratedPdf: boolean;
    latestGeneratedProposal: { client: Client; pdf: SavedPDF } | null;
    handleDuplicateFromGeneratedPdf?: () => void;
    generatedClientProposals: SavedPDF[];
    generatedPreselectedPdfKeys: string[];
    handlePreviewProposal: (pdf: SavedPDF) => Promise<boolean>;
    handleShareProposals: (pdfs: SavedPDF[]) => Promise<'shared' | 'downloaded' | 'unavailable'>;
    generatedProposalVersions: Record<string, { total: number; kept: number; locked: boolean }>;
    canDeleteGeneratedProposals: boolean;
    handleDeleteGeneratedProposal: (pdf: SavedPDF) => Promise<{ deleted: number; kept: number; done: Promise<void> }>;
    handleOpenAIVariationFromGeneratedPdf?: () => void;
    isAIVariationModalOpen: boolean;
    handleCancelAIVariation: () => void;
    handleProcessAIVariationInput: (input: AIInput) => Promise<void>;
    optionVariationPlan: OptionVariationPlan | null;
    handleConfirmAIVariation: (rows: OptionVariationRow[], optionName: string) => void;

    // Edit Measurement Modal
    editingMeasurement: UIMeasurement | null;
    setEditingMeasurement: (value: UIMeasurement | null) => void;
    handleSaveMeasurement: (measurement: UIMeasurement) => void;
    handleDeleteMeasurementFromEditModal: () => void;
    handleDuplicateMeasurement: () => void;
    handleOpenFilmSelectionModal: (measurementId: number) => void;
    onOpenLocationImport: () => void;
    numpadConfig: any;
    editingMeasurementForDiscount: UIMeasurement | null;
    editingMeasurementBasePrice: number;
    handleCloseDiscountModal: () => void;
    handleSaveDiscount: (adjustment: MeasurementPriceAdjustment) => void;
    generalDiscount: ProposalDiscount;
    handleSaveGeneralDiscount: (discount: ProposalDiscount) => void;
    isGeneralDiscountModalOpen: boolean;
    setIsGeneralDiscountModalOpen: (value: boolean) => void;

    // AI Measurement Modal
    isAIMeasurementModalOpen: boolean;
    setIsAIMeasurementModalOpen: (value: boolean) => void;
    handleProcessAIMeasurementInput: (input: any) => Promise<void>;
    isProcessingAI: boolean;

    // AI Quick Proposal Modal
    isAIQuickProposalModalOpen: boolean;
    setIsAIQuickProposalModalOpen: (value: boolean) => void;
    handleProcessAIQuickProposalInput: (input: any) => Promise<void>;

    // AI Client Modal
    isAIClientModalOpen: boolean;
    setIsAIClientModalOpen: (value: boolean) => void;
    handleProcessAIClientInput: (input: any) => void;

    // AI Film Modal
    isAIFilmModalOpen: boolean;
    handleProcessAIFilmInput: (input: any) => void;
    isAIFilmTableModalOpen: boolean;
    setIsAIFilmTableModalOpen: (value: boolean) => void;
    handleProcessAIFilmTableInput: (input: any) => Promise<void>;
    filmImportCandidates: Partial<Film>[] | null;
    setFilmImportCandidates: (value: Partial<Film>[] | null) => void;
    handleSaveFilms: (films: Film[]) => Promise<void>;
    handleDeleteFilms: (filmNames: string[]) => Promise<void>;

    // AI Schedule Modal (agendamento por voz)
    isAIScheduleModalOpen: boolean;
    setIsAIScheduleModalOpen: (value: boolean) => void;
    handleProcessAIScheduleInput: (input: AIInput) => Promise<void>;
    scheduleAutoSave: boolean;
    handleToggleScheduleAutoSave: (enabled: boolean) => void;
    scheduleVoiceClient: Client | null;

    // API Key Modal
    isApiKeyModalOpen: boolean;
    setIsApiKeyModalOpen: (value: boolean) => void;
    handleSaveApiKey: (key: string) => void;
    handleDeleteApiKey: () => void;
    apiKeyModalProvider: 'gemini';

    // Image Gallery Modal
    isGalleryOpen: boolean;
    handleCloseGallery: () => void;
    galleryImages: string[];
    galleryInitialIndex: number;

    // Agendamento Modal
    schedulingInfo: SchedulingInfo | null;
    setSchedulingInfo: (value: SchedulingInfo | null) => void;
    handleSaveAgendamento: (agendamento: Partial<Agendamento> | Array<Partial<Agendamento>>) => Promise<void>;
    handleConfirmAgendamento: (clientId: number) => void;
    handleRequestDeleteAgendamento: (agendamento: Agendamento) => void;
    handleAddNewClientFromAgendamento: (clientName: string) => void;
    handleSaveClientFromAgendamento: (client: Omit<Client, 'id'> | Client) => Promise<Client>;
    handleCreateQuickClient: (values: { nome: string; local: string }, draft?: QuickClientDraft) => Promise<Client>;
    allSavedPdfs: SavedPDF[];
    agendamentos: Agendamento[];

    // Save Before PDF Modal
    isSaveBeforePdfModalOpen: boolean;
    setIsSaveBeforePdfModalOpen: (value: boolean) => void;
    handleConfirmSaveBeforePdf: () => Promise<void>;
    isSavingBeforePdf: boolean;

    // Apply Film to All Modal
    isApplyFilmToAllModalOpen: boolean;
    setIsApplyFilmToAllModalOpen: (value: boolean) => void;
    handleConfirmApplyFilmToAll: () => void;
    filmToApplyToAll: string | null;
    handleApplyFilmToAll: (filmName: string | null) => void;

    // Duplicate All Modal
    isDuplicateAllModalOpen: boolean;
    setIsDuplicateAllModalOpen: (value: boolean) => void;
    handleConfirmDuplicateAll: () => void;
    handleDuplicateWithFilm: (filmName: string) => void;
    handleOpenDuplicateFilmSelector: () => void;
    isDuplicateFilmSelectorOpen: boolean;
    setIsDuplicateFilmSelectorOpen: (value: boolean) => void;
    handleCloseDuplicateFilmSelector: () => void;
    handleSelectFilmForDuplicate: (filmName: string) => void;
    activeOption: ProposalOption | null;

    // Measurement Delete Modal
    measurementToDeleteId: number | null;
    setMeasurementToDeleteId: (value: number | null) => void;
    handleConfirmDeleteIndividualMeasurement: () => void;
    measurementToDelete: UIMeasurement | null;
    isDeletingMeasurement: boolean;

    // Delete Proposal Option Modal
    isDeleteProposalOptionModalOpen: boolean;
    setIsDeleteProposalOptionModalOpen: (value: boolean) => void;
    handleConfirmDeleteProposalOption: () => void;
    proposalOptionToDeleteName: string | null;
    isDeletingProposalOption: boolean;
}

export const ModalsContainer: React.FC<ModalsContainerProps> = (props) => {
    return (
        <Suspense fallback={null}>
        <>
            {/* Client Modal */}
            {props.isClientModalOpen && (
                <ClientModal
                    isOpen={props.isClientModalOpen}
                    onClose={() => {
                        props.setIsClientModalOpen(false);
                        props.setNewClientName('');
                        props.setAiClientData(undefined);
                    }}
                    onSave={props.handleSaveClient}
                    mode={props.clientModalMode}
                    client={props.clientModalMode === 'edit' ? props.selectedClient : null}
                    initialName={props.newClientName}
                    aiData={props.aiClientData}
                    onOpenAIModal={props.handleOpenAIClientModal}
                />
            )}

            {/* Client Selection Modal */}
            {props.isClientSelectionModalOpen && (
                <ClientSelectionModal
                    isOpen={props.isClientSelectionModalOpen}
                    onClose={() => props.setIsClientSelectionModalOpen(false)}
                    clients={props.clients}
                    onClientSelect={props.setSelectedClientId}
                    isLoading={props.isLoading}
                    onAddNewClient={props.handleAddNewClientFromSelection}
                    onTogglePin={props.handleToggleClientPin}
                    savedPdfs={props.allSavedPdfs}
                />
            )}

            {/* Payment Modal */}
            {props.isPaymentModalOpen && props.userInfo && (
                <PaymentMethodsModal
                    isOpen={props.isPaymentModalOpen}
                    onClose={() => props.setIsPaymentModalOpen(false)}
                    onSave={props.handleSavePaymentMethods}
                    paymentMethods={props.userInfo.payment_methods}
                />
            )}

            {/* Film Modal */}
            {props.isFilmModalOpen && (
                <FilmModal
                    isOpen={props.isFilmModalOpen}
                    onClose={() => {
                        props.setIsFilmModalOpen(false);
                        props.setEditingFilm(null);
                        props.setEditingMeasurementIdForFilm(null);
                        props.setNewFilmName('');
                        props.setAiFilmData(undefined);
                        props.setDuplicatingFilm(null);
                    }}
                    onSave={props.handleSaveFilm}
                    onDelete={props.handleDeleteFilm}
                    film={props.editingFilm}
                    films={props.films}
                    initialName={props.newFilmName}
                    aiData={props.aiFilmData}
                    duplicateData={props.duplicatingFilm}
                    onOpenAIModal={props.handleOpenAIFilmModal}
                />
            )}

            {/* Film Selection Modal */}
            {props.isFilmSelectionModalOpen && (
                <FilmSelectionModal
                    isOpen={props.isFilmSelectionModalOpen}
                    onClose={() => props.setIsFilmSelectionModalOpen(false)}
                    films={props.films}
                    onSelect={props.handleSelectFilm}
                    onAddNewFilm={props.handleAddNewFilm}
                    onEditFilm={props.handleEditFilm}
                    onDeleteFilm={props.handleRequestDeleteFilm}
                    onTogglePin={props.handleToggleFilmPin}
                />
            )}

            {/* Clear All Confirmation Modal */}
            {props.isClearAllModalOpen && (
                <ConfirmationModal
                    isOpen={props.isClearAllModalOpen}
                    onClose={() => props.setIsClearAllModalOpen(false)}
                    onConfirm={props.handleConfirmClearAll}
                    title="Limpar Todas as Medidas"
                    message="Tem certeza que deseja apagar todas as medidas? Esta ação não pode ser desfeita."
                    confirmButtonText="Sim, Limpar Tudo"
                    confirmButtonVariant="danger"
                />
            )}

            {/* Delete Film Confirmation Modal */}
            {props.filmToDeleteName && (
                <ConfirmationModal
                    isOpen={!!props.filmToDeleteName}
                    onClose={() => props.setFilmToDeleteName(null)}
                    onConfirm={props.handleConfirmDeleteFilm}
                    title="Confirmar Exclusão de Película"
                    message={`Tem certeza que deseja excluir a película "${props.filmToDeleteName}"? Esta ação não pode ser desfeita.`}
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                    isProcessing={props.isDeletingFilm}
                    processingText="Excluindo..."
                />
            )}

            {/* Edit Measurement Modal */}
            {props.editingMeasurement && (
                <EditMeasurementModal
                    isOpen={!!props.editingMeasurement}
                    onClose={() => props.setEditingMeasurement(null)}
                    onSave={props.handleSaveMeasurement}
                    measurement={props.editingMeasurement}
                    films={props.films}
                    onUpdate={(updated) => props.handleSaveMeasurement({ ...props.editingMeasurement!, ...updated })}
                    onDelete={props.handleDeleteMeasurementFromEditModal}
                    onDuplicate={props.handleDuplicateMeasurement}
                    onOpenFilmModal={props.handleOpenFilmModal}
                    onOpenFilmSelectionModal={props.handleOpenFilmSelectionModal}
                    numpadConfig={props.numpadConfig}
                    onOpenNumpad={props.handleOpenNumpad}
                    userInfo={props.userInfo}
                    onOpenLocationImport={props.onOpenLocationImport}
                />
            )}

            {/* Agendamento Modal */}
            {props.schedulingInfo && (
                <AgendamentoModal
                    isOpen={!!props.schedulingInfo}
                    onClose={() => props.setSchedulingInfo(null)}
                    onSave={props.handleSaveAgendamento}
                    onDelete={props.handleRequestDeleteAgendamento}
                    schedulingInfo={props.schedulingInfo}
                    clients={props.clients}
                    savedPdfs={props.allSavedPdfs}
                    onAddNewClient={props.handleAddNewClientFromAgendamento}
                    onSaveClient={props.handleSaveClientFromAgendamento}
                    onCreateQuickClient={props.handleCreateQuickClient}
                    userInfo={props.userInfo}
                    agendamentos={props.agendamentos}
                />
            )}

            {/* Save Before PDF Modal */}
            {props.isSaveBeforePdfModalOpen && (
                <ConfirmationModal
                    isOpen={props.isSaveBeforePdfModalOpen}
                    onClose={() => props.setIsSaveBeforePdfModalOpen(false)}
                    onConfirm={props.handleConfirmSaveBeforePdf}
                    title="Orçamento ainda não salvo"
                    message="Existem alterações recentes neste orçamento. Deseja salvá-las e gerar o PDF agora?"
                    confirmButtonText="Salvar e Gerar PDF"
                    cancelButtonText="Cancelar"
                    isProcessing={props.isSavingBeforePdf}
                    processingText="Salvando orçamento..."
                />
            )}

            {/* Apply Film to All Modal - Selector */}
            {props.isApplyFilmToAllModalOpen && (
                <FilmSelectionModal
                    isOpen={props.isApplyFilmToAllModalOpen}
                    onClose={() => props.setIsApplyFilmToAllModalOpen(false)}
                    films={props.films}
                    onSelect={(filmName) => props.handleApplyFilmToAll(filmName)}
                    onAddNewFilm={props.handleAddNewFilm}
                    onEditFilm={props.handleEditFilm}
                    onDeleteFilm={props.handleRequestDeleteFilm}
                    onTogglePin={props.handleToggleFilmPin}
                />
            )}

            {/* Duplicar Opcao - Seletor de pelicula (quando nao ha favoritas) */}
            {props.isDuplicateFilmSelectorOpen && (
                <FilmSelectionModal
                    isOpen={props.isDuplicateFilmSelectorOpen}
                    onClose={props.handleCloseDuplicateFilmSelector}
                    films={props.films}
                    onSelect={(filmName) => props.handleSelectFilmForDuplicate(filmName)}
                    onAddNewFilm={props.handleAddNewFilm}
                    onEditFilm={props.handleEditFilm}
                    onDeleteFilm={props.handleRequestDeleteFilm}
                    onTogglePin={props.handleToggleFilmPin}
                />
            )}

            {/* Delete Client Confirmation Modal */}
            {props.isDeleteClientModalOpen && (
                <ConfirmationModal
                    isOpen={props.isDeleteClientModalOpen}
                    onClose={() => props.setIsDeleteClientModalOpen(false)}
                    onConfirm={props.handleConfirmDeleteClient}
                    title="Confirmar Exclusão de Cliente"
                    message={
                        <>
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <i className="fas fa-exclamation-triangle text-red-500 h-5 w-5" aria-hidden="true"></i>
                                </div>
                                <div className="ml-3">
                                    <p>
                                        Todas as suas medidas, opções de proposta e histórico de orçamentos (PDFs) serão <strong>perdidos permanentemente</strong>. Esta ação não pode ser desfeita.
                                    </p>
                                </div>
                            </div>
                        </>
                    }
                    confirmButtonText="Sim, Excluir Cliente"
                    confirmButtonVariant="danger"
                    isProcessing={props.isDeletingClient}
                    processingText="Excluindo..."
                />
            )}

            {/* Delete PDF Confirmation Modal */}
            {props.pdfToDeleteId !== null && (
                <ConfirmationModal
                    isOpen={props.pdfToDeleteId !== null}
                    onClose={() => props.setPdfToDeleteId(null)}
                    onConfirm={props.handleConfirmDeletePdf}
                    title="Confirmar Exclusão de Orçamento"
                    message="Tem certeza que deseja apagar este orçamento do histórico? Esta ação não pode ser desfeita."
                    confirmButtonText="Sim, Excluir"
                    confirmButtonVariant="danger"
                    isProcessing={props.isDeletingPdf}
                    processingText="Excluindo..."
                />
            )}

            {/* Delete Agendamento Confirmation Modal */}
            {props.agendamentoToDelete && (
                <ConfirmationModal
                    isOpen={!!props.agendamentoToDelete}
                    onClose={() => props.setAgendamentoToDelete(null)}
                    onConfirm={props.handleConfirmDeleteAgendamento}
                    title="Confirmar Exclusão"
                    message={
                        <>
                            Tem certeza que deseja apagar o agendamento para <strong>{props.agendamentoToDelete.clienteNome}</strong> em <strong>{new Date(props.agendamentoToDelete.start).toLocaleDateString('pt-BR')}</strong>?
                        </>
                    }
                    confirmButtonText="Sim, Excluir Agendamento"
                    confirmButtonVariant="danger"
                    isProcessing={props.isDeletingAgendamento}
                    processingText="Excluindo..."
                />
            )}

            {/* Exit Confirmation Modal */}
            {props.isExitConfirmModalOpen && (
                <ConfirmationModal
                    isOpen={props.isExitConfirmModalOpen}
                    onClose={() => props.setIsExitConfirmModalOpen(false)}
                    onConfirm={() => {
                        props.setIsExitConfirmModalOpen(false);
                        window.history.back();
                    }}
                    title="Sair do Aplicativo"
                    message="Tem certeza que deseja sair do aplicativo?"
                    confirmButtonText="Sim, Sair"
                    cancelButtonText="Cancelar"
                />
            )}

            {/* PDF Generation Status Modal */}
            {props.pdfGenerationStatus !== 'idle' && (
                <PdfGenerationStatusModal
                    status={props.pdfGenerationStatus as 'generating' | 'success'}
                    onClose={props.handleClosePdfStatusModal}
                    onGoToHistory={props.handleGoToHistoryFromPdf}
                    onShare={props.handleShareGeneratedPdf}
                    onPreview={props.handlePreviewGeneratedPdf}
                    canShare={props.canShareGeneratedPdf}
                    canPreview={props.canPreviewGeneratedPdf}
                    proposalForLink={props.latestGeneratedProposal}
                    onDuplicateWithFilm={props.handleDuplicateFromGeneratedPdf}
                    onDuplicateWithAI={props.handleOpenAIVariationFromGeneratedPdf}
                    clientProposals={props.generatedClientProposals}
                    preselectedPdfKeys={props.generatedPreselectedPdfKeys}
                    onPreviewProposal={props.handlePreviewProposal}
                    onShareProposals={props.handleShareProposals}
                    onDeleteProposal={props.handleDeleteGeneratedProposal}
                    proposalVersions={props.generatedProposalVersions}
                    canDeleteProposals={props.canDeleteGeneratedProposals}
                />
            )}

            {/* Duplicar com IA: pedido e conferência das trocas */}
            {props.isAIVariationModalOpen && (
                <AIOptionVariationModal
                    isOpen={props.isAIVariationModalOpen}
                    onClose={props.handleCancelAIVariation}
                    onProcess={props.handleProcessAIVariationInput}
                    isProcessing={props.isProcessingAI}
                    provider={props.userInfo?.aiConfig?.provider || 'gemini'}
                />
            )}
            {props.optionVariationPlan && (
                <OptionVariationReviewModal
                    plan={props.optionVariationPlan}
                    films={props.films}
                    onCancel={props.handleCancelAIVariation}
                    onConfirm={props.handleConfirmAIVariation}
                />
            )}

            {/* Discount Modal */}
            {props.editingMeasurementForDiscount && (
                <DiscountModal
                    isOpen={!!props.editingMeasurementForDiscount}
                    onClose={props.handleCloseDiscountModal}
                    onSave={props.handleSaveDiscount}
                    initialAdjustment={props.editingMeasurementForDiscount.discount}
                    basePrice={props.editingMeasurementBasePrice}
                />
            )}

            {/* General Discount Modal */}
            {props.isGeneralDiscountModalOpen && (
                <GeneralDiscountModal
                    isOpen={props.isGeneralDiscountModalOpen}
                    onClose={() => props.setIsGeneralDiscountModalOpen(false)}
                    onSave={props.handleSaveGeneralDiscount}
                    initialDiscount={props.generalDiscount}
                    initialValue={props.generalDiscount.value}
                    initialType={props.generalDiscount.type}
                    initialOperation={props.generalDiscount.operation}
                />
            )}

            {/* AI Measurement Modal */}
            {props.isAIMeasurementModalOpen && (
                <AIMeasurementModal
                    isOpen={props.isAIMeasurementModalOpen}
                    onClose={() => props.setIsAIMeasurementModalOpen(false)}
                    onProcess={props.handleProcessAIMeasurementInput}
                    isProcessing={props.isProcessingAI}
                    provider={props.userInfo?.aiConfig?.provider || 'gemini'}
                />
            )}

            {/* AI Quick Proposal Modal */}
            {props.isAIQuickProposalModalOpen && (
                <AIQuickProposalModal
                    isOpen={props.isAIQuickProposalModalOpen}
                    onClose={() => props.setIsAIQuickProposalModalOpen(false)}
                    onProcess={props.handleProcessAIQuickProposalInput}
                    isProcessing={props.isProcessingAI}
                    provider={props.userInfo?.aiConfig?.provider || 'gemini'}
                />
            )}

            {/* AI Schedule Modal */}
            {props.isAIScheduleModalOpen && (
                <AIScheduleModal
                    isOpen={props.isAIScheduleModalOpen}
                    onClose={() => props.setIsAIScheduleModalOpen(false)}
                    onProcess={props.handleProcessAIScheduleInput}
                    isProcessing={props.isProcessingAI}
                    provider={props.userInfo?.aiConfig?.provider || 'gemini'}
                    autoSave={props.scheduleAutoSave}
                    onToggleAutoSave={props.handleToggleScheduleAutoSave}
                    client={props.scheduleVoiceClient}
                />
            )}

            {/* AI Client Modal */}
            {props.isAIClientModalOpen && (
                <AIClientModal
                    isOpen={props.isAIClientModalOpen}
                    onClose={() => props.setIsAIClientModalOpen(false)}
                    onProcess={props.handleProcessAIClientInput}
                    isProcessing={props.isProcessingAI}
                    provider={props.userInfo?.aiConfig?.provider || 'gemini'}
                />
            )}

            {/* AI Film Modal */}
            {props.isAIFilmModalOpen && (
                <AIFilmModal
                    isOpen={props.isAIFilmModalOpen}
                    onClose={() => props.setIsAIFilmModalOpen(false)}
                    onProcess={props.handleProcessAIFilmInput}
                    isProcessing={props.isProcessingAI}
                    provider={props.userInfo?.aiConfig?.provider || 'gemini'}
                />
            )}

            {/* Importar tabela do fornecedor: leitura com IA e revisão */}
            {props.isAIFilmTableModalOpen && (
                <AIFilmTableModal
                    isOpen={props.isAIFilmTableModalOpen}
                    onClose={() => props.setIsAIFilmTableModalOpen(false)}
                    onProcess={props.handleProcessAIFilmTableInput}
                    isProcessing={props.isProcessingAI}
                    provider={props.userInfo?.aiConfig?.provider || 'gemini'}
                />
            )}
            {props.filmImportCandidates && (
                <FilmImportReviewModal
                    candidates={props.filmImportCandidates}
                    films={props.films}
                    onClose={() => props.setFilmImportCandidates(null)}
                    onSaveFilms={props.handleSaveFilms}
                    onDeleteFilms={props.handleDeleteFilms}
                />
            )}

            {/* API Key Modal */}
            {props.isApiKeyModalOpen && props.userInfo && (
                <ApiKeyModal
                    isOpen={props.isApiKeyModalOpen}
                    onClose={() => props.setIsApiKeyModalOpen(false)}
                    onSave={props.handleSaveApiKey}
                    onDelete={props.handleDeleteApiKey}
                    currentApiKey={props.userInfo.aiConfig?.provider === props.apiKeyModalProvider ? props.userInfo.aiConfig?.apiKey : ''}
                    provider={props.apiKeyModalProvider}
                />
            )}

            {/* Image Gallery Modal */}
            {props.isGalleryOpen && (
                <ImageGalleryModal
                    isOpen={props.isGalleryOpen}
                    onClose={props.handleCloseGallery}
                    images={props.galleryImages}
                    initialIndex={props.galleryInitialIndex}
                />
            )}

            {/* Duplicate All Modal */}
            {props.isDuplicateAllModalOpen && props.activeOption && (
                <ConfirmationModal
                    isOpen={props.isDuplicateAllModalOpen}
                    onClose={() => props.setIsDuplicateAllModalOpen(false)}
                    onConfirm={props.handleConfirmDuplicateAll}
                    title="Duplicar Opção de Proposta"
                    message={
                        <>
                            <p className="text-slate-700 dark:text-slate-300">
                                Você está prestes a duplicar a opção atual "<strong>{props.activeOption.name}</strong>" ({props.activeOption.measurements.length} medidas) e criar uma nova opção de proposta.
                            </p>

                            {(() => {
                                const pinnedFilms = props.films.filter(film => film.pinned);
                                return (
                                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                                            Já aplicar película em todos os grupos
                                        </p>
                                        {pinnedFilms.length > 0 ? (
                                            <>
                                                <div className="flex flex-wrap gap-2">
                                                    {pinnedFilms.map(film => (
                                                        <button
                                                            key={film.nome}
                                                            type="button"
                                                            onClick={() => props.handleDuplicateWithFilm(film.nome)}
                                                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-all active:scale-95 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300"
                                                        >
                                                            <i className="fas fa-star text-[10px] text-amber-400" aria-hidden="true" />
                                                            <span className="truncate">{film.nome}</span>
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={props.handleOpenDuplicateFilmSelector}
                                                        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-500 transition-all active:scale-95 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
                                                    >
                                                        <i className="fas fa-layer-group text-[10px]" aria-hidden="true" />
                                                        <span>Outra película</span>
                                                    </button>
                                                </div>
                                                <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                                                    Toque numa película para duplicar já trocando o material de todos os grupos.
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={props.handleOpenDuplicateFilmSelector}
                                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 transition-all active:scale-95 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300"
                                                >
                                                    <i className="fas fa-layer-group text-xs" aria-hidden="true" />
                                                    <span>Escolher película e duplicar</span>
                                                </button>
                                                <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                                                    Fixe (📌) suas películas mais usadas para que apareçam aqui como atalho.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}

                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                                Ou apenas duplique mantendo as películas atuais.
                            </p>
                        </>
                    }
                    confirmButtonText="Duplicar mantendo películas"
                />
            )}

            {/* Delete Measurement Confirmation Modal */}
            {props.measurementToDeleteId !== null && props.measurementToDelete && (
                <ConfirmationModal
                    isOpen={props.measurementToDeleteId !== null}
                    onClose={() => props.setMeasurementToDeleteId(null)}
                    onConfirm={props.handleConfirmDeleteIndividualMeasurement}
                    title="Confirmar Exclusão de Medida"
                    message={`Tem certeza que deseja excluir a medida "${props.measurementToDelete.local}"? Esta ação não pode ser desfeita.`}
                    confirmButtonText="Sim, Excluir Medida"
                    confirmButtonVariant="danger"
                    isProcessing={props.isDeletingMeasurement}
                    processingText="Excluindo..."
                />
            )}
            {/* Delete Proposal Option Confirmation Modal */}
            {props.isDeleteProposalOptionModalOpen && (
                <ConfirmationModal
                    isOpen={props.isDeleteProposalOptionModalOpen}
                    onClose={() => props.setIsDeleteProposalOptionModalOpen(false)}
                    onConfirm={props.handleConfirmDeleteProposalOption}
                    title="Excluir Opção de Proposta"
                    message={`Tem certeza que deseja excluir a opção "${props.proposalOptionToDeleteName || ''}"? Esta ação não pode ser desfeita.`}
                    confirmButtonText="Sim, Excluir Opção"
                    confirmButtonVariant="danger"
                    isProcessing={props.isDeletingProposalOption}
                    processingText="Excluindo..."
                />
            )}
        </>
        </Suspense>
    );
};
