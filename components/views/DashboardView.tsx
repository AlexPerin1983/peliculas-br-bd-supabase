import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle,
    ArrowRight,
    CalendarDays,
    Car,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
    ClipboardList,
    DollarSign,
    FileText,
    Gauge,
    Layers3,
    Megaphone,
    Package,
    Pencil,
    PieChart,
    Plus,
    QrCode,
    ReceiptText,
    Sparkles,
    Star,
    Trash2,
    TrendingUp,
    UsersRound,
    UtensilsCrossed,
    WalletCards,
    Wrench,
    X,
    type LucideIcon
} from 'lucide-react';
import { Agendamento, Client, Film, ProposalExpenseCategory, SavedPDF, StandaloneExpense } from '../../types';
import { getAllServicosPrestados, ServicoPrestado } from '../../services/servicosService';
import { deleteStandaloneExpense, getAllStandaloneExpenses, saveStandaloneExpense } from '../../services/db';
import StandaloneExpenseModal from '../modals/StandaloneExpenseModal';
import AIFinancialAssistantModal, { FinancialAnalysisCache, FinancialSummary } from '../modals/AIFinancialAssistantModal';

type ActiveTab = 'dashboard' | 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores';
type PeriodKey =
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
type Tone = 'blue' | 'emerald' | 'amber' | 'slate' | 'rose' | 'cyan';
type DateRange = { start: Date; end: Date };

interface DashboardViewProps {
    allSavedPdfs: SavedPDF[];
    clients: Client[];
    agendamentos: Agendamento[];
    films: Film[];
    onTabChange: (tab: ActiveTab) => void;
    onOpenAIQuickProposal: () => void;
    onOpenClientModal: (mode: 'add' | 'edit') => void;
    onCreateProposal?: () => void;
    aiConfig?: { provider: 'gemini' | 'openai' | 'local_ocr'; apiKey: string };
}

const DESKTOP_PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
    { key: 'custom', label: 'Personalizar' },
    { key: 'today', label: 'Hoje' },
    { key: 'yesterday', label: 'Ontem' },
    { key: 'thisWeekSunday', label: 'Esta semana (dom. ate hoje)' },
    { key: 'last7', label: '7 dias atras' },
    { key: 'lastWeekSunday', label: 'Semana passada (dom. a sab.)' },
    { key: 'last14', label: '14 dias atras' },
    { key: 'month', label: 'Este mes' },
    { key: 'last30', label: '30 dias atras' },
    { key: 'previousMonth', label: 'Ultimo mes' },
    { key: 'all', label: 'Todo o periodo' }
];

const MOBILE_PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
    { key: 'custom', label: 'Personalizado' },
    { key: 'today', label: 'Hoje' },
    { key: 'yesterday', label: 'Ontem' },
    { key: 'last7', label: '7 dias atras' },
    { key: 'last14', label: '14 dias atras' },
    { key: 'last30', label: '30 dias atras' },
    { key: 'thisWeekSunday', label: 'Esta semana (dom - hoje)' },
    { key: 'thisWeekMonday', label: 'Esta semana (seg - hoje)' },
    { key: 'lastWeekSunday', label: 'Semana passada (dom - sab)' },
    { key: 'lastWeekMonday', label: 'Semana passada (seg - dom)' },
    { key: 'month', label: 'Este mes' },
    { key: 'previousMonth', label: 'Mes passado' },
    { key: 'year', label: 'Este ano' },
    { key: 'all', label: 'Todo o periodo' }
];

const PERIOD_LABELS: Record<PeriodKey, string> = {
    custom: 'Personalizada',
    today: 'Hoje',
    yesterday: 'Ontem',
    last7: '7 dias',
    last14: '14 dias',
    last30: '30 dias',
    thisWeekSunday: 'Esta semana',
    thisWeekMonday: 'Esta semana',
    lastWeekSunday: 'Semana passada',
    lastWeekMonday: 'Semana passada',
    month: 'Este mes',
    previousMonth: 'Mes passado',
    year: 'Este ano',
    all: 'Todo o periodo'
};

const EXPENSE_CATEGORY_LABELS: Record<ProposalExpenseCategory, string> = {
    paid_traffic: 'Trafego pago',
    transport: 'Transporte',
    food: 'Alimentacao',
    tools: 'Ferramentas',
    material: 'Material',
    other: 'Outros'
};

const EXPENSE_CATEGORY_ICONS: Record<ProposalExpenseCategory, { Icon: LucideIcon; className: string }> = {
    paid_traffic: { Icon: Megaphone, className: 'bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-200' },
    transport: { Icon: Car, className: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-200' },
    food: { Icon: UtensilsCrossed, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200' },
    tools: { Icon: Wrench, className: 'bg-orange-50 text-orange-600 dark:bg-orange-400/10 dark:text-orange-200' },
    material: { Icon: Package, className: 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-200' },
    other: { Icon: ReceiptText, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-200' }
};

const STATUS_CONFIG: Record<NonNullable<SavedPDF['status']>, { label: string; className: string; dot: string }> = {
    pending: {
        label: 'Pendente',
        className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
        dot: 'bg-amber-500'
    },
    approved: {
        label: 'Aprovado',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
        dot: 'bg-emerald-500'
    },
    revised: {
        label: 'Revisar',
        className: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200',
        dot: 'bg-sky-500'
    }
};

const TONE_CLASSES: Record<Tone, { icon: string; accent: string; bar: string }> = {
    blue: {
        icon: 'bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-200',
        accent: 'text-blue-600 dark:text-blue-300',
        bar: 'bg-blue-500'
    },
    emerald: {
        icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200',
        accent: 'text-emerald-600 dark:text-emerald-300',
        bar: 'bg-emerald-500'
    },
    amber: {
        icon: 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-200',
        accent: 'text-amber-600 dark:text-amber-300',
        bar: 'bg-amber-500'
    },
    slate: {
        icon: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
        accent: 'text-slate-700 dark:text-slate-200',
        bar: 'bg-slate-500'
    },
    rose: {
        icon: 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-200',
        accent: 'text-rose-600 dark:text-rose-300',
        bar: 'bg-rose-500'
    },
    cyan: {
        icon: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-200',
        accent: 'text-cyan-600 dark:text-cyan-300',
        bar: 'bg-cyan-500'
    }
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
});

const preciseCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1
});

const parseNumber = (value: unknown): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value !== 'string') return 0;

    const normalized = value
        .replace(/\s/g, '')
        .replace(/[R$]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parseDate = (value?: string): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const startOfWeek = (date: Date, weekStartsOn: 0 | 1) => {
    const start = startOfDay(date);
    const diff = (start.getDay() - weekStartsOn + 7) % 7;
    start.setDate(start.getDate() - diff);
    return start;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const getMonthDistance = (start: Date, end: Date) =>
    ((end.getFullYear() - start.getFullYear()) * 12) + end.getMonth() - start.getMonth();

const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isSameDay = (first: Date, second: Date) =>
    first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();

const isSameMonth = (first: Date, second: Date) =>
    first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth();

const formatFullDate = (date: Date | null) => {
    if (!date) return 'Sem data';

    return date.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).replace('.', '');
};

const formatRangeButtonLabel = (range: DateRange | null) => {
    if (!range) return 'Todo o periodo';

    if (isSameDay(range.start, range.end)) {
        return formatFullDate(range.start);
    }

    return `${range.start.toLocaleDateString('pt-BR')} - ${range.end.toLocaleDateString('pt-BR')}`;
};

const formatMobileRangeLabel = (range: DateRange | null) => {
    if (!range) return 'Todo o periodo';

    if (isSameDay(range.start, range.end)) {
        return formatFullDate(range.start);
    }

    const formatSide = (date: Date) =>
        date.toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'short'
        }).replace('.', '');

    return `${formatSide(range.start)} - ${formatSide(range.end)}`;
};

const formatMobileDatePairLabel = (startValue: string | null, endValue: string | null) => {
    const start = startValue ? parseDateInput(startValue, 'start') : null;
    const end = endValue ? parseDateInput(endValue, 'end') : null;

    if (!start || !end) return 'Data invalida';

    return formatMobileRangeLabel({ start, end });
};

const formatMonthTitle = (date: Date) =>
    date.toLocaleDateString('pt-BR', {
        month: 'short',
        year: 'numeric'
    }).replace('.', '').toUpperCase();

const getCalendarCells = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const gridStart = addDays(monthStart, -monthStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {
        const date = addDays(gridStart, index);

        return {
            date,
            isCurrentMonth: isSameMonth(date, monthStart)
        };
    });
};

const parseDateInput = (value: string, boundary: 'start' | 'end'): Date | null => {
    const [year, month, day] = value.split('-').map(Number);

    if (!year || !month || !day) return null;

    return boundary === 'start'
        ? new Date(year, month - 1, day, 0, 0, 0, 0)
        : new Date(year, month - 1, day, 23, 59, 59, 999);
};

const getDayRange = (date: Date): DateRange => ({
    start: startOfDay(date),
    end: endOfDay(date)
});

const getCustomDateRange = (startValue: string, endValue: string): DateRange | null => {
    const start = parseDateInput(startValue, 'start');
    const startAsEnd = parseDateInput(startValue, 'end');
    const end = parseDateInput(endValue, 'end');
    const endAsStart = parseDateInput(endValue, 'start');

    if (!start || !startAsEnd || !end || !endAsStart) return null;

    if (start <= end) {
        return { start, end };
    }

    return {
        start: endAsStart,
        end: startAsEnd
    };
};

const getStrictDateRangeValidation = (startValue: string | null, endValue: string | null) => {
    const start = startValue ? parseDateInput(startValue, 'start') : null;
    const end = endValue ? parseDateInput(endValue, 'end') : null;
    const today = endOfDay(new Date());

    if (!start || !end) {
        return {
            range: null,
            startError: false,
            endError: false,
            message: null
        };
    }

    if (start > today) {
        return {
            range: null,
            startError: true,
            endError: false,
            message: 'Fora do intervalo.'
        };
    }

    if (end > today) {
        return {
            range: null,
            startError: false,
            endError: true,
            message: 'Fora do intervalo.'
        };
    }

    if (start > end) {
        return {
            range: null,
            startError: true,
            endError: false,
            message: 'Data inicial maior que a final.'
        };
    }

    return {
        range: { start, end },
        startError: false,
        endError: false,
        message: null
    };
};

const getPeriodRange = (period: PeriodKey, customRange?: DateRange | null): DateRange | null => {
    const now = new Date();
    const end = new Date(now);

    if (period === 'today') {
        return getDayRange(now);
    }

    if (period === 'yesterday') {
        return getDayRange(addDays(now, -1));
    }

    if (period === 'month') {
        return {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end
        };
    }

    if (period === 'last7') {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return { start, end };
    }

    if (period === 'last14') {
        const start = new Date(now);
        start.setDate(start.getDate() - 13);
        start.setHours(0, 0, 0, 0);
        return { start, end };
    }

    if (period === 'last30') {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        return { start, end };
    }

    if (period === 'thisWeekSunday') {
        return {
            start: startOfWeek(now, 0),
            end
        };
    }

    if (period === 'thisWeekMonday') {
        return {
            start: startOfWeek(now, 1),
            end
        };
    }

    if (period === 'lastWeekSunday') {
        const start = addDays(startOfWeek(now, 0), -7);
        return {
            start,
            end: endOfDay(addDays(start, 6))
        };
    }

    if (period === 'lastWeekMonday') {
        const start = addDays(startOfWeek(now, 1), -7);
        return {
            start,
            end: endOfDay(addDays(start, 6))
        };
    }

    if (period === 'previousMonth') {
        return {
            start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        };
    }

    if (period === 'year') {
        return {
            start: new Date(now.getFullYear(), 0, 1),
            end
        };
    }

    if (period === 'custom') {
        return customRange || null;
    }

    return null;
};

const isWithinRange = (date: Date | null, range: DateRange | null) => {
    if (!range) return true;
    if (!date) return false;
    return date >= range.start && date <= range.end;
};

const getTodayRange = () => getDayRange(new Date());

const getPdfStatus = (pdf: SavedPDF): NonNullable<SavedPDF['status']> => pdf.status || 'pending';

const getPdfValue = (pdf: SavedPDF) => parseNumber(pdf.totalPreco);

const isPdfExpired = (pdf: SavedPDF) => {
    const expirationDate = parseDate(pdf.expirationDate);
    if (!expirationDate || getPdfStatus(pdf) === 'approved') return false;

    return startOfDay(expirationDate).getTime() < startOfDay(new Date()).getTime();
};

const getOperationalExpenses = (pdf: SavedPDF) => {
    const snapshot = pdf.generalDiscount?.expenseSnapshot;

    if (snapshot && Number.isFinite(snapshot.operationalExpenses)) {
        return snapshot.operationalExpenses;
    }

    if (snapshot?.expensesByCategory?.length) {
        return snapshot.expensesByCategory.reduce((sum, item) => sum + parseNumber(item.total), 0);
    }

    return (pdf.generalDiscount?.expenses || []).reduce((sum, expense) => sum + parseNumber(expense.amount), 0);
};

const getEstimatedProfit = (pdf: SavedPDF) => {
    const snapshot = pdf.generalDiscount?.expenseSnapshot;
    if (snapshot && Number.isFinite(snapshot.estimatedProfit)) {
        return snapshot.estimatedProfit;
    }

    return Math.max(0, getPdfValue(pdf) - getOperationalExpenses(pdf));
};

const formatCurrency = (value: number, precise = false) => {
    const formatter = precise && Math.abs(value) < 10000 ? preciseCurrencyFormatter : currencyFormatter;
    return formatter.format(Number.isFinite(value) ? value : 0);
};

const formatPercent = (value: number) => `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;

const formatShortDate = (value?: string) => {
    const date = parseDate(value);
    if (!date) return 'Sem data';

    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short'
    });
};

const formatDateInputLabel = (value: string) => {
    const date = parseDateInput(value, 'start');
    if (!date) return 'Sem data';

    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
    });
};

const formatManualDateValue = (value: string) => {
    const date = parseDateInput(value, 'start');
    if (!date) return '';

    return date.toLocaleDateString('pt-BR');
};

const normalizeManualDateValue = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);

    return parts.join('/');
};

const getManualDateCaretPosition = (value: string, digitsBeforeCaret: number) => {
    if (digitsBeforeCaret <= 0) return 0;

    let seenDigits = 0;

    for (let index = 0; index < value.length; index += 1) {
        if (/\d/.test(value[index])) {
            seenDigits += 1;
        }

        if (seenDigits >= digitsBeforeCaret) {
            return index + 1;
        }
    }

    return value.length;
};

const parseManualDateValue = (value: string): string | null => {
    const [day, month, year] = value.split('/').map(Number);
    if (!day || !month || !year || year < 1000) return null;

    const date = new Date(year, month - 1, day);
    const isValid = date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day;

    return isValid ? toDateInputValue(date) : null;
};

const formatDateTime = (value?: string) => {
    const date = parseDate(value);
    if (!date) return 'Sem data';

    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const StatusBadge: React.FC<{ status?: SavedPDF['status'] }> = ({ status }) => {
    const resolvedStatus = status || 'pending';
    const config = STATUS_CONFIG[resolvedStatus];

    return (
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${config.className}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
            {config.label}
        </span>
    );
};

const MetricCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    helper: string;
    tone: Tone;
    onClick?: () => void;
    className?: string;
}> = ({ icon, label, value, helper, tone, onClick, className = '' }) => {
    const toneClass = TONE_CLASSES[tone];
    const content = (
        <div className="flex h-full min-w-0 flex-col justify-between gap-3 sm:gap-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] sm:h-10 sm:w-10 ${toneClass.icon}`}>
                    {icon}
                </div>
                <span className={`min-w-0 truncate text-right text-xs font-bold ${toneClass.accent}`}>{label}</span>
            </div>
            <div className="min-w-0">
                <p className="break-words text-xl font-bold leading-tight text-[var(--text-strong)] sm:text-[1.65rem]">
                    {value}
                </p>
                <p className="mt-1 break-words text-xs leading-relaxed text-[var(--text-muted)]">{helper}</p>
            </div>
        </div>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`ui-card min-h-[116px] min-w-0 overflow-hidden p-3 text-left transition-colors hover:bg-[var(--surface-muted)] sm:min-h-[138px] sm:p-5 ${className}`}
            >
                {content}
            </button>
        );
    }

    return (
        <article className={`ui-card min-h-[116px] min-w-0 overflow-hidden p-3 sm:min-h-[138px] sm:p-5 ${className}`}>
            {content}
        </article>
    );
};

const EmptyLine: React.FC<{ title: string; description: string }> = ({ title, description }) => (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-center sm:p-4">
        <p className="text-sm font-bold text-[var(--text-strong)]">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>
    </div>
);

const HISTORY_FOCUS_FILTER_KEY = 'peliculas-br-history-focus-filter';

// Notas de avaliacao salvas pela Agenda (0/ausente = ainda nao avaliado).
const AGENDA_REVIEW_RATINGS_KEY = 'peliculas-br-agenda-review-ratings-v1';
const readAgendaReviewRatings = (): Record<number, number> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(AGENDA_REVIEW_RATINGS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const firstName = (full?: string) => (full || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';

const ActionRow: React.FC<{
    icon: React.ReactNode;
    tone: Tone;
    title: string;
    subtitle: string;
    count?: number;
    onClick: () => void;
}> = ({ icon, tone, title, subtitle, count, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-left transition-colors hover:bg-[var(--surface-muted)]"
    >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] ${TONE_CLASSES[tone].icon}`}>
            {icon}
        </span>
        <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[var(--text-strong)]">{title}</span>
            <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{subtitle}</span>
        </span>
        {typeof count === 'number' ? (
            <span className={`flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold ${TONE_CLASSES[tone].icon}`}>
                {count}
            </span>
        ) : null}
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-soft)]" aria-hidden="true" />
    </button>
);

const DashboardView: React.FC<DashboardViewProps> = ({
    allSavedPdfs,
    clients,
    agendamentos,
    films,
    onTabChange,
    onOpenAIQuickProposal,
    onOpenClientModal,
    onCreateProposal,
    aiConfig
}) => {
    const [period, setPeriod] = useState<PeriodKey>('today');
    const [isFinAssistantOpen, setIsFinAssistantOpen] = useState(false);
    const [finAnalysisCache, setFinAnalysisCache] = useState<FinancialAnalysisCache | null>(null);
    const [customStartDate, setCustomStartDate] = useState(() => toDateInputValue(addDays(new Date(), -6)));
    const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));
    const [isMobilePeriodOpen, setIsMobilePeriodOpen] = useState(false);
    const [mobileDraftPeriod, setMobileDraftPeriod] = useState<PeriodKey>('today');
    const [mobileDraftStartDate, setMobileDraftStartDate] = useState(customStartDate);
    const [mobileDraftEndDate, setMobileDraftEndDate] = useState(customEndDate);
    const [isDesktopPeriodOpen, setIsDesktopPeriodOpen] = useState(false);
    const [desktopDraftPeriod, setDesktopDraftPeriod] = useState<PeriodKey>('today');
    const [desktopDraftStartDate, setDesktopDraftStartDate] = useState(customStartDate);
    const [desktopDraftEndDate, setDesktopDraftEndDate] = useState(customEndDate);
    const [desktopActiveBoundary, setDesktopActiveBoundary] = useState<'start' | 'end'>('start');
    const [desktopCalendarMonth, setDesktopCalendarMonth] = useState(() => startOfMonth(new Date()));
    const [servicos, setServicos] = useState<ServicoPrestado[]>([]);
    const [isLoadingServicos, setIsLoadingServicos] = useState(true);
    const [standaloneExpenses, setStandaloneExpenses] = useState<StandaloneExpense[]>([]);
    const [isStandaloneExpenseModalOpen, setIsStandaloneExpenseModalOpen] = useState(false);
    const [isSavingStandaloneExpense, setIsSavingStandaloneExpense] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadServicos = async () => {
            try {
                const data = await getAllServicosPrestados();
                if (isMounted) {
                    setServicos(data);
                }
            } catch (error) {
                console.error('Erro ao carregar servicos no dashboard:', error);
                if (isMounted) {
                    setServicos([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoadingServicos(false);
                }
            }
        };

        loadServicos();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadStandaloneExpenses = async () => {
            try {
                const data = await getAllStandaloneExpenses();
                if (isMounted) {
                    setStandaloneExpenses(data);
                }
            } catch (error) {
                console.error('Erro ao carregar despesas avulsas no dashboard:', error);
                if (isMounted) {
                    setStandaloneExpenses([]);
                }
            }
        };

        loadStandaloneExpenses();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!isMobilePeriodOpen || typeof document === 'undefined') return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobilePeriodOpen]);

    useEffect(() => {
        if (!isDesktopPeriodOpen || typeof window === 'undefined') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsDesktopPeriodOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDesktopPeriodOpen]);

    const clientsById = useMemo(() => new Map(clients.map(client => [client.id, client])), [clients]);
    const customRange = useMemo(
        () => getCustomDateRange(customStartDate, customEndDate),
        [customEndDate, customStartDate]
    );
    const periodRange = useMemo(() => getPeriodRange(period, customRange), [customRange, period]);

    const periodPdfs = useMemo(() => {
        return allSavedPdfs
            .filter(pdf => isWithinRange(parseDate(pdf.date), periodRange))
            .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
    }, [allSavedPdfs, periodRange]);

    const periodServicos = useMemo(() => {
        return servicos.filter(servico => isWithinRange(parseDate(servico.data_servico || servico.created_at), periodRange));
    }, [servicos, periodRange]);

    const periodStandaloneExpenses = useMemo(() => {
        return standaloneExpenses
            .filter(expense => isWithinRange(parseDate(expense.date), periodRange))
            .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
    }, [standaloneExpenses, periodRange]);

    const standaloneExpenseTotal = useMemo(() => {
        return periodStandaloneExpenses.reduce((sum, expense) => sum + parseNumber(expense.amount), 0);
    }, [periodStandaloneExpenses]);

    const upcomingAgendamentos = useMemo(() => {
        const now = new Date();
        return agendamentos
            .filter(agendamento => {
                const date = parseDate(agendamento.start);
                return !!date && date >= now;
            })
            .sort((a, b) => (parseDate(a.start)?.getTime() || 0) - (parseDate(b.start)?.getTime() || 0))
            .slice(0, 5);
    }, [agendamentos]);

    const periodStats = useMemo(() => {
        const generatedCount = periodPdfs.length;
        const approved = periodPdfs.filter(pdf => getPdfStatus(pdf) === 'approved');
        const pending = periodPdfs.filter(pdf => getPdfStatus(pdf) === 'pending');
        const revised = periodPdfs.filter(pdf => getPdfStatus(pdf) === 'revised');
        const totalValue = periodPdfs.reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
        const approvedValue = approved.reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
        const pendingValue = pending.reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
        const proposalExpenses = periodPdfs.reduce((sum, pdf) => sum + getOperationalExpenses(pdf), 0);
        const expenses = proposalExpenses + standaloneExpenseTotal;
        const estimatedProfit = periodPdfs.reduce((sum, pdf) => sum + getEstimatedProfit(pdf), 0) - standaloneExpenseTotal;
        const totalM2 = periodPdfs.reduce((sum, pdf) => sum + parseNumber(pdf.totalM2), 0);

        return {
            generatedCount,
            approvedCount: approved.length,
            pendingCount: pending.length,
            revisedCount: revised.length,
            totalValue,
            approvedValue,
            pendingValue,
            expenses,
            estimatedProfit,
            totalM2,
            averageTicket: generatedCount > 0 ? totalValue / generatedCount : 0,
            approvedAverageTicket: approved.length > 0 ? approvedValue / approved.length : 0,
            conversionRate: generatedCount > 0 ? (approved.length / generatedCount) * 100 : 0,
            estimatedMargin: totalValue > 0 ? (estimatedProfit / totalValue) * 100 : 0
        };
    }, [periodPdfs, standaloneExpenseTotal]);

    const expenseRhythm = useMemo(() => {
        const sumProposalExpensesInRange = (range: DateRange | null) =>
            allSavedPdfs
                .filter(pdf => isWithinRange(parseDate(pdf.date), range))
                .reduce((sum, pdf) => sum + getOperationalExpenses(pdf), 0);
        const sumStandaloneExpensesInRange = (range: DateRange | null) =>
            standaloneExpenses
                .filter(expense => isWithinRange(parseDate(expense.date), range))
                .reduce((sum, expense) => sum + parseNumber(expense.amount), 0);

        const periodExpenses = sumProposalExpensesInRange(periodRange) + sumStandaloneExpensesInRange(periodRange);
        const daysInPeriod = periodRange
            ? Math.max(1, Math.ceil((periodRange.end.getTime() - periodRange.start.getTime()) / 86400000))
            : 1;

        return {
            periodExpenses,
            dailyAverage: periodExpenses / daysInPeriod
        };
    }, [allSavedPdfs, periodRange, standaloneExpenses]);

    const categoryTotals = useMemo(() => {
        const totals = new Map<string, { label: string; value: number }>();

        periodPdfs.forEach(pdf => {
            const snapshotCategories = pdf.generalDiscount?.expenseSnapshot?.expensesByCategory || [];

            if (snapshotCategories.length) {
                snapshotCategories.forEach(category => {
                    const previous = totals.get(category.category) || { label: category.label, value: 0 };
                    totals.set(category.category, {
                        label: category.label || EXPENSE_CATEGORY_LABELS[category.category] || 'Gasto',
                        value: previous.value + parseNumber(category.total)
                    });
                });
                return;
            }

            (pdf.generalDiscount?.expenses || []).forEach(expense => {
                const label = EXPENSE_CATEGORY_LABELS[expense.category] || 'Gasto';
                const previous = totals.get(expense.category) || { label, value: 0 };
                totals.set(expense.category, {
                    label,
                    value: previous.value + parseNumber(expense.amount)
                });
            });
        });

        periodStandaloneExpenses.forEach(expense => {
            const label = EXPENSE_CATEGORY_LABELS[expense.category] || 'Gasto avulso';
            const previous = totals.get(expense.category) || { label, value: 0 };
            totals.set(expense.category, {
                label,
                value: previous.value + parseNumber(expense.amount)
            });
        });

        return Array.from(totals.values())
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [periodPdfs, periodStandaloneExpenses]);

    const topClient = useMemo(() => {
        const totals = new Map<number, number>();
        periodPdfs.forEach(pdf => {
            totals.set(pdf.clienteId, (totals.get(pdf.clienteId) || 0) + getPdfValue(pdf));
        });

        const best = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0];
        if (!best) return null;

        return {
            name: clientsById.get(best[0])?.nome || periodPdfs.find(pdf => pdf.clienteId === best[0])?.clientName || 'Cliente',
            value: best[1]
        };
    }, [clientsById, periodPdfs]);

    const topFilm = useMemo(() => {
        const totals = new Map<string, { quantity: number; area: number }>();

        periodPdfs.forEach(pdf => {
            (pdf.measurements || []).forEach(measurement => {
                const name = measurement.pelicula || 'Sem pelicula';
                const previous = totals.get(name) || { quantity: 0, area: 0 };
                const largura = parseNumber(measurement.largura);
                const altura = parseNumber(measurement.altura);
                const quantity = parseNumber(measurement.quantidade) || 1;

                totals.set(name, {
                    quantity: previous.quantity + quantity,
                    area: previous.area + largura * altura * quantity
                });
            });
        });

        const best = Array.from(totals.entries()).sort((a, b) => b[1].area - a[1].area)[0];
        if (!best) return null;

        return {
            name: best[0],
            area: best[1].area,
            quantity: best[1].quantity
        };
    }, [periodPdfs]);

    const evolutionItems = useMemo(() => {
        const range = periodRange || getPeriodRange('last30')!;
        const allDays = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / 86400000));
        const visibleDays = Math.min(allDays, 14);
        const start = addDays(range.end, -(visibleDays - 1));
        start.setHours(0, 0, 0, 0);

        return Array.from({ length: visibleDays }, (_, index) => {
            const day = addDays(start, index);
            const dayRange = getDayRange(day);
            const dayPdfs = allSavedPdfs.filter(pdf => isWithinRange(parseDate(pdf.date), dayRange));
            const dayStandaloneExpenses = standaloneExpenses.filter(expense => isWithinRange(parseDate(expense.date), dayRange));
            const revenue = dayPdfs.reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
            const expenses = dayPdfs.reduce((sum, pdf) => sum + getOperationalExpenses(pdf), 0)
                + dayStandaloneExpenses.reduce((sum, expense) => sum + parseNumber(expense.amount), 0);

            return {
                key: toDateInputValue(day),
                label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                revenue,
                expenses
            };
        });
    }, [allSavedPdfs, periodRange, standaloneExpenses]);

    const pendingOlderThanSevenDays = useMemo(() => {
        const threshold = addDays(new Date(), -7).getTime();
        return allSavedPdfs.filter(pdf => {
            const date = parseDate(pdf.date);
            return getPdfStatus(pdf) === 'pending' && !!date && date.getTime() < threshold;
        }).length;
    }, [allSavedPdfs]);

    const expiredProposalCount = useMemo(() => {
        return allSavedPdfs.filter(isPdfExpired).length;
    }, [allSavedPdfs]);

    // Central de "Acoes do dia": pendencias que valem a pena abrir o app todo dia.
    // Tudo derivado dos dados que ja temos em memoria (zero consulta nova).
    const dailyActions = useMemo(() => {
        const now = new Date();
        const todayRange = getTodayRange();
        const nowMs = now.getTime();
        const fiveDaysAgoMs = addDays(now, -5).getTime();
        const threeDaysAgoMs = addDays(now, -3).getTime();
        const thirtyDaysAgoMs = addDays(now, -30).getTime();

        // 1) Instalacoes de hoje (exclui canceladas).
        const todayAppointments = agendamentos
            .filter(agendamento => {
                const date = parseDate(agendamento.start);
                return !!date && isWithinRange(date, todayRange) && agendamento.serviceStatus !== 'cancelled';
            })
            .sort((a, b) => (parseDate(a.start)?.getTime() || 0) - (parseDate(b.start)?.getTime() || 0));

        // 2) Orcamentos sem retorno: nao aprovados, enviados ha +5 dias e cujo
        //    cliente nao tem agendamento criado depois (proxy de conversao).
        const stalledProposals = allSavedPdfs.filter(pdf => {
            if (getPdfStatus(pdf) === 'approved') return false;
            const date = parseDate(pdf.date);
            if (!date || date.getTime() >= fiveDaysAgoMs) return false;
            const hasFollowUp = agendamentos.some(agendamento => {
                if (agendamento.clienteId !== pdf.clienteId) return false;
                const apptDate = parseDate(agendamento.start);
                return !!apptDate && apptDate.getTime() >= date.getTime();
            });
            return !hasFollowUp;
        });

        // 3) Pedir avaliacao: servicos concluidos nos ultimos 3 dias ainda sem nota.
        const ratings = readAgendaReviewRatings();
        const pendingReviews = agendamentos.filter(agendamento => {
            if (agendamento.serviceStatus !== 'completed') return false;
            const date = parseDate(agendamento.end || agendamento.start);
            if (!date) return false;
            const time = date.getTime();
            if (time < threeDaysAgoMs || time > nowMs) return false;
            return typeof agendamento.id === 'number' ? !((ratings[agendamento.id] || 0) > 0) : true;
        });

        // 4) Clientes para reativar: com telefone e sem atualizacao ha +30 dias.
        const dormantClients = clients.filter(client => {
            if (!client.telefone) return false;
            const date = parseDate(client.lastUpdated);
            return !date || date.getTime() < thirtyDaysAgoMs;
        });

        return { todayAppointments, stalledProposals, pendingReviews, dormantClients };
    }, [agendamentos, allSavedPdfs, clients]);

    const maxCategoryValue = categoryTotals[0]?.value || 0;
    const maxEvolutionValue = Math.max(
        1,
        ...evolutionItems.map(item => Math.max(item.revenue, item.expenses))
    );
    const statusTotal = Math.max(periodStats.generatedCount, 1);
    const hasAnyData = allSavedPdfs.length > 0 || clients.length > 0 || agendamentos.length > 0 || servicos.length > 0 || standaloneExpenses.length > 0;
    const customDateSummary = `${formatDateInputLabel(customStartDate)} - ${formatDateInputLabel(customEndDate)}`;
    const periodDisplayLabel = period === 'custom' ? `Personalizada: ${customDateSummary}` : PERIOD_LABELS[period];
    const mobilePeriodTriggerLabel = period === 'custom' ? customDateSummary : PERIOD_LABELS[period];

    // Periodo anterior equivalente: mesmo tamanho, imediatamente antes do atual.
    // Serve para o Assistente Financeiro responder perguntas de comparacao.
    const previousRange = useMemo<DateRange | null>(() => {
        if (!periodRange) return null;
        const lengthMs = periodRange.end.getTime() - periodRange.start.getTime();
        const end = new Date(periodRange.start.getTime() - 1);
        const start = new Date(end.getTime() - lengthMs);
        return { start, end };
    }, [periodRange]);

    // Numeros do periodo anterior, calculados em memoria (zero consulta nova).
    const comparisonStats = useMemo(() => {
        if (!previousRange) return null;

        const prevPdfs = allSavedPdfs.filter(pdf => isWithinRange(parseDate(pdf.date), previousRange));
        const prevStandalone = standaloneExpenses.filter(expense => isWithinRange(parseDate(expense.date), previousRange));
        const prevStandaloneTotal = prevStandalone.reduce((sum, expense) => sum + parseNumber(expense.amount), 0);

        const totalValue = prevPdfs.reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
        const approvedValue = prevPdfs
            .filter(pdf => getPdfStatus(pdf) === 'approved')
            .reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
        const proposalExpenses = prevPdfs.reduce((sum, pdf) => sum + getOperationalExpenses(pdf), 0);
        const expenses = proposalExpenses + prevStandaloneTotal;
        const estimatedProfit = prevPdfs.reduce((sum, pdf) => sum + getEstimatedProfit(pdf), 0) - prevStandaloneTotal;

        const categoryMap = new Map<string, { label: string; value: number }>();
        const addCategory = (key: string, label: string, value: number) => {
            const previous = categoryMap.get(key) || { label, value: 0 };
            categoryMap.set(key, { label: previous.label || label, value: previous.value + value });
        };
        prevPdfs.forEach(pdf => {
            const snapshotCategories = pdf.generalDiscount?.expenseSnapshot?.expensesByCategory || [];
            if (snapshotCategories.length) {
                snapshotCategories.forEach(category => {
                    addCategory(category.category, category.label || EXPENSE_CATEGORY_LABELS[category.category] || 'Gasto', parseNumber(category.total));
                });
                return;
            }
            (pdf.generalDiscount?.expenses || []).forEach(expense => {
                addCategory(expense.category, EXPENSE_CATEGORY_LABELS[expense.category] || 'Gasto', parseNumber(expense.amount));
            });
        });
        prevStandalone.forEach(expense => {
            addCategory(expense.category, EXPENSE_CATEGORY_LABELS[expense.category] || 'Gasto avulso', parseNumber(expense.amount));
        });

        return {
            periodoAnterior: formatRangeButtonLabel(previousRange),
            faturamentoTotal: totalValue,
            faturamentoAprovado: approvedValue,
            despesas: expenses,
            lucroEstimado: estimatedProfit,
            margemEstimada: totalValue > 0 ? (estimatedProfit / totalValue) * 100 : 0,
            gastosPorCategoria: Array.from(categoryMap.values())
                .filter(item => item.value > 0)
                .sort((a, b) => b.value - a.value)
        };
    }, [previousRange, allSavedPdfs, standaloneExpenses]);

    const daysInPeriod = useMemo(() => {
        if (!periodRange) return 1;
        return Math.max(1, Math.ceil((periodRange.end.getTime() - periodRange.start.getTime()) / 86400000));
    }, [periodRange]);

    // Resumo financeiro reaproveitando os agregados ja calculados acima.
    // Nenhuma consulta nova ao banco: tudo ja esta em memoria.
    const financialSummary = useMemo<FinancialSummary>(() => ({
        periodo: periodDisplayLabel,
        faturamentoTotal: periodStats.totalValue,
        faturamentoAprovado: periodStats.approvedValue,
        faturamentoPendente: periodStats.pendingValue,
        despesas: periodStats.expenses,
        lucroEstimado: periodStats.estimatedProfit,
        margemEstimada: periodStats.estimatedMargin,
        ticketMedio: periodStats.averageTicket,
        taxaAprovacao: periodStats.conversionRate,
        orcamentosGerados: periodStats.generatedCount,
        orcamentosAprovados: periodStats.approvedCount,
        orcamentosPendentes: periodStats.pendingCount,
        totalM2: periodStats.totalM2,
        gastoDiarioMedio: expenseRhythm.dailyAverage,
        diasNoPeriodo: daysInPeriod,
        faturamentoDiarioMedio: periodStats.totalValue / daysInPeriod,
        gastosPorCategoria: categoryTotals.map(item => ({ label: item.label, value: item.value })),
        melhorCliente: topClient,
        peliculaMaisUsada: topFilm,
        comparativo: comparisonStats
    }), [periodDisplayLabel, periodStats, expenseRhythm, categoryTotals, topClient, topFilm, comparisonStats, daysInPeriod]);
    const desktopRangeButtonLabel = formatRangeButtonLabel(periodRange);

    const syncDesktopDraftFromPeriod = (nextPeriod: PeriodKey) => {
        const range = getPeriodRange(nextPeriod, nextPeriod === 'custom' ? customRange : null);
        const fallbackRange = range || getTodayRange();

        setDesktopDraftPeriod(nextPeriod);
        setDesktopDraftStartDate(toDateInputValue(fallbackRange.start));
        setDesktopDraftEndDate(toDateInputValue(fallbackRange.end));
        setDesktopActiveBoundary('start');
        setDesktopCalendarMonth(startOfMonth(fallbackRange.start));
    };

    const openDesktopPeriodSelector = () => {
        syncDesktopDraftFromPeriod(period);
        setIsDesktopPeriodOpen(true);
    };

    const openMobilePeriodSelector = () => {
        setMobileDraftPeriod(period);
        setMobileDraftStartDate(customStartDate);
        setMobileDraftEndDate(customEndDate);
        setIsMobilePeriodOpen(true);
    };

    const handleSelectDesktopPeriod = (nextPeriod: PeriodKey) => {
        syncDesktopDraftFromPeriod(nextPeriod);
    };

    const handleChangeDesktopDraftDate = (boundary: 'start' | 'end', value: string) => {
        if (boundary === 'start') {
            setDesktopDraftStartDate(value);
        } else {
            setDesktopDraftEndDate(value);
        }

        const parsed = parseDateInput(value, 'start');
        if (parsed) {
            setDesktopCalendarMonth(startOfMonth(parsed));
        }
        setDesktopDraftPeriod('custom');
        setDesktopActiveBoundary(boundary);
    };

    const handleSelectDesktopCalendarDay = (date: Date) => {
        if (startOfDay(date) > startOfDay(new Date())) return;

        const value = toDateInputValue(date);
        const currentStart = parseDateInput(desktopDraftStartDate, 'start');
        const currentEnd = parseDateInput(desktopDraftEndDate, 'start');

        if (desktopActiveBoundary === 'start') {
            setDesktopDraftStartDate(value);
            if (!currentEnd || startOfDay(date) > startOfDay(currentEnd)) {
                setDesktopDraftEndDate(value);
            }
            setDesktopActiveBoundary('end');
        } else {
            if (currentStart && startOfDay(date) < startOfDay(currentStart)) {
                setDesktopDraftStartDate(value);
                setDesktopDraftEndDate(toDateInputValue(currentStart));
            } else {
                setDesktopDraftEndDate(value);
            }
            setDesktopActiveBoundary('start');
        }

        setDesktopDraftPeriod('custom');
        setDesktopCalendarMonth(startOfMonth(date));
    };

    const handleApplyDesktopPeriod = () => {
        if (desktopDraftPeriod === 'custom') {
            const draftRange = getStrictDateRangeValidation(desktopDraftStartDate, desktopDraftEndDate).range;
            if (!draftRange) return;

            setCustomStartDate(toDateInputValue(draftRange.start));
            setCustomEndDate(toDateInputValue(draftRange.end));
        }

        setPeriod(desktopDraftPeriod);
        setIsDesktopPeriodOpen(false);
    };

    const handleShiftDesktopPeriod = (direction: -1 | 1) => {
        if (!periodRange) return;

        const periodLength = Math.max(
            1,
            Math.floor((endOfDay(periodRange.end).getTime() - startOfDay(periodRange.start).getTime()) / 86_400_000) + 1
        );
        const nextStart = addDays(periodRange.start, periodLength * direction);
        const nextEnd = addDays(periodRange.end, periodLength * direction);

        setCustomStartDate(toDateInputValue(nextStart));
        setCustomEndDate(toDateInputValue(nextEnd));
        setPeriod('custom');
        setDesktopCalendarMonth(startOfMonth(nextStart));
    };

    const handleSelectMobilePeriod = (nextPeriod: PeriodKey) => {
        if (nextPeriod === 'custom') {
            setMobileDraftPeriod('custom');
            return;
        }

        setPeriod(nextPeriod);
        setMobileDraftPeriod(nextPeriod);
        setIsMobilePeriodOpen(false);
    };

    const handleApplyMobileCustomPeriod = () => {
        setCustomStartDate(mobileDraftStartDate);
        setCustomEndDate(mobileDraftEndDate);
        setPeriod('custom');
        setIsMobilePeriodOpen(false);
    };

    const handleOpenHistory = (filter: 'all' | 'pending' | 'approved' | 'expenses' | 'expired' = 'all') => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(HISTORY_FOCUS_FILTER_KEY, filter);
        }
        onTabChange('history');
    };

    const handleSaveStandaloneExpense = async (expense: StandaloneExpense) => {
        setIsSavingStandaloneExpense(true);
        try {
            const savedExpense = await saveStandaloneExpense(expense);
            setStandaloneExpenses(previous => [
                savedExpense,
                ...previous.filter(item => item.id !== savedExpense.id)
            ].sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0)));
            setIsStandaloneExpenseModalOpen(false);
        } catch (error) {
            console.error('Erro ao salvar despesa avulsa:', error);
        } finally {
            setIsSavingStandaloneExpense(false);
        }
    };

    const handleDeleteStandaloneExpense = async (expense: StandaloneExpense) => {
        if (!expense.id) return;

        const previousExpenses = standaloneExpenses;
        setStandaloneExpenses(current => current.filter(item => item.id !== expense.id));

        try {
            await deleteStandaloneExpense(expense.id);
        } catch (error) {
            console.error('Erro ao remover despesa avulsa:', error);
            setStandaloneExpenses(previousExpenses);
        }
    };

    const todayCount = dailyActions.todayAppointments.length;
    const stalledCount = dailyActions.stalledProposals.length;
    const reviewCount = dailyActions.pendingReviews.length;
    const dormantCount = dailyActions.dormantClients.length;
    const totalActions = todayCount + stalledCount + reviewCount + dormantCount;
    const todayActionSubtitle = dailyActions.todayAppointments
        .slice(0, 2)
        .map(agendamento => {
            const date = parseDate(agendamento.start);
            const hour = date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
            return `${firstName(agendamento.clienteNome)} ${hour}`.trim();
        })
        .join(' · ');

    return (
        <div className="w-full max-w-full space-y-5 overflow-x-hidden pb-28 sm:pb-0">
            <div className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center justify-between gap-3 sm:block">
                        <h1 className="min-w-0 truncate text-2xl font-bold leading-tight text-[var(--text-strong)] sm:mt-2 sm:text-3xl">
                            Dashboard
                        </h1>
                        <button
                            type="button"
                            onClick={openMobilePeriodSelector}
                            aria-label={`Abrir filtro de data: ${mobilePeriodTriggerLabel}`}
                            title={periodDisplayLabel}
                            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-2 text-sm font-bold text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-muted)] sm:hidden"
                        >
                            <CalendarDays className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />
                            <span>{mobilePeriodTriggerLabel}</span>
                        </button>
                    </div>
                </div>

                <div className="flex min-w-0 w-full flex-col gap-3 lg:w-auto lg:items-end">
                    <DesktopPeriodPicker
                        isOpen={isDesktopPeriodOpen}
                        selectedLabel={PERIOD_LABELS[period]}
                        rangeLabel={desktopRangeButtonLabel}
                        draftPeriod={desktopDraftPeriod}
                        draftStartDate={desktopDraftStartDate}
                        draftEndDate={desktopDraftEndDate}
                        activeBoundary={desktopActiveBoundary}
                        calendarMonth={desktopCalendarMonth}
                        canShiftPeriod={!!periodRange}
                        onOpen={openDesktopPeriodSelector}
                        onClose={() => setIsDesktopPeriodOpen(false)}
                        onSelectPeriod={handleSelectDesktopPeriod}
                        onChangeDraftDate={handleChangeDesktopDraftDate}
                        onSelectDay={handleSelectDesktopCalendarDay}
                        onChangeCalendarMonth={setDesktopCalendarMonth}
                        onChangeActiveBoundary={setDesktopActiveBoundary}
                        onApply={handleApplyDesktopPeriod}
                        onShiftPeriod={handleShiftDesktopPeriod}
                    />
                </div>
            </div>

            <MobilePeriodSelector
                isOpen={isMobilePeriodOpen}
                selectedPeriod={mobileDraftPeriod}
                customStartDate={mobileDraftStartDate}
                customEndDate={mobileDraftEndDate}
                onClose={() => setIsMobilePeriodOpen(false)}
                onSelectPeriod={handleSelectMobilePeriod}
                onChangeCustomStartDate={setMobileDraftStartDate}
                onChangeCustomEndDate={setMobileDraftEndDate}
                onApplyCustom={handleApplyMobileCustomPeriod}
            />

            <StandaloneExpenseModal
                isOpen={isStandaloneExpenseModalOpen}
                onClose={() => setIsStandaloneExpenseModalOpen(false)}
                onSave={handleSaveStandaloneExpense}
                clients={clients}
                pdfs={allSavedPdfs}
                isSaving={isSavingStandaloneExpense}
            />

            <AIFinancialAssistantModal
                isOpen={isFinAssistantOpen}
                onClose={() => setIsFinAssistantOpen(false)}
                summary={financialSummary}
                apiKey={aiConfig?.apiKey}
                provider={aiConfig?.provider}
                cache={finAnalysisCache}
                onCached={setFinAnalysisCache}
            />

            <section className="ui-card p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-[var(--text-strong)] sm:text-lg">Ações do dia</h2>
                        <p className="text-xs text-[var(--text-muted)]">O que precisa da sua atenção agora</p>
                    </div>
                    {totalActions > 0 ? (
                        <span className="flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] px-2 text-xs font-bold text-white">
                            {totalActions}
                        </span>
                    ) : null}
                </div>
                <div className="space-y-2">
                    {todayCount > 0 ? (
                        <ActionRow
                            tone="blue"
                            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
                            title={todayCount === 1 ? '1 instalação hoje' : `${todayCount} instalações hoje`}
                            subtitle={todayActionSubtitle || 'Veja sua agenda de hoje'}
                            count={todayCount}
                            onClick={() => onTabChange('agenda')}
                        />
                    ) : null}
                    {stalledCount > 0 ? (
                        <ActionRow
                            tone="amber"
                            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
                            title={stalledCount === 1 ? '1 orçamento sem retorno' : `${stalledCount} orçamentos sem retorno`}
                            subtitle="Enviados há mais de 5 dias — dê um retorno"
                            count={stalledCount}
                            onClick={() => handleOpenHistory('all')}
                        />
                    ) : null}
                    {reviewCount > 0 ? (
                        <ActionRow
                            tone="emerald"
                            icon={<Star className="h-5 w-5" aria-hidden="true" />}
                            title="Pedir avaliação no Google"
                            subtitle={reviewCount === 1 ? '1 serviço concluído recentemente' : `${reviewCount} serviços concluídos recentemente`}
                            count={reviewCount}
                            onClick={() => onTabChange('agenda')}
                        />
                    ) : null}
                    {dormantCount > 0 ? (
                        <ActionRow
                            tone="slate"
                            icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
                            title={dormantCount === 1 ? '1 cliente para reativar' : `${dormantCount} clientes para reativar`}
                            subtitle="Sem contato há mais de 30 dias"
                            count={dormantCount}
                            onClick={() => onTabChange('client')}
                        />
                    ) : null}
                    {totalActions === 0 ? (
                        <EmptyLine title="Tudo em dia" description="Nenhuma pendência por agora. Bom trabalho!" />
                    ) : null}
                </div>
            </section>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
                <MetricCard
                    icon={<FileText className="h-5 w-5" aria-hidden="true" />}
                    label="Total orcado"
                    value={formatCurrency(periodStats.totalValue)}
                    helper={`${periodStats.generatedCount} orcamentos no periodo`}
                    tone="blue"
                    onClick={() => handleOpenHistory('all')}
                />
                <MetricCard
                    icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                    label="Total aprovado"
                    value={formatCurrency(periodStats.approvedValue)}
                    helper={`${periodStats.approvedCount} aprovados no periodo`}
                    tone="emerald"
                    onClick={() => handleOpenHistory('approved')}
                />
                <MetricCard
                    icon={<Gauge className="h-5 w-5" aria-hidden="true" />}
                    label="Taxa de aprovacao"
                    value={formatPercent(periodStats.conversionRate)}
                    helper={`Ticket aprovado ${formatCurrency(periodStats.approvedAverageTicket)}`}
                    tone="slate"
                    onClick={() => handleOpenHistory('approved')}
                />
                <MetricCard
                    icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}
                    label="Gastos do periodo"
                    value={formatCurrency(periodStats.expenses)}
                    helper={`${categoryTotals.length} categorias, ${periodStandaloneExpenses.length} avulsas`}
                    tone="amber"
                    onClick={() => handleOpenHistory('expenses')}
                />
                <MetricCard
                    icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
                    label="Servicos"
                    value={isLoadingServicos ? '...' : String(periodServicos.length)}
                    helper={`${upcomingAgendamentos.length} proximos na agenda`}
                    tone="cyan"
                    onClick={() => onTabChange(periodServicos.length > 0 ? 'qr_code' : 'agenda')}
                    className="col-span-2 xl:col-span-1"
                />
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
                <section className="ui-card min-w-0 overflow-hidden p-3 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="ui-kicker">Atenção</p>
                            <h2 className="mt-1 text-lg font-bold text-[var(--text-strong)]">O que precisa de ação</h2>
                        </div>
                        <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:block sm:space-y-2">
                        <AttentionItem
                            icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                            label={`${expiredProposalCount} propostas vencidas`}
                            mobileValue={String(expiredProposalCount)}
                            mobileLabel="Vencidas"
                            helper="Abrir clientes para follow-up"
                            tone={expiredProposalCount > 0 ? 'rose' : 'slate'}
                            onClick={() => handleOpenHistory('expired')}
                        />
                        <AttentionItem
                            icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
                            label={`${periodStats.pendingCount} orcamentos pendentes`}
                            mobileValue={String(periodStats.pendingCount)}
                            mobileLabel="Pendentes"
                            helper="Ver propostas que ainda nao foram fechadas"
                            tone="amber"
                            onClick={() => handleOpenHistory('pending')}
                        />
                        <AttentionItem
                            icon={<FileText className="h-4 w-4" aria-hidden="true" />}
                            label={`${pendingOlderThanSevenDays} antigos sem retorno`}
                            mobileValue={String(pendingOlderThanSevenDays)}
                            mobileLabel="Antigos"
                            helper="Pendentes ha mais de 7 dias"
                            tone={pendingOlderThanSevenDays > 0 ? 'rose' : 'slate'}
                            onClick={() => handleOpenHistory('pending')}
                        />
                        <AttentionItem
                            icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
                            label={`${upcomingAgendamentos.length} servicos agendados`}
                            mobileValue={String(upcomingAgendamentos.length)}
                            mobileLabel="Agenda"
                            helper={upcomingAgendamentos.length > 0 ? 'Abrir agenda da equipe' : 'Planejar proximos atendimentos'}
                            tone={upcomingAgendamentos.length > 0 ? 'emerald' : 'cyan'}
                            onClick={() => onTabChange('agenda')}
                        />
                    </div>
                </section>

                <section className="ui-card min-w-0 overflow-hidden p-3 sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="ui-kicker">Evolução</p>
                            <h2 className="mt-1 text-lg font-bold text-[var(--text-strong)]">Receita e gastos por dia</h2>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-bold text-[var(--text-muted)]">
                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Receita</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Gastos</span>
                        </div>
                    </div>
                    <div className="mt-4 w-full max-w-full overflow-x-auto overscroll-x-contain pb-1">
                        <div
                            className="grid w-full min-w-0 items-end gap-1 sm:min-w-[520px] sm:gap-2"
                            style={{ gridTemplateColumns: `repeat(${evolutionItems.length}, minmax(14px, 1fr))` }}
                        >
                            {evolutionItems.map(item => {
                                const revenueHeight = Math.max(4, (item.revenue / maxEvolutionValue) * 72);
                                const expenseHeight = Math.max(4, (item.expenses / maxEvolutionValue) * 72);

                                return (
                                    <div key={item.key} className="flex min-w-0 flex-col items-center gap-2">
                                        <div className="flex h-20 w-full items-end justify-center gap-1 rounded-[var(--radius-card)] bg-[var(--surface-muted)] px-1.5 py-1 sm:h-24">
                                            <span
                                                className="w-2 rounded-full bg-blue-500"
                                                style={{ height: `${revenueHeight}px` }}
                                                title={`Receita ${formatCurrency(item.revenue, true)}`}
                                            />
                                            <span
                                                className="w-2 rounded-full bg-amber-500"
                                                style={{ height: `${expenseHeight}px` }}
                                                title={`Gastos ${formatCurrency(item.expenses, true)}`}
                                            />
                                        </div>
                                        <span className="truncate text-[10px] font-semibold text-[var(--text-muted)]">{item.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            </div>

            {!hasAnyData && (
                <section className="ui-card p-5">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                        <div>
                            <p className="ui-kicker">Primeiros passos</p>
                            <h2 className="mt-2 text-xl font-bold text-[var(--text-strong)]">Crie seu primeiro fluxo comercial</h2>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
                                Cadastre um cliente ou gere uma proposta rapida com IA para o dashboard comecar a mostrar receita, gastos e tarefas.
                            </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
                            <button
                                type="button"
                                onClick={onOpenAIQuickProposal}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 text-sm font-bold text-white shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--brand-primary-strong)]"
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Proposta rapida
                            </button>
                            <button
                                type="button"
                                onClick={() => onOpenClientModal('add')}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-sm font-bold text-[var(--text-strong)] transition-colors hover:bg-[var(--surface)]"
                            >
                                <UsersRound className="h-4 w-4" aria-hidden="true" />
                                Novo cliente
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <section className="ui-card min-w-0 overflow-hidden p-3 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="ui-kicker">Resultado</p>
                            <h2 className="mt-1 text-lg font-bold text-[var(--text-strong)]">Resumo financeiro</h2>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsFinAssistantOpen(true)}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-blue-100 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 sm:h-10 sm:text-sm"
                            >
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                <span className="hidden sm:inline">Analisar com IA</span>
                                <span className="sm:hidden">IA</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onTabChange('history')}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-xs font-bold text-[var(--text-strong)] transition-colors hover:bg-[var(--surface)] sm:h-10 sm:text-sm"
                            >
                                Historico
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-5">
                        <FinancialMetricTile
                            icon={<DollarSign className="h-3.5 w-3.5" aria-hidden="true" />}
                            label="Ticket medio"
                            value={formatCurrency(periodStats.averageTicket)}
                        />
                        <FinancialMetricTile
                            icon={<ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />}
                            label="Gasto periodo"
                            value={formatCurrency(expenseRhythm.periodExpenses, true)}
                        />
                        <FinancialMetricTile
                            icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />}
                            label="Media diaria"
                            value={formatCurrency(expenseRhythm.dailyAverage, true)}
                            helper="Filtro atual"
                        />
                        <FinancialMetricTile
                            icon={<Gauge className="h-3.5 w-3.5" aria-hidden="true" />}
                            label="Margem"
                            value={formatPercent(periodStats.estimatedMargin)}
                        />
                        <FinancialMetricTile
                            icon={<Layers3 className="h-3.5 w-3.5" aria-hidden="true" />}
                            label="Area cotada"
                            value={`${periodStats.totalM2.toFixed(2).replace('.', ',')} m2`}
                            className="col-span-2 sm:col-span-1"
                        />
                    </div>

                    <div className="mt-5 space-y-4">
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <span className="text-sm font-bold text-[var(--text-strong)]">Pipeline de orcamentos</span>
                                <span className="text-xs font-semibold text-[var(--text-muted)]">{periodStats.generatedCount} total</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                                <div className="flex h-full">
                                    <div className="bg-emerald-500" style={{ width: `${(periodStats.approvedCount / statusTotal) * 100}%` }} />
                                    <div className="bg-amber-500" style={{ width: `${(periodStats.pendingCount / statusTotal) * 100}%` }} />
                                    <div className="bg-sky-500" style={{ width: `${(periodStats.revisedCount / statusTotal) * 100}%` }} />
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <StatusSummary label="Aprovados" value={periodStats.approvedCount} colorClass="bg-emerald-500" />
                                <StatusSummary label="Pendentes" value={periodStats.pendingCount} colorClass="bg-amber-500" />
                                <StatusSummary label="Revisar" value={periodStats.revisedCount} colorClass="bg-sky-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <InsightItem
                                icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
                                label="Maior cliente"
                                value={topClient?.name || 'Sem dados'}
                                helper={topClient ? formatCurrency(topClient.value) : 'Ainda sem orcamentos'}
                            />
                            <InsightItem
                                icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
                                label="Pelicula destaque"
                                value={topFilm?.name || 'Sem dados'}
                                helper={topFilm ? `${topFilm.area.toFixed(2).replace('.', ',')} m2 cotados` : `${films.length} peliculas cadastradas`}
                            />
                            <InsightItem
                                icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
                                label="Lucro estimado"
                                value={formatCurrency(periodStats.estimatedProfit)}
                                helper="Com base nos custos salvos"
                            />
                        </div>
                    </div>
                </section>

                <section className="ui-card min-w-0 overflow-hidden p-3 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="ui-kicker">Custos</p>
                            <h2 className="mt-1 text-lg font-bold text-[var(--text-strong)]">Gastos por categoria</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsStandaloneExpenseModalOpen(true)}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-xs font-bold text-[var(--text-strong)] transition-colors hover:bg-[var(--surface)]"
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                <span className="hidden sm:inline">Nova despesa</span>
                            </button>
                            <PieChart className="h-5 w-5 text-[var(--text-soft)]" aria-hidden="true" />
                        </div>
                    </div>

                    <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
                        {categoryTotals.length > 0 ? (
                            categoryTotals.slice(0, 6).map((category, index) => {
                                const width = maxCategoryValue > 0 ? (category.value / maxCategoryValue) * 100 : 0;
                                const tone = (['amber', 'blue', 'emerald', 'rose', 'cyan', 'slate'] as Tone[])[index % 6];

                                return (
                                    <div key={`${category.label}-${index}`}>
                                        <div className="mb-1.5 flex items-center justify-between gap-3">
                                            <span className="truncate text-sm font-semibold text-[var(--text-strong)]">{category.label}</span>
                                            <span className="shrink-0 text-sm font-bold text-[var(--text-strong)]">{formatCurrency(category.value, true)}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-[var(--surface-muted)]">
                                            <div className={`h-full rounded-full ${TONE_CLASSES[tone].bar}`} style={{ width: `${width}%` }} />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <EmptyLine
                                title="Sem gastos no periodo"
                                description="Use gastos da proposta ou despesas avulsas para acompanhar transporte, material, ferramentas e outros custos."
                            />
                        )}
                    </div>

                    {periodStandaloneExpenses.length > 0 && (
                        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-[var(--text-strong)]">Despesas avulsas</p>
                                <span className="text-xs font-semibold text-[var(--text-muted)]">
                                    {formatCurrency(standaloneExpenseTotal, true)}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {periodStandaloneExpenses.slice(0, 4).map(expense => {
                                    const clientName = expense.clientId ? clientsById.get(expense.clientId)?.nome : '';
                                    const categoryIcon = EXPENSE_CATEGORY_ICONS[expense.category] || EXPENSE_CATEGORY_ICONS.other;
                                    const CategoryIcon = categoryIcon.Icon;
                                    return (
                                        <div key={expense.id || `${expense.date}-${expense.description}`} className="flex min-w-0 items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2">
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] ${categoryIcon.className}`}>
                                                <CategoryIcon className="h-4 w-4" aria-hidden="true" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-bold text-[var(--text-strong)]">{expense.description || EXPENSE_CATEGORY_LABELS[expense.category]}</p>
                                                <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                                                    {formatShortDate(expense.date)}{clientName ? ` - ${clientName}` : ''}{expense.paymentMethod ? ` - ${expense.paymentMethod}` : ''}
                                                </p>
                                            </div>
                                            <span className="shrink-0 text-xs font-bold text-[var(--text-strong)]">{formatCurrency(parseNumber(expense.amount), true)}</span>
                                            {expense.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => { void handleDeleteStandaloneExpense(expense); }}
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-400/10 dark:hover:text-red-200"
                                                    aria-label={`Remover despesa ${expense.description}`}
                                                >
                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-3">
                <section className="ui-card min-w-0 overflow-hidden p-3 sm:p-5">
                    <PanelHeader
                        kicker="Comercial"
                        title="Ultimos orcamentos"
                        icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
                        onClick={() => onTabChange('history')}
                    />
                    <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                        {periodPdfs.slice(0, 5).map(pdf => (
                            <div key={pdf.id || `${pdf.nomeArquivo}-${pdf.date}`} className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-2.5 last:border-b-0 last:pb-0 sm:gap-3 sm:pb-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-200 sm:h-10 sm:w-10">
                                    <FileText className="h-4 w-4" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                                        {clientsById.get(pdf.clienteId)?.nome || pdf.clientName || 'Cliente'}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                                        {formatShortDate(pdf.date)} - {pdf.proposalOptionName || 'Orcamento'}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="text-sm font-bold text-[var(--text-strong)]">{formatCurrency(getPdfValue(pdf), true)}</span>
                                    <StatusBadge status={pdf.status} />
                                </div>
                            </div>
                        ))}
                        {periodPdfs.length === 0 && (
                            <EmptyLine
                                title="Nenhum orcamento aqui"
                                description="Gere uma proposta para acompanhar valores, status e custos."
                            />
                        )}
                    </div>
                </section>

                <section className="ui-card min-w-0 overflow-hidden p-3 sm:p-5">
                    <PanelHeader
                        kicker="Agenda"
                        title="Proximos servicos"
                        icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
                        onClick={() => onTabChange('agenda')}
                    />
                    <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                        {upcomingAgendamentos.map(agendamento => (
                            <div key={agendamento.id || `${agendamento.clienteId}-${agendamento.start}`} className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-2.5 last:border-b-0 last:pb-0 sm:gap-3 sm:pb-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200 sm:h-10 sm:w-10">
                                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                                        {agendamento.clienteNome || clientsById.get(agendamento.clienteId)?.nome || 'Cliente'}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{formatDateTime(agendamento.start)}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-soft)]" aria-hidden="true" />
                            </div>
                        ))}
                        {upcomingAgendamentos.length === 0 && (
                            <EmptyLine
                                title="Agenda livre"
                                description="Quando um servico for agendado, ele aparece aqui para facilitar o acompanhamento."
                            />
                        )}
                    </div>
                </section>

                <section className="ui-card min-w-0 overflow-hidden p-3 sm:p-5">
                    <PanelHeader
                        kicker="Entrega"
                        title="Servicos QR recentes"
                        icon={<QrCode className="h-5 w-5" aria-hidden="true" />}
                        onClick={() => onTabChange('qr_code')}
                    />
                    <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                        {periodServicos.slice(0, 5).map(servico => (
                            <div key={servico.id || servico.codigo_qr} className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-2.5 last:border-b-0 last:pb-0 sm:gap-3 sm:pb-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-200 sm:h-10 sm:w-10">
                                    <QrCode className="h-4 w-4" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-[var(--text-strong)]">{servico.cliente_nome}</p>
                                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                                        {servico.filme_aplicado} - {formatShortDate(servico.data_servico || servico.created_at)}
                                    </p>
                                </div>
                                <span className="shrink-0 text-xs font-bold text-[var(--text-muted)]">
                                    {typeof servico.metros_aplicados === 'number' ? `${servico.metros_aplicados.toFixed(1).replace('.', ',')} m2` : 'QR'}
                                </span>
                            </div>
                        ))}
                        {!isLoadingServicos && periodServicos.length === 0 && (
                            <EmptyLine
                                title="Sem servicos QR"
                                description="Registre servicos finalizados no modulo QR para criar historico de entrega e garantia."
                            />
                        )}
                        {isLoadingServicos && (
                            <div className="rounded-[var(--radius-card)] bg-[var(--surface-muted)] p-4 text-sm font-semibold text-[var(--text-muted)]">
                                Carregando servicos...
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
                <QuickAction
                    icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    label="Nova proposta"
                    description="Abrir proposta rapida"
                    onClick={onOpenAIQuickProposal}
                    tone="blue"
                />
                <QuickAction
                    icon={<ReceiptText className="h-4 w-4" aria-hidden="true" />}
                    label="Nova despesa"
                    description="Custo sem proposta"
                    onClick={() => setIsStandaloneExpenseModalOpen(true)}
                    tone="amber"
                />
                <QuickAction
                    icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
                    label="Clientes"
                    description={`${clients.length} cadastrados`}
                    onClick={() => onTabChange('client')}
                    tone="slate"
                />
                <QuickAction
                    icon={<WalletCards className="h-4 w-4" aria-hidden="true" />}
                    label="Estoque"
                    description="Bobinas e retalhos"
                    onClick={() => onTabChange('estoque')}
                    tone="emerald"
                />
                <QuickAction
                    icon={<QrCode className="h-4 w-4" aria-hidden="true" />}
                    label="Registrar servico"
                    description="Gerar etiqueta QR"
                    onClick={() => onTabChange('qr_code')}
                    tone="cyan"
                />
            </div>

            <DashboardMobileFooter
                onCreateProposal={() => (onCreateProposal ? onCreateProposal() : onTabChange('client'))}
                onAddClient={() => onOpenClientModal('add')}
                onOpenAIQuickProposal={onOpenAIQuickProposal}
                onOpenAgenda={() => onTabChange('agenda')}
                onOpenExpense={() => setIsStandaloneExpenseModalOpen(true)}
            />
        </div>
    );
};

const DashboardMobileFooter: React.FC<{
    onCreateProposal: () => void;
    onAddClient: () => void;
    onOpenAIQuickProposal: () => void;
    onOpenAgenda: () => void;
    onOpenExpense: () => void;
}> = ({ onCreateProposal, onAddClient, onOpenAIQuickProposal, onOpenAgenda, onOpenExpense }) => {
    const FooterButton: React.FC<{ onClick: () => void; label: string; icon: string }> = ({ onClick, label, icon }) => (
        <button
            onClick={onClick}
            aria-label={label}
            className="flex flex-col items-center justify-center transition-all duration-300 w-16 h-14 rounded-xl group text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        >
            <i className={`${icon} text-lg transition-transform duration-300 group-active:scale-90`}></i>
            <span className="text-[9px] mt-1 font-bold uppercase tracking-wider">{label}</span>
        </button>
    );

    return (
        <div
            className="sm:hidden fixed left-4 right-4 z-40"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/20 dark:border-slate-800/50 rounded-2xl px-2 py-2">
                <div className="flex justify-between items-center relative">
                    <div className="flex gap-1">
                        <FooterButton onClick={onAddClient} label="Cliente" icon="fas fa-user-plus" />
                        <FooterButton onClick={onOpenAIQuickProposal} label="IA" icon="fas fa-robot" />
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 -top-12">
                        <button
                            onClick={onCreateProposal}
                            aria-label="Criar proposta"
                            className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-950 dark:from-slate-700 dark:to-slate-900 text-white rounded-2xl flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.4)] transition-all duration-300 transform hover:-translate-y-1 active:scale-95 border-4 border-white dark:border-slate-900"
                        >
                            <i className="fas fa-plus text-2xl"></i>
                        </button>
                    </div>

                    <div className="flex gap-1">
                        <FooterButton onClick={onOpenAgenda} label="Agenda" icon="fas fa-calendar-day" />
                        <FooterButton onClick={onOpenExpense} label="Despesa" icon="fas fa-receipt" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const DesktopPeriodPicker: React.FC<{
    isOpen: boolean;
    selectedLabel: string;
    rangeLabel: string;
    draftPeriod: PeriodKey;
    draftStartDate: string;
    draftEndDate: string;
    activeBoundary: 'start' | 'end';
    calendarMonth: Date;
    canShiftPeriod: boolean;
    onOpen: () => void;
    onClose: () => void;
    onSelectPeriod: (period: PeriodKey) => void;
    onChangeDraftDate: (boundary: 'start' | 'end', value: string) => void;
    onSelectDay: (date: Date) => void;
    onChangeCalendarMonth: (date: Date) => void;
    onChangeActiveBoundary: (boundary: 'start' | 'end') => void;
    onApply: () => void;
    onShiftPeriod: (direction: -1 | 1) => void;
}> = ({
    isOpen,
    selectedLabel,
    rangeLabel,
    draftPeriod,
    draftStartDate,
    draftEndDate,
    activeBoundary,
    calendarMonth,
    canShiftPeriod,
    onOpen,
    onClose,
    onSelectPeriod,
    onChangeDraftDate,
    onSelectDay,
    onChangeCalendarMonth,
    onChangeActiveBoundary,
    onApply,
    onShiftPeriod
}) => {
    const draftValidation = getStrictDateRangeValidation(draftStartDate, draftEndDate);
    const draftRange = draftValidation.range || getCustomDateRange(draftStartDate, draftEndDate);
    const draftStart = draftRange?.start || null;
    const draftEnd = draftRange?.end || null;
    const months = Array.from({ length: 4 }, (_, index) => addMonths(calendarMonth, index));
    const maxDateValue = toDateInputValue(new Date());
    const maxSelectableDate = startOfDay(new Date());
    const canApply = draftPeriod !== 'custom' || !!draftValidation.range;

    const getDayClassName = (date: Date, isCurrentMonth: boolean) => {
        const dayStart = startOfDay(date).getTime();
        const rangeStart = draftStart ? startOfDay(draftStart).getTime() : null;
        const rangeEnd = draftEnd ? startOfDay(draftEnd).getTime() : null;
        const isFuture = startOfDay(date) > maxSelectableDate;
        const isEdge = (!!draftStart && isSameDay(date, draftStart)) || (!!draftEnd && isSameDay(date, draftEnd));
        const isInRange = rangeStart !== null && rangeEnd !== null && dayStart > rangeStart && dayStart < rangeEnd;

        return [
            'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors',
            isFuture
                ? 'cursor-not-allowed text-[var(--text-soft)] opacity-35'
                : isEdge
                ? 'bg-[var(--brand-primary)] text-white shadow-[var(--shadow-hairline)]'
                : isInRange
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-400/15 dark:text-blue-100'
                    : isCurrentMonth
                        ? 'text-[var(--text-strong)] hover:bg-[var(--surface-muted)]'
                        : 'text-[var(--text-soft)] hover:bg-[var(--surface-muted)]'
        ].join(' ');
    };

    return (
        <div className="relative hidden sm:block">
            <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-2 shadow-[var(--shadow-hairline)]">
                <span className="min-w-[76px] text-right text-sm font-semibold text-[var(--text-muted)]">{selectedLabel}</span>
                <button
                    type="button"
                    onClick={onOpen}
                    aria-label={`Abrir filtro de data desktop: ${rangeLabel}`}
                    className="flex h-10 min-w-[178px] items-center justify-between gap-3 rounded-[7px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm font-bold text-[var(--text-strong)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                >
                    <span className="truncate">{rangeLabel}</span>
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => onShiftPeriod(-1)}
                    disabled={!canShiftPeriod}
                    aria-label="Periodo anterior"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => onShiftPeriod(1)}
                    disabled={!canShiftPeriod}
                    aria-label="Proximo periodo"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
            </div>

            {isOpen && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-40 cursor-default bg-transparent"
                        aria-label="Fechar filtro de data"
                        onClick={onClose}
                    />
                    <div
                        role="dialog"
                        aria-label="Filtro de data desktop"
                        className="absolute right-0 top-[calc(100%+10px)] z-50 grid w-[min(920px,calc(100vw-2rem))] grid-cols-[260px_minmax(0,1fr)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-strong)] shadow-2xl"
                    >
                        <div className="border-r border-[var(--border-subtle)] bg-[var(--surface-muted)]">
                            {DESKTOP_PERIOD_OPTIONS.map(option => {
                                const isSelected = draftPeriod === option.key;

                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => onSelectPeriod(option.key)}
                                        className={[
                                            'flex min-h-[46px] w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold transition-colors',
                                            isSelected
                                                ? 'bg-blue-50 text-[var(--brand-primary)] dark:bg-blue-400/15 dark:text-blue-200'
                                                : 'text-[var(--text-strong)] hover:bg-[var(--surface)]'
                                        ].join(' ')}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="min-w-0 bg-[var(--surface)]">
                            <div className="flex items-end gap-3 border-b border-[var(--border-subtle)] p-4">
                                <label className="block min-w-0 flex-1">
                                    <span className="ui-label mb-1 block">Data inicial</span>
                                    <input
                                        type="date"
                                        max={maxDateValue}
                                        value={draftStartDate}
                                        onFocus={() => onChangeActiveBoundary('start')}
                                        onChange={event => onChangeDraftDate('start', event.target.value)}
                                        className={[
                                            'ui-field h-10 w-full px-3 text-sm font-semibold',
                                            activeBoundary === 'start' ? 'border-[var(--brand-primary)] ring-2 ring-blue-500/20' : ''
                                        ].join(' ')}
                                    />
                                </label>
                                <span className="pb-2 text-lg font-semibold text-[var(--text-muted)]">-</span>
                                <label className="block min-w-0 flex-1">
                                    <span className="ui-label mb-1 block">Data final</span>
                                    <input
                                        type="date"
                                        max={maxDateValue}
                                        value={draftEndDate}
                                        onFocus={() => onChangeActiveBoundary('end')}
                                        onChange={event => onChangeDraftDate('end', event.target.value)}
                                        className={[
                                            'ui-field h-10 w-full px-3 text-sm font-semibold',
                                            activeBoundary === 'end' ? 'border-[var(--brand-primary)] ring-2 ring-blue-500/20' : ''
                                        ].join(' ')}
                                    />
                                </label>
                            </div>

                            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() => onChangeCalendarMonth(addMonths(calendarMonth, -1))}
                                    aria-label="Mes anterior"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                >
                                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                </button>
                                <p className="text-sm font-bold tracking-wide text-[var(--text-strong)]">{formatMonthTitle(calendarMonth)}</p>
                                <button
                                    type="button"
                                    onClick={() => onChangeCalendarMonth(addMonths(calendarMonth, 1))}
                                    aria-label="Proximo mes"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                >
                                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>

                            <div className="grid grid-cols-7 px-4 pt-3 text-center text-xs font-bold text-[var(--text-muted)]">
                                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                                    <span key={`${day}-${index}`}>{day}</span>
                                ))}
                            </div>

                            <div className="max-h-[360px] overflow-y-auto px-4 pb-4 pt-2">
                                {months.map(month => (
                                    <div key={month.toISOString()} className="mb-5 last:mb-0">
                                        <p className="mb-2 text-sm font-bold text-[var(--text-strong)]">{formatMonthTitle(month)}</p>
                                        <div className="grid grid-cols-7 justify-items-center gap-y-1">
                                            {getCalendarCells(month).map(({ date, isCurrentMonth }) => (
                                                <button
                                                    key={date.toISOString()}
                                                    type="button"
                                                    disabled={startOfDay(date) > maxSelectableDate}
                                                    onClick={() => onSelectDay(date)}
                                                    className={getDayClassName(date, isCurrentMonth)}
                                                    aria-label={formatFullDate(date)}
                                                >
                                                    {date.getDate()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="h-9 rounded-[7px] px-4 text-sm font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-strong)]"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={onApply}
                                    disabled={!canApply}
                                    className="h-9 rounded-[7px] bg-[var(--brand-primary)] px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-soft)]"
                                >
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const MobilePeriodSelector: React.FC<{
    isOpen: boolean;
    selectedPeriod: PeriodKey;
    customStartDate: string;
    customEndDate: string;
    onClose: () => void;
    onSelectPeriod: (period: PeriodKey) => void;
    onChangeCustomStartDate: (value: string) => void;
    onChangeCustomEndDate: (value: string) => void;
    onApplyCustom: () => void;
}> = ({
    isOpen,
    selectedPeriod,
    customStartDate,
    customEndDate,
    onClose,
    onSelectPeriod,
    onChangeCustomStartDate,
    onChangeCustomEndDate,
    onApplyCustom
}) => {
    const [view, setView] = useState<'list' | 'calendar'>('list');
    const [activeBoundary, setActiveBoundary] = useState<'start' | 'end'>('start');
    const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
    const [isManualOpen, setIsManualOpen] = useState(false);
    const [manualStartDate, setManualStartDate] = useState(() => formatManualDateValue(customStartDate));
    const [manualEndDate, setManualEndDate] = useState(() => formatManualDateValue(customEndDate));
    const currentMonthRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const selectedRange = getCustomDateRange(customStartDate, customEndDate);
        const fallbackRange = selectedPeriod === 'custom'
            ? selectedRange || getTodayRange()
            : getPeriodRange(selectedPeriod, selectedRange) || getTodayRange();

        setView(selectedPeriod === 'custom' ? 'calendar' : 'list');
        setActiveBoundary('start');
        setCalendarMonth(startOfMonth(fallbackRange.start));
        setManualStartDate(formatManualDateValue(customStartDate));
        setManualEndDate(formatManualDateValue(customEndDate));
        setIsManualOpen(false);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || view !== 'calendar') return;

        const frame = window.requestAnimationFrame(() => {
            currentMonthRef.current?.scrollIntoView({ block: 'start' });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isOpen, view]);

    if (!isOpen) return null;

    const currentValidation = getStrictDateRangeValidation(customStartDate, customEndDate);
    const canApplyCustom = !!currentValidation.range;
    const currentRange = currentValidation.range || getCustomDateRange(customStartDate, customEndDate);
    const maxSelectableDate = startOfDay(new Date());
    const currentMonthStart = startOfMonth(maxSelectableDate);
    const fallbackFirstMonth = addMonths(currentMonthStart, -12);
    const selectedFirstMonth = currentRange ? startOfMonth(currentRange.start) : startOfMonth(calendarMonth);
    const firstMobileMonth = selectedFirstMonth < fallbackFirstMonth ? selectedFirstMonth : fallbackFirstMonth;
    const mobileMonthCount = Math.max(1, getMonthDistance(firstMobileMonth, currentMonthStart) + 1);
    const months = Array.from({ length: mobileMonthCount }, (_, index) => addMonths(firstMobileMonth, index));

    const handleSelectPeriod = (nextPeriod: PeriodKey) => {
        onSelectPeriod(nextPeriod);

        if (nextPeriod === 'custom') {
            const range = getCustomDateRange(customStartDate, customEndDate) || getTodayRange();
            setCalendarMonth(startOfMonth(range.start));
            setActiveBoundary('start');
            setView('calendar');
        }
    };

    const handleSelectDay = (date: Date) => {
        if (startOfDay(date) > maxSelectableDate) return;

        const value = toDateInputValue(date);
        const start = parseDateInput(customStartDate, 'start');
        const end = parseDateInput(customEndDate, 'start');

        if (activeBoundary === 'start') {
            onChangeCustomStartDate(value);
            if (!end || startOfDay(date) > startOfDay(end)) {
                onChangeCustomEndDate(value);
            }
            setActiveBoundary('end');
        } else {
            if (start && startOfDay(date) < startOfDay(start)) {
                onChangeCustomStartDate(value);
                onChangeCustomEndDate(toDateInputValue(start));
            } else {
                onChangeCustomEndDate(value);
            }
            setActiveBoundary('start');
        }

        onSelectPeriod('custom');
    };

    const handleOpenManualDates = () => {
        setManualStartDate(formatManualDateValue(customStartDate));
        setManualEndDate(formatManualDateValue(customEndDate));
        setIsManualOpen(true);
    };

    const handleConfirmManualDates = () => {
        const parsedStartDate = parseManualDateValue(manualStartDate);
        const parsedEndDate = parseManualDateValue(manualEndDate);
        if (!parsedStartDate || !parsedEndDate) return;

        const nextRange = getStrictDateRangeValidation(parsedStartDate, parsedEndDate).range;
        if (!nextRange) return;

        onChangeCustomStartDate(toDateInputValue(nextRange.start));
        onChangeCustomEndDate(toDateInputValue(nextRange.end));
        setCalendarMonth(startOfMonth(nextRange.start));
        setActiveBoundary('start');
        setIsManualOpen(false);
        onSelectPeriod('custom');
    };

    const handleManualDateInputChange = (
        event: React.ChangeEvent<HTMLInputElement>,
        updateValue: React.Dispatch<React.SetStateAction<string>>
    ) => {
        const input = event.currentTarget;
        const caret = input.selectionStart ?? input.value.length;
        const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
        const nextValue = normalizeManualDateValue(input.value);
        const nextCaret = getManualDateCaretPosition(nextValue, digitsBeforeCaret);

        updateValue(nextValue);

        window.requestAnimationFrame(() => {
            if (document.activeElement === input) {
                input.setSelectionRange(nextCaret, nextCaret);
            }
        });
    };

    const parsedManualStartDate = parseManualDateValue(manualStartDate);
    const parsedManualEndDate = parseManualDateValue(manualEndDate);
    const manualValidation = getStrictDateRangeValidation(parsedManualStartDate, parsedManualEndDate);
    const manualPreviewLabel = formatMobileDatePairLabel(parsedManualStartDate, parsedManualEndDate);
    const showManualStartError = manualStartDate.length === 10 && (!parsedManualStartDate || manualValidation.startError);
    const showManualEndError = manualEndDate.length === 10 && (!parsedManualEndDate || manualValidation.endError);

    const getDayClassName = (date: Date, isCurrentMonth: boolean) => {
        const dayTime = startOfDay(date).getTime();
        const rangeStart = currentRange ? startOfDay(currentRange.start).getTime() : null;
        const rangeEnd = currentRange ? startOfDay(currentRange.end).getTime() : null;
        const isFuture = startOfDay(date) > maxSelectableDate;
        const isEdge = (!!currentRange && isSameDay(date, currentRange.start)) || (!!currentRange && isSameDay(date, currentRange.end));
        const isInRange = rangeStart !== null && rangeEnd !== null && dayTime > rangeStart && dayTime < rangeEnd;

        return [
            'flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold transition-colors',
            isFuture
                ? 'cursor-not-allowed text-[var(--text-soft)] opacity-35'
                : isEdge
                ? 'bg-[var(--brand-primary)] text-white shadow-[var(--shadow-hairline)]'
                : isInRange
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-400/20 dark:text-blue-100'
                    : isCurrentMonth
                        ? 'text-[var(--text-strong)] hover:bg-[var(--surface-muted)]'
                        : 'text-[var(--text-soft)] hover:bg-[var(--surface-muted)]'
        ].join(' ');
    };

    const content = (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtro de periodo"
            className="fixed inset-0 z-[90] flex min-h-[100dvh] w-screen flex-col bg-[var(--app-bg)] text-[var(--text-strong)] sm:hidden"
        >
            {view === 'list' ? (
                <>
                    <div className="flex h-20 shrink-0 items-center gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 shadow-[var(--shadow-hairline)]">
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar filtro de periodo"
                            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-muted)]"
                        >
                            <X className="h-7 w-7" aria-hidden="true" />
                        </button>
                        <h2 className="text-2xl font-bold">Periodo</h2>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {MOBILE_PERIOD_OPTIONS.map(option => {
                            const isSelected = selectedPeriod === option.key;

                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => handleSelectPeriod(option.key)}
                                    className={[
                                        'flex min-h-[64px] w-full items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 text-left text-xl font-bold transition-colors',
                                        isSelected ? 'text-[var(--brand-primary)]' : 'text-[var(--text-strong)] hover:bg-[var(--surface-muted)]'
                                    ].join(' ')}
                                >
                                    <span>{option.label}</span>
                                    {isSelected && <Check className="h-7 w-7 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                        <div className="flex h-16 items-center justify-between gap-3 px-4">
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Fechar filtro de periodo"
                                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-muted)]"
                            >
                                <X className="h-7 w-7" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                onClick={onApplyCustom}
                                disabled={!canApplyCustom}
                                className="h-10 rounded-[8px] px-3 text-lg font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--text-soft)]"
                            >
                                Salvar
                            </button>
                        </div>
                        <div className="px-5 pb-5">
                            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Personalizado</p>
                            <div className="mt-3 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={handleOpenManualDates}
                                    aria-label="Editar datas manualmente"
                                    className="min-w-0 text-left text-3xl font-bold leading-tight text-[var(--text-strong)]"
                                >
                                    {formatMobileRangeLabel(currentRange)}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenManualDates}
                                    aria-label="Editar datas manualmente"
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                >
                                    <Pencil className="h-6 w-6" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 border-t border-[var(--border-subtle)] px-3 py-3 text-center text-lg font-bold text-[var(--text-muted)]">
                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                                <span key={`${day}-${index}`}>{day}</span>
                            ))}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
                        {months.map(month => (
                            <div
                                key={month.toISOString()}
                                ref={isSameMonth(month, currentMonthStart) ? currentMonthRef : undefined}
                                className="mb-8 last:mb-0 scroll-mt-3"
                            >
                                <p className="mb-3 px-2 text-xl font-bold text-[var(--text-muted)]">
                                    {month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                </p>
                                <div className="grid grid-cols-7 justify-items-center gap-y-2">
                                    {getCalendarCells(month).map(({ date, isCurrentMonth }) => (
                                        <button
                                            key={date.toISOString()}
                                            type="button"
                                            disabled={startOfDay(date) > maxSelectableDate}
                                            onClick={() => handleSelectDay(date)}
                                            className={getDayClassName(date, isCurrentMonth)}
                                            aria-label={formatFullDate(date)}
                                        >
                                            {date.getDate()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {isManualOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Editar datas manualmente"
                    className="absolute inset-0 z-20 flex min-h-[100dvh] w-screen items-start justify-center bg-black/60 px-5 pt-[18dvh] text-[var(--text-strong)]"
                >
                    <div className="w-full max-w-[360px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-2xl">
                        <div className="p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Personalizado</p>
                                <p className="mt-4 truncate text-3xl font-bold leading-tight text-[var(--text-strong)]">
                                    {manualPreviewLabel}
                                </p>
                            </div>
                            <CalendarDays className="h-8 w-8 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                        </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] px-5 py-4">
                            <label className="block">
                                <span className="ui-label mb-1 block">Data inicial</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="dd/mm/aaaa"
                                    maxLength={10}
                                    value={manualStartDate}
                                    onChange={event => handleManualDateInputChange(event, setManualStartDate)}
                                    aria-invalid={showManualStartError}
                                    className={[
                                        'ui-field h-14 w-full px-3 text-lg font-bold',
                                        showManualStartError ? 'border-red-400 text-red-500 ring-2 ring-red-500/20 dark:border-red-400 dark:text-red-200' : ''
                                    ].join(' ')}
                                />
                                {showManualStartError && (
                                    <span className="mt-1 block text-xs font-bold text-red-500 dark:text-red-300">
                                        {manualValidation.message || 'Data invalida.'}
                                    </span>
                                )}
                            </label>
                            <label className="block">
                                <span className="ui-label mb-1 block">Data final</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="dd/mm/aaaa"
                                    maxLength={10}
                                    value={manualEndDate}
                                    onChange={event => handleManualDateInputChange(event, setManualEndDate)}
                                    aria-invalid={showManualEndError}
                                    className={[
                                        'ui-field h-14 w-full px-3 text-lg font-bold',
                                        showManualEndError ? 'border-red-400 text-red-500 ring-2 ring-red-500/20 dark:border-red-400 dark:text-red-200' : ''
                                    ].join(' ')}
                                />
                                {showManualEndError && (
                                    <span className="mt-1 block text-xs font-bold text-red-500 dark:text-red-300">
                                        {manualValidation.message || 'Data invalida.'}
                                    </span>
                                )}
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
                            <button
                                type="button"
                                onClick={() => setIsManualOpen(false)}
                                className="h-10 rounded-[8px] px-3 text-base font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmManualDates}
                                disabled={!manualValidation.range}
                                className="h-10 rounded-[8px] px-3 text-base font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--text-soft)]"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return typeof document === 'undefined' ? content : createPortal(content, document.body);
};

const StatusSummary: React.FC<{ label: string; value: number; colorClass: string }> = ({ label, value, colorClass }) => (
    <div className="flex min-w-0 flex-col items-start gap-1 rounded-[var(--radius-card)] bg-[var(--surface-muted)] px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] sm:text-xs">
            <span className={`h-2 w-2 shrink-0 rounded-full ${colorClass}`} />
            <span className="truncate">{label}</span>
        </span>
        <span className="text-sm font-bold leading-none text-[var(--text-strong)]">{value}</span>
    </div>
);

const AttentionItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    mobileValue: string;
    mobileLabel: string;
    helper: string;
    tone: Tone;
    onClick: () => void;
}> = ({ icon, label, mobileValue, mobileLabel, helper, tone, onClick }) => {
    const toneClass = TONE_CLASSES[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-[92px] w-full min-w-0 flex-col items-start justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2.5 text-left transition-colors hover:bg-[var(--surface)] sm:min-h-0 sm:flex-row sm:items-center sm:gap-3 sm:p-3"
        >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-card)] sm:h-9 sm:w-9 ${toneClass.icon}`}>
                {icon}
            </span>
            <span className="min-w-0 flex-1 sm:hidden">
                <span className="block text-xl font-bold leading-none text-[var(--text-strong)]">{mobileValue}</span>
                <span className="mt-1 block truncate text-[11px] font-semibold text-[var(--text-muted)]">{mobileLabel}</span>
            </span>
            <span className="hidden min-w-0 flex-1 sm:block">
                <span className="block truncate text-sm font-bold text-[var(--text-strong)]">{label}</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{helper}</span>
            </span>
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-[var(--text-soft)] sm:block" aria-hidden="true" />
        </button>
    );
};

const FinancialMetricTile: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    helper?: string;
    className?: string;
}> = ({ icon, label, value, helper, className = '' }) => (
    <div className={`min-w-0 rounded-[var(--radius-card)] bg-[var(--surface-muted)] p-3 sm:p-4 ${className}`}>
        <div className="flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]">
            <span className="shrink-0">{icon}</span>
            <span className="min-w-0 truncate text-[11px] font-bold sm:text-xs">{label}</span>
        </div>
        <p className="mt-2 break-words text-lg font-bold leading-tight text-[var(--text-strong)] sm:text-xl">{value}</p>
        {helper && <p className="mt-1 truncate text-[10px] font-semibold text-[var(--text-muted)] sm:text-[11px]">{helper}</p>}
    </div>
);

const InsightItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    helper: string;
}> = ({ icon, label, value, helper }) => (
    <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5 sm:p-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[var(--text-soft)] sm:gap-2">
            {icon}
            <span className="min-w-0 truncate text-[9px] font-bold uppercase sm:text-[11px]">{label}</span>
        </div>
        <p className="mt-2 truncate text-xs font-bold text-[var(--text-strong)] sm:text-sm">{value}</p>
        <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)] sm:text-xs">{helper}</p>
    </div>
);

const PanelHeader: React.FC<{
    kicker: string;
    title: string;
    icon: React.ReactNode;
    onClick: () => void;
}> = ({ kicker, title, icon, onClick }) => (
    <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
            <p className="ui-kicker">{kicker}</p>
            <h2 className="mt-1 truncate text-base font-bold text-[var(--text-strong)] sm:text-lg">{title}</h2>
        </div>
        <button
            type="button"
            onClick={onClick}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-strong)] sm:h-10 sm:w-10"
            aria-label={`Abrir ${title}`}
            title={`Abrir ${title}`}
        >
            {icon}
        </button>
    </div>
);

const QuickAction: React.FC<{
    icon: React.ReactNode;
    label: string;
    description: string;
    onClick: () => void;
    tone: Tone;
}> = ({ icon, label, description, onClick, tone }) => {
    const toneClass = TONE_CLASSES[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            className="ui-card flex min-h-[70px] min-w-0 items-center gap-2.5 overflow-hidden p-3 text-left transition-colors hover:bg-[var(--surface-muted)] sm:min-h-[76px] sm:gap-3 sm:p-4"
        >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] sm:h-10 sm:w-10 ${toneClass.icon}`}>
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[var(--text-strong)]">{label}</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{description}</span>
            </span>
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-[var(--text-soft)] sm:block" aria-hidden="true" />
        </button>
    );
};

export default DashboardView;
