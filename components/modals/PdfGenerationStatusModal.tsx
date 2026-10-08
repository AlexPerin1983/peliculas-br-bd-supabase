import React, { useEffect, useMemo, useState } from 'react';
import type { Client, SavedPDF } from '../../types';
import ProposalShareModal from './ProposalShareModal';
import { getProposalKey } from '../../src/lib/generatedProposals';

type ShareResult = 'shared' | 'downloaded' | 'unavailable';

interface PdfGenerationStatusModalProps {
    status: 'generating' | 'success';
    onClose: () => void;
    onGoToHistory: () => void;
    onShare: () => Promise<ShareResult>;
    onPreview: () => boolean;
    canShare: boolean;
    canPreview: boolean;
    proposalForLink?: { client: Client; pdf: SavedPDF } | null;
    /** Duplica a opção trocando a película e gera o PDF da nova opção. */
    onDuplicateWithFilm?: () => void;
    /** Duplica com as trocas pedidas à IA (por voz ou texto). */
    onDuplicateWithAI?: () => void;
    /**
     * Propostas do cliente para enviar juntas num link só (a recém-gerada
     * incluída). Aparece depois de duplicar, com as marcadas em preselectedPdfKeys
     * (identificação estável, ver getProposalKey).
     */
    clientProposals?: SavedPDF[];
    preselectedPdfKeys?: string[];
    /** O olho de cada linha abre o PDF daquela opção, uma de cada vez. */
    onPreviewProposal?: (pdf: SavedPDF) => Promise<boolean>;
    /** Compartilha as marcadas, um PDF por opção (sem juntar). */
    onShareProposals?: (pdfs: SavedPDF[]) => Promise<ShareResult>;
    /**
     * Tira a opção da lista: exclui do histórico a versão tocada e as antigas
     * (menos as antigas aprovadas ou agendadas) e diz quantas saíram e ficaram.
     * A linha sai na hora; `done` termina quando o aparelho e o servidor confirmam.
     */
    onDeleteProposal?: (pdf: SavedPDF) => Promise<{ deleted: number; kept: number; done?: Promise<void> } | void>;
    /** Quantos PDFs cada linha representa (chave: getProposalKey) e quantos ficam. */
    proposalVersions?: Record<string, { total: number; kept: number }>;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const describeProposal = (pdf: SavedPDF) =>
    `${pdf.proposalOptionName || 'Proposta'} · ${formatCurrency(pdf.totalPreco)}`;

const shareMessageFor = (result: ShareResult, count = 1) => result === 'shared'
    ? count > 1 ? `${count} PDFs compartilhados, um por opção.` : 'PDF compartilhado com sucesso.'
    : result === 'downloaded'
        ? count > 1
            ? 'Este navegador não anexa PDFs diretamente. Os PDFs estão sendo baixados um a um; se ele perguntar, permita baixar vários arquivos.'
            : 'Este navegador não anexa PDFs diretamente. O arquivo foi baixado para você enviar.'
        : 'O PDF ainda não está disponível para compartilhar.';

// Mensagem depois da lixeira: quantos PDFs da opção saíram e quantos ficaram.
const deletedMessage = (name: string, result: { deleted: number; kept: number } | void) => {
    if (!result || (result.deleted <= 1 && result.kept === 0)) return `"${name}" foi excluída do histórico.`;
    if (result.kept === 0) return `"${name}" saiu da lista (${result.deleted} PDFs excluídos).`;
    const deleted = result.deleted === 1 ? '1 PDF excluído' : `${result.deleted} PDFs excluídos`;
    const kept = result.kept === 1
        ? 'a versão aprovada ou agendada ficou'
        : `${result.kept} versões aprovadas ou agendadas ficaram`;
    return `"${name}": ${deleted}; ${kept}.`;
};

const iconButton = 'flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

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
    onDuplicateWithAI,
    clientProposals = [],
    preselectedPdfKeys = [],
    onPreviewProposal,
    onShareProposals,
    onDeleteProposal,
    proposalVersions,
}) => {
    const [isSharing, setIsSharing] = useState(false);
    const [previewingKey, setPreviewingKey] = useState<string | null>(null);
    const [shareMessage, setShareMessage] = useState('');
    const [linkPdfs, setLinkPdfs] = useState<SavedPDF[] | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<string[]>(preselectedPdfKeys);
    const [confirmingDeleteKey, setConfirmingDeleteKey] = useState<string | null>(null);
    const [deletingKey, setDeletingKey] = useState<string | null>(null);

    const latestKey = proposalForLink ? getProposalKey(proposalForLink.pdf) : null;
    // Cliente com 2 ou mais opções: lista para conferir e mandar juntas. Depois
    // de aparecer, continua até o próximo PDF (excluir uma não muda a tela).
    const [keepsPicker, setKeepsPicker] = useState(false);
    const hasSeveralOptions = clientProposals.length > 1;
    useEffect(() => {
        setKeepsPicker(hasSeveralOptions);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [latestKey]);
    useEffect(() => {
        if (hasSeveralOptions) setKeepsPicker(true);
    }, [hasSeveralOptions]);
    const showsProposalPicker = !!proposalForLink && (hasSeveralOptions || keepsPicker);
    const cameFromDuplicate = preselectedPdfKeys.length > 1;
    const latestStillListed = clientProposals.some(pdf => getProposalKey(pdf) === latestKey);
    const selectedPdfs = useMemo(
        () => clientProposals.filter(pdf => selectedKeys.includes(getProposalKey(pdf))),
        [clientProposals, selectedKeys]
    );
    const selectedCount = selectedPdfs.length;

    useEffect(() => {
        if (status === 'generating') {
            setShareMessage('');
            setLinkPdfs(null);
            setConfirmingDeleteKey(null);
        }
    }, [status]);

    // Nova geração (outra duplicação): volta a marcar as opções sugeridas.
    const preselectedSignature = preselectedPdfKeys.join('\n');
    useEffect(() => {
        setSelectedKeys(preselectedSignature ? preselectedSignature.split('\n') : []);
    }, [preselectedSignature]);

    const runShare = async (share: () => Promise<ShareResult>, count = 1) => {
        setIsSharing(true);
        setShareMessage('');
        try {
            setShareMessage(shareMessageFor(await share(), count));
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

    const handlePreviewOne = async (pdf: SavedPDF) => {
        if (!onPreviewProposal) return;
        setPreviewingKey(getProposalKey(pdf));
        setShareMessage('');
        try {
            const opened = await onPreviewProposal(pdf);
            setShareMessage(opened
                ? `PDF de "${pdf.proposalOptionName || 'Proposta'}" aberto para conferência.`
                : 'Não foi possível abrir o PDF. Tente novamente.');
        } finally {
            setPreviewingKey(null);
        }
    };

    const toggleProposal = (key: string) => {
        setSelectedKeys(current => current.includes(key)
            ? current.filter(item => item !== key)
            : [...current, key]);
    };

    const allSelected = clientProposals.length > 0 && selectedCount === clientProposals.length;
    const toggleAll = () => {
        setSelectedKeys(allSelected ? [] : clientProposals.map(getProposalKey));
    };

    const handleDelete = async (pdf: SavedPDF) => {
        if (!onDeleteProposal) return;
        const key = getProposalKey(pdf);
        setDeletingKey(key);
        setShareMessage('');
        try {
            const result = await onDeleteProposal(pdf);
            setSelectedKeys(current => current.filter(item => item !== key));
            setConfirmingDeleteKey(null);
            setShareMessage(deletedMessage(pdf.proposalOptionName || 'Proposta', result));
            result?.done?.catch(() => {
                setShareMessage('Não foi possível excluir tudo. A lista foi atualizada; tente de novo.');
            });
        } catch {
            setShareMessage('Não foi possível excluir. Tente novamente.');
        } finally {
            setDeletingKey(null);
        }
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

    // Na lista, cada opção tem o seu "ver" e Compartilhar usa as marcadas.
    const usesSelection = showsProposalPicker && !!onShareProposals;
    const shareLabel = usesSelection && selectedCount > 1 ? `Compartilhar ${selectedCount}` : 'Compartilhar';

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div role="dialog" aria-modal="true" aria-labelledby="pdf-status-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <i className="fas fa-check text-lg text-green-600 dark:text-green-400" aria-hidden="true"></i>
                    </div>
                    <div className="min-w-0">
                        <h2 id="pdf-status-title" className="text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">
                            {cameFromDuplicate ? 'Nova opção gerada' : 'Orçamento gerado'}
                        </h2>
                        <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                            {!proposalForLink
                                ? 'Seu PDF foi salvo.'
                                : showsProposalPicker && !latestStillListed
                                    ? 'Escolha as opções para enviar.'
                                    : describeProposal(proposalForLink.pdf)}
                        </p>
                    </div>
                </div>

                {showsProposalPicker ? (
                    <section className="mt-5" aria-labelledby="pdf-status-send-title">
                        <div className="flex items-baseline justify-between gap-2">
                            <h3 id="pdf-status-send-title" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Enviar ao cliente</h3>
                            {clientProposals.length > 2 ? (
                                <button type="button" onClick={toggleAll} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                                    <span className="text-xs font-semibold">{allSelected ? 'Desmarcar todas' : 'Marcar todas'}</span>
                                </button>
                            ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {onPreviewProposal
                                ? 'Marque as opções para enviar. Toque no olho para conferir o PDF de cada uma.'
                                : 'Marque as opções para enviar ao cliente.'}
                        </p>

                        {clientProposals.length === 0 ? (
                            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                                Nenhuma proposta deste cliente na lista.
                            </p>
                        ) : (
                            <ul className="mt-2 space-y-1.5">
                                {clientProposals.map(pdf => {
                                    const key = getProposalKey(pdf);
                                    const isSelected = selectedKeys.includes(key);
                                    const name = pdf.proposalOptionName || 'Proposta';
                                    const isConfirming = confirmingDeleteKey === key;
                                    const totalVersions = proposalVersions?.[key]?.total ?? 1;
                                    const keptVersions = proposalVersions?.[key]?.kept ?? 0;
                                    const deleteCount = Math.max(1, totalVersions - keptVersions);
                                    return (
                                        <li key={key}>
                                            <div className={`flex items-center rounded-lg border transition-colors ${isSelected
                                                ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                                                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60'}`}
                                            >
                                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleProposal(key)}
                                                        className="h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</span>
                                                            {key === latestKey ? (
                                                                <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">Nova</span>
                                                            ) : null}
                                                        </span>
                                                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                            {formatCurrency(pdf.totalPreco)} · {new Date(pdf.date).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </span>
                                                </label>
                                                {onPreviewProposal ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => { void handlePreviewOne(pdf); }}
                                                        disabled={previewingKey === key}
                                                        aria-label={`Ver PDF de ${name}`}
                                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                                    >
                                                        <i className={`fas ${previewingKey === key ? 'fa-spinner fa-spin' : 'fa-eye'} text-sm`} aria-hidden="true"></i>
                                                    </button>
                                                ) : null}
                                                {onDeleteProposal ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmingDeleteKey(isConfirming ? null : key)}
                                                        aria-label={`Excluir ${name}`}
                                                        aria-expanded={isConfirming}
                                                        className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                                                    >
                                                        <i className="fas fa-trash-can text-sm" aria-hidden="true"></i>
                                                    </button>
                                                ) : null}
                                            </div>
                                            {isConfirming ? (
                                                <div role="alertdialog" aria-label={`Confirmar exclusão de ${name}`} className="mt-1 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/30">
                                                    <span className="min-w-0 flex-1 text-xs font-medium text-red-800 dark:text-red-200">
                                                        Excluir do histórico?
                                                        {totalVersions > 1 ? (
                                                            <span className="block font-normal text-red-700 dark:text-red-300">
                                                                {keptVersions > 0
                                                                    ? `São ${totalVersions} PDFs desta opção; ${keptVersions === 1 ? 'o aprovado ou agendado fica' : `${keptVersions} aprovados ou agendados ficam`}.`
                                                                    : `São ${totalVersions} PDFs desta opção.`}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmingDeleteKey(null)}
                                                        disabled={deletingKey === key}
                                                        className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                                                    >
                                                        <span className="text-xs font-semibold">Cancelar</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { void handleDelete(pdf); }}
                                                        disabled={deletingKey === key}
                                                        className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                                    >
                                                        <span className="text-xs font-semibold">{deletingKey === key ? 'Excluindo…' : deleteCount > 1 ? `Excluir os ${deleteCount}` : 'Excluir'}</span>
                                                    </button>
                                                </div>
                                            ) : null}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <button
                            type="button"
                            onClick={() => setLinkPdfs(selectedPdfs)}
                            disabled={selectedCount === 0}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                        >
                            <i className="fab fa-whatsapp" aria-hidden="true"></i>
                            <span className="font-semibold">
                                {selectedCount === 0
                                    ? 'Marque ao menos uma opção'
                                    : selectedCount === 1 ? 'Enviar 1 opção pelo WhatsApp' : `Enviar as ${selectedCount} pelo WhatsApp`}
                            </span>
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
                        <span className="font-semibold">Criar link e enviar</span>
                    </button>
                )}

                <div className={`mt-3 grid gap-2 ${usesSelection ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {usesSelection ? (
                        <button
                            type="button"
                            onClick={() => { void runShare(() => onShareProposals!(selectedPdfs), selectedCount); }}
                            disabled={selectedCount === 0 || isSharing}
                            aria-label={selectedCount > 1 ? `Compartilhar os ${selectedCount} PDFs` : 'Compartilhar PDF'}
                            className={iconButton}
                        >
                            <i className={`fas ${isSharing ? 'fa-spinner fa-spin' : 'fa-share-nodes'} text-base`} aria-hidden="true"></i>
                            <span className="whitespace-nowrap text-xs font-semibold">{isSharing ? 'Preparando' : shareLabel}</span>
                        </button>
                    ) : (
                        <>
                            <button type="button" onClick={handlePreview} disabled={!canPreview} aria-label="Visualizar PDF" className={iconButton}>
                                <i className="fas fa-eye text-base" aria-hidden="true"></i>
                                <span className="whitespace-nowrap text-xs font-semibold">Ver PDF</span>
                            </button>
                            <button type="button" onClick={() => { void runShare(onShare); }} disabled={!canShare || isSharing} aria-label="Compartilhar PDF" className={iconButton}>
                                <i className={`fas ${isSharing ? 'fa-spinner fa-spin' : 'fa-share-nodes'} text-base`} aria-hidden="true"></i>
                                <span className="whitespace-nowrap text-xs font-semibold">{isSharing ? 'Preparando' : 'Compartilhar'}</span>
                            </button>
                        </>
                    )}
                    <button type="button" onClick={onGoToHistory} aria-label="Ver Histórico" className={iconButton}>
                        <i className="fas fa-clock-rotate-left text-base" aria-hidden="true"></i>
                        <span className="whitespace-nowrap text-xs font-semibold">Histórico</span>
                    </button>
                </div>
                {shareMessage ? <p role="status" className="mt-2 text-center text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{shareMessage}</p> : null}

                {onDuplicateWithFilm ? (
                    <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700" aria-labelledby="pdf-status-duplicate-title">
                        <h3 id="pdf-status-duplicate-title" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mandar outra opção ao cliente</h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {onDuplicateWithAI
                                ? 'Escolha a película ou peça à IA; o PDF da nova opção sai pronto.'
                                : 'Escolha a película e o PDF da nova opção sai pronto.'}
                        </p>
                        <button
                            type="button"
                            onClick={onDuplicateWithFilm}
                            className="mt-2 inline-flex w-full items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            <i className="fas fa-copy w-4 text-center text-slate-500 dark:text-slate-400" aria-hidden="true"></i>
                            <span className="text-sm font-semibold">Duplicar com outra película</span>
                        </button>
                        {onDuplicateWithAI ? (
                            <button
                                type="button"
                                onClick={onDuplicateWithAI}
                                className="mt-2 inline-flex w-full items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                <i className="fas fa-wand-magic-sparkles w-4 text-center text-violet-500 dark:text-violet-400" aria-hidden="true"></i>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold">Duplicar com IA</span>
                                    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">"Mantém o jateado e troca a outra pela Window Premium"</span>
                                </span>
                            </button>
                        ) : null}
                    </section>
                ) : null}

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                    <span className="text-sm font-semibold">Fechar</span>
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
