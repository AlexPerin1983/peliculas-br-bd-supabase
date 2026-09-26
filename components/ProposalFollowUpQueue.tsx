import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Eye, History, LoaderCircle, MessageCircle, MessageSquareText, PencilLine, PhoneCall, RotateCcw, Settings2, ThumbsDown, X } from 'lucide-react';
import {
    markProposalPortalLost,
    recordProposalFollowUp,
    reopenProposalPortal,
    type CompanyProposalPortal,
} from '../src/lib/proposalPortal';
import {
    buildFollowUpMessage,
    buildFollowUpQueue,
    buildFollowUpTimeline,
    describeNextContact,
    FOLLOW_UP_TEMPLATE_STEPS,
    LOST_REASONS,
    lostReasonLabel,
    summarizeLostProposals,
    type FollowUpItem,
    type FollowUpTemplates,
    type FollowUpTemplateStep,
} from '../src/lib/proposalFollowUpQueue';
import { buildProposalWhatsAppUrl } from '../src/lib/proposalMessages';
import { getFollowUpMessageTemplates, type FollowUpMessageTemplateRow } from '../services/supabaseDb';
import FollowUpTemplatesModal from './FollowUpTemplatesModal';

interface ProposalFollowUpQueueProps {
    portals: CompanyProposalPortal[];
    loading?: boolean;
    onChanged: () => Promise<void> | void;
}

type Tab = 'today' | 'waiting' | 'lost';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const toneDot: Record<string, string> = {
    neutral: 'bg-slate-300 dark:bg-slate-600',
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
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

const isTemplateStep = (step: string): step is FollowUpTemplateStep => FOLLOW_UP_TEMPLATE_STEPS.some(item => item.step === step);

const FollowUpCard: React.FC<{
    item: FollowUpItem;
    templates: FollowUpTemplates;
    busy: boolean;
    onContact: (item: FollowUpItem, channel: 'whatsapp' | 'call' | 'other') => void;
    onLost: (item: FollowUpItem, reason: string, note: string) => void;
}> = ({ item, templates, busy, onContact, onLost }) => {
    const { portal } = item;
    const [showHistory, setShowHistory] = useState(false);
    const [losing, setLosing] = useState(false);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState(false);
    const [templateStep, setTemplateStep] = useState<FollowUpTemplateStep | null>(isTemplateStep(item.step) ? item.step : null);
    const [text, setText] = useState(item.message || '');
    const [edited, setEdited] = useState(false);

    // Sem edição manual, a mensagem acompanha o modelo escolhido (e os modelos salvos).
    useEffect(() => {
        if (edited) return;
        setText(templateStep ? buildFollowUpMessage(templateStep, portal, Date.now(), templates) || '' : item.message || '');
    }, [edited, templateStep, templates, portal, item.message]);

    const whatsappUrl = text ? buildProposalWhatsAppUrl(portal.clientPhone || undefined, text) : null;
    const total = portal.proposals.reduce((sum, proposal) => sum + (proposal.conditionFinalValue ?? proposal.total), 0);
    const timeline = useMemo(() => buildFollowUpTimeline(portal), [portal]);
    const hasMessage = item.step !== 'reply' && item.step !== 'close';

    return (
        <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[var(--text-strong)]">{portal.clientName}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{portal.proposals.map(proposal => proposal.name).join(', ')} · {currency.format(total)}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-muted)]" title="Vezes que o cliente abriu o link">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {portal.viewCount}
                </span>
            </div>

            <p className={`mt-3 text-sm font-semibold ${item.step === 'reply' ? 'text-blue-700 dark:text-blue-300' : item.step === 'expiring' || item.step === 'expired' ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--text-strong)]'}`}>{item.title}</p>
            <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-muted)]">{item.hint}</p>
            {!item.due ? <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">Próximo contato: {describeNextContact(item.dueAt)}</p> : null}

            {hasMessage && !losing ? (
                <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
                    <div className="flex items-center justify-between gap-2">
                        <label className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                            Mensagem
                            <select
                                value={templateStep ?? ''}
                                onChange={event => { setTemplateStep(event.target.value as FollowUpTemplateStep); setEdited(false); }}
                                aria-label="Trocar mensagem"
                                className="min-w-0 truncate rounded-md bg-transparent py-0.5 text-[11px] font-semibold text-[var(--text-strong)] focus:outline-none"
                            >
                                {FOLLOW_UP_TEMPLATE_STEPS.map(option => <option key={option.step} value={option.step}>{option.label}</option>)}
                            </select>
                        </label>
                        <button type="button" onClick={() => setEditing(current => !current)} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-blue-600">
                            {editing ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /> Pronto</> : <><PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> Editar</>}
                        </button>
                    </div>
                    {editing ? (
                        <textarea value={text} onChange={event => { setText(event.target.value); setEdited(true); }} rows={5} aria-label={`Mensagem para ${portal.clientName}`}
                            className="mt-2 w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5 text-[15px] leading-6 text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    ) : (
                        <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[13px] leading-5 text-[var(--text-body)]">{text}</p>
                    )}
                </div>
            ) : null}

            {losing ? (
                <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
                    <p className="text-xs font-semibold text-[var(--text-strong)]">Por que não fechou?</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Motivo da perda">
                        {LOST_REASONS.map(option => (
                            <button key={option.id} type="button" aria-pressed={reason === option.id} onClick={() => setReason(option.id)}
                                className={`rounded-full border px-2.5 py-1 font-medium transition-colors ${reason === option.id ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <input value={note} onChange={event => setNote(event.target.value)} placeholder="Observação (opcional)" aria-label="Observação da perda"
                        className="ui-field mt-2 h-10 w-full px-3 text-sm" />
                    <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => { setLosing(false); setReason(''); setNote(''); }} className="h-9 flex-1 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-body)]">Cancelar</button>
                        <button type="button" disabled={!reason || busy} onClick={() => onLost(item, reason, note)} className="h-9 flex-1 rounded-lg bg-red-600 text-xs font-bold text-white disabled:opacity-50">Marcar como perdida</button>
                    </div>
                </div>
            ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.step === 'reply' ? (
                        <button type="button" onClick={() => {
                            window.dispatchEvent(new CustomEvent('proposal-portal-open', { detail: { portalId: portal.id } }));
                            document.getElementById('proposal-conversations-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-sm font-semibold text-white">
                            <MessageSquareText className="h-4 w-4" aria-hidden="true" /> Abrir conversa
                        </button>
                    ) : hasMessage && whatsappUrl ? (
                        <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => onContact(item, 'whatsapp')}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white">
                            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar no WhatsApp
                        </a>
                    ) : hasMessage && text ? (
                        <button type="button" onClick={() => { void copyText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }); }}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3.5 text-sm font-semibold text-[var(--text-strong)]">
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Mensagem copiada' : 'Copiar mensagem'}
                        </button>
                    ) : null}
                    {hasMessage ? (
                        <button type="button" disabled={busy} onClick={() => onContact(item, 'call')} title="Registrar que você já falou com o cliente (ligação ou pessoalmente)"
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 text-sm font-medium text-[var(--text-body)] disabled:opacity-50">
                            <PhoneCall className="h-4 w-4" aria-hidden="true" /> Já falei
                        </button>
                    ) : null}
                    <button type="button" onClick={() => setLosing(true)} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ${item.step === 'close' ? 'bg-red-600 text-white' : 'text-red-600'}`}>
                        <ThumbsDown className="h-4 w-4" aria-hidden="true" /> Perdida
                    </button>
                </div>
            )}

            <button type="button" onClick={() => setShowHistory(current => !current)} aria-expanded={showHistory}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                <History className="h-3.5 w-3.5" aria-hidden="true" /> Histórico da proposta
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
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
        </article>
    );
};

/** Propostas enviadas por link que pedem uma ação, com a mensagem pronta (e editável). */
const ProposalFollowUpQueue: React.FC<ProposalFollowUpQueueProps> = ({ portals, loading = false, onChanged }) => {
    const [tab, setTab] = useState<Tab>('today');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [lastLost, setLastLost] = useState<{ id: string; name: string } | null>(null);
    const [savedTemplates, setSavedTemplates] = useState<FollowUpMessageTemplateRow[]>([]);
    const [templatesOpen, setTemplatesOpen] = useState(false);

    const loadTemplates = useCallback(() => {
        getFollowUpMessageTemplates().then(setSavedTemplates).catch(() => setSavedTemplates([]));
    }, []);
    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const templates = useMemo<FollowUpTemplates>(
        () => Object.fromEntries(savedTemplates.map(row => [row.step, row.text])),
        [savedTemplates],
    );
    const { due, waiting } = useMemo(() => buildFollowUpQueue(portals, Date.now(), templates), [portals, templates]);
    const lostPortals = useMemo(() => portals.filter(portal => portal.lostAt && !['approved', 'revoked'].includes(portal.status)), [portals]);
    const lostSummary = useMemo(() => summarizeLostProposals(portals), [portals]);

    const run = async (portalId: string, action: () => Promise<void>) => {
        setBusyId(portalId);
        setError('');
        try {
            await action();
            await onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.');
        } finally {
            setBusyId(null);
        }
    };

    const contact = (item: FollowUpItem, channel: 'whatsapp' | 'call' | 'other') =>
        void run(item.portal.id, () => recordProposalFollowUp(item.portal.id, item.step, channel));

    const lose = (item: FollowUpItem, reason: string, note: string) =>
        void run(item.portal.id, async () => {
            await markProposalPortalLost(item.portal.id, reason, note);
            setLastLost({ id: item.portal.id, name: item.portal.clientName });
        });

    const reopen = (portalId: string) =>
        void run(portalId, async () => {
            await reopenProposalPortal(portalId);
            setLastLost(current => (current?.id === portalId ? null : current));
        });

    const tabs: Array<{ id: Tab; label: string; count: number }> = [
        { id: 'today', label: 'Hoje', count: due.length },
        { id: 'waiting', label: 'Aguardando', count: waiting.length },
        { id: 'lost', label: 'Perdidas', count: lostPortals.length },
    ];
    const items = tab === 'today' ? due : waiting;

    return (
        <section className="space-y-3" aria-labelledby="proposal-follow-up-title">
            <div className="flex items-center justify-between gap-2 px-1">
                <h2 id="proposal-follow-up-title" className="text-base font-semibold tracking-[-0.01em] text-[var(--text-strong)]">Para acompanhar</h2>
                <button type="button" onClick={() => setTemplatesOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                    <Settings2 className="h-3.5 w-3.5" aria-hidden="true" /> Mensagens
                </button>
            </div>

            <div className="grid grid-cols-3 rounded-xl bg-[var(--surface-muted)] p-1 text-[13px]" role="tablist" aria-label="Acompanhamento">
                {tabs.map(item => (
                    <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} aria-label={`${item.label} (${item.count})`} onClick={() => setTab(item.id)}
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors ${tab === item.id ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                        {item.label}
                        <span className={`min-w-5 rounded-full px-1.5 text-[11px] tabular-nums ${tab === item.id && item.id === 'today' && item.count > 0 ? 'bg-blue-600 text-white' : 'bg-black/5 dark:bg-white/10'}`}>{item.count}</span>
                    </button>
                ))}
            </div>

            {lastLost ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-body)]">
                    <span>Proposta de {lastLost.name} marcada como perdida.</span>
                    <span className="flex shrink-0 items-center gap-3">
                        <button type="button" onClick={() => reopen(lastLost.id)} className="font-semibold text-blue-600">Desfazer</button>
                        <button type="button" onClick={() => setLastLost(null)} aria-label="Fechar aviso"><X className="h-3.5 w-3.5" /></button>
                    </span>
                </div>
            ) : null}
            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}

            {loading ? (
                <p className="flex items-center gap-2 px-1 py-4 text-sm text-[var(--text-muted)]"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando…</p>
            ) : tab === 'lost' ? (
                lostPortals.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">Nenhuma proposta marcada como perdida.</p>
                ) : (
                    <div className="space-y-2">
                        {lostSummary.topReason ? <p className="px-1 text-xs text-[var(--text-muted)]">Nos últimos 30 dias, o motivo mais comum foi <strong className="font-semibold text-[var(--text-strong)]">{lostSummary.topReason.toLowerCase()}</strong>.</p> : null}
                        <ul className="space-y-2">
                            {lostPortals.map(portal => (
                                <li key={portal.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">{portal.clientName}</span>
                                        <span className="block text-xs text-[var(--text-muted)]">{lostReasonLabel(portal.lostReason)} · {shortDate(portal.lostAt!)}</span>
                                    </span>
                                    <button type="button" disabled={busyId === portal.id} onClick={() => reopen(portal.id)} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 disabled:opacity-50">
                                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reabrir
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )
            ) : items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    {tab === 'today'
                        ? `Nada para hoje.${waiting.length > 0 ? ` ${waiting.length === 1 ? '1 proposta está' : `${waiting.length} propostas estão`} aguardando o momento certo.` : ''}`
                        : 'Nenhuma proposta aguardando.'}
                </p>
            ) : (
                <div className="space-y-2">
                    {items.map(item => (
                        <FollowUpCard key={item.portal.id} item={item} templates={templates} busy={busyId === item.portal.id} onContact={contact} onLost={lose} />
                    ))}
                </div>
            )}

            <FollowUpTemplatesModal isOpen={templatesOpen} saved={savedTemplates} onClose={() => setTemplatesOpen(false)} onSaved={loadTemplates} />
        </section>
    );
};

export default ProposalFollowUpQueue;
