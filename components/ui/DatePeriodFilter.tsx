import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, ChevronLeft, X } from 'lucide-react';

export type DatePeriodKey =
    | 'custom'
    | 'today'
    | 'yesterday'
    | 'last7'
    | 'last14'
    | 'last30'
    | 'thisWeekSunday'
    | 'thisWeekMonday'
    | 'lastWeekSunday'
    | 'lastWeekMonday'
    | 'month'
    | 'previousMonth'
    | 'year'
    | 'all';

export interface DatePeriodValue {
    key: DatePeriodKey;
    start?: string;
    end?: string;
}

export interface DateRange {
    start: Date;
    end: Date;
}

export const DATE_PERIOD_OPTIONS: { key: DatePeriodKey; label: string }[] = [
    { key: 'custom', label: 'Personalizado' },
    { key: 'today', label: 'Hoje' },
    { key: 'yesterday', label: 'Ontem' },
    { key: 'last7', label: '7 dias atrás' },
    { key: 'last14', label: '14 dias atrás' },
    { key: 'last30', label: '30 dias atrás' },
    { key: 'thisWeekSunday', label: 'Esta semana (dom - hoje)' },
    { key: 'thisWeekMonday', label: 'Esta semana (seg - hoje)' },
    { key: 'lastWeekSunday', label: 'Semana passada (dom - sáb)' },
    { key: 'lastWeekMonday', label: 'Semana passada (seg - dom)' },
    { key: 'month', label: 'Este mês' },
    { key: 'previousMonth', label: 'Mês passado' },
    { key: 'year', label: 'Este ano' },
    { key: 'all', label: 'Todo o período' },
];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};
const startOfWeek = (date: Date, startsOn: 0 | 1) => {
    const start = startOfDay(date);
    start.setDate(start.getDate() - ((start.getDay() - startsOn + 7) % 7));
    return start;
};
const parseInputDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};
const toInputDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const resolveDatePeriod = (value: DatePeriodValue, now = new Date()): DateRange | null => {
    const today = startOfDay(now);

    switch (value.key) {
        case 'custom': {
            const start = parseInputDate(value.start);
            const end = parseInputDate(value.end);
            return start && end && start <= end ? { start: startOfDay(start), end: endOfDay(end) } : null;
        }
        case 'today':
            return { start: today, end: endOfDay(today) };
        case 'yesterday': {
            const yesterday = addDays(today, -1);
            return { start: yesterday, end: endOfDay(yesterday) };
        }
        case 'last7':
            return { start: addDays(today, -6), end: endOfDay(today) };
        case 'last14':
            return { start: addDays(today, -13), end: endOfDay(today) };
        case 'last30':
            return { start: addDays(today, -29), end: endOfDay(today) };
        case 'thisWeekSunday':
            return { start: startOfWeek(today, 0), end: endOfDay(today) };
        case 'thisWeekMonday':
            return { start: startOfWeek(today, 1), end: endOfDay(today) };
        case 'lastWeekSunday': {
            const currentStart = startOfWeek(today, 0);
            return { start: addDays(currentStart, -7), end: endOfDay(addDays(currentStart, -1)) };
        }
        case 'lastWeekMonday': {
            const currentStart = startOfWeek(today, 1);
            return { start: addDays(currentStart, -7), end: endOfDay(addDays(currentStart, -1)) };
        }
        case 'month':
            return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: endOfDay(today) };
        case 'previousMonth':
            return {
                start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
                end: endOfDay(new Date(today.getFullYear(), today.getMonth(), 0)),
            };
        case 'year':
            return { start: new Date(today.getFullYear(), 0, 1), end: endOfDay(today) };
        case 'all':
        default:
            return null;
    }
};

export const getDatePeriodLabel = (value: DatePeriodValue) => {
    if (value.key !== 'custom') {
        return DATE_PERIOD_OPTIONS.find(option => option.key === value.key)?.label || 'Todo o período';
    }

    const start = parseInputDate(value.start);
    const end = parseInputDate(value.end);
    if (!start || !end) return 'Personalizado';
    return `${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`;
};

interface DatePeriodFilterProps {
    value: DatePeriodValue;
    onChange: (value: DatePeriodValue) => void;
    className?: string;
}

const DatePeriodFilter: React.FC<DatePeriodFilterProps> = ({ value, onChange, className = '' }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [view, setView] = React.useState<'list' | 'custom'>('list');
    const [draftStart, setDraftStart] = React.useState(value.start || toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
    const [draftEnd, setDraftEnd] = React.useState(value.end || toInputDate(new Date()));

    React.useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    const close = () => {
        setIsOpen(false);
        setView('list');
    };

    const selectPeriod = (key: DatePeriodKey) => {
        if (key === 'custom') {
            setView('custom');
            return;
        }
        onChange({ key });
        close();
    };

    const customRange = resolveDatePeriod({ key: 'custom', start: draftStart, end: draftEnd });
    const applyCustom = () => {
        if (!customRange) return;
        onChange({ key: 'custom', start: draftStart, end: draftEnd });
        close();
    };

    const list = (
        <div className="min-h-0 flex-1 overflow-y-auto">
            {DATE_PERIOD_OPTIONS.map(option => {
                const selected = value.key === option.key;
                return (
                    <button
                        key={option.key}
                        type="button"
                        onClick={() => selectPeriod(option.key)}
                        className={`flex min-h-[64px] w-full items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 text-left text-xl font-semibold transition-colors sm:min-h-[46px] sm:px-4 sm:text-sm ${
                            selected
                                ? 'text-[var(--brand-primary)] sm:bg-blue-50 dark:sm:bg-blue-400/15'
                                : 'text-[var(--text-strong)] hover:bg-[var(--surface-muted)]'
                        }`}
                    >
                        <span>{option.label}</span>
                        {selected ? <Check className="h-7 w-7 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" /> : null}
                    </button>
                );
            })}
        </div>
    );

    const custom = (
        <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface)] p-5 sm:p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                    <span className="ui-label mb-1 block">Data inicial</span>
                    <input type="date" value={draftStart} max={draftEnd || undefined} onChange={event => setDraftStart(event.target.value)} className="ui-field h-12 w-full px-3" />
                </label>
                <label className="block">
                    <span className="ui-label mb-1 block">Data final</span>
                    <input type="date" value={draftEnd} min={draftStart || undefined} max={toInputDate(new Date())} onChange={event => setDraftEnd(event.target.value)} className="ui-field h-12 w-full px-3" />
                </label>
            </div>
            {!customRange ? <p className="mt-3 text-sm font-semibold text-red-500">Escolha um intervalo de datas válido.</p> : null}
            <button type="button" onClick={applyCustom} disabled={!customRange} className="mt-5 h-12 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
                Aplicar período
            </button>
        </div>
    );

    const mobilePanel = typeof document !== 'undefined' && isOpen
        ? createPortal(
            <div role="dialog" aria-modal="true" aria-label="Filtro de período" className="fixed inset-0 z-[10020] flex min-h-[100dvh] flex-col bg-[var(--app-bg)] text-[var(--text-strong)] sm:hidden">
                <div className="flex h-20 shrink-0 items-center gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 shadow-[var(--shadow-hairline)]">
                    <button type="button" onClick={view === 'custom' ? () => setView('list') : close} aria-label={view === 'custom' ? 'Voltar para períodos' : 'Fechar filtro de período'} className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-muted)]">
                        {view === 'custom' ? <ChevronLeft className="h-7 w-7" aria-hidden="true" /> : <X className="h-7 w-7" aria-hidden="true" />}
                    </button>
                    <h2 className="text-2xl font-bold">{view === 'custom' ? 'Personalizado' : 'Período'}</h2>
                </div>
                {view === 'list' ? list : custom}
            </div>,
            document.body,
        )
        : null;

    return (
        <div className={`relative ${className}`}>
            <button type="button" onClick={() => setIsOpen(true)} aria-label={`Abrir filtro de período: ${getDatePeriodLabel(value)}`} className="flex h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text-strong)] shadow-[var(--shadow-hairline)] transition-colors hover:border-[var(--brand-primary)] sm:min-w-[220px]">
                <span className="flex min-w-0 items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
                    <span className="truncate">{getDatePeriodLabel(value)}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            </button>

            {isOpen ? (
                <>
                    <button type="button" aria-label="Fechar filtro de período" onClick={close} className="fixed inset-0 z-40 hidden cursor-default bg-transparent sm:block" />
                    <div role="dialog" aria-label="Filtro de período" className="absolute right-0 top-[calc(100%+8px)] z-50 hidden max-h-[min(620px,calc(100vh-140px))] w-[340px] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-elevated)] sm:flex sm:flex-col">
                        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                            <button type="button" onClick={view === 'custom' ? () => setView('list') : close} className="flex items-center gap-2 text-sm font-bold text-[var(--text-strong)]">
                                {view === 'custom' ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : null}
                                {view === 'custom' ? 'Personalizado' : 'Período'}
                            </button>
                            <button type="button" onClick={close} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"><X className="h-4 w-4" aria-hidden="true" /></button>
                        </div>
                        {view === 'list' ? list : custom}
                    </div>
                </>
            ) : null}
            {mobilePanel}
        </div>
    );
};

export default DatePeriodFilter;
