import { useCallback } from 'react';
import { Bobina, Retalho } from '../../types';
import {
    saveBobina,
    deleteBobina,
    saveRetalho,
    deleteRetalho,
    generateQRCode,
    saveConsumo,
} from '../../services/estoqueDb';
import QRCode from 'qrcode';

type QrModalState = { type: 'bobina' | 'retalho'; item: Bobina | Retalho } | null;
type StatusModalState = { type: 'bobina' | 'retalho'; item: Bobina | Retalho } | null;
type DeleteConfirmState = { type: 'bobina' | 'retalho'; id: number } | null;

type FormState = {
    formFilmId: string;
    formLargura: string;
    formComprimento: string;
    formFornecedor: string;
    formLote: string;
    formCusto: string;
    formLocalizacao: string;
    formObservacao: string;
    formBobinaId: number | '';
    formDeduzirDaBobina: boolean;
};

type FormSetters = {
    setFormFilmId: (value: string) => void;
    setFormLargura: (value: string) => void;
    setFormComprimento: (value: string) => void;
    setFormFornecedor: (value: string) => void;
    setFormLote: (value: string) => void;
    setFormCusto: (value: string) => void;
    setFormLocalizacao: (value: string) => void;
    setFormObservacao: (value: string) => void;
    setFormBobinaId: (value: number | '') => void;
    setFormDeduzirDaBobina: (value: boolean) => void;
};

type UseEstoqueOperationsParams = {
    form: FormState;
    setters: FormSetters;
    showQRModal: QrModalState;
    setShowQRModal: (value: QrModalState) => void;
    setQrCodeDataUrl: (value: string) => void;
    setShowAddModal: (value: boolean) => void;
    showDeleteConfirm: DeleteConfirmState;
    setShowDeleteConfirm: (value: DeleteConfirmState) => void;
    showStatusModal: StatusModalState;
    setShowStatusModal: (value: StatusModalState) => void;
    setIsGenerating: (value: boolean) => void;
    loadData: () => Promise<void>;
    qrCodeDataUrl: string;
};

export function useEstoqueOperations({
    form,
    setters,
    showQRModal,
    setShowQRModal,
    setQrCodeDataUrl,
    setShowAddModal,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showStatusModal,
    setShowStatusModal,
    setIsGenerating,
    loadData,
    qrCodeDataUrl,
}: UseEstoqueOperationsParams) {
    const resetForm = useCallback(() => {
        setters.setFormFilmId('');
        setters.setFormLargura('');
        setters.setFormComprimento('');
        setters.setFormFornecedor('');
        setters.setFormLote('');
        setters.setFormCusto('');
        setters.setFormObservacao('');
        setters.setFormLocalizacao('');
        setters.setFormBobinaId('');
        setters.setFormDeduzirDaBobina(false);
    }, [setters]);

    const generateQRCodeImage = useCallback(async (code: string) => {
        try {
            const baseUrl = window.location.origin;
            const publicUrl = `${baseUrl}?qr=${encodeURIComponent(code)}`;

            const url = await QRCode.toDataURL(publicUrl, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
            });
            setQrCodeDataUrl(url);
        } catch (error) {
            console.error('Erro ao gerar QR Code:', error);
        }
    }, [setQrCodeDataUrl]);

    const handleShowQR = useCallback(async (type: 'bobina' | 'retalho', item: Bobina | Retalho) => {
        setShowQRModal({ type, item });
        await generateQRCodeImage(item.codigoQr);
    }, [generateQRCodeImage, setShowQRModal]);

    const generateCleanLabelElement = useCallback((item: Bobina | Retalho, type: 'bobina' | 'retalho', qrUrl: string) => {
        const card = document.createElement('div');
        card.style.width = '320px';
        card.style.padding = '30px 20px';
        card.style.backgroundColor = '#ffffff';
        card.style.color = '#000000';
        card.style.fontFamily = 'sans-serif';
        card.style.textAlign = 'center';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.border = '1px solid #e2e8f0';
        card.style.borderRadius = '12px';

        const titulo = document.createElement('h2');
        titulo.textContent = type === 'bobina' ? 'Bobina' : 'Retalho';
        titulo.style.fontSize = '18px';
        titulo.style.fontWeight = 'bold';
        titulo.style.margin = '0 0 5px 0';
        titulo.style.color = '#1e293b';
        card.appendChild(titulo);

        const filme = document.createElement('p');
        filme.textContent = item.filmId;
        filme.style.fontSize = '16px';
        filme.style.fontWeight = '600';
        filme.style.color = '#334155';
        filme.style.margin = '0 0 20px 0';
        card.appendChild(filme);

        const qrImg = document.createElement('img');
        qrImg.src = qrUrl;
        qrImg.style.width = '160px';
        qrImg.style.height = '160px';
        qrImg.style.margin = '0 auto 15px auto';
        qrImg.style.display = 'block';
        card.appendChild(qrImg);

        const codigo = document.createElement('p');
        codigo.textContent = item.codigoQr;
        codigo.style.fontSize = '14px';
        codigo.style.fontFamily = 'monospace';
        codigo.style.color = '#64748b';
        codigo.style.margin = '0 0 5px 0';
        card.appendChild(codigo);

        const dimensoes = document.createElement('p');
        dimensoes.textContent = 'comprimentoTotalM' in item
            ? `${item.larguraCm}cm x ${item.comprimentoTotalM}m`
            : `${item.larguraCm}cm x ${(item as Retalho).comprimentoCm}cm`;
        dimensoes.style.fontSize = '14px';
        dimensoes.style.color = '#64748b';
        dimensoes.style.margin = '0';
        card.appendChild(dimensoes);

        return card;
    }, []);

    const handleSaveImage = useCallback(async () => {
        if (!showQRModal || !qrCodeDataUrl) return;

        try {
            setIsGenerating(true);
            const { toPng } = await import('html-to-image');

            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '-10000px';
            container.style.left = '-10000px';
            document.body.appendChild(container);

            const card = generateCleanLabelElement(showQRModal.item, showQRModal.type, qrCodeDataUrl);
            container.appendChild(card);

            await new Promise(resolve => setTimeout(resolve, 100));

            const dataUrl = await toPng(card, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                cacheBust: true,
            });

            document.body.removeChild(container);

            const link = document.createElement('a');
            link.download = `qr-${showQRModal.type}-${showQRModal.item.codigoQr}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Erro ao gerar imagem:', err);
            alert('Erro ao gerar imagem. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    }, [generateCleanLabelElement, qrCodeDataUrl, setIsGenerating, showQRModal]);

    const handleSavePDF = useCallback(async () => {
        if (!showQRModal || !qrCodeDataUrl) return;

        try {
            setIsGenerating(true);
            const { toPng } = await import('html-to-image');
            const { jsPDF } = await import('jspdf');

            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '-10000px';
            container.style.left = '-10000px';
            document.body.appendChild(container);

            const card = generateCleanLabelElement(showQRModal.item, showQRModal.type, qrCodeDataUrl);
            container.appendChild(card);

            await new Promise(resolve => setTimeout(resolve, 100));

            const imgData = await toPng(card, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                cacheBust: true,
            });

            document.body.removeChild(container);

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, 100],
            });

            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`qr-${showQRModal.type}-${showQRModal.item.codigoQr}.pdf`);
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            alert('Erro ao gerar PDF. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    }, [generateCleanLabelElement, qrCodeDataUrl, setIsGenerating, showQRModal]);

    const handleAddBobina = useCallback(async () => {
        if (!form.formFilmId || !form.formLargura || !form.formComprimento) {
            alert('Preencha os campos obrigatórios');
            return;
        }

        try {
            const novaBobina: Omit<Bobina, 'id'> = {
                filmId: form.formFilmId,
                codigoQr: generateQRCode(),
                larguraCm: parseFloat(form.formLargura),
                comprimentoTotalM: parseFloat(form.formComprimento),
                comprimentoRestanteM: parseFloat(form.formComprimento),
                custoTotal: form.formCusto ? parseFloat(form.formCusto) : undefined,
                fornecedor: form.formFornecedor || undefined,
                lote: form.formLote || undefined,
                status: 'ativa',
                localizacao: form.formLocalizacao || undefined,
                observacao: form.formObservacao || undefined,
            };

            await saveBobina(novaBobina);
            await loadData();
            resetForm();
            setShowAddModal(false);
        } catch (error) {
            console.error('Erro ao salvar bobina:', error);
            alert('Erro ao salvar bobina');
        }
    }, [form, loadData, resetForm, setShowAddModal]);

    const handleAddRetalho = useCallback(async () => {
        if (!form.formFilmId || !form.formLargura || !form.formComprimento) {
            alert('Preencha os campos obrigatórios');
            return;
        }

        try {
            const novoRetalho: Omit<Retalho, 'id'> = {
                filmId: form.formFilmId,
                codigoQr: generateQRCode(),
                larguraCm: parseFloat(form.formLargura),
                comprimentoCm: parseFloat(form.formComprimento),
                bobinaId: form.formBobinaId || undefined,
                status: 'disponivel',
                localizacao: form.formLocalizacao || undefined,
                observacao: form.formObservacao || undefined,
            };

            await saveRetalho(novoRetalho);

            if (form.formDeduzirDaBobina && form.formBobinaId) {
                const metrosRetalho = parseFloat(form.formComprimento) / 100;
                await saveConsumo({
                    bobinaId: form.formBobinaId,
                    metrosConsumidos: metrosRetalho,
                    larguraCorteCm: parseFloat(form.formLargura),
                    comprimentoCorteCm: parseFloat(form.formComprimento),
                    areaM2: (parseFloat(form.formLargura) * parseFloat(form.formComprimento)) / 10000,
                    tipo: 'corte',
                    observacao: `Retalho criado: ${form.formFilmId}`,
                });
            }

            await loadData();
            resetForm();
            setShowAddModal(false);
        } catch (error) {
            console.error('Erro ao salvar retalho:', error);
            alert('Erro ao salvar retalho');
        }
    }, [form, loadData, resetForm, setShowAddModal]);

    const handleDelete = useCallback((type: 'bobina' | 'retalho', id: number) => {
        if (!id) {
            alert('Erro: ID do item não encontrado');
            return;
        }
        setShowDeleteConfirm({ type, id });
    }, [setShowDeleteConfirm]);

    const handleConfirmDelete = useCallback(async () => {
        if (!showDeleteConfirm) return;

        const { type, id } = showDeleteConfirm;

        try {
            if (type === 'bobina') {
                await deleteBobina(id);
            } else {
                await deleteRetalho(id);
            }
            await loadData();
            setShowDeleteConfirm(null);
        } catch (error: any) {
            console.error(`Erro ao excluir ${type}:`, error);
            const errorMessage = error?.message || 'Erro desconhecido';
            alert(`Erro ao excluir ${type}:\n${errorMessage}`);
        }
    }, [loadData, setShowDeleteConfirm, showDeleteConfirm]);

    const handleChangeStatus = useCallback((type: 'bobina' | 'retalho', item: Bobina | Retalho) => {
        setShowStatusModal({ type, item });
    }, [setShowStatusModal]);

    const handleConfirmStatusChange = useCallback(async (newStatus: string) => {
        if (!showStatusModal) return;

        const { type, item } = showStatusModal;

        try {
            if (type === 'bobina') {
                await saveBobina({ ...(item as Bobina), status: newStatus as Bobina['status'] });
            } else {
                await saveRetalho({ ...(item as Retalho), status: newStatus as Retalho['status'] });
            }
            await loadData();
            setShowStatusModal(null);
        } catch (error: any) {
            console.error('Erro ao alterar status:', error);
            alert('Erro ao alterar status');
        }
    }, [loadData, setShowStatusModal, showStatusModal]);

    const getStatusOptions = useCallback((type: 'bobina' | 'retalho') => {
        return type === 'bobina'
            ? [
                { value: 'ativa', label: 'Ativa', emoji: '🟢', color: '#22c55e' },
                { value: 'finalizada', label: 'Finalizada', emoji: '🟡', color: '#f59e0b' },
                { value: 'descartada', label: 'Descartada', emoji: '🔴', color: '#ef4444' },
            ]
            : [
                { value: 'disponivel', label: 'Disponível', emoji: '🟢', color: '#22c55e' },
                { value: 'reservado', label: 'Reservado', emoji: '🟡', color: '#f59e0b' },
                { value: 'usado', label: 'Usado', emoji: '🟠', color: '#f97316' },
                { value: 'descartado', label: 'Descartado', emoji: '🔴', color: '#ef4444' },
            ];
    }, []);

    const getStatusColor = useCallback((status: string) => {
        switch (status) {
            case 'ativa':
            case 'disponivel':
                return 'var(--success)';
            case 'finalizada':
            case 'usado':
                return 'var(--warning)';
            case 'descartada':
            case 'descartado':
                return 'var(--danger)';
            default:
                return 'var(--text-secondary)';
        }
    }, []);

    const getStatusLabel = useCallback((status: string) => {
        const labels: Record<string, string> = {
            ativa: 'Ativa',
            finalizada: 'Finalizada',
            descartada: 'Descartada',
            disponivel: 'Disponível',
            reservado: 'Reservado',
            usado: 'Usado',
            descartado: 'Descartado',
        };
        return labels[status] || status;
    }, []);

    return {
        handleShowQR,
        handleSaveImage,
        handleSavePDF,
        handleAddBobina,
        handleAddRetalho,
        handleDelete,
        handleConfirmDelete,
        handleChangeStatus,
        handleConfirmStatusChange,
        getStatusOptions,
        getStatusColor,
        getStatusLabel,
    };
}
