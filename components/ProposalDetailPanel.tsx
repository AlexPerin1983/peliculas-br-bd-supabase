import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
    AlarmClock,
    AlertTriangle,
    ArrowLeft,
    BadgePercent,
    CalendarClock,
    Check,
    CheckCircle2,
    ChevronDown,
    Copy,
    ExternalLink,
    HandCoins,
    History,
    Lightbulb,
    LoaderCircle,
    MessageCircle,
    MessageSquareText,
    PencilLine,
    Phone,
    PhoneCall,
    RotateCcw,
    Send,
    Sparkles,
    ThumbsDown,
    X,
} from 'lucide-react';
import {
    buildProposalPortalUrl,
    markCompanyProposalPortalRead,
    markProposalPortalLost,
    recordProposalFollowUp,
    reopenProposalPortal,
    sendCompanyProposalMessage,
    snoozeProposalFollowUp,
    type CompanyProposalPortal,
    type ProposalPortalMessage,
} from '../src/lib/proposalPortal';
import {
    buildFollowUpVariantMessage,
    FOLLOW_UP_VARIANTS,
    getNegotiationTip,
    buildFollowUpTimeline,
    describeClosed,
    describeNextContact,
    FOLLOW_UP_TEMPLATE_STEPS,
    getFollowUpItem,
    LOST_REASONS,
    openedRecently,
    portalTotal,
    snoozeDate,
    SNOOZE_PRESETS,
    type ClientProposalGroup,
    type FollowUpItem,
    type FollowUpTemplates,
    type FollowUpTemplateStep,
} from '../src/lib/proposalFollowUpQueue';
import { buildProposalReactivationMessages, formatConditionExpiry, getProposalCondition } from '../src/lib/proposalCondition';
import { buildProposalWhatsAppUrl } from '../src/lib/proposalMessages';
import { registerBackHandler } from '../src/lib/backButton';
import ProposalConditionModal from './modals/ProposalConditionModal';
import ProposalOfferSheet from './ProposalOfferSheet';

type CompanyProposal = CompanyProposalPortal['proposals'][number];

interface ProposalDetailPanelProps {
    group: ClientProposalGroup;
    // Link aberto primeiro (ex.: notificação de um link anterior); padrão: o principal.
    initialPortalId?: string | null;
    templates: FollowUpTemplates;
    now?: number;
    onClose: () => void;
    onChanged: () => Promise<void> | void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const ATTENTION_WINDOW_MS = 24 * 60 * 60 * 1000;
const shortDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const timesLabel = (count: number) => (count === 1 ? '1 vez' : `${count} vezes`);

const toneDot: Record<string, string> = {
    neutral: 'bg-slate-300 dark:bg-slate-600',
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
};

const actionMeta = (message: ProposalPortalMessage) => {
    if (message.kind === 'approved') return { label: 'Aprovou a proposta', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' };
    if (message.kind === 'rejected') return { label: 'Recusou a proposta', icon: ThumbsDown, color: 'text-red-700 bg-red-50' };
    if (message.kind === 'negotiation') return { label: 'Enviou uma contraproposta', icon: HandCoins, color: 'text-blue-700 bg-blue-50' };
    if (message.kind === 'condition_extended') return { label: 'Condição prorrogada', icon: CalendarClock, color: 'text-blue-700 bg-blue-50' };
    if (message.kind === 'condition_updated') return { label: 'Condição atualizada', icon: PencilLine, color: 'text-violet-700 bg-violet-50' };
    return null;
};

const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const area = document.createElement('textarea');
    area.value = value;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
};

export const OpenedNowBadge: React.FC = () => (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" title="O cliente abriu o link nos últimos minutos">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        Abriu agora
    </span>
);

const isTemplateStep = (step: string): step is FollowUpTemplateStep => FOLLOW_UP_TEMPLATE_STEPS.some(item => item.step === step);

const ReactivationMessagesModal: React.FC<{
    portal: CompanyProposalPortal;
    proposal: CompanyProposal;
    onChoose: (message: string) => void;
    onClose: () => void;
}> = ({ portal, proposal, onChoose, onClose }) => {
    const condition = getProposalCondition(proposal);
    if (!condition) return null;
    const messages = buildProposalReactivationMessages({
        clientName: portal.clientName,
        finalValue: condition.finalValue,
        discountAmount: condition.discountAmount,
        expiresAt: condition.expiresAt,
    });

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10035] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Mensagens prontas">
            <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar" />
            <section className="relative w-full max-w-lg rounded-t-[26px] bg-[var(--surface)] p-5 shadow-2xl sm:mx-4 sm:rounded-[26px]">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><Sparkles className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-[var(--text-strong)]">Escolha uma mensagem pronta</h2>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Você poderá editar antes de enviar.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-4 space-y-2">
                    {messages.map(item => (
                        <button key={item.label} type="button" onClick={() => onChoose(item.text)} className="w-full rounded-2xl border border-[var(--border-subtle)] p-4 text-left transition hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/25">
                            <span className="block text-xs font-semibold text-[var(--text-strong)]">{item.label}</span>
                            <span className="mt-1.5 line-clamp-3 block text-xs leading-5 text-[var(--text-muted)]">{item.text}</span>
                        </button>
                    ))}
                </div>
            </section>
        </div>,
        document.body,
    );
};

// Próximo passo sugerido, com a mensagem pronta (e editável) e as ações.
const NextStepCard: React.FC<{
    item: FollowUpItem;
    templates: FollowUpTemplates;
    busy: boolean;
    onContact: (channel: 'whatsapp' | 'call') => void;
    onLost: (reason: string, note: string) => void;
    onReply: () => void;
    onSnooze: (remindAt: Date, note: string) => void;
    onOffer?: () => void;
}> = ({ item, templates, busy, onContact, onLost, onReply, onSnooze, onOffer }) => {
    const { portal } = item;
    const [losing, setLosing] = useState(false);
    const [snoozing, setSnoozing] = useState(false);
    const [snoozePick, setSnoozePick] = useState<string>('tomorrow');
    const [snoozeCustom, setSnoozeCustom] = useState('');
    const [snoozeNote, setSnoozeNote] = useState('');
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState(false);
    // Mensagem escolhida: "situação:variação" (ex.: "hot:principal", "expired:renovar").
    const [choice, setChoice] = useState(isTemplateStep(item.step) ? `${item.step}:principal` : '');
    const [text, setText] = useState(item.message || '');
    const [edited, setEdited] = useState(false);
    const [showTip, setShowTip] = useState(false);
    const tip = getNegotiationTip(item);

    useEffect(() => {
        setChoice(isTemplateStep(item.step) ? `${item.step}:principal` : '');
        setEdited(false);
        setEditing(false);
    }, [item.step, portal.id]);

    // Sem edição manual, a mensagem acompanha a variação escolhida (e os modelos salvos).
    useEffect(() => {
        if (edited) return;
        const [step, variantId] = choice.split(':');
        setText(isTemplateStep(step) ? buildFollowUpVariantMessage(step, variantId, portal, Date.now(), templates) : item.message || '');
    }, [edited, choice, templates, portal, item.message]);

    const whatsappUrl = text ? buildProposalWhatsAppUrl(portal.clientPhone || undefined, text) : null;
    const hasMessage = item.step !== 'reply' && item.step !== 'close';
    const snoozeTarget = snoozePick === 'custom'
        ? (snoozeCustom ? snoozeDate(snoozeCustom) : null)
        : snoozeDate(snoozePick);
    const snoozeValid = snoozeTarget != null && snoozeTarget.getTime() > Date.now();
    const titleTone = item.step === 'reply' ? 'text-blue-700 dark:text-blue-300'
        : item.step === 'expiring' || item.step === 'expired' ? 'text-amber-700 dark:text-amber-300'
            : 'text-[var(--text-strong)]';

    return (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4" aria-label="Próximo passo">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Próximo passo</p>
            <p className={`mt-1 text-[15px] font-semibold ${titleTone}`}>{item.title}</p>
            <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-body)]">{item.hint}</p>
            <div className="mt-2 rounded-xl bg-amber-50/70 px-3 py-2 text-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                <div className="text-xs">
                    <button type="button" onClick={() => setShowTip(current => !current)} aria-expanded={showTip} className="flex w-full items-center gap-1.5 text-left">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">Dica de negociação: <span className="font-semibold">{tip.title}</span></span>
                        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${showTip ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                </div>
                {showTip ? <p className="mt-1.5 text-[13px] leading-5">{tip.text}</p> : null}
            </div>
            {item.snoozedUntil ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]"><AlarmClock className="h-3.5 w-3.5" aria-hidden="true" /> Lembrete: {describeNextContact(item.snoozedUntil)}</p>
            ) : !item.due ? <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">Próximo contato: {describeNextContact(item.dueAt)}</p> : null}

            {hasMessage && !losing && !snoozing ? (
                <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <label className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--text-muted)]">
                            Mensagem
                            <select
                                value={choice}
                                onChange={event => { setChoice(event.target.value); setEdited(false); }}
                                aria-label="Trocar mensagem"
                                className="min-w-0 truncate rounded-md bg-transparent py-0.5 font-semibold text-[var(--text-strong)] focus:outline-none"
                            >
                                {FOLLOW_UP_TEMPLATE_STEPS.map(option => (
                                    <optgroup key={option.step} label={option.label}>
                                        {FOLLOW_UP_VARIANTS[option.step].map(variant => (
                                            <option key={variant.id} value={`${option.step}:${variant.id}`}>{variant.id === 'principal' ? option.label : variant.label}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </label>
                        <button type="button" onClick={() => setEditing(current => !current)} className="inline-flex shrink-0 items-center gap-1 text-blue-600">
                            {editing ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /> Pronto</> : <><PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> Editar</>}
                        </button>
                    </div>
                    {editing ? (
                        <textarea value={text} onChange={event => { setText(event.target.value); setEdited(true); }} rows={5} aria-label={`Mensagem para ${portal.clientName}`}
                            style={{ fontSize: 16 }}
                            className="mt-2 w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5 leading-6 text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    ) : (
                        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-5 text-[var(--text-body)] [overflow-wrap:anywhere]">{text}</p>
                    )}
                </div>
            ) : null}

            {losing ? (
                <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
                    <p className="text-xs font-semibold text-[var(--text-strong)]">Por que não fechou?</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium" role="group" aria-label="Motivo da perda">
                        {LOST_REASONS.map(option => (
                            <button key={option.id} type="button" aria-pressed={reason === option.id} onClick={() => setReason(option.id)}
                                className={`rounded-full border px-2.5 py-1 transition-colors ${reason === option.id ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <input value={note} onChange={event => setNote(event.target.value)} placeholder="Observação (opcional)" aria-label="Observação da perda"
                        style={{ fontSize: 16 }} className="ui-field mt-2 h-10 w-full px-3" />
                    <div className="mt-2 flex gap-2 text-xs font-semibold">
                        <button type="button" onClick={() => { setLosing(false); setReason(''); setNote(''); }} className="h-9 flex-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-body)]">Cancelar</button>
                        <button type="button" disabled={!reason || busy} onClick={() => onLost(reason, note)} className="h-9 flex-1 rounded-lg bg-red-600 text-white disabled:opacity-50">Marcar como perdida</button>
                    </div>
                </div>
            ) : snoozing ? (
                <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
                    <p className="text-xs font-semibold text-[var(--text-strong)]">Lembrar quando?</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium" role="group" aria-label="Quando lembrar">
                        {[...SNOOZE_PRESETS, { id: 'custom', label: 'Outra data' }].map(option => (
                            <button key={option.id} type="button" aria-pressed={snoozePick === option.id} onClick={() => setSnoozePick(option.id)}
                                className={`rounded-full border px-2.5 py-1 transition-colors ${snoozePick === option.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
                                {option.label}
                            </button>
                        ))}
                    </div>
                    {snoozePick === 'custom' ? (
                        <input type="date" value={snoozeCustom} onChange={event => setSnoozeCustom(event.target.value)} aria-label="Data do lembrete" style={{ fontSize: 16 }} className="ui-field mt-2 h-10 w-full px-3" />
                    ) : null}
                    <input value={snoozeNote} onChange={event => setSnoozeNote(event.target.value)} placeholder="Anotação (opcional): pediu para chamar depois do dia 10" aria-label="Anotação do lembrete"
                        style={{ fontSize: 16 }} className="ui-field mt-2 h-10 w-full px-3" />
                    {snoozeValid && snoozeTarget ? <p className="mt-2 text-xs text-[var(--text-muted)]">Volta para "Hoje" {describeNextContact(snoozeTarget.getTime())}, às 9h.</p> : null}
                    <div className="mt-2 flex gap-2 text-xs font-semibold">
                        <button type="button" onClick={() => { setSnoozing(false); setSnoozeNote(''); }} className="h-9 flex-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-body)]">Cancelar</button>
                        <button type="button" disabled={!snoozeValid || busy} onClick={() => { if (snoozeValid && snoozeTarget) { onSnooze(snoozeTarget, snoozeNote); setSnoozing(false); setSnoozeNote(''); } }}
                            className="h-9 flex-1 rounded-lg bg-blue-600 text-white disabled:opacity-50">Salvar lembrete</button>
                    </div>
                </div>
            ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {item.step === 'reply' ? (
                        <button type="button" onClick={onReply} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-white">
                            <MessageSquareText className="h-4 w-4" aria-hidden="true" /> Responder
                        </button>
                    ) : hasMessage && whatsappUrl ? (
                        <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => onContact('whatsapp')}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-white">
                            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar no WhatsApp
                        </a>
                    ) : hasMessage && text ? (
                        <button type="button" onClick={() => { void copyText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }); }}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3.5 text-[var(--text-strong)]">
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Mensagem copiada' : 'Copiar mensagem'}
                        </button>
                    ) : null}
                    {hasMessage ? (
                        <button type="button" disabled={busy} onClick={() => onContact('call')} title="Registrar que você já falou com o cliente (ligação ou pessoalmente)"
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 font-medium text-[var(--text-body)] disabled:opacity-50">
                            <PhoneCall className="h-4 w-4" aria-hidden="true" /> Já falei
                        </button>
                    ) : null}
                    {onOffer ? (
                        <button type="button" onClick={onOffer} title="Dar um desconto com prazo: o cliente vê a contagem regressiva no link"
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 font-medium text-[var(--text-body)]">
                            <BadgePercent className="h-4 w-4" aria-hidden="true" /> Oferecer condição
                        </button>
                    ) : null}
                    <button type="button" onClick={() => setSnoozing(true)} title="O cliente pediu para chamar em outra data"
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 font-medium text-[var(--text-body)]">
                        <AlarmClock className="h-4 w-4" aria-hidden="true" /> Lembrar depois
                    </button>
                    <button type="button" onClick={() => setLosing(true)} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 font-medium ${item.step === 'close' ? 'bg-red-600 text-white' : 'text-red-600'}`}>
                        <ThumbsDown className="h-4 w-4" aria-hidden="true" /> Perdida
                    </button>
                </div>
            )}
        </section>
    );
};

/** Ficha do cliente: próximo passo, condições, conversa no link, histórico e links anteriores. */
const ProposalDetailPanel: React.FC<ProposalDetailPanelProps> = ({ group, initialPortalId, templates, now = Date.now(), onClose, onChanged }) => {
    const [activeId, setActiveId] = useState(initialPortalId || group.primary.id);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [conditionModal, setConditionModal] = useState<{ proposal: CompanyProposal; mode: 'extend' | 'edit' } | null>(null);
    const [reactivationProposal, setReactivationProposal] = useState<CompanyProposal | null>(null);
    const [offerOpen, setOfferOpen] = useState(false);
    const replyRef = useRef<HTMLTextAreaElement>(null);
    const threadEndRef = useRef<HTMLDivElement>(null);

    const links = useMemo(() => [group.primary, ...group.others], [group]);
    const portal = links.find(link => link.id === activeId) || group.primary;
    const item = useMemo(() => getFollowUpItem(portal, Date.now(), templates), [portal, templates]);
    const closedInfo = describeClosed(portal);
    const timeline = useMemo(() => (showHistory ? buildFollowUpTimeline(portal) : []), [portal, showHistory]);
    const attentionConditions = useMemo(() => {
        if (closedInfo) return [];
        return portal.proposals
            .map(proposal => ({ proposal, condition: getProposalCondition(proposal) }))
            .filter((entry): entry is { proposal: CompanyProposal; condition: NonNullable<ReturnType<typeof getProposalCondition>> } => (
                Boolean(entry.condition) && (entry.condition!.expired || entry.condition!.remainingMs <= ATTENTION_WINDOW_MS)
            ));
    }, [portal, closedInfo]);
    const expired = new Date(portal.expiresAt).getTime() <= Date.now();

    // Abrir a ficha já marca as respostas do cliente como lidas.
    useEffect(() => {
        if (portal.unreadCount <= 0) return;
        markCompanyProposalPortalRead(portal.id).then(() => onChanged()).catch(err => console.error('[ProposalDetailPanel] Falha ao marcar como lida:', err));
    }, [portal.id, portal.unreadCount, onChanged]);

    // Voltar do celular: fecha primeiro o que estiver por cima e depois a ficha.
    useEffect(() => registerBackHandler(() => {
        if (offerOpen) setOfferOpen(false);
        else if (conditionModal) setConditionModal(null);
        else if (reactivationProposal) setReactivationProposal(null);
        else onClose();
    }), [offerOpen, conditionModal, reactivationProposal, onClose]);

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !conditionModal && !reactivationProposal && !offerOpen) onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [conditionModal, reactivationProposal, offerOpen, onClose]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError('');
        try {
            await action();
            await onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.');
        } finally {
            setBusy(false);
        }
    };

    const send = async () => {
        if (!reply.trim()) return;
        setSending(true);
        setError('');
        try {
            await sendCompanyProposalMessage(portal.id, reply);
            setReply('');
            await onChanged();
            window.requestAnimationFrame(() => threadEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar a resposta.');
        } finally {
            setSending(false);
        }
    };

    const focusReply = () => {
        replyRef.current?.focus();
        replyRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    };

    const chooseReadyMessage = (text: string) => {
        setReply(text);
        setReactivationProposal(null);
        window.setTimeout(focusReply, 50);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={`Proposta de ${portal.clientName}`}>
            <button type="button" aria-label="Fechar ficha" onClick={onClose} className="absolute inset-0 hidden bg-slate-950/40 backdrop-blur-[2px] lg:block" />
            <section className="absolute inset-0 flex flex-col bg-[var(--app-bg)] pt-[env(safe-area-inset-top,0px)] text-sm text-[var(--text-body)] lg:left-auto lg:w-[min(560px,100vw)] lg:border-l lg:border-[var(--border-subtle)] lg:shadow-2xl">
                <header className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-2">
                    <button type="button" onClick={onClose} aria-label="Voltar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-body)] hover:bg-[var(--surface-muted)]">
                        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-[var(--text-strong)]">
                            <span className="truncate">{portal.clientName}</span>
                            {openedRecently(portal, now) ? <OpenedNowBadge /> : null}
                        </h2>
                        <p className="truncate text-xs text-[var(--text-muted)]">{currency.format(portalTotal(portal))} · {closedInfo ? closedInfo.label : expired ? `Venceu em ${shortDate(portal.expiresAt)}` : `Vale até ${shortDate(portal.expiresAt)}`}</p>
                    </div>
                    <a href={buildProposalPortalUrl(portal.token, portal.clientName)} target="_blank" rel="noreferrer" className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 text-xs text-[var(--text-body)]">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> <span className="font-semibold">Ver link</span>
                    </a>
                </header>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4">
                    {portal.id !== group.primary.id ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                            <span>Você está vendo um link anterior (de {shortDate(portal.createdAt)}).</span>
                            <button type="button" onClick={() => setActiveId(group.primary.id)} className="shrink-0"><span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Ver o atual</span></button>
                        </div>
                    ) : null}

                    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4" aria-label="Resumo">
                        <ul className="space-y-1">
                            {portal.proposals.map(proposal => (
                                <li key={proposal.id} className="flex items-baseline justify-between gap-3">
                                    <span className="min-w-0 truncate text-[var(--text-body)]">{proposal.name}</span>
                                    <span className="shrink-0 font-semibold tabular-nums text-[var(--text-strong)]">{currency.format(getProposalCondition(proposal)?.finalValue ?? proposal.conditionFinalValue ?? proposal.total)}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                            Enviada em {shortDate(portal.createdAt)} · {portal.viewCount > 0 ? `abriu ${timesLabel(portal.viewCount)}` : 'ainda não abriu'}
                        </p>
                        {portal.clientPhone ? (
                            <p className="mt-2 text-xs">
                                <a href={`tel:${portal.clientPhone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 text-blue-600">
                                    <Phone className="h-3.5 w-3.5" aria-hidden="true" /> <span className="font-semibold">Ligar</span> <span className="text-[var(--text-muted)]">{portal.clientPhone}</span>
                                </a>
                            </p>
                        ) : null}
                    </section>

                    {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}

                    {closedInfo ? (
                        <section className={`rounded-2xl p-4 ${closedInfo.kind === 'approved' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : closedInfo.kind === 'rejected' ? 'bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100' : 'bg-[var(--surface-muted)] text-[var(--text-body)]'}`} aria-label="Situação">
                            <p className="font-semibold">{closedInfo.label}</p>
                            {closedInfo.kind === 'lost' ? (
                                <>
                                    <p className="mt-0.5 text-xs opacity-80">O cliente continua vendo o link e ainda pode aprovar.</p>
                                    <div className="mt-2 text-xs font-semibold">
                                        <button type="button" disabled={busy} onClick={() => void run(() => reopenProposalPortal(portal.id))} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-blue-600 disabled:opacity-50">
                                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reabrir
                                        </button>
                                    </div>
                                </>
                            ) : null}
                        </section>
                    ) : item ? (
                        <NextStepCard
                            item={item}
                            templates={templates}
                            busy={busy}
                            onContact={channel => void run(() => recordProposalFollowUp(portal.id, item.step, channel))}
                            onLost={(reason, note) => void run(() => markProposalPortalLost(portal.id, reason, note))}
                            onReply={focusReply}
                            onSnooze={(remindAt, note) => void run(() => snoozeProposalFollowUp(portal.id, item.step, remindAt, note))}
                            onOffer={() => setOfferOpen(true)}
                        />
                    ) : null}

                    {attentionConditions.map(({ proposal, condition }) => (
                        <section key={proposal.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/20" aria-label="Condição especial">
                            <div className="flex items-start gap-3">
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${condition.expired ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}><AlertTriangle className="h-4 w-4" /></span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-semibold text-[var(--text-strong)]">{condition.expired ? 'A condição especial expirou' : 'A condição especial vence em breve'}</p>
                                    <p className="mt-0.5 text-xs leading-4 text-[var(--text-muted)]">{proposal.name}: {currency.format(condition.finalValue)}. Vencimento: {formatConditionExpiry(condition.expiresAt)}.</p>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-semibold leading-tight">
                                <button type="button" onClick={() => setReactivationProposal(proposal)} className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2 py-2 text-white"><MessageCircle className="h-3.5 w-3.5 shrink-0" /> Mensagem</button>
                                <button type="button" onClick={() => setConditionModal({ proposal, mode: 'extend' })} className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-[var(--surface)] px-2 py-2 text-blue-700 dark:border-blue-800 dark:text-blue-300"><CalendarClock className="h-3.5 w-3.5 shrink-0" /> Prorrogar</button>
                                <button type="button" onClick={() => setConditionModal({ proposal, mode: 'edit' })} className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-2 text-[var(--text-body)]"><PencilLine className="h-3.5 w-3.5 shrink-0" /> Alterar</button>
                            </div>
                        </section>
                    ))}

                    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]" aria-label="Conversa no link">
                        <h3 className="border-b border-[var(--border-subtle)] px-4 py-3 text-[13px] font-semibold text-[var(--text-strong)]">Conversa no link</h3>
                        <div className="space-y-2.5 bg-[var(--surface-muted)]/50 p-3">
                            {portal.messages.length === 0 ? (
                                <p className="flex flex-col items-center py-6 text-center text-xs text-[var(--text-muted)]">
                                    <MessageCircle className="mb-2 h-6 w-6 opacity-40" aria-hidden="true" />
                                    Nenhuma mensagem ainda. O cliente pode responder pela página da proposta.
                                </p>
                            ) : portal.messages.map(message => {
                                const meta = actionMeta(message);
                                const Icon = meta?.icon;
                                const company = message.sender_type === 'company';
                                return (
                                    <div key={message.id} className={`flex ${company ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 ${company ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md bg-[var(--surface)] text-[var(--text-body)] shadow-sm'}`}>
                                            {meta && Icon ? <p className={`mb-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${meta.color}`}><Icon className="h-3.5 w-3.5" /> {meta.label}</p> : null}
                                            {message.offer_value != null ? <p className="font-semibold">{message.offer_type === 'percentage' ? `${message.offer_value}% de desconto` : `Quer pagar ${currency.format(message.offer_value)}`}</p> : null}
                                            {message.condition_value != null ? <p className="font-semibold">Valor da condição: {currency.format(message.condition_value)}</p> : null}
                                            {message.payment_selection ? (
                                                <div className="my-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-emerald-900">
                                                    <p className="font-semibold">{message.payment_selection.label}</p>
                                                    <p>{message.payment_selection.installments > 1 ? `${message.payment_selection.installments}x de ${currency.format(message.payment_selection.installmentValue)}${message.payment_selection.lastInstallmentValue != null ? ` (última ${currency.format(message.payment_selection.lastInstallmentValue)})` : ''} · total ${currency.format(message.payment_selection.customerTotal)}` : currency.format(message.payment_selection.customerTotal)}</p>
                                                </div>
                                            ) : null}
                                            {message.body ? <p className="whitespace-pre-line [overflow-wrap:anywhere]">{message.body}</p> : null}
                                            <p className="mt-1 text-[10px] opacity-60">{dateTime(message.created_at)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={threadEndRef} />
                        </div>
                    </section>

                    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                        <div className="text-xs font-semibold">
                            <button type="button" onClick={() => setShowHistory(current => !current)} aria-expanded={showHistory}
                                className="inline-flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                                <History className="h-3.5 w-3.5" aria-hidden="true" /> Histórico da proposta
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                        </div>
                        {showHistory ? (
                            <ol className="mt-2 space-y-1.5 border-l border-[var(--border-subtle)] pl-3" aria-label={`Histórico de ${portal.clientName}`}>
                                {timeline.map((entry, index) => (
                                    <li key={`${entry.at}-${index}`} className="relative text-xs leading-5 text-[var(--text-body)]">
                                        <span className={`absolute -left-[17px] top-1.5 h-2 w-2 rounded-full ${toneDot[entry.tone]}`} aria-hidden="true" />
                                        <span className="tabular-nums text-[var(--text-muted)]">{dateTime(entry.at)}</span> · {entry.label}
                                    </li>
                                ))}
                            </ol>
                        ) : null}
                    </section>

                    {group.others.length > 0 ? (
                        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3" aria-label="Outros links do cliente">
                            <h3 className="text-xs font-semibold text-[var(--text-muted)]">Outros links deste cliente ({group.others.length})</h3>
                            <ul className="mt-2 space-y-1.5">
                                {links.filter(link => link.id !== portal.id).map(link => (
                                    <li key={link.id} className="flex items-center justify-between gap-3 text-xs">
                                        <span className="min-w-0 truncate text-[var(--text-body)]">
                                            {link.id === group.primary.id ? 'Link atual' : `Link de ${shortDate(link.createdAt)}`} · {describeClosed(link)?.label || (link.viewCount > 0 ? `abriu ${timesLabel(link.viewCount)}` : 'não abriu')}
                                        </span>
                                        <span className="flex shrink-0 items-center gap-2">
                                            {link.unreadCount > 0 ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">{link.unreadCount}</span> : null}
                                            <button type="button" onClick={() => setActiveId(link.id)} className="text-blue-600"><span className="text-xs font-semibold">Ver</span></button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}
                </div>

                <footer className="flex items-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface)] p-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
                    <textarea
                        ref={replyRef}
                        value={reply}
                        onChange={event => setReply(event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && window.matchMedia?.('(pointer: fine)').matches) { event.preventDefault(); void send(); } }}
                        rows={1}
                        placeholder="Responder no link da proposta…"
                        aria-label="Responder no link da proposta"
                        style={{ fontSize: 16 }}
                        className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text-strong)] outline-none focus:border-blue-500"
                    />
                    <button type="button" disabled={sending || !reply.trim()} onClick={() => void send()} aria-label="Enviar resposta"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50">
                        {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                </footer>
            </section>

            {conditionModal ? <ProposalConditionModal isOpen mode={conditionModal.mode} portal={portal} proposal={conditionModal.proposal} onClose={() => setConditionModal(null)} onSaved={onChanged} /> : null}
            {reactivationProposal ? <ReactivationMessagesModal portal={portal} proposal={reactivationProposal} onChoose={chooseReadyMessage} onClose={() => setReactivationProposal(null)} /> : null}
            {offerOpen ? <ProposalOfferSheet isOpen portal={portal} step={item?.step ?? 'hot'} onClose={() => setOfferOpen(false)} onApplied={onChanged} /> : null}
        </div>,
        document.body,
    );
};

export default ProposalDetailPanel;
