import React, { useEffect, useMemo, useState } from 'react';
import { Agendamento, Client, SavedPDF, UserInfo } from '../../types';
import { buildReceiptDetails, formatReceiptCurrency, formatReceiptDate, getDefaultReceiptDescription } from '../../src/lib/receipt';
import Modal from '../ui/Modal';

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    agendamento: Agendamento;
    client?: Client;
    linkedPdf?: SavedPDF;
    linkedPdfs?: SavedPDF[];
    userInfo?: UserInfo | null;
    amount: number;
    onSaveDescription?: (description: string) => Promise<void>;
}

const PAYMENT_OPTIONS = ['', 'Pix', 'Dinheiro', 'Cartão', 'Transferência bancária', 'Outro'];

type ReceiptGeneratorModule = typeof import('../../services/receiptGenerator');
let loadedReceiptGenerator: ReceiptGeneratorModule | null = null;
let receiptGeneratorPromise: Promise<ReceiptGeneratorModule> | null = null;

const preloadReceiptGenerator = (): Promise<ReceiptGeneratorModule> => {
    if (loadedReceiptGenerator) return Promise.resolve(loadedReceiptGenerator);
    if (!receiptGeneratorPromise) {
        receiptGeneratorPromise = import('../../services/receiptGenerator')
            .then((module) => {
                loadedReceiptGenerator = module;
                return module;
            })
            .catch((error) => {
                receiptGeneratorPromise = null;
                throw error;
            });
    }
    return receiptGeneratorPromise;
};

const ReceiptModal: React.FC<ReceiptModalProps> = ({
    isOpen, onClose, agendamento, client, linkedPdf, linkedPdfs, userInfo, amount, onSaveDescription,
}) => {
    const defaultDescription = useMemo(
        () => agendamento.receiptDescription?.trim()
            || getDefaultReceiptDescription(linkedPdfs?.length ? linkedPdfs : linkedPdf),
        [agendamento.receiptDescription, linkedPdf, linkedPdfs],
    );
    const [description, setDescription] = useState(defaultDescription);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [busyAction, setBusyAction] = useState<'download' | 'share' | null>(null);
    const [message, setMessage] = useState('');
    const [generatorReady, setGeneratorReady] = useState(Boolean(loadedReceiptGenerator));
    const linkedPdfIds = useMemo(() => Array.from(new Set(
        agendamento.pdfIds?.length
            ? agendamento.pdfIds
            : (agendamento.pdfId != null ? [agendamento.pdfId] : []),
    )), [agendamento.pdfId, agendamento.pdfIds]);
    const availablePdfIds = useMemo(() => new Set(
        [...(linkedPdfs || []), ...(linkedPdf ? [linkedPdf] : [])]
            .map((pdf) => pdf.id)
            .filter((id): id is number => typeof id === 'number'),
    ), [linkedPdf, linkedPdfs]);
    const hasCompleteServiceData = Boolean(agendamento.receiptDescription?.trim())
        || linkedPdfIds.length === 0
        || linkedPdfIds.every((id) => availablePdfIds.has(id));

    useEffect(() => {
        if (!isOpen) return;
        setDescription(defaultDescription);
        setPaymentMethod('');
        setMessage('');
    }, [defaultDescription, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        setGeneratorReady(Boolean(loadedReceiptGenerator));
        preloadReceiptGenerator()
            .then(() => {
                if (active) setGeneratorReady(true);
            })
            .catch((error) => {
                console.error('Erro ao preparar gerador de recibo:', error);
                if (active) setMessage('Não foi possível preparar o recibo. Feche e tente novamente.');
            });
        return () => {
            active = false;
        };
    }, [isOpen]);

    const details = () => buildReceiptDetails({
        agendamento, client, linkedPdf, linkedPdfs, userInfo, amount, description, paymentMethod,
    });

    const persistDescription = async (confirmedDescription: string): Promise<boolean> => {
        if (!onSaveDescription || confirmedDescription === agendamento.receiptDescription?.trim()) return true;
        try {
            await onSaveDescription(confirmedDescription);
            return true;
        } catch (error) {
            console.error('Erro ao guardar descrição do recibo:', error);
            return false;
        }
    };

    const handleDownload = async () => {
        setBusyAction('download');
        setMessage('');
        try {
            if (!loadedReceiptGenerator) throw new Error('Gerador de recibo ainda não está pronto.');
            const receiptDetails = details();
            await loadedReceiptGenerator.downloadReceiptPdf(receiptDetails);
            const descriptionSaved = await persistDescription(receiptDetails.description);
            setMessage(descriptionSaved
                ? 'Recibo baixado com sucesso.'
                : 'Recibo baixado, mas a descrição não pôde ser guardada para a próxima emissão.');
        } catch (error) {
            console.error('Erro ao gerar recibo:', error);
            setMessage('Não foi possível gerar o recibo. Tente novamente.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleShare = async () => {
        setBusyAction('share');
        setMessage('');
        try {
            if (!loadedReceiptGenerator) throw new Error('Gerador de recibo ainda não está pronto.');
            const receiptDetails = details();
            const result = await loadedReceiptGenerator.shareReceiptPdf(receiptDetails);
            const descriptionSaved = await persistDescription(receiptDetails.description);
            setMessage(!descriptionSaved
                ? 'Recibo gerado, mas a descrição não pôde ser guardada para a próxima emissão.'
                : result === 'shared'
                    ? 'Recibo compartilhado.'
                    : 'Seu navegador não compartilha PDF diretamente. O arquivo foi baixado para você enviar ao cliente.');
        } catch (error) {
            if ((error as DOMException)?.name !== 'AbortError') {
                console.error('Erro ao compartilhar recibo:', error);
                setMessage('Não foi possível compartilhar. Você ainda pode baixar o PDF.');
            }
        } finally {
            setBusyAction(null);
        }
    };

    const isBusy = busyAction !== null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={<span className="inline-flex items-center gap-2"><i className="fas fa-receipt text-blue-500" /> Gerar recibo</span>}
            disableClose={isBusy}
            footer={(
                <div className="grid w-full grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={isBusy || !generatorReady || !hasCompleteServiceData || !description.trim()}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-blue-300 bg-white px-3 text-sm font-bold text-blue-700 disabled:opacity-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                    >
                        <i className={`fas ${busyAction === 'download' || !generatorReady ? 'fa-spinner fa-spin' : 'fa-download'}`} />
                        Baixar PDF
                    </button>
                    <button
                        type="button"
                        onClick={handleShare}
                        disabled={isBusy || !generatorReady || !hasCompleteServiceData || !description.trim()}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-blue-600 px-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        <i className={`fas ${busyAction === 'share' || !generatorReady ? 'fa-spinner fa-spin' : 'fa-share-nodes'}`} />
                        Compartilhar
                    </button>
                </div>
            )}
        >
            <div className="space-y-4">
                <div className="overflow-hidden rounded-[var(--radius-card)] border border-blue-200 bg-white shadow-sm dark:border-blue-900 dark:bg-slate-950">
                    <div className="h-1.5 bg-blue-600" />
                    <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recebedor</p>
                                <p className="truncate font-black text-slate-900 dark:text-white">{userInfo?.empresa || userInfo?.nome || 'Prestador de serviço'}</p>
                            </div>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-300">Recibo</span>
                        </div>
                        <div className="my-4 rounded-xl bg-blue-50 px-4 py-3 dark:bg-blue-950/45">
                            <p className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-300">Valor recebido</p>
                            <p className="text-2xl font-black tracking-tight text-blue-700 dark:text-blue-200">{formatReceiptCurrency(amount)}</p>
                        </div>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                            <dt className="font-bold text-slate-500">Cliente</dt>
                            <dd className="text-right font-semibold text-slate-800 dark:text-slate-200">{client?.nome || agendamento.clienteNome}</dd>
                            <dt className="font-bold text-slate-500">Serviço em</dt>
                            <dd className="text-right font-semibold text-slate-800 dark:text-slate-200">{formatReceiptDate(agendamento.end || agendamento.start)}</dd>
                        </dl>
                    </div>
                </div>

                <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-[var(--text-strong)]">Descrição do serviço</span>
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={3}
                        maxLength={300}
                        className="w-full resize-none rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
                        {hasCompleteServiceData
                            ? 'Já preenchemos com os dados do orçamento. Edite apenas se precisar.'
                            : 'Aguarde enquanto carregamos todos os serviços vinculados a este atendimento.'}
                    </span>
                </label>

                <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-[var(--text-strong)]">Forma de pagamento <span className="font-normal text-[var(--text-muted)]">(opcional)</span></span>
                    <select
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                        className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-strong)] outline-none focus:border-blue-500"
                    >
                        {PAYMENT_OPTIONS.map((option) => <option key={option || 'empty'} value={option}>{option || 'Não informar'}</option>)}
                    </select>
                </label>

                <div className="flex gap-2 rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">
                    <i className="fas fa-circle-info mt-1 shrink-0" />
                    <p>O recibo comprova o pagamento do serviço. Ele não substitui nota fiscal quando a emissão for obrigatória.</p>
                </div>

                {message ? <p role="status" className="text-center text-xs font-semibold text-[var(--text-muted)]">{message}</p> : null}
            </div>
        </Modal>
    );
};

export default ReceiptModal;
