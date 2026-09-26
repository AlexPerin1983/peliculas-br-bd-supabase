import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Eye, History, LoaderCircle, MessageCircle, MessageSquareText, PhoneCall, RotateCcw, Target, ThumbsDown, X } from 'lucide-react';
import {
    markProposalPortalLost,
    recordProposalFollowUp,
    reopenProposalPortal,
    type CompanyProposalPortal,
} from '../src/lib/proposalPortal';
import {
    buildFollowUpQueue,
    buildFollowUpTimeline,
    LOST_REASONS,
    lostReasonLabel,
    summarizeLostProposals,
    type FollowUpItem,
} from '../src/lib/proposalFollowUpQueue';
import { buildProposalWhatsAppUrl } from '../src/lib/proposalMessages';

interface ProposalFollowUpQueueProps {
    portals: CompanyProposalPortal[];
    loading?: boolean;
    onChanged: () => Promise<void> | void;
}

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

const FollowUpCard: React.FC<{
    item: FollowUpItem;
    busy: boolean;
    onContact: (item: FollowUpItem, channel: 'whatsapp' | 'call' | 'other') => void;
    onLost: (item: FollowUpItem, reason: string, note: string) => void;
}> = ({ item, busy, onContact, onLost }) => {
    const { portal } = item;
    const [showHistory, setShowHistory] = useState(false);
    const [losing, setLosing] = useState(false);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [copied, setCopied] = useState(false);
    const whatsappUrl = item.message ? buildProposalWhatsAppUrl(portal.clientPhone || undefined, item.message) : null;
    const total = portal.proposals.reduce((sum, proposal) => sum + (proposal.conditionFinalValue ?? proposal.total), 0);
    const proposalNames = portal.proposals.map(proposal => proposal.name).join(', ');
    const timeline = useMemo(() => buildFollowUpTimeline(portal), [portal]);

    return (
        <article className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-hairline)] sm:p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--text-strong)]">{portal.clientName}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{proposalNames} · {currency.format(total)}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)]" title="Vezes que o cliente abriu o link">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {portal.viewCount}
                </span>
            </div>

            <p className={`mt-3 text-sm font-semibold ${item.step === 'reply' ? 'text-blue-700 dark:text-blue-300' : item.step === 'expiring' || item.step === 'expired' ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--text-strong)]'}`}>{item.title}</p>
            <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-muted)]">{item.hint}</p>

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
                    ) : whatsappUrl ? (
                        <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => onContact(item, 'whatsapp')}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white">
                            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar no WhatsApp
                        </a>
                    ) : item.message ? (
                        <button type="button" onClick={() => { void copyText(item.message!).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }); }}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3.5 text-sm font-semibold text-[var(--text-strong)]">
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Mensagem copiada' : 'Copiar mensagem'}
                        </button>
                    ) : null}
                    {item.step !== 'reply' && item.step !== 'close' ? (
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

/** Propostas enviadas por link que pedem uma ação hoje, com a mensagem pronta. */
const ProposalFollowUpQueue: React.FC<ProposalFollowUpQueueProps> = ({ portals, loading = false, onChanged }) => {
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [lastLost, setLastLost] = useState<{ id: string; name: string } | null>(null);
    const [showLost, setShowLost] = useState(false);
    const { due, waiting } = useMemo(() => buildFollowUpQueue(portals), [portals]);
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

    return (
        <section className="space-y-2" aria-labelledby="proposal-follow-up-title">
            <div className="flex items-end justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    <h2 id="proposal-follow-up-title" className="text-sm font-black text-[var(--text-strong)]">Para acompanhar hoje{due.length > 0 ? ` (${due.length})` : ''}</h2>
                </div>
                {busyId ? <LoaderCircle className="h-4 w-4 animate-spin text-[var(--text-muted)]" aria-label="Salvando" /> : null}
            </div>
            <p className="px-1 text-xs text-[var(--text-muted)]">Sugestões pelo que o cliente fez no link. A mensagem já vai com o mesmo link.</p>

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
            ) : due.length === 0 ? (
                <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] px-4 py-5 text-center text-sm text-[var(--text-muted)]">
                    Nada para hoje.{waiting > 0 ? ` ${waiting === 1 ? '1 proposta está' : `${waiting} propostas estão`} aguardando o momento certo.` : ''}
                </p>
            ) : (
                <div className="space-y-2">
                    {due.map(item => (
                        <FollowUpCard key={item.portal.id} item={item} busy={busyId === item.portal.id} onContact={contact} onLost={lose} />
                    ))}
                    {waiting > 0 ? <p className="px-1 text-xs text-[var(--text-muted)]">{waiting === 1 ? 'Mais 1 proposta aguarda' : `Mais ${waiting} propostas aguardam`} o momento certo.</p> : null}
                </div>
            )}

            {lostPortals.length > 0 ? (
                <div className="px-1 pt-1">
                    <button type="button" onClick={() => setShowLost(current => !current)} aria-expanded={showLost}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]">
                        Perdidas ({lostPortals.length}){lostSummary.topReason ? ` · nos últimos 30 dias o motivo mais comum foi ${lostSummary.topReason.toLowerCase()}` : ''}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showLost ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    {showLost ? (
                        <ul className="mt-2 space-y-1.5">
                            {lostPortals.map(portal => (
                                <li key={portal.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">{portal.clientName}</span>
                                        <span className="block text-[11px] text-[var(--text-muted)]">{lostReasonLabel(portal.lostReason)} · {shortDate(portal.lostAt!)}</span>
                                    </span>
                                    <button type="button" disabled={busyId === portal.id} onClick={() => reopen(portal.id)} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 disabled:opacity-50">
                                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reabrir
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
};

export default ProposalFollowUpQueue;
