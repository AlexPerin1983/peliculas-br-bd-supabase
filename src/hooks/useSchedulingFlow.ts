import { Dispatch, SetStateAction, useCallback } from 'react';
import * as db from '../../services/db';
import { completeAgendamentoWithStock, ServiceStockConsumptionInput } from '../../services/estoqueDb';
import { Agendamento, AgendamentoServiceStatus, AgendamentoStockStatus, SavedPDF, SchedulingInfo } from '../../types';
import { getDefaultReceiptDescription } from '../lib/receipt';

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

    const handleSaveReceiptDescription = useCallback(async (agendamento: Agendamento, description: string) => {
        const receiptDescription = description.trim().slice(0, 300).trimEnd();
        if (!receiptDescription || receiptDescription === agendamento.receiptDescription?.trim()) return;

        const previousDescription = agendamento.receiptDescription;
        setAgendamentos(current => current.map(item => (
            item.id === agendamento.id ? { ...item, receiptDescription } : item
        )));

        try {
            const savedAgendamento = await db.saveAgendamento({ ...agendamento, receiptDescription });
            if (savedAgendamento.receiptDescription?.trim() !== receiptDescription) {
                throw new Error('A descrição do recibo não foi confirmada pelo armazenamento.');
            }
        } catch (error) {
            console.error('Erro ao salvar descrição do recibo:', error);
            setAgendamentos(current => current.map(item => (
                item.id === agendamento.id && item.receiptDescription === receiptDescription
                    ? { ...item, receiptDescription: previousDescription }
                    : item
            )));
            throw error;
        }
    }, [setAgendamentos]);

    const handleCompleteAgendamentoWithValue = useCallback(async (
        agendamento: Agendamento,
        finalValue: number,
        stockDecision?: { lines?: ServiceStockConsumptionInput[]; stockStatus: AgendamentoStockStatus },
    ): Promise<boolean> => {
        const previousStatus = agendamento.serviceStatus;
        const previousValorFinal = agendamento.valorFinal;
        const previousStockStatus = agendamento.stockStatus;
        const previousStockConsumedAt = agendamento.stockConsumedAt;
        const previousStockSourcePdfIds = agendamento.stockSourcePdfIds;

        const linkedPdf = agendamento.pdfId ? allSavedPdfs.find(pdf => pdf.id === agendamento.pdfId) : undefined;
        const linkedProposalIds = agendamento.pdfIds?.length ? agendamento.pdfIds : (agendamento.pdfId ? [agendamento.pdfId] : []);
        const hasMultipleLinkedProposals = linkedProposalIds.length > 1;
        const stockLines = stockDecision?.lines?.length ? stockDecision.lines : undefined;
        const nextStockStatus: AgendamentoStockStatus = stockLines
            ? 'confirmed'
            : (stockDecision?.stockStatus || agendamento.stockStatus || 'not_required');

        const hasValidValue = Number.isFinite(finalValue) && finalValue > 0;
        const shouldUpdatePdf = Boolean(linkedPdf && !hasMultipleLinkedProposals && hasValidValue && finalValue !== linkedPdf!.totalPreco);
        const shouldStoreValorFinal = (!linkedPdf || hasMultipleLinkedProposals) && hasValidValue && finalValue !== agendamento.valorFinal;
        const nextValorFinal = shouldStoreValorFinal ? finalValue : agendamento.valorFinal;

        setAgendamentos(current => current.map(item => (
            item.id === agendamento.id
                ? {
                    ...item,
                    serviceStatus: 'completed',
                    valorFinal: nextValorFinal,
                    stockStatus: nextStockStatus,
                }
                : item
        )));

        if (shouldUpdatePdf && linkedPdf) {
            setAllSavedPdfs(previous => previous.map(pdf => (
                pdf.id === linkedPdf.id ? { ...pdf, totalPreco: finalValue } : pdf
            )));
        }

        try {
            if (stockLines) {
                if (agendamento.id == null) {
                    throw new Error('Salve o agendamento antes de confirmar a baixa de estoque.');
                }

                const result = await completeAgendamentoWithStock(
                    agendamento.id,
                    shouldStoreValorFinal ? nextValorFinal ?? null : null,
                    stockLines,
                );
                const completedAgendamento: Agendamento = {
                    ...agendamento,
                    serviceStatus: 'completed',
                    valorFinal: nextValorFinal,
                    stockStatus: result.stockStatus,
                    stockConsumedAt: result.stockConsumedAt,
                    stockSourcePdfIds: result.stockSourcePdfIds,
                };
                setAgendamentos(current => current.map(item => (
                    item.id === agendamento.id
                        ? {
                            ...item,
                            serviceStatus: 'completed',
                            valorFinal: nextValorFinal,
                            stockStatus: result.stockStatus,
                            stockConsumedAt: result.stockConsumedAt,
                            stockSourcePdfIds: result.stockSourcePdfIds,
                        }
                        : item
                )));

                // A RPC escreve primeiro no servidor. Em seguida espelhamos o
                // resultado no banco offline para que um reload sem conexão não
                // volte a exibir a conclusão como pendente.
                try {
                    await db.saveAgendamento(completedAgendamento);
                } catch (localMirrorError) {
                    console.error('Baixa confirmada, mas houve erro ao atualizar o espelho offline:', localMirrorError);
                }
            } else {
                await db.saveAgendamento({
                    ...agendamento,
                    serviceStatus: 'completed',
                    valorFinal: nextValorFinal,
                    stockStatus: nextStockStatus,
                });
            }

            if (shouldUpdatePdf && linkedPdf) {
                try {
                    await db.updatePDF({ ...linkedPdf, totalPreco: finalValue });
                } catch (pdfError) {
                    console.error('Atendimento concluído, mas houve erro ao atualizar o valor do orçamento:', pdfError);
                    setAllSavedPdfs(previous => previous.map(pdf => (
                        pdf.id === linkedPdf.id ? { ...pdf, totalPreco: linkedPdf.totalPreco } : pdf
                    )));
                    handleShowInfo(
                        'O serviço foi concluído e a baixa foi preservada, mas o valor do orçamento não foi atualizado. Edite o valor novamente na Agenda.',
                    );
                }
            }
            return true;
        } catch (error) {
            console.error('Erro ao concluir atendimento com valor final:', error);
            setAgendamentos(current => current.map(item => (
                item.id === agendamento.id
                    ? {
                        ...item,
                        serviceStatus: previousStatus,
                        valorFinal: previousValorFinal,
                        stockStatus: previousStockStatus,
                        stockConsumedAt: previousStockConsumedAt,
                        stockSourcePdfIds: previousStockSourcePdfIds,
                    }
                    : item
            )));
            if (shouldUpdatePdf && linkedPdf) {
                setAllSavedPdfs(previous => previous.map(pdf => (
                    pdf.id === linkedPdf.id ? { ...pdf, totalPreco: linkedPdf.totalPreco } : pdf
                )));
            }
            const errorMessage = error instanceof Error
                ? error.message
                : (typeof error === 'object' && error && 'message' in error
                    ? String((error as { message?: unknown }).message || '')
                    : '');
            const detail = errorMessage ? ` ${errorMessage}` : '';
            handleShowInfo(`Não foi possível concluir o atendimento. Nenhum material foi descontado.${detail}`);
            return false;
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
        const linkedProposalIds = agendamento.pdfIds?.length
            ? agendamento.pdfIds
            : (agendamento.pdfId ? [agendamento.pdfId] : []);
        const stockSourcePdfIds = agendamento.stockSourcePdfIds?.length
            ? agendamento.stockSourcePdfIds
            : linkedProposalIds;
        const linkedPdfs = linkedProposalIds
            .map((pdfId) => allSavedPdfs.find((pdf) => pdf.id === pdfId))
            .filter((pdf): pdf is SavedPDF => Boolean(pdf));
        const receiptDescription = agendamento.receiptDescription?.trim()
            || (linkedPdfs.length ? getDefaultReceiptDescription(linkedPdfs) : undefined);

        // Continuacao nao herda o pdfId para nao reapontar o orcamento (evita
        // desvincular o agendamento original do orcamento).
        handleOpenAgendamentoModal({
            agendamento: {
                clienteId: agendamento.clienteId,
                clienteNome: agendamento.clienteNome,
                start: continuationStart.toISOString(),
                notes,
                receiptDescription,
                stockSourcePdfIds,
            }
        });
    }, [allSavedPdfs, handleOpenAgendamentoModal, handleUpdateAgendamentoServiceStatus]);

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
        handleSaveReceiptDescription,
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
