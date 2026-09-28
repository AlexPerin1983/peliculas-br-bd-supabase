import React, { useEffect, useState } from 'react';
import { CalendarPlus, Check, CheckCircle2, ChevronDown, Copy, Lightbulb, MessageCircle, MessageSquareText, PencilLine, PhoneCall } from 'lucide-react';
import type { CompanyProposalPortal } from '../src/lib/proposalPortal';
import { AGREEMENT_TIP, agreementConfirmedAt, buildAgreementConfirmation } from '../src/lib/proposalQuickReplies';
import { buildProposalWhatsAppUrl } from '../src/lib/proposalMessages';

const shortDate = (value: number) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const area = document.createElement('textarea');
    area.value = value;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
};

/** Depois da aprovação: confirmar por escrito o que, quanto, quando e quem recebe a equipe. */
const ProposalAgreementCard: React.FC<{
    portal: CompanyProposalPortal;
    installation: Date | null;
    busy: boolean;
    onConfirmed: (channel: 'whatsapp' | 'other') => void;
    onUseInLink: (text: string) => void;
    onSchedule?: () => void;
}> = ({ portal, installation, busy, onConfirmed, onUseInLink, onSchedule }) => {
    const confirmedAt = agreementConfirmedAt(portal);
    const [open, setOpen] = useState(!confirmedAt);
    const [editing, setEditing] = useState(false);
    const [edited, setEdited] = useState(false);
    const [text, setText] = useState(() => buildAgreementConfirmation(portal, installation));
    const [copied, setCopied] = useState(false);
    const [showTip, setShowTip] = useState(false);

    // Depois de confirmar, o cartão fecha (dá para abrir e mandar de novo).
    useEffect(() => { setOpen(!confirmedAt); }, [confirmedAt, portal.id]);

    // Sem edição manual, a mensagem acompanha a data agendada.
    useEffect(() => {
        if (!edited) setText(buildAgreementConfirmation(portal, installation));
    }, [edited, portal, installation]);

    const whatsappUrl = text ? buildProposalWhatsAppUrl(portal.clientPhone || undefined, text) : null;

    return (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4" aria-label="Confirmar o combinado">
            {confirmedAt ? (
                <div className="flex items-center justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Combinado confirmado em {shortDate(confirmedAt)}
                    </p>
                    <button type="button" onClick={() => setOpen(current => !current)} aria-expanded={open} className="inline-flex shrink-0 items-center gap-1 text-blue-600">
                        <span className="text-xs font-semibold">{open ? 'Fechar' : 'Ver mensagem'}</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                </div>
            ) : (
                <>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Próximo passo</p>
                    <p className="mt-1 text-[15px] font-semibold text-[var(--text-strong)]">Confirme o combinado</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-body)]">Mande por escrito o que foi aprovado, o valor, a data e quem recebe a equipe no local.</p>
                    <div className="mt-2 rounded-xl bg-amber-50/70 px-3 py-2 text-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                        <div className="text-xs">
                            <button type="button" onClick={() => setShowTip(current => !current)} aria-expanded={showTip} className="flex w-full items-center gap-1.5 text-left">
                                <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 flex-1">Dica de negociação: <span className="font-semibold">{AGREEMENT_TIP.title}</span></span>
                                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${showTip ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                        </div>
                        {showTip ? <p className="mt-1.5 text-[13px] leading-5">{AGREEMENT_TIP.text}</p> : null}
                    </div>
                </>
            )}

            {open ? (
                <>
                    <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                            <span className="font-medium text-[var(--text-muted)]">Mensagem</span>
                            <button type="button" onClick={() => setEditing(current => !current)} className="inline-flex shrink-0 items-center gap-1 text-blue-600">
                                {editing ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /> Pronto</> : <><PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> Editar</>}
                            </button>
                        </div>
                        {editing ? (
                            <textarea value={text} onChange={event => { setText(event.target.value); setEdited(true); }} rows={7} aria-label={`Confirmação para ${portal.clientName}`}
                                style={{ fontSize: 16 }}
                                className="mt-2 w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5 leading-6 text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                        ) : (
                            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-5 text-[var(--text-body)] [overflow-wrap:anywhere]">{text}</p>
                        )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => onConfirmed('whatsapp')}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-white">
                                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar no WhatsApp
                            </a>
                        ) : (
                            <button type="button" onClick={() => { void copyText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }); }}
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3.5 text-[var(--text-strong)]">
                                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Mensagem copiada' : 'Copiar mensagem'}
                            </button>
                        )}
                        {!installation && onSchedule ? (
                            <button type="button" onClick={onSchedule} title="Abrir a agenda com esta proposta"
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 font-medium text-[var(--text-body)]">
                                <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Agendar instalação
                            </button>
                        ) : null}
                        <button type="button" onClick={() => onUseInLink(text)} title="Colocar a mensagem na conversa do link"
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 font-medium text-[var(--text-body)]">
                            <MessageSquareText className="h-4 w-4" aria-hidden="true" /> Responder no link
                        </button>
                        {!confirmedAt ? (
                            <button type="button" disabled={busy} onClick={() => onConfirmed('other')} title="Você já confirmou por ligação ou pessoalmente"
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 font-medium text-[var(--text-body)] disabled:opacity-50">
                                <PhoneCall className="h-4 w-4" aria-hidden="true" /> Já confirmei
                            </button>
                        ) : null}
                    </div>
                </>
            ) : null}
        </section>
    );
};

export default ProposalAgreementCard;
