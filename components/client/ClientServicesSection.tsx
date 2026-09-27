import React from 'react';
import { CalendarDays, CalendarPlus, ChevronRight } from 'lucide-react';
import type { Agendamento, AgendamentoServiceStatus } from '../../types';
import { formatServiceDate } from '../../src/lib/clientInsights';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_META: Record<AgendamentoServiceStatus, { label: string; chip: string }> = {
    scheduled: { label: 'Agendado', chip: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
    completed: { label: 'Concluído', chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
    partial: { label: 'Parcial', chip: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' },
    cancelled: { label: 'Cancelado', chip: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
    no_show: { label: 'Não compareceu', chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

// Já passou e continua "agendado": falta dar baixa (concluir) na agenda.
const PENDING_CLOSE = { label: 'Sem conclusão', chip: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' };

const ServiceRow: React.FC<{ agendamento: Agendamento; now: number; onOpen: () => void }> = ({ agendamento, now, onOpen }) => {
    const status = agendamento.serviceStatus ?? 'scheduled';
    const meta = status === 'scheduled' && new Date(agendamento.end || agendamento.start).getTime() < now ? PENDING_CLOSE : STATUS_META[status];
    return (
        <button type="button" onClick={onOpen}
            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-left transition-colors hover:bg-[var(--surface-muted)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-muted)]">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">{formatServiceDate(agendamento.start, now)}</span>
                <span className="block truncate text-xs text-[var(--text-muted)]">
                    {[agendamento.valorFinal ? currency.format(agendamento.valorFinal) : null, agendamento.notes?.trim() || null].filter(Boolean).join(' · ') || new Date(agendamento.start).toLocaleDateString('pt-BR')}
                </span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>{meta.label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-soft)]" aria-hidden="true" />
        </button>
    );
};

/** Serviços do cliente: o que vem pela frente e o histórico. */
const ClientServicesSection: React.FC<{
    agendamentos: Agendamento[];
    now?: number;
    onOpen: (agendamento: Agendamento) => void;
    onSchedule: () => void;
}> = ({ agendamentos, now = Date.now(), onOpen, onSchedule }) => {
    const upcoming = agendamentos
        .filter(item => (item.serviceStatus ?? 'scheduled') === 'scheduled' && new Date(item.start).getTime() >= now)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const past = agendamentos
        .filter(item => !upcoming.includes(item))
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

    return (
        <div className="space-y-4 text-sm">
            <div className="text-sm font-semibold">
                <button type="button" onClick={onSchedule}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 text-blue-700 transition hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300">
                    <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Agendar serviço
                </button>
            </div>

            {agendamentos.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-[var(--text-muted)]">Nenhum serviço marcado para este cliente.</p>
            ) : (
                <>
                    {upcoming.length > 0 ? (
                        <section className="space-y-2" aria-label="Próximos serviços">
                            <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Próximos</h3>
                            {upcoming.map(item => <ServiceRow key={item.id ?? item.start} agendamento={item} now={now} onOpen={() => onOpen(item)} />)}
                        </section>
                    ) : null}
                    {past.length > 0 ? (
                        <section className="space-y-2" aria-label="Histórico de serviços">
                            <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Histórico</h3>
                            {past.map(item => <ServiceRow key={item.id ?? item.start} agendamento={item} now={now} onOpen={() => onOpen(item)} />)}
                        </section>
                    ) : null}
                </>
            )}
        </div>
    );
};

export default ClientServicesSection;
