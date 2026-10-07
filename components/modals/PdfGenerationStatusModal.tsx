import React, { useEffect, useMemo, useState } from 'react';
import type { Client, SavedPDF } from '../../types';
import ProposalShareModal from './ProposalShareModal';

interface PdfGenerationStatusModalProps {
    status: 'generating' | 'success';
    onClose: () => void;
    onGoToHistory: () => void;
    onShare: () => Promise<'shared' | 'downloaded' | 'unavailable'>;
    onPreview: () => boolean;
    canShare: boolean;
    canPreview: boolean;
    proposalForLink?: { client: Client; pdf: SavedPDF } | null;
    /** Duplica a opção trocando a película e gera o PDF da nova opção. */
    onDuplicateWithFilm?: () => void;
    /**
     * Propostas do cliente para enviar juntas num link só (a recém-gerada
     * incluída). Aparece depois de duplicar, com as marcadas em preselectedPdfIds.
     */
    clientProposals?: SavedPDF[];
    preselectedPdfIds?: number[];
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const describeProposal = (pdf: SavedPDF) =>
    `${pdf.proposalOptionName || 'Proposta'} · ${formatCurrency(pdf.totalPreco)}`;

const iconButton = 'flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

const PdfGenerationStatusModal: React.FC<PdfGenerationStatusModalProps> = ({
    status,
    onClose,
    onGoToHistory,
    onShare,
    onPreview,
    canShare,
    canPreview,
    proposalForLink,
    onDuplicateWithFilm,
    clientProposals = [],
    preselectedPdfIds = [],
}) => {
    const [isSharing, setIsSharing] = useState(false);
    const [shareMessage, setShareMessage] = useState('');
    const [linkPdfs, setLinkPdfs] = useState<SavedPDF[] | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>(preselectedPdfIds);

    // Depois de duplicar: lista as propostas do cliente para mandar juntas.
    const showsProposalPicker = !!proposalForLink && preselectedPdfIds.length > 1 && clientProposals.length > 1;
    const selectedPdfs = useMemo(
        () => clientProposals.filter(pdf => pdf.id != null && selectedIds.includes(pdf.id)),
        [clientProposals, selectedIds]
    );

    useEffect(() => {
        if (status === 'generating') {
            setShareMessage('');
            setLinkPdfs(null);
        }
    }, [status]);

    // Nova geração (outra duplicação): volta a marcar as opções sugeridas.
    const preselectedKey = preselectedPdfIds.join(',');
    useEffect(() => {
        setSelectedIds(preselectedKey ? preselectedKey.split(',').map(Number) : []);
    }, [preselectedKey]);

    const handleShare = async () => {
        setIsSharing(true);
        setShareMessage('');
        try {
            const result = await onShare();
            setShareMessage(result === 'shared'
                ? 'PDF compartilhado com sucesso.'
                : result === 'downloaded'
                    ? 'Este navegador não anexa PDFs diretamente. O arquivo foi baixado para você enviar.'
                    : 'O PDF ainda não está disponível para compartilhar.');
        } catch (error) {
            if ((error as DOMException)?.name !== 'AbortError') setShareMessage('Não foi possível compartilhar. Tente novamente.');
        } finally {
            setIsSharing(false);
        }
    };

    const handlePreview = () => {
        setShareMessage(onPreview()
            ? 'PDF aberto para conferência.'
            : 'O PDF ainda não está disponível para visualizar.');
    };

    const toggleProposal = (pdfId: number) => {
        setSelectedIds(current => current.includes(pdfId)
            ? current.filter(id => id !== pdfId)
            : [...current, pdfId]);
    };

    if (status === 'generating') {
        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8 text-center flex flex-col items-center">
                    <div className="loader mb-4"></div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Gerando Orçamento...</h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">Por favor, aguarde um momento.</p>
                </div>
            </div>
        );
    }

    if (status !== 'success') return null;

    if (linkPdfs && proposalForLink) {
        return (
            <ProposalShareModal
                isOpen
                client={proposalForLink.client}
                pdfs={linkPdfs}
                autoCreate
                onClose={() => setLinkPdfs(null)}
            />
        );
    }

    const sendCount = selectedPdfs.length;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div role="dialog" aria-modal="true" aria-labelledby="pdf-status-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <i className="fas fa-check text-lg text-green-600 dark:text-green-400" aria-hidden="true"></i>
                    </div>
                    <div className="min-w-0">
                        <h2 id="pdf-status-title" className="text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">
                            {showsProposalPicker ? 'Nova opção gerada' : 'Orçamento gerado'}
                        </h2>
                        <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                            {proposalForLink ? describeProposal(proposalForLink.pdf) : 'Seu PDF foi salvo.'}
                        </p>
                    </div>
                </div>

                {showsProposalPicker ? (
                    <section className="mt-5" aria-labelledby="pdf-status-send-title">
                        <h3 id="pdf-status-send-title" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Enviar ao cliente</h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Marque as opções que vão no mesmo link.</p>
                        <ul className="mt-2 space-y-1.5">
                            {clientProposals.map(pdf => pdf.id != null && (
                                <li key={pdf.id}>
                                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${selectedIds.includes(pdf.id)
                                        ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(pdf.id)}
                                            onChange={() => toggleProposal(pdf.id!)}
                                            className="h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{pdf.proposalOptionName || 'Proposta'}</span>
                                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                {formatCurrency(pdf.totalPreco)} · {new Date(pdf.date).toLocaleDateString('pt-BR')}
                                            </span>
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            onClick={() => setLinkPdfs(selectedPdfs)}
                            disabled={sendCount === 0}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                            <i className="fab fa-whatsapp" aria-hidden="true"></i>
                            {sendCount === 0
                                ? 'Marque ao menos uma opção'
                                : sendCount === 1 ? 'Enviar 1 opção pelo WhatsApp' : `Enviar as ${sendCount} pelo WhatsApp`}
                        </button>
                    </section>
                ) : (
                    <button
                        type="button"
                        onClick={() => proposalForLink && setLinkPdfs([proposalForLink.pdf])}
                        disabled={!proposalForLink}
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                        <i className="fab fa-whatsapp" aria-hidden="true"></i>
                        Criar link e enviar
                    </button>
                )}

                <div className="mt-3 grid grid-cols-3 gap-2">
                    <button type="button" onClick={handlePreview} disabled={!canPreview} aria-label="Visualizar PDF" className={iconButton}>
                        <i className="fas fa-eye text-base" aria-hidden="true"></i>
                        Ver PDF
                    </button>
                    <button type="button" onClick={() => { void handleShare(); }} disabled={!canShare || isSharing} aria-label="Compartilhar PDF" className={iconButton}>
                        <i className={`fas ${isSharing ? 'fa-spinner fa-spin' : 'fa-share-nodes'} text-base`} aria-hidden="true"></i>
                        {isSharing ? 'Preparando' : 'Compartilhar'}
                    </button>
                    <button type="button" onClick={onGoToHistory} aria-label="Ver Histórico" className={iconButton}>
                        <i className="fas fa-clock-rotate-left text-base" aria-hidden="true"></i>
                        Histórico
                    </button>
                </div>
                {shareMessage ? <p role="status" className="mt-2 text-center text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{shareMessage}</p> : null}

                {onDuplicateWithFilm ? (
                    <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700" aria-labelledby="pdf-status-duplicate-title">
                        <h3 id="pdf-status-duplicate-title" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mandar outra opção ao cliente</h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Escolha a película e o PDF da nova opção sai pronto.</p>
                        <button
                            type="button"
                            onClick={onDuplicateWithFilm}
                            className="mt-2 inline-flex w-full items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            <i className="fas fa-copy w-4 text-center text-slate-500 dark:text-slate-400" aria-hidden="true"></i>
                            Duplicar com outra película
                        </button>
                    </section>
                ) : null}

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                    Fechar
                </button>
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default PdfGenerationStatusModal;
