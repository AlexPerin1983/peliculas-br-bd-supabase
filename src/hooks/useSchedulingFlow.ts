import { Dispatch, SetStateAction, useCallback } from 'react';
import * as db from '../../services/db';
import { Agendamento, AgendamentoServiceStatus, SavedPDF, SchedulingInfo } from '../../types';

type SetActiveTab = Dispatch<SetStateAction<'dashboard' | 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores'>>;

interface UseSchedulingFlowParams {
    allSavedPdfs: SavedPDF[];
    agendamentoToDelete: Agendamento | null;
    setAgendamentos: Dispatch<SetStateAction<Agendamento[]>>;
    setAllSavedPdfs: Dispatch<SetStateAction<SavedPDF[]>>;
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
    setAgendamentos,
    setAllSavedPdfs,
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

            const linkedProposalIds = savedAgendamento.pdfIds?.length
                ? savedAgendamento.pdfIds
                : (savedAgendamento.pdfId ? [savedAgendamento.pdfId] : []);

            const allPdfsFromDb = await db.getAllPDFs();
            const linkedProposalIdSet = new Set(linkedProposalIds);
            const pdfsToUpdate = allPdfsFromDb.filter((item) => (
                (typeof item.id === 'number' && linkedProposalIdSet.has(item.id))
                || item.agendamentoId === savedAgendamento.id
            ));

            await Promise.all(pdfsToUpdate.map((item) => {
                const shouldLink = typeof item.id === 'number' && linkedProposalIdSet.has(item.id);
                if (shouldLink) {
                    return item.agendamentoId === savedAgendamento.id
                        ? Promise.resolve()
                        : db.updatePDF({ ...item, agendamentoId: savedAgendamento.id });
                }

                const updatedPdf = { ...item };
                delete updatedPdf.agendamentoId;
                return db.updatePDF(updatedPdf);
            }));

            await Promise.all([loadAgendamentos(), loadAllPdfs()]);
            handleCloseAgendamentoModal();
        } catch (error) {
            console.error('Erro ao salvar agendamento:', error);
            handleShowInfo('Não foi possível salvar o agendamento. Tente novamente.');
            throw error;
        }
    }, [handleCloseAgendamentoModal, handleShowInfo, loadAgendamentos, loadAllPdfs]);

    const handleUpdateAgendamentoServiceStatus = useCallback(async (agendamento: Agendamento, serviceStatus: AgendamentoServiceStatus) => {
        if (agendamento.serviceStatus === serviceStatus) return;

        const previous = agendamento.serviceStatus;
        // Atualização otimista para feedback imediato na agenda.
        setAgendamentos(current => current.map(item => (
            item.id === agendamento.id ? { ...item, serviceStatus } : item
        )));

        try {
            await db.saveAgendamento({ ...agendamento, serviceStatus });
        } catch (error) {
            console.error('Erro ao atualizar status do agendamento:', error);
            setAgendamentos(current => current.map(item => (
                item.id === agendamento.id ? { ...item, serviceStatus: previous } : item
            )));
            handleShowInfo('Não foi possível atualizar o status do agendamento. Tente novamente.');
        }
    }, [handleShowInfo, setAgendamentos]);

    const handleCompleteAgendamentoWithValue = useCallback(async (agendamento: Agendamento, finalValue: number) => {
        const previousStatus = agendamento.serviceStatus;
        const previousValorFinal = agendamento.valorFinal;

        const linkedPdf = agendamento.pdfId ? allSavedPdfs.find(pdf => pdf.id === agendamento.pdfId) : undefined;
        const linkedProposalIds = agendamento.pdfIds?.length ? agendamento.pdfIds : (agendamento.pdfId ? [agendamento.pdfId] : []);
        const hasMultipleLinkedProposals = linkedProposalIds.length > 1;

        const hasValidValue = Number.isFinite(finalValue) && finalValue > 0;
        // Com orcamento vinculado: o valor sobrescreve o orcamento.
        const shouldUpdatePdf = Boolean(linkedPdf && !hasMultipleLinkedProposals && hasValidValue && finalValue !== linkedPdf!.totalPreco);
        // Sem orcamento vinculado: o valor fica guardado no proprio agendamento
        // para entrar no resultado financeiro como servico avulso.
        const shouldStoreValorFinal = (!linkedPdf || hasMultipleLinkedProposals) && hasValidValue && finalValue !== agendamento.valorFinal;

        const nextValorFinal = shouldStoreValorFinal ? finalValue : agendamento.valorFinal;

        // Conclui o atendimento de forma otimista (status + valor avulso).
        setAgendamentos(current => current.map(item => (
            item.id === agendamento.id ? { ...item, serviceStatus: 'completed', valorFinal: nextValorFinal } : item
        )));

        if (shouldUpdatePdf && linkedPdf) {
            // Sobrescreve o valor do orcamento vinculado com o valor final do servico.
            setAllSavedPdfs(previous => previous.map(pdf => (
                pdf.id === linkedPdf.id ? { ...pdf, totalPreco: finalValue } : pdf
            )));
        }

        try {
            await db.saveAgendamento({ ...agendamento, serviceStatus: 'completed', valorFinal: nextValorFinal });
            if (shouldUpdatePdf && linkedPdf) {
                await db.updatePDF({ ...linkedPdf, totalPreco: finalValue });
            }
        } catch (error) {
            console.error('Erro ao concluir atendimento com valor final:', error);
            setAgendamentos(current => current.map(item => (
                item.id === agendamento.id ? { ...item, serviceStatus: previousStatus, valorFinal: previousValorFinal } : item
            )));
            if (shouldUpdatePdf && linkedPdf) {
                setAllSavedPdfs(previous => previous.map(pdf => (
                    pdf.id === linkedPdf.id ? { ...pdf, totalPreco: linkedPdf.totalPreco } : pdf
                )));
            }
            handleShowInfo('Não foi possível concluir o atendimento. Tente novamente.');
        }
    }, [allSavedPdfs, handleShowInfo, setAgendamentos, setAllSavedPdfs]);

    const handleRequestDeleteAgendamento = useCallback((agendamento: Agendamento) => {
        handleCloseAgendamentoModal();
        setAgendamentoToDelete(agendamento);
    }, [handleCloseAgendamentoModal, setAgendamentoToDelete]);

    const handleConfirmDeleteAgendamento = useCallback(async () => {
        if (!agendamentoToDelete?.id) return;

        try {
            const agendamentoId = agendamentoToDelete.id;
            const allPdfsFromDb = await db.getAllPDFs();
            const pdfsToUnlink = allPdfsFromDb.filter((pdf) => pdf.agendamentoId === agendamentoId);

            await db.deleteAgendamento(agendamentoId);

            if (pdfsToUnlink.length > 0) {
                const updatedPdfs = pdfsToUnlink.map((item) => {
                    const updatedPdf = { ...item };
                    delete updatedPdf.agendamentoId;
                    return updatedPdf;
                });
                await Promise.all(updatedPdfs.map((item) => db.updatePDF(item)));
                const updatedById = new Map(updatedPdfs.map((item) => [item.id, item]));
                setAllSavedPdfs((previous) => previous.map((item) => updatedById.get(item.id) || item));
            }

            setAgendamentos(previous => previous.filter(agendamento => agendamento.id !== agendamentoId));
        } catch (error) {
            console.error('Erro ao excluir agendamento:', error);
            handleShowInfo('Não foi possível excluir o agendamento. Tente novamente.');
            await Promise.all([loadAgendamentos(), loadAllPdfs()]);
        } finally {
            setAgendamentoToDelete(null);
        }
    }, [agendamentoToDelete, handleShowInfo, loadAgendamentos, loadAllPdfs, setAgendamentoToDelete, setAgendamentos, setAllSavedPdfs]);

    const handleContinueAgendamento = useCallback((agendamento: Agendamento) => {
        // Marca o atendimento de hoje como parcial (some o aviso de encerramento)
        // e abre um novo agendamento de continuacao para o dia seguinte.
        void handleUpdateAgendamentoServiceStatus(agendamento, 'partial');

        const continuationStart = new Date();
        continuationStart.setDate(continuationStart.getDate() + 1);
        continuationStart.setHours(9, 0, 0, 0);

        const originDate = new Date(agendamento.start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const continuationNote = `Continuação do atendimento de ${originDate}.`;
        const notes = agendamento.notes ? `${continuationNote}\n\n${agendamento.notes}` : continuationNote;

        // Continuacao nao herda o pdfId para nao reapontar o orcamento (evita
        // desvincular o agendamento original do orcamento).
        handleOpenAgendamentoModal({
            agendamento: {
                clienteId: agendamento.clienteId,
                clienteNome: agendamento.clienteNome,
                start: continuationStart.toISOString(),
                notes,
            }
        });
    }, [handleOpenAgendamentoModal, handleUpdateAgendamentoServiceStatus]);

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

    const handleRescheduleAgendamento = useCallback((agendamento: Agendamento) => {
        // Reabre um atendimento cancelado/não comparecido: volta o status para
        // "agendado" e abre o modal mantendo o mesmo registro (e o orçamento
        // vinculado) para o usuário escolher a nova data/hora.
        const pdf = allSavedPdfs.find(item => item.id === agendamento.pdfId);
        setSchedulingInfo({ agendamento: { ...agendamento, serviceStatus: 'scheduled' }, pdf });
    }, [allSavedPdfs, setSchedulingInfo]);

    const handleGoToHistoryFromPdf = useCallback(() => {
        setPdfGenerationStatus('idle');
        setActiveTab('history');
    }, [setActiveTab, setPdfGenerationStatus]);

    return {
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
    };
}
