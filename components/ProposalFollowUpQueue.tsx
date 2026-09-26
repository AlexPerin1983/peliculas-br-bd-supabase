import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Eye, History, LoaderCircle, MessageCircle, MessageSquareText, PencilLine, PhoneCall, RotateCcw, Search, Settings2, ThumbsDown, X } from 'lucide-react';
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
    FOLLOW_UP_FILTERS,
    FOLLOW_UP_TEMPLATE_STEPS,
    LOST_REASONS,
    lostReasonLabel,
    STALE_AFTER_DAYS,
    summarizeLostProposals,
    type FollowUpItem,
    type FollowUpStep,
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
    // Opcional: quem usa a lista pode abrir as mensagens por fora (ex.: menu fixo no celular).
    templatesOpen?: boolean;
    onTemplatesOpenChange?: (open: boolean) => void;
}

type Tab = 'today' | 'waiting' | 'lost';
type Filter = FollowUpStep | 'all' | 'stale';

const PAGE_SIZE = 10;
// Com poucas propostas a busca só ocupa espaço.
const SEARCH_MIN_PORTALS = 7;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const portalTotal = (portal: CompanyProposalPortal) => portal.proposals.reduce((sum, proposal) => sum + (proposal.conditionFinalValue ?? proposal.total), 0);

const toneDot: Record<string, string> = {
    neutral: 'bg-slate-300 dark:bg-slate-600',
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
};

const stepDot: Record<FollowUpStep, string> = {
    reply: 'bg-blue-600',
    expiring: 'bg-amber-500',
    hot: 'bg-emerald-500',
    not_opened: 'bg-slate-400',
    value: 'bg-sky-500',
    expired: 'bg-orange-500',
    close: 'bg-red-500',
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

const openConversation = (portalId: string) =>
    window.dispatchEvent(new CustomEvent('proposal-portal-open', { detail: { portalId } }));

const isTemplateStep = (step: string): step is FollowUpTemplateStep => FOLLOW_UP_TEMPLATE_STEPS.some(item => item.step === step);

// Linha compacta; toque para abrir a mensagem, as ações e o histórico.
const FollowUpRow: React.FC<{
    item: FollowUpItem;
    templates: FollowUpTemplates;
    expanded: boolean;
    busy: boolean;
    onToggle: () => void;
    onContact: (item: FollowUpItem, channel: 'whatsapp' | 'call' | 'other') => void;
    onLost: (item: FollowUpItem, reason: string, note: string) => void;
}> = ({ item, templates, expanded, busy, onToggle, onContact, onLost }) => {
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
    const timeline = useMemo(() => (showHistory ? buildFollowUpTimeline(portal) : []), [portal, showHistory]);
    const hasMessage = item.step !== 'reply' && item.step !== 'close';
    const titleTone = item.step === 'reply' ? 'text-blue-700 dark:text-blue-300'
        : item.step === 'expiring' || item.step === 'expired' ? 'text-amber-700 dark:text-amber-300'
            : '';

    return (
        <article className={`rounded-2xl border bg-[var(--surface)] ${expanded ? 'border-blue-200 shadow-sm dark:border-blue-900/60' : 'border-[var(--border-subtle)]'}`}>
            <div className="flex items-center gap-1 pr-2">
                <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-1 text-left">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stepDot[item.step]}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--text-strong)]">{portal.clientName}</span>
                            <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{currency.format(portalTotal(portal))}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                            <span className={titleTone}>{item.title}</span>
                            {!item.due ? <> · <span>Próximo contato: {describeNextContact(item.dueAt)}</span></> : null}
                        </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {!expanded && item.step === 'reply' ? (
                    <button type="button" onClick={() => openConversation(portal.id)} aria-label={`Abrir conversa de ${portal.clientName}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                    </button>
                ) : !expanded && hasMessage && whatsappUrl ? (
                    <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => onContact(item, 'whatsapp')}
                        aria-label={`WhatsApp para ${portal.clientName}`} title="Enviar a mensagem sugerida no WhatsApp"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    </a>
                ) : null}
            </div>

            {expanded ? (
                <div className="border-t border-[var(--border-subtle)] px-4 pb-4 pt-3">
                    <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span className="min-w-0 truncate">{portal.proposals.map(proposal => proposal.name).join(', ')}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 tabular-nums" title="Vezes que o cliente abriu o link">
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {portal.viewCount}
                        </span>
                    </p>
                    <p className="mt-2 text-[13px] leading-5 text-[var(--text-body)]">{item.hint}</p>

                    {hasMessage && !losing ? (
                        <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
                            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                <label className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--text-muted)]">
                                    Mensagem
                                    <select
                                        value={templateStep ?? ''}
                                        onChange={event => { setTemplateStep(event.target.value as FollowUpTemplateStep); setEdited(false); }}
                                        aria-label="Trocar mensagem"
                                        className="min-w-0 truncate rounded-md bg-transparent py-0.5 font-semibold text-[var(--text-strong)] focus:outline-none"
                                    >
                                        {FOLLOW_UP_TEMPLATE_STEPS.map(option => <option key={option.step} value={option.step}>{option.label}</option>)}
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
                                <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[13px] leading-5 text-[var(--text-body)]">{text}</p>
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
                                <button type="button" disabled={!reason || busy} onClick={() => onLost(item, reason, note)} className="h-9 flex-1 rounded-lg bg-red-600 text-white disabled:opacity-50">Marcar como perdida</button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-3 flex flex-wrap items-center gap-2 font-semibold">
                            {item.step === 'reply' ? (
                                <button type="button" onClick={() => openConversation(portal.id)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-white">
                                    <MessageSquareText className="h-4 w-4" aria-hidden="true" /> Abrir conversa
                                </button>
                            ) : hasMessage && whatsappUrl ? (
                                <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => onContact(item, 'whatsapp')}
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
                                <button type="button" disabled={busy} onClick={() => onContact(item, 'call')} title="Registrar que você já falou com o cliente (ligação ou pessoalmente)"
                                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 font-medium text-[var(--text-body)] disabled:opacity-50">
                                    <PhoneCall className="h-4 w-4" aria-hidden="true" /> Já falei
                                </button>
                            ) : null}
                            <button type="button" onClick={() => setLosing(true)} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 font-medium ${item.step === 'close' ? 'bg-red-600 text-white' : 'text-red-600'}`}>
                                <ThumbsDown className="h-4 w-4" aria-hidden="true" /> Perdida
                            </button>
                        </div>
                    )}

                    <div className="mt-3 text-xs font-semibold">
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
                </div>
            ) : null}
        </article>
    );
};

const Chip: React.FC<{ label: string; count: number; active: boolean; tone?: 'amber'; onClick: () => void }> = ({ label, count, active, tone, onClick }) => (
    <button type="button" aria-pressed={active} onClick={onClick}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors ${active
            ? 'border-blue-600 bg-blue-600 text-white'
            : tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)]'}`}>
        {label} <span className={`tabular-nums ${active ? 'text-white/80' : 'opacity-70'}`}>{count}</span>
    </button>
);

/** Propostas enviadas por link que pedem uma ação, com a mensagem pronta (e editável). */
const ProposalFollowUpQueue: React.FC<ProposalFollowUpQueueProps> = ({ portals, loading = false, onChanged, templatesOpen, onTemplatesOpenChange }) => {
    const [tab, setTab] = useState<Tab>('today');
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [visible, setVisible] = useState(PAGE_SIZE);
    // undefined = automático: em "Hoje", o primeiro da lista já vem aberto.
    const [openId, setOpenId] = useState<string | null | undefined>(undefined);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null);
    const [savedTemplates, setSavedTemplates] = useState<FollowUpMessageTemplateRow[]>([]);
    const [ownTemplatesOpen, setOwnTemplatesOpen] = useState(false);
    const isTemplatesOpen = templatesOpen ?? ownTemplatesOpen;
    const setTemplatesOpen = onTemplatesOpenChange ?? setOwnTemplatesOpen;

    const loadTemplates = useCallback(() => {
        getFollowUpMessageTemplates().then(setSavedTemplates).catch(() => setSavedTemplates([]));
    }, []);
    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const templates = useMemo<FollowUpTemplates>(
        () => Object.fromEntries(savedTemplates.map(row => [row.step, row.text])),
        [savedTemplates],
    );
    const searched = useMemo(() => {
        const term = normalize(query);
        return term ? portals.filter(portal => normalize(portal.clientName).includes(term)) : portals;
    }, [portals, query]);
    const { due, waiting, stale } = useMemo(() => buildFollowUpQueue(searched, Date.now(), templates), [searched, templates]);
    const lostPortals = useMemo(() => searched.filter(portal => portal.lostAt && !['approved', 'revoked'].includes(portal.status)), [searched]);
    const lostSummary = useMemo(() => summarizeLostProposals(portals), [portals]);

    const tabItems = tab === 'today' ? due : tab === 'waiting' ? waiting : [];
    const filters = useMemo(
        () => FOLLOW_UP_FILTERS.map(option => ({ ...option, count: tabItems.filter(item => item.step === option.step).length })).filter(option => option.count > 0),
        [tabItems],
    );
    const showStale = tab === 'today' && stale.length > 0;
    const showFilters = tab !== 'lost' && (filters.length > 1 || showStale);
    const listItems = filter === 'stale' ? stale : filter === 'all' ? tabItems : tabItems.filter(item => item.step === filter);
    const shown = listItems.slice(0, visible);
    const autoOpenId = tab === 'today' && filter !== 'stale' ? shown[0]?.portal.id ?? null : null;
    const expandedId = openId === undefined ? autoOpenId : openId;

    // O filtro escolhido pode esvaziar (ex.: depois de encerrar as antigas).
    useEffect(() => {
        if (filter === 'all') return;
        const empty = filter === 'stale' ? !showStale : !tabItems.some(item => item.step === filter);
        if (empty) setFilter('all');
    }, [filter, showStale, tabItems]);

    const resetList = () => { setVisible(PAGE_SIZE); setOpenId(undefined); };
    const changeTab = (next: Tab) => { setTab(next); setFilter('all'); resetList(); };
    const changeFilter = (next: Filter) => { setFilter(next); resetList(); };

    const run = async (key: string, action: () => Promise<void>) => {
        setBusyId(key);
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

    // Depois de agir, o próximo da lista abre sozinho.
    const contact = (item: FollowUpItem, channel: 'whatsapp' | 'call' | 'other') => {
        setOpenId(undefined);
        void run(item.portal.id, () => recordProposalFollowUp(item.portal.id, item.step, channel));
    };

    const lose = (item: FollowUpItem, reason: string, note: string) =>
        void run(item.portal.id, async () => {
            await markProposalPortalLost(item.portal.id, reason, note);
            setUndo({ ids: [item.portal.id], label: `Proposta de ${item.portal.clientName} marcada como perdida.` });
            setOpenId(undefined);
        });

    const closeStale = () => {
        const ids = stale.map(item => item.portal.id);
        void run('stale', async () => {
            await markProposalPortalLost(ids, 'no_response', `Vencida há mais de ${STALE_AFTER_DAYS} dias`);
            setUndo({ ids, label: ids.length === 1 ? '1 proposta antiga encerrada como perdida.' : `${ids.length} propostas antigas encerradas como perdidas.` });
            setFilter('all');
        });
    };

    const reopen = (ids: string[]) =>
        void run(ids.length === 1 ? ids[0] : 'undo', async () => {
            await reopenProposalPortal(ids.length === 1 ? ids[0] : ids);
            setUndo(current => (current && current.ids.every(id => ids.includes(id)) ? null : current));
        });

    const tabs: Array<{ id: Tab; label: string; count: number }> = [
        { id: 'today', label: 'Hoje', count: due.length },
        { id: 'waiting', label: 'Aguardando', count: waiting.length },
        { id: 'lost', label: 'Perdidas', count: lostPortals.length },
    ];

    const term = query.trim();
    const emptyText = term
        ? `Nenhum cliente encontrado para "${term}".`
        : tab === 'today'
            ? `Nada para hoje.${waiting.length > 0 ? ` ${waiting.length === 1 ? '1 proposta está' : `${waiting.length} propostas estão`} aguardando o momento certo.` : ''}`
            : 'Nenhuma proposta aguardando.';

    return (
        <section id="proposal-follow-up" className="scroll-mt-24 space-y-3 text-sm" aria-labelledby="proposal-follow-up-title">
            <div className="flex items-center justify-between gap-2 px-1">
                <h2 id="proposal-follow-up-title" className="text-base font-semibold tracking-[-0.01em] text-[var(--text-strong)]">Para acompanhar</h2>
                <div className="text-xs font-semibold">
                    <button type="button" onClick={() => setTemplatesOpen(true)} className="hidden items-center gap-1.5 rounded-lg px-2 py-1 text-blue-600 hover:bg-blue-50 sm:inline-flex dark:hover:bg-blue-950/30">
                        <Settings2 className="h-3.5 w-3.5" aria-hidden="true" /> Mensagens
                    </button>
                </div>
            </div>

            {portals.length >= SEARCH_MIN_PORTALS || term ? (
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                    <input
                        id="proposal-follow-up-search"
                        type="search"
                        value={query}
                        onChange={event => { setQuery(event.target.value); resetList(); }}
                        placeholder="Buscar cliente"
                        aria-label="Buscar cliente"
                        style={{ fontSize: 16 }}
                        className="h-10 w-full scroll-mt-28 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] pl-9 pr-3 text-[var(--text-body)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                </label>
            ) : null}

            <div className="grid grid-cols-3 rounded-xl bg-[var(--surface-muted)] p-1 text-[13px] font-semibold" role="tablist" aria-label="Acompanhamento">
                {tabs.map(item => (
                    <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} aria-label={`${item.label} (${item.count})`} onClick={() => changeTab(item.id)}
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-lg transition-colors ${tab === item.id ? 'bg-[var(--surface)] text-[var(--text-strong)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
                        {item.label}
                        <span className={`min-w-5 rounded-full px-1.5 text-[11px] tabular-nums ${tab === item.id && item.id === 'today' && item.count > 0 ? 'bg-blue-600 text-white' : 'bg-black/5 dark:bg-white/10'}`}>{item.count}</span>
                    </button>
                ))}
            </div>

            {showFilters ? (
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 text-xs font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por situação">
                    <Chip label="Todas" count={tabItems.length} active={filter === 'all'} onClick={() => changeFilter('all')} />
                    {filters.map(option => (
                        <Chip key={option.step} label={option.label} count={option.count} active={filter === option.step} onClick={() => changeFilter(option.step)} />
                    ))}
                    {showStale ? <Chip label="Antigas" count={stale.length} tone="amber" active={filter === 'stale'} onClick={() => changeFilter('stale')} /> : null}
                </div>
            ) : null}

            {undo ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-body)]">
                    <span>{undo.label}</span>
                    <span className="flex shrink-0 items-center gap-3 font-semibold">
                        <button type="button" disabled={busyId === 'undo'} onClick={() => reopen(undo.ids)} className="text-blue-600 disabled:opacity-50">Desfazer</button>
                        <button type="button" onClick={() => setUndo(null)} aria-label="Fechar aviso"><X className="h-3.5 w-3.5" /></button>
                    </span>
                </div>
            ) : null}
            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}

            {loading ? (
                <p className="flex items-center gap-2 px-1 py-4 text-[var(--text-muted)]"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando…</p>
            ) : tab === 'lost' ? (
                lostPortals.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-[var(--text-muted)]">
                        {term ? `Nenhum cliente encontrado para "${term}".` : 'Nenhuma proposta marcada como perdida.'}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {lostSummary.topReason ? <p className="px-1 text-xs text-[var(--text-muted)]">Nos últimos 30 dias, o motivo mais comum foi <strong className="font-semibold text-[var(--text-strong)]">{lostSummary.topReason.toLowerCase()}</strong>.</p> : null}
                        <ul className="space-y-2">
                            {lostPortals.slice(0, visible).map(portal => (
                                <li key={portal.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                                    <span className="min-w-0">
                                        <span className="block truncate font-semibold text-[var(--text-strong)]">{portal.clientName}</span>
                                        <span className="block text-xs text-[var(--text-muted)]">{lostReasonLabel(portal.lostReason)} · {shortDate(portal.lostAt!)}</span>
                                    </span>
                                    <span className="shrink-0 text-xs font-semibold">
                                        <button type="button" disabled={busyId === portal.id} onClick={() => reopen([portal.id])} className="inline-flex items-center gap-1 text-blue-600 disabled:opacity-50">
                                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reabrir
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {lostPortals.length > visible ? (
                            <button type="button" onClick={() => setVisible(current => current + PAGE_SIZE)} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] text-[var(--text-body)]">
                                <span className="font-semibold">Mostrar mais ({lostPortals.length - visible})</span>
                            </button>
                        ) : null}
                    </div>
                )
            ) : listItems.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-[var(--text-muted)]">
                    {emptyText}
                    {tab === 'today' && showStale && !term ? ` Há ${stale.length === 1 ? '1 antiga' : `${stale.length} antigas`} em "Antigas".` : null}
                </p>
            ) : (
                <div className="space-y-2">
                    {filter === 'stale' ? (
                        <div className="rounded-2xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                            <p className="text-[13px] leading-5">
                                Venceram há mais de {STALE_AFTER_DAYS} dias sem resposta, por isso ficam fora de "Hoje". Encerre como perdidas para limpar a lista. Se precisar, dá para reabrir em "Perdidas".
                            </p>
                            <div className="mt-2 text-[13px] font-semibold">
                                <button type="button" disabled={busyId === 'stale'} onClick={closeStale} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-white disabled:opacity-60">
                                    {busyId === 'stale' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ThumbsDown className="h-4 w-4" aria-hidden="true" />}
                                    {stale.length === 1 ? 'Encerrar a antiga como perdida' : `Encerrar as ${stale.length} como perdidas`}
                                </button>
                            </div>
                        </div>
                    ) : null}
                    {shown.map(item => (
                        <FollowUpRow
                            key={item.portal.id}
                            item={item}
                            templates={templates}
                            expanded={expandedId === item.portal.id}
                            busy={busyId === item.portal.id}
                            onToggle={() => setOpenId(expandedId === item.portal.id ? null : item.portal.id)}
                            onContact={contact}
                            onLost={lose}
                        />
                    ))}
                    {listItems.length > visible ? (
                        <button type="button" onClick={() => setVisible(current => current + PAGE_SIZE)} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] text-[var(--text-body)]">
                            <span className="font-semibold">Mostrar mais ({listItems.length - visible})</span>
                        </button>
                    ) : null}
                </div>
            )}

            <FollowUpTemplatesModal isOpen={isTemplatesOpen} saved={savedTemplates} onClose={() => setTemplatesOpen(false)} onSaved={loadTemplates} />
        </section>
    );
};

export default ProposalFollowUpQueue;
