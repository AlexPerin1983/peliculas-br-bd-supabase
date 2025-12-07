import React from 'react';
import ClientModal from './modals/ClientModal';
import ClientSelectionModal from './modals/ClientSelectionModal';
import PaymentMethodsModal from './modals/PaymentMethodsModal';
import FilmModal from './modals/FilmModal';
import ConfirmationModal from './modals/ConfirmationModal';
import FilmSelectionModal from './modals/FilmSelectionModal';
import EditMeasurementModal from './modals/EditMeasurementModal';
import InfoModal from './modals/InfoModal';
import AgendamentoModal from './modals/AgendamentoModal';
import DiscountModal from './modals/DiscountModal';
import GeneralDiscountModal from './modals/GeneralDiscountModal';
import AIMeasurementModal from './modals/AIMeasurementModal';
import AIClientModal from './modals/AIClientModal';
import AIFilmModal from './modals/AIFilmModal';
import ApiKeyModal from './modals/ApiKeyModal';
import PdfGenerationStatusModal from './modals/PdfGenerationStatusModal';
import ImageGalleryModal from './modals/ImageGalleryModal';
import { Client, Film, UserInfo, SavedPDF, Agendamento, ProposalOption, SchedulingInfo } from '../types';

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
    setAiFilmData: (value: Partial<Film> | undefined) => void;
    setIsAIFilmModalOpen: (value: boolean) => void;

    // Film Selection Modal
    isFilmSelectionModalOpen: boolean;
    setIsFilmSelectionModalOpen: (value: boolean) => void;
    films: Film[];
    handleSelectFilm: (filmName: string) => void;
    handleAddNewFilm: (filmName: string) => void;
    handleEditFilm: (film: Film) => void;
    handleRequestDeleteFilm: (filmName: string) => void;
    handleToggleFilmPin: (filmId: number) => void;

    // Clear All Modal
    isClearAllModalOpen: boolean;
    setIsClearAllModalOpen: (value: boolean) => void;
    handleConfirmClearAll: () => void;

    // Delete Film Modal
    filmToDeleteName: string | null;
    setFilmToDeleteName: (value: string | null) => void;
    handleConfirmDeleteFilm: () => void;

    // Delete Client Modal
    isDeleteClientModalOpen: boolean;
    setIsDeleteClientModalOpen: (value: boolean) => void;
    handleConfirmDeleteClient: () => void;

    // Delete PDF Modal
    pdfToDeleteId: number | null;
    setPdfToDeleteId: (value: number | null) => void;
    handleConfirmDeletePdf: () => void;

    // Delete Agendamento Modal
    agendamentoToDelete: Agendamento | null;
    setAgendamentoToDelete: (value: Agendamento | null) => void;
    handleConfirmDeleteAgendamento: () => void;

    // Exit Confirm Modal
    isExitConfirmModalOpen: boolean;
    setIsExitConfirmModalOpen: (value: boolean) => void;

    // PDF Generation Status Modal
    pdfGenerationStatus: 'idle' | 'generating' | 'success';
    handleClosePdfStatusModal: () => void;
    handleGoToHistoryFromPdf: () => void;

    // Edit Measurement Modal
    editingMeasurement: UIMeasurement | null;
    setEditingMeasurement: (value: UIMeasurement | null) => void;
    handleSaveMeasurement: (measurement: UIMeasurement) => void;
    handleDeleteMeasurementFromEditModal: () => void;
    handleDuplicateMeasurement: () => void;
    handleOpenFilmSelectionModal: (measurementId: number) => void;
    numpadConfig: any;
    generalDiscount: { value: number; type: 'percentage' | 'value' };

    // AI Measurement Modal
    isAIMeasurementModalOpen: boolean;
    setIsAIMeasurementModalOpen: (value: boolean) => void;
    handleProcessAIInput: (input: any) => void;
    isProcessingAI: boolean;

    // AI Client Modal
    isAIClientModalOpen: boolean;
    setIsAIClientModalOpen: (value: boolean) => void;
    handleProcessAIClientInput: (input: any) => void;

    // AI Film Modal
    isAIFilmModalOpen: boolean;
    handleProcessAIFilmInput: (input: any) => void;

    // API Key Modal
    isApiKeyModalOpen: boolean;
    setIsApiKeyModalOpen: (value: boolean) => void;
    handleSaveApiKey: (key: string) => void;
    apiKeyModalProvider: 'gemini' | 'openai';

    // Image Gallery Modal
    isGalleryOpen: boolean;
    handleCloseGallery: () => void;
    galleryImages: string[];
    galleryInitialIndex: number;

    // Agendamento Modal
    schedulingInfo: SchedulingInfo | null;
    setSchedulingInfo: (value: SchedulingInfo | null) => void;
    handleSaveAgendamento: (agendamento: Partial<Agendamento>) => Promise<void>;
    handleConfirmAgendamento: (clientId: number) => void;
    handleRequestDeleteAgendamento: (agendamento: Agendamento) => void;
    handleAddNewClientFromAgendamento: (clientName: string) => void;
    allSavedPdfs: SavedPDF[];
    agendamentos: Agendamento[];

    // Info Modal
    infoModalConfig: { isOpen: boolean; title: string; message: string };
    setInfoModalConfig: (value: { isOpen: boolean; title: string; message: string }) => void;

    // Save Before PDF Modal
    isSaveBeforePdfModalOpen: boolean;
    setIsSaveBeforePdfModalOpen: (value: boolean) => void;
    handleSaveClientAndGeneratePdf: () => void;

    // Apply Film to All Modal
    isApplyFilmToAllModalOpen: boolean;
    setIsApplyFilmToAllModalOpen: (value: boolean) => void;
    handleConfirmApplyFilmToAll: () => void;
    filmToApplyToAll: string | null;

    // Duplicate All Modal
    isDuplicateAllModalOpen: boolean;
    setIsDuplicateAllModalOpen: (value: boolean) => void;
    handleConfirmDuplicateAll: () => void;
    activeOption: ProposalOption | null;

    // Measurement Delete Modal
    measurementToDeleteId: number | null;
    setMeasurementToDeleteId: (value: number | null) => void;
    handleConfirmDeleteIndividualMeasurement: () => void;
    measurementToDelete: UIMeasurement | null;

    // Delete Proposal Option Modal
    isDeleteProposalOptionModalOpen: boolean;
    setIsDeleteProposalOptionModalOpen: (value: boolean) => void;
    handleConfirmDeleteProposalOption: () => void;
    proposalOptionToDeleteName: string | null;
}

export const ModalsContainer: React.FC<ModalsContainerProps> = (props) => {
    return (
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
                    }}
                    onSave={props.handleSaveFilm}
                    onDelete={props.handleDeleteFilm}
                    film={props.editingFilm}
                    initialName={props.newFilmName}
                    aiData={props.aiFilmData}
                    onOpenAIModal={() => props.setIsAIFilmModalOpen(true)}
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
                    onAddNewClient={props.handleAddNewClientFromAgendamento}
                    userInfo={props.userInfo}
                    agendamentos={props.agendamentos}
                />
            )}

            {/* Info Modal */}
            {props.infoModalConfig.isOpen && (
                <InfoModal
                    isOpen={props.infoModalConfig.isOpen}
                    onClose={() => props.setInfoModalConfig({ isOpen: false, title: '', message: '' })}
                    title={props.infoModalConfig.title}
                    message={props.infoModalConfig.message}
                />
            )}

            {/* Save Before PDF Modal */}
            {props.isSaveBeforePdfModalOpen && (
                <ConfirmationModal
                    isOpen={props.isSaveBeforePdfModalOpen}
                    onClose={() => props.setIsSaveBeforePdfModalOpen(false)}
                    onConfirm={props.handleSaveClientAndGeneratePdf}
                    title="Cliente Não Salvo"
                    message="Você precisa salvar o cliente antes de gerar o PDF. Deseja salvar agora?"
                    confirmButtonText="Sim, Salvar e Gerar PDF"
                    cancelButtonText="Cancelar"
                />
            )}

            {/* Apply Film to All Modal */}
            {props.isApplyFilmToAllModalOpen && props.filmToApplyToAll && (
                <ConfirmationModal
                    isOpen={props.isApplyFilmToAllModalOpen}
                    onClose={() => props.setIsApplyFilmToAllModalOpen(false)}
                    onConfirm={props.handleConfirmApplyFilmToAll}
                    title="Aplicar Película a Todas as Medidas"
                    message={`Deseja aplicar a película "${props.filmToApplyToAll}" a todas as medidas desta opção de proposta?`}
                    confirmButtonText="Sim, Aplicar a Todas"
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
                />
            )}

            {/* Discount Modal */}
            {props.editingMeasurementForDiscount && (
                <DiscountModal
                    isOpen={!!props.editingMeasurementForDiscount}
                    onClose={props.handleCloseDiscountModal}
                    onSave={props.handleSaveDiscount}
                    initialValue={props.editingMeasurementForDiscount.discount?.value}
                    initialType={props.editingMeasurementForDiscount.discount?.type}
                    basePrice={props.editingMeasurementBasePrice}
                />
            )}

            {/* General Discount Modal */}
            {props.isGeneralDiscountModalOpen && (
                <GeneralDiscountModal
                    isOpen={props.isGeneralDiscountModalOpen}
                    onClose={() => props.setIsGeneralDiscountModalOpen(false)}
                    onSave={props.handleSaveGeneralDiscount}
                    initialValue={props.generalDiscount.value}
                    initialType={props.generalDiscount.type}
                />
            )}

            {/* AI Measurement Modal */}
            {props.isAIMeasurementModalOpen && (
                <AIMeasurementModal
                    isOpen={props.isAIMeasurementModalOpen}
                    onClose={() => props.setIsAIMeasurementModalOpen(false)}
                    onProcess={props.handleProcessAIInput}
                    isProcessing={props.isProcessingAI}
                    provider={props.userInfo?.aiConfig?.provider || 'gemini'}
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

            {/* API Key Modal */}
            {props.isApiKeyModalOpen && props.userInfo && (
                <ApiKeyModal
                    isOpen={props.isApiKeyModalOpen}
                    onClose={() => props.setIsApiKeyModalOpen(false)}
                    onSave={props.handleSaveApiKey}
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
                            <p className="text-slate-700">
                                Você está prestes a duplicar a opção atual "<strong>{props.activeOption.name}</strong>" ({props.activeOption.measurements.length} medidas) e criar uma nova opção de proposta.
                            </p>
                            <p className="mt-2 text-sm text-slate-600">
                                Deseja continuar?
                            </p>
                        </>
                    }
                    confirmButtonText="Sim, Duplicar Opção"
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
                />
            )}
        </>
    );
};
