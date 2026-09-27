import React from 'react';
import { ArrowRight, CalendarCheck2, MessageCircle, MessageSquareText, Plus, Sparkles, Star, Users } from 'lucide-react';
import type { Client } from '../../types';
import { buildClientWhatsAppUrl, type ClientNextStep, type ClientNextStepAction } from '../../src/lib/clientInsights';

const TONES: Record<ClientNextStep['tone'], { card: string; button: string; kicker: string }> = {
    blue: {
        card: 'border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/25',
        button: 'bg-blue-600 text-white',
        kicker: 'text-blue-700 dark:text-blue-300',
    },
    green: {
        card: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/25',
        button: 'bg-emerald-600 text-white',
        kicker: 'text-emerald-700 dark:text-emerald-300',
    },
    amber: {
        card: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/25',
        button: 'bg-amber-600 text-white',
        kicker: 'text-amber-700 dark:text-amber-300',
    },
    slate: {
        card: 'border-[var(--border-subtle)] bg-[var(--surface-raised)]',
        button: 'bg-[var(--text-strong)] text-[var(--surface)]',
        kicker: 'text-[var(--text-muted)]',
    },
};

const actionIcon = (action: ClientNextStepAction) => {
    if (action.type === 'whatsapp') return <MessageCircle className="h-4 w-4" aria-hidden="true" />;
    if (action.type === 'open_portal' || action.type === 'follow_up') return <MessageSquareText className="h-4 w-4" aria-hidden="true" />;
    if (action.type === 'schedule' || action.type === 'open_agendamento') return <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />;
    if (action.type === 'new_proposal') return <Plus className="h-4 w-4" aria-hidden="true" />;
    if (action.type === 'review') return <Star className="h-4 w-4" aria-hidden="true" />;
    if (action.type === 'referral') return <Users className="h-4 w-4" aria-hidden="true" />;
    return <ArrowRight className="h-4 w-4" aria-hidden="true" />;
};

/** O que fazer agora com este cliente (uma sugestão só, a mais importante). */
const ClientNextStepCard: React.FC<{
    client: Client;
    step: ClientNextStep;
    onAction: (action: ClientNextStepAction) => void;
}> = ({ client, step, onAction }) => {
    const tone = TONES[step.tone];
    const whatsappUrl = step.action.type === 'whatsapp' ? buildClientWhatsAppUrl(client, step.action.message) : null;
    const buttonClass = `inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${tone.button}`;

    return (
        <section className={`rounded-2xl border p-4 ${tone.card}`} aria-label="Próximo passo">
            <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${tone.kicker}`}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Próximo passo
            </p>
            <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text-strong)]">{step.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[var(--text-body)]">{step.detail}</p>
                </div>
                {step.action.type === 'whatsapp' ? (
                    whatsappUrl ? (
                        <a href={whatsappUrl} target="_blank" rel="noreferrer" className={buttonClass}>{actionIcon(step.action)} {step.cta}</a>
                    ) : null
                ) : (
                    <div className="text-sm font-semibold">
                        <button type="button" onClick={() => onAction(step.action)} className={buttonClass}>{actionIcon(step.action)} {step.cta}</button>
                    </div>
                )}
            </div>
        </section>
    );
};

export default ClientNextStepCard;
