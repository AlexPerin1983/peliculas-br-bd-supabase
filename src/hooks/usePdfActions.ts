import { Dispatch, SetStateAction, useCallback } from 'react';
import * as db from '../../services/db';
import { Client, Film, ProposalOption, SavedPDF, Totals, UIMeasurement, UserInfo } from '../../types';

type PdfGenerationStatus = 'idle' | 'generating' | 'success';
type DiscountType = { value: string; type: 'percentage' | 'fixed' };

interface UsePdfActionsParams {
    measurements: UIMeasurement[];
    films: Film[];
    generalDiscount: DiscountType;
    totals: Totals;
    selectedClient: Client | null;
    selectedClientId: number | null;
    userInfo: UserInfo | null;
    activeOption: ProposalOption | null;
    clients: Client[];
    setAllSavedPdfs: Dispatch<SetStateAction<SavedPDF[]>>;
    setPdfGenerationStatus: Dispatch<SetStateAction<PdfGenerationStatus>>;
    setIsSaveBeforePdfModalOpen: Dispatch<SetStateAction<boolean>>;
    handleShowInfo: (message: string, title?: string) => void;
    handleSaveChanges: () => Promise<void>;
}

export const sanitizeForFilename = (name: string): string => {
    if (!name) return name;

    const corruptedPatterns = [
        { pattern: /Op[�\uFFFD]{1,4}o/gi, replacement: 'Opcao' },
        { pattern: /Op\?+o/gi, replacement: 'Opcao' },
        { pattern: /Op[\x00-\x1F]+o/gi, replacement: 'Opcao' },
        { pattern: /ção/gi, replacement: 'cao' },
        { pattern: /ã/gi, replacement: 'a' },
        { pattern: /[�\uFFFD]+/g, replacement: '' }
    ];

    let sanitized = name;
    for (const { pattern, replacement } of corruptedPatterns) {
        sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized.replace(/[<>:"/\\|?*]/g, '');
};

export function usePdfActions({
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
}: UsePdfActionsParams) {
    const downloadBlob = useCallback((blobOrBase64: Blob | string, filename: string) => {
        let blob: Blob;

        if (typeof blobOrBase64 === 'string') {
            try {
                if (!blobOrBase64.includes(',')) {
                    console.error('[PDF] downloadBlob: formato base64 inválido');
                    return;
                }

                const parts = blobOrBase64.split(',');
                const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
                const bstr = atob(parts[1]);
                let length = bstr.length;
                const u8arr = new Uint8Array(length);

                while (length--) {
                    u8arr[length] = bstr.charCodeAt(length);
                }

                blob = new Blob([u8arr], { type: mime });
            } catch (error) {
                console.error('[PDF] Erro ao converter base64 para Blob:', error);
                return;
            }
        } else {
            blob = blobOrBase64;
        }

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, []);

    const handleDownloadPdf = useCallback(async (pdf: SavedPDF, filename: string) => {
        let blob = pdf.pdfBlob;
        if (!blob && pdf.id) {
            try {
                blob = await db.getPDFBlob(pdf.id) || undefined;
            } catch (error) {
                console.error('[PDF] Erro ao buscar blob do PDF:', error);
            }
        }

        if (blob) {
            downloadBlob(blob, filename);
            return;
        }

        handleShowInfo('Não foi possível baixar o PDF.');
    }, [downloadBlob, handleShowInfo]);

    const executePdfGeneration = useCallback(async () => {
        const activeMeasurements = measurements.filter(measurement =>
            measurement.active &&
            parseFloat(String(measurement.largura).replace(',', '.')) > 0 &&
            parseFloat(String(measurement.altura).replace(',', '.')) > 0
        );

        if (activeMeasurements.length === 0) {
            handleShowInfo('Não há medidas válidas para gerar um orçamento.');
            return;
        }

        setPdfGenerationStatus('generating');

        try {
            const { generatePDF } = await import('../../services/pdfGenerator');
            const pdfBlob = await generatePDF(
                selectedClient!,
                userInfo!,
                activeMeasurements,
                films,
                generalDiscount,
                totals,
                activeOption!.name
            );

            const filename = `orcamento_${sanitizeForFilename(selectedClient!.nome).replace(/\s+/g, '_').toLowerCase()}_${sanitizeForFilename(activeOption!.name).replace(/\s+/g, '_').toLowerCase()}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;

            const generalDiscountForDb: SavedPDF['generalDiscount'] = {
                ...generalDiscount,
                value: parseFloat(String(generalDiscount.value).replace(',', '.')) || 0,
                type: generalDiscount.value ? generalDiscount.type : 'none'
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
                pdfBlob,
                nomeArquivo: filename,
                measurements: activeMeasurements.map(({ isNew, ...rest }) => rest),
                status: 'pending',
                proposalOptionName: activeOption!.name,
                proposalOptionId: activeOption!.id
            };

            const savedPdf = await db.savePDF(pdfToSave);
            downloadBlob(pdfBlob, filename);
            setAllSavedPdfs(previous => [savedPdf, ...previous]);
            setPdfGenerationStatus('success');
        } catch (error) {
            console.error('Erro ao gerar ou salvar PDF:', error);
            handleShowInfo('Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.');
            setPdfGenerationStatus('idle');
        }
    }, [
        measurements,
        selectedClient,
        userInfo,
        films,
        generalDiscount,
        totals,
        activeOption,
        selectedClientId,
        setPdfGenerationStatus,
        downloadBlob,
        setAllSavedPdfs,
        handleShowInfo
    ]);

    const handleGeneratePdf = useCallback(async () => {
        if (!selectedClient || !userInfo || !activeOption) {
            handleShowInfo('Selecione um cliente e preencha as informações da empresa antes de gerar o PDF.');
            return;
        }

        if (measurements.length === 0) {
            handleShowInfo('Adicione ao menos uma medida antes de gerar o PDF.');
            return;
        }

        await executePdfGeneration();
    }, [selectedClient, userInfo, activeOption, measurements.length, handleShowInfo, executePdfGeneration]);

    const handleGeneratePdfWithSaveCheck = useCallback(async (isDirty: boolean) => {
        if (!selectedClient || !userInfo || !activeOption) {
            handleShowInfo('Selecione um cliente e preencha as informações da empresa antes de gerar o PDF.');
            return;
        }

        if (isDirty) {
            setIsSaveBeforePdfModalOpen(true);
            return;
        }

        await executePdfGeneration();
    }, [selectedClient, userInfo, activeOption, handleShowInfo, setIsSaveBeforePdfModalOpen, executePdfGeneration]);

    const handleConfirmSaveBeforePdf = useCallback(async () => {
        await handleSaveChanges();
        setIsSaveBeforePdfModalOpen(false);
        await executePdfGeneration();
    }, [handleSaveChanges, setIsSaveBeforePdfModalOpen, executePdfGeneration]);

    const handleGenerateCombinedPdf = useCallback(async (selectedPdfs: SavedPDF[]) => {
        if (!userInfo || selectedPdfs.length === 0) {
            return;
        }

        setPdfGenerationStatus('generating');

        try {
            const client = clients.find(item => item.id === selectedPdfs[0].clienteId);
            if (!client) {
                throw new Error('Cliente não encontrado para os orçamentos selecionados.');
            }

            const { generateCombinedPDF } = await import('../../services/pdfGenerator');
            const pdfBlob = await generateCombinedPDF(client, userInfo, selectedPdfs, films);
            const firstOptionName = selectedPdfs[0].proposalOptionName || 'Opcao';
            const filename = `orcamento_combinado_${sanitizeForFilename(client.nome).replace(/\s+/g, '_').toLowerCase()}_${sanitizeForFilename(firstOptionName).replace(/\s+/g, '_').toLowerCase()}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;

            downloadBlob(pdfBlob, filename);
            setPdfGenerationStatus('success');
        } catch (error) {
            console.error('Erro ao gerar PDF combinado:', error);
            handleShowInfo(`Ocorreu um erro ao gerar o PDF combinado: ${error instanceof Error ? error.message : String(error)}`);
            setPdfGenerationStatus('idle');
        }
    }, [userInfo, clients, films, downloadBlob, handleShowInfo, setPdfGenerationStatus]);

    return {
        handleDownloadPdf,
        handleGeneratePdf,
        handleGeneratePdfWithSaveCheck,
        handleConfirmSaveBeforePdf,
        handleGenerateCombinedPdf
    };
}
