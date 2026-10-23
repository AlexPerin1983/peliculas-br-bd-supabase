import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Client, SavedPDF } from '../../types';
import ProposalShareModal from './ProposalShareModal';
import { getProposalKey, suggestOptionNames } from '../../src/lib/generatedProposals';

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
    proposalVersions?: Record<string, {
        total: number;
        kept: number;
        locked?: boolean;
        lockedBy?: 'approved' | 'link' | null;
        /** Já enviada ao cliente por link (etiqueta "Link"). */
        linked?: boolean;
    }>;
    /** Falso enquanto o histórico do cliente carrega (a lixeira ainda não sabe todas as versões). */
    canDeleteProposals?: boolean;
    /** Troca o nome da opção (PDF refeito e aba do orçamento). Deslizar a linha para a direita. */
    onRenameProposal?: (pdf: SavedPDF, name: string) => Promise<void>;
    /** Abre a opção no orçamento para mudar medidas e valores. */
    onEditProposal?: (pdf: SavedPDF) => void;
    /** Linhas cuja opção ainda está aberta no orçamento (getProposalKey): só elas têm "Editar". */
    editableProposalKeys?: string[];
    /** Aberto pelo atalho "Enviar ao cliente": nada foi gerado agora. */
    openedFromShortcut?: boolean;
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
        ? 'a versão aprovada, agendada ou com link ficou'
        : `${result.kept} versões aprovadas, agendadas ou com link ficaram`;
    return `"${name}": ${deleted}; ${kept}.`;
};

const iconButton = 'flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

interface SwipeAction {
    key: string;
    label: string;
    icon: string;
    className: string;
    onClick: () => void;
}

const SWIPE_ACTION_WIDTH = 76;
const SWIPE_SNAP = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * Linha que desliza para a direita e mostra ações à esquerda, como as medidas
 * do orçamento. Só no toque; tocar na linha aberta fecha sem marcar a opção.
 */
const SwipeRow: React.FC<{
    actions: SwipeAction[];
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}> = ({ actions, isOpen, onOpenChange, children }) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const gesture = useRef({ x: 0, y: 0, base: 0, axis: null as 'x' | 'y' | null, moved: false });
    const [isDragging, setIsDragging] = useState(false);
    const revealWidth = actions.length * SWIPE_ACTION_WIDTH;

    const moveTo = (x: number, animate: boolean) => {
        const row = rowRef.current;
        if (!row) return;
        row.style.transition = animate ? SWIPE_SNAP : 'none';
        row.style.transform = `translateX(${x}px)`;
    };

    useEffect(() => {
        moveTo(isOpen ? revealWidth : 0, true);
    }, [isOpen, revealWidth]);

    if (actions.length === 0) return <>{children}</>;

    const handleTouchStart = (event: React.TouchEvent) => {
        const touch = event.touches[0];
        gesture.current = { x: touch.clientX, y: touch.clientY, base: isOpen ? revealWidth : 0, axis: null, moved: false };
    };

    const handleTouchMove = (event: React.TouchEvent) => {
        const touch = event.touches[0];
        const deltaX = touch.clientX - gesture.current.x;
        const deltaY = touch.clientY - gesture.current.y;
        if (gesture.current.axis === null) {
            if (Math.abs(deltaX) > 6 && Math.abs(deltaX) > Math.abs(deltaY)) {
                gesture.current.axis = 'x';
                setIsDragging(true);
            } else if (Math.abs(deltaY) > 10) {
                gesture.current.axis = 'y';
            }
        }
        if (gesture.current.axis !== 'x') return;
        gesture.current.moved = true;
        let x = gesture.current.base + deltaX;
        // Resistência nas pontas: não passa para a esquerda nem muito além das ações.
        if (x < 0) x *= 0.2;
        if (x > revealWidth) x = revealWidth + (x - revealWidth) * 0.35;
        moveTo(x, false);
    };

    const handleTouchEnd = (event: React.TouchEvent) => {
        if (gesture.current.axis !== 'x') return;
        const deltaX = (event.changedTouches[0]?.clientX ?? gesture.current.x) - gesture.current.x;
        const x = gesture.current.base + deltaX;
        const open = isOpen ? x > revealWidth - 40 : x > 40;
        if (open && !isOpen && navigator.vibrate) navigator.vibrate(30);
        moveTo(open ? revealWidth : 0, true);
        setIsDragging(false);
        onOpenChange(open);
    };

    // O toque que terminou um deslize (ou que fecha a linha aberta) não marca a opção.
    const handleClickCapture = (event: React.MouseEvent) => {
        if (gesture.current.moved || isOpen) {
            event.preventDefault();
            event.stopPropagation();
            gesture.current.moved = false;
            if (isOpen) onOpenChange(false);
        }
    };

    return (
        <div className="relative overflow-hidden rounded-lg">
            <div
                className={`absolute inset-y-0 left-0 flex overflow-hidden rounded-l-lg transition-opacity ${isOpen || isDragging ? 'opacity-100' : 'opacity-0'}`}
                style={{ width: revealWidth }}
                aria-hidden={!isOpen}
            >
                {actions.map(action => (
                    <button
                        key={action.key}
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => {
                            onOpenChange(false);
                            action.onClick();
                        }}
                        className={`flex h-full flex-col items-center justify-center gap-1 text-white transition-colors ${action.className}`}
                        style={{ width: SWIPE_ACTION_WIDTH }}
                    >
                        <i className={`${action.icon} text-base`} aria-hidden="true"></i>
                        <span className="text-[10px] font-bold uppercase">{action.label}</span>
                    </button>
                ))}
            </div>
            <div
                ref={rowRef}
                style={{ touchAction: 'pan-y' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClickCapture={handleClickCapture}
                className="relative rounded-lg bg-white dark:bg-slate-800"
            >
                {children}
            </div>
        </div>
    );
};

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
    canDeleteProposals = true,
    onRenameProposal,
    onEditProposal,
    editableProposalKeys = [],
    openedFromShortcut = false,
}) => {
    const [isSharing, setIsSharing] = useState(false);
    const [previewingKey, setPreviewingKey] = useState<string | null>(null);
    const [shareMessage, setShareMessage] = useState('');
    const [linkPdfs, setLinkPdfs] = useState<SavedPDF[] | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<string[]>(preselectedPdfKeys);
    const [confirmingDeleteKey, setConfirmingDeleteKey] = useState<string | null>(null);
    const [deletingKey, setDeletingKey] = useState<string | null>(null);
    const [swipedKey, setSwipedKey] = useState<string | null>(null);
    const [renamingKey, setRenamingKey] = useState<string | null>(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [renameError, setRenameError] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);

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
    // Pelo atalho "Enviar ao cliente" é sempre a lista, mesmo com uma opção só.
    const showsProposalPicker = !!proposalForLink && (hasSeveralOptions || keepsPicker || openedFromShortcut);
    const latestIsLinked = !!latestKey && !!proposalVersions?.[latestKey]?.linked;
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
            setSwipedKey(null);
            setRenamingKey(null);
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

    const startRename = (pdf: SavedPDF) => {
        setSwipedKey(null);
        setConfirmingDeleteKey(null);
        setRenamingKey(getProposalKey(pdf));
        setRenameDraft(pdf.proposalOptionName || '');
        setRenameError('');
    };

    const cancelRename = () => {
        if (isRenaming) return;
        setRenamingKey(null);
        setRenameError('');
    };

    const submitRename = async (pdf: SavedPDF) => {
        if (!onRenameProposal || isRenaming) return;
        const name = renameDraft.trim().replace(/\s+/g, ' ');
        const key = getProposalKey(pdf);
        if (!name) {
            setRenameError('Digite um nome para a opção.');
            return;
        }
        if (name === (pdf.proposalOptionName || '').trim()) {
            setRenamingKey(null);
            return;
        }
        // Dois nomes iguais confundem a lista e o cliente.
        const taken = clientProposals.some(other => (
            getProposalKey(other) !== key
            && (other.proposalOptionName || '').trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR')
        ));
        if (taken) {
            setRenameError('Já existe uma opção com esse nome.');
            return;
        }
        setIsRenaming(true);
        setRenameError('');
        setShareMessage('');
        try {
            await onRenameProposal(pdf, name);
            setRenamingKey(null);
            setShareMessage(`Agora é "${name}", no PDF e no orçamento.`);
        } catch (error) {
            setRenameError((error as Error)?.message || 'Não foi possível renomear. Tente novamente.');
        } finally {
            setIsRenaming(false);
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
                        <i className={`fas ${openedFromShortcut ? 'fa-paper-plane text-base' : 'fa-check text-lg'} text-green-600 dark:text-green-400`} aria-hidden="true"></i>
                    </div>
                    <div className="min-w-0">
                        <h2 id="pdf-status-title" className="text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">
                            {openedFromShortcut ? 'Orçamentos do cliente' : cameFromDuplicate ? 'Nova opção gerada' : 'Orçamento gerado'}
                        </h2>
                        <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                            {openedFromShortcut && proposalForLink
                                ? proposalForLink.client.nome
                                : !proposalForLink
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
                            {onRenameProposal ? (
                                <span className="sm:hidden"> Deslize uma opção para a direita para renomear{onEditProposal && editableProposalKeys.length > 0 ? ' ou editar' : ''}.</span>
                            ) : null}
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
                                    const isLocked = !!proposalVersions?.[key]?.locked;
                                    const lockedByLink = proposalVersions?.[key]?.lockedBy === 'link';
                                    const isLinked = !!proposalVersions?.[key]?.linked;
                                    const isRenamingRow = renamingKey === key;
                                    const swipeActions: SwipeAction[] = isRenamingRow ? [] : [
                                        ...(onRenameProposal ? [{
                                            key: 'rename',
                                            label: 'Renomear',
                                            icon: 'fas fa-i-cursor',
                                            className: 'bg-slate-600 hover:bg-slate-700',
                                            onClick: () => startRename(pdf),
                                        }] : []),
                                        ...(onEditProposal && editableProposalKeys.includes(key) ? [{
                                            key: 'edit',
                                            label: 'Editar',
                                            icon: 'fas fa-pen',
                                            className: 'bg-blue-600 hover:bg-blue-700',
                                            onClick: () => onEditProposal(pdf),
                                        }] : []),
                                    ];
                                    if (isRenamingRow) {
                                        const renameSuggestions = suggestOptionNames(
                                            pdf,
                                            clientProposals.filter(other => getProposalKey(other) !== key).map(other => other.proposalOptionName || ''),
                                        );
                                        return (
                                            <li key={key}>
                                                <form
                                                    onSubmit={event => { event.preventDefault(); void submitRename(pdf); }}
                                                    className="flex items-center gap-2 rounded-lg border border-blue-400 bg-white p-1.5 dark:border-blue-500 dark:bg-slate-900"
                                                >
                                                    <input
                                                        type="text"
                                                        value={renameDraft}
                                                        onChange={event => { setRenameDraft(event.target.value); if (renameError) setRenameError(''); }}
                                                        onKeyDown={event => { if (event.key === 'Escape') cancelRename(); }}
                                                        maxLength={80}
                                                        autoFocus
                                                        disabled={isRenaming}
                                                        aria-label={`Novo nome para ${name}`}
                                                        placeholder="Ex.: Janelas da sala"
                                                        // O CSS global (font: inherit e o contorno do :focus-visible) vence as classes; por isso aqui é inline.
                                                        style={{ fontSize: 16, fontWeight: 500, outline: 'none' }}
                                                        className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-slate-900 caret-blue-600 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-70 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:caret-blue-400 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={isRenaming || !renameDraft.trim()}
                                                        className="flex h-10 shrink-0 items-center rounded-md bg-blue-600 px-3 text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                                                    >
                                                        <span className="text-xs font-semibold">{isRenaming ? 'Salvando…' : 'Salvar'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelRename}
                                                        disabled={isRenaming}
                                                        aria-label="Cancelar renomear"
                                                        className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                                                    >
                                                        <i className="fas fa-xmark text-sm" aria-hidden="true"></i>
                                                    </button>
                                                </form>
                                                {renameSuggestions.length > 0 ? (
                                                    <div className="mt-2 flex flex-wrap gap-1.5 px-0.5" role="group" aria-label="Nomes prontos">
                                                        {renameSuggestions.map(suggestion => {
                                                            const isPicked = suggestion === renameDraft.trim();
                                                            return (
                                                                <button
                                                                    key={suggestion}
                                                                    type="button"
                                                                    onClick={() => { setRenameDraft(suggestion); setRenameError(''); }}
                                                                    disabled={isRenaming}
                                                                    aria-pressed={isPicked}
                                                                    className={`flex h-8 max-w-full items-center rounded-full border px-3 transition-colors disabled:opacity-60 ${isPicked
                                                                        ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                                                                        : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300'}`}
                                                                >
                                                                    <span className="truncate text-xs font-semibold">{suggestion}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ) : null}
                                                <p className={`mt-1 px-1 text-xs ${renameError ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`} role={renameError ? 'alert' : undefined}>
                                                    {renameError || (isRenaming ? 'Refazendo o PDF com o nome novo…' : 'O nome muda no PDF, na aba do orçamento e na página do cliente.')}
                                                </p>
                                            </li>
                                        );
                                    }
                                    return (
                                        <li key={key}>
                                            <SwipeRow
                                                actions={swipeActions}
                                                isOpen={swipedKey === key}
                                                onOpenChange={open => setSwipedKey(current => (open ? key : current === key ? null : current))}
                                            >
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
                                                            {key === latestKey && !openedFromShortcut ? (
                                                                <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">Nova</span>
                                                            ) : null}
                                                            {isLinked ? (
                                                                <span
                                                                    title="Já enviada ao cliente por link"
                                                                    className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                                                >
                                                                    <i className="fas fa-link text-[8px]" aria-hidden="true"></i>
                                                                    Link
                                                                </span>
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
                                                {onRenameProposal ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => startRename(pdf)}
                                                        aria-label={`Renomear ${name}`}
                                                        title="Renomear"
                                                        className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100 sm:flex"
                                                    >
                                                        <i className="fas fa-i-cursor text-sm" aria-hidden="true"></i>
                                                    </button>
                                                ) : null}
                                                {onDeleteProposal ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmingDeleteKey(isConfirming ? null : key)}
                                                        disabled={!canDeleteProposals}
                                                        title={canDeleteProposals ? undefined : 'Carregando o histórico do cliente…'}
                                                        aria-label={`Excluir ${name}`}
                                                        aria-expanded={isConfirming}
                                                        className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 dark:hover:bg-red-950/40"
                                                    >
                                                        <i className="fas fa-trash-can text-sm" aria-hidden="true"></i>
                                                    </button>
                                                ) : null}
                                            </div>
                                            </SwipeRow>
                                            {isConfirming ? (
                                                <div role="alertdialog" aria-label={`Confirmar exclusão de ${name}`} className="mt-1 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/30">
                                                    <span className="min-w-0 flex-1 text-xs font-medium text-red-800 dark:text-red-200">
                                                        Excluir do histórico?
                                                        {isLocked ? (
                                                            <span className="block font-semibold text-red-800 dark:text-red-200">
                                                                {lockedByLink
                                                                    ? 'Este está num link enviado ao cliente; ele deixa de ver esta opção.'
                                                                    : 'Este está aprovado ou agendado; o agendamento também sai.'}
                                                            </span>
                                                        ) : null}
                                                        {totalVersions > 1 ? (
                                                            <span className="block font-normal text-red-700 dark:text-red-300">
                                                                {keptVersions > 0
                                                                    ? `São ${totalVersions} PDFs desta opção; ${keptVersions === 1 ? 'o aprovado, agendado ou com link fica' : `${keptVersions} aprovados, agendados ou com link ficam`}.`
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
                                                        <span className="text-xs font-semibold">{deletingKey === key ? 'Excluindo…' : `${deleteCount > 1 ? `Excluir os ${deleteCount}` : 'Excluir'}${isLocked ? ' mesmo assim' : ''}`}</span>
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
                        <span className="font-semibold">{latestIsLinked ? 'Enviar de novo pelo WhatsApp' : 'Criar link e enviar'}</span>
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
