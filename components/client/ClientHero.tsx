import React from 'react';
import { Mail, MapPin, MessageCircle, Pencil, Phone, Pin } from 'lucide-react';
import type { Client } from '../../types';
import {
    buildClientMapsUrl,
    buildClientWhatsAppUrl,
    clientAvatarTone,
    clientInitials,
    clientPhoneDigits,
    CLIENT_STAGE_LABELS,
    formatMoneyShort,
    relativeDays,
    type ClientStage,
    type ClientSummary,
} from '../../src/lib/clientInsights';

const STAGE_TONES: Record<ClientStage, string> = {
    new: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    negotiating: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    customer: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    recurring: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    inactive: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export const ClientStageBadge: React.FC<{ stage: ClientStage }> = ({ stage }) => (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_TONES[stage]}`}>
        {CLIENT_STAGE_LABELS[stage]}
    </span>
);

export const ClientAvatar: React.FC<{ client: Client; size?: 'md' | 'lg' }> = ({ client, size = 'md' }) => (
    <span
        className={`flex shrink-0 items-center justify-center font-semibold ${clientAvatarTone(client.id ?? client.nome)} ${size === 'lg' ? 'h-14 w-14 rounded-2xl text-lg' : 'h-11 w-11 rounded-xl text-sm'}`}
        aria-hidden="true"
    >
        {clientInitials(client.nome)}
    </span>
);

const QuickAction: React.FC<{ label: string; icon: React.ReactNode; href: string | null; external?: boolean; tone?: 'green' }> = ({ label, icon, href, external, tone }) => {
    const circle = `flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-200 group-active:scale-95 ${!href
        ? 'bg-[var(--surface-muted)] text-[var(--text-soft)] opacity-50'
        : tone === 'green'
            ? 'bg-emerald-600 text-white shadow-[0_6px_16px_rgba(5,150,105,0.28)]'
            : 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'}`;
    const content = (
        <>
            <span className={circle}>{icon}</span>
            <span className="mt-1.5 text-[11px] font-medium text-[var(--text-body)]">{label}</span>
        </>
    );
    return href ? (
        <a href={href} aria-label={label} className="group flex flex-col items-center" {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{content}</a>
    ) : (
        <span aria-label={`${label} (não cadastrado)`} aria-disabled="true" className="flex flex-col items-center">{content}</span>
    );
};

/** Cabeçalho da ficha: quem é o cliente, como falar com ele e o que ele já representa. */
const ClientHero: React.FC<{
    client: Client;
    summary: ClientSummary;
    onEditClient: () => void;
    now?: number;
}> = ({ client, summary, onEditClient, now = Date.now() }) => {
    const phone = clientPhoneDigits(client);
    const since = summary.since ? new Date(summary.since).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '') : '';

    return (
        <section className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]" aria-label="Cliente">
            <div className="flex items-start gap-3">
                <ClientAvatar client={client} size="lg" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <h2 className="truncate text-xl font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">{client.nome}</h2>
                        {client.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" fill="currentColor" aria-label="Fixado no topo" /> : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
                        <ClientStageBadge stage={summary.stage} />
                        {since ? <span>Cliente desde {since}</span> : null}
                    </div>
                    {summary.lastActivityAt ? <p className="mt-1 text-xs text-[var(--text-muted)]">Última atividade {relativeDays(summary.lastActivityAt, now)}</p> : null}
                </div>
                <button type="button" onClick={onEditClient} aria-label="Editar cliente" title="Editar dados do cliente"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:text-[var(--text-strong)]">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-1" role="group" aria-label="Falar com o cliente">
                <QuickAction label="WhatsApp" tone="green" icon={<MessageCircle className="h-5 w-5" aria-hidden="true" />} href={buildClientWhatsAppUrl(client)} external />
                <QuickAction label="Ligar" icon={<Phone className="h-5 w-5" aria-hidden="true" />} href={phone ? `tel:+${phone}` : null} />
                <QuickAction label="Rota" icon={<MapPin className="h-5 w-5" aria-hidden="true" />} href={buildClientMapsUrl(client)} external />
                <QuickAction label="E-mail" icon={<Mail className="h-5 w-5" aria-hidden="true" />} href={client.email?.trim() ? `mailto:${client.email.trim()}` : null} />
            </div>

            <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--border-subtle)] rounded-xl bg-[var(--surface-muted)]/60 text-center">
                <div className="min-w-0 px-2 py-2.5" title="Orçamentos aprovados e serviços cobrados">
                    <dt className="truncate text-[11px] text-[var(--text-muted)]">Fechado</dt>
                    <dd className="truncate text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoneyShort(summary.closedValue)}</dd>
                </div>
                <div className="min-w-0 px-2 py-2.5" title="Orçamentos sem resposta dos últimos 6 meses">
                    <dt className="truncate text-[11px] text-[var(--text-muted)]">Em aberto</dt>
                    <dd className="truncate text-base font-semibold tabular-nums text-[var(--text-strong)]">{formatMoneyShort(summary.openValue)}</dd>
                </div>
                <div className="min-w-0 px-2 py-2.5">
                    <dt className="truncate text-[11px] text-[var(--text-muted)]">Serviços</dt>
                    <dd className="truncate text-base font-semibold tabular-nums text-[var(--text-strong)]">{summary.servicesDone}</dd>
                </div>
            </dl>
        </section>
    );
};

export default ClientHero;
