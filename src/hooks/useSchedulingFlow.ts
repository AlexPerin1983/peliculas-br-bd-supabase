import { Dispatch, SetStateAction, useCallback } from 'react';
import * as db from '../../services/db';
import { Agendamento, SavedPDF, SchedulingInfo } from '../../types';

type SetActiveTab = Dispatch<SetStateAction<'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores'>>;

interface UseSchedulingFlowParams {
    allSavedPdfs: SavedPDF[];
    agendamentoToDelete: Agendamento | null;
    setSchedulingInfo: Dispatch<SetStateAction<SchedulingInfo | null>>;
    setAgendamentoToDelete: Dispatch<SetStateAction<Agendamento | null>>;
    setPdfGenerationStatus: Dispatch<SetStateAction<'idle' | 'generating' | 'success'>>;
    setActiveTab: SetActiveTab;
    loadAgendamentos: () => Promise<void>;
    loadAllPdfs: () => Promise<void>;
    handleShowInfo: (message: string, title?: string) => void;
}

export function useSchedulingFlow({
    allSavedPdfs,
    agendamentoToDelete,
    setSchedulingInfo,
    setAgendamentoToDelete,
    setPdfGenerationStatus,
    setActiveTab,
    loadAgendamentos,
    loadAllPdfs,
    handleShowInfo
}: UseSchedulingFlowParams) {
    const handleOpenAgendamentoModal = useCallback((info: SchedulingInfo) => {
        setSchedulingInfo(info);
    }, [setSchedulingInfo]);

    const handleCloseAgendamentoModal = useCallback(() => {
        setSchedulingInfo(null);
    }, [setSchedulingInfo]);

    const handleSaveAgendamento = useCallback(async (agendamentoData: Omit<Agendamento, 'id'> | Agendamento) => {
        try {
            const savedAgendamento = await db.saveAgendamento(agendamentoData);

            if (savedAgendamento.pdfId) {
                const allPdfsFromDb = await db.getAllPDFs();
                const pdfToUpdate = allPdfsFromDb.find(pdf => pdf.id === savedAgendamento.pdfId);

                if (pdfToUpdate && pdfToUpdate.agendamentoId !== savedAgendamento.id) {
                    await db.updatePDF({ ...pdfToUpdate, agendamentoId: savedAgendamento.id });
                }
            }

            await Promise.all([loadAgendamentos(), loadAllPdfs()]);
            handleCloseAgendamentoModal();
        } catch (error) {
            console.error('Erro ao salvar agendamento:', error);
            handleShowInfo('Nao foi possivel salvar o agendamento. Tente novamente.');
        }
    }, [handleCloseAgendamentoModal, handleShowInfo, loadAgendamentos, loadAllPdfs]);

    const handleRequestDeleteAgendamento = useCallback((agendamento: Agendamento) => {
        handleCloseAgendamentoModal();
        setAgendamentoToDelete(agendamento);
    }, [handleCloseAgendamentoModal, setAgendamentoToDelete]);

    const handleConfirmDeleteAgendamento = useCallback(async () => {
        if (!agendamentoToDelete?.id) return;

        try {
            const agendamentoId = agendamentoToDelete.id;
            const allPdfsFromDb = await db.getAllPDFs();
            const pdfToUnlink = allPdfsFromDb.find(pdf => pdf.agendamentoId === agendamentoId);

            await db.deleteAgendamento(agendamentoId);

            if (pdfToUnlink) {
                const updatedPdf = { ...pdfToUnlink };
                delete updatedPdf.agendamentoId;
                await db.updatePDF(updatedPdf);
            }

            await Promise.all([loadAgendamentos(), loadAllPdfs()]);
        } catch (error) {
            console.error('Erro ao excluir agendamento:', error);
            handleShowInfo('Nao foi possivel excluir o agendamento. Tente novamente.');
        } finally {
            setAgendamentoToDelete(null);
        }
    }, [agendamentoToDelete, handleShowInfo, loadAgendamentos, loadAllPdfs, setAgendamentoToDelete]);

    const handleCreateNewAgendamento = useCallback((date: Date) => {
        const startDate = new Date(date);
        startDate.setHours(9, 0, 0, 0);

        handleOpenAgendamentoModal({
            agendamento: {
                start: startDate.toISOString(),
            }
        });
    }, [handleOpenAgendamentoModal]);

    const handleEditAgendamento = useCallback((agendamento: Agendamento) => {
        const pdf = allSavedPdfs.find(item => item.id === agendamento.pdfId);
        setSchedulingInfo({ agendamento, pdf });
    }, [allSavedPdfs, setSchedulingInfo]);

    const handleGoToHistoryFromPdf = useCallback(() => {
        setPdfGenerationStatus('idle');
        setActiveTab('history');
    }, [setActiveTab, setPdfGenerationStatus]);

    return {
        handleOpenAgendamentoModal,
        handleCloseAgendamentoModal,
        handleSaveAgendamento,
        handleRequestDeleteAgendamento,
        handleConfirmDeleteAgendamento,
        handleCreateNewAgendamento,
        handleEditAgendamento,
        handleGoToHistoryFromPdf
    };
}
