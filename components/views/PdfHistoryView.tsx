import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowDownUp,
    BarChart3,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    ClipboardCopy,
    Download,
    Eye,
    FileText,
    Filter,
    LockKeyhole,
    MessageSquareText,
    MoreVertical,
    Pencil,
    Plus,
    ReceiptText,
    Search,
    Star,
    Target,
    Trash2,
    TrendingUp,
    X,
} from 'lucide-react';
import { SavedPDF, Client, Agendamento, Film, ProposalExpenseCategory, ProposalExpenseCategoryTotal } from '../../types';
import ActionButton from '../ui/ActionButton';
import ContentState from '../ui/ContentState';
import Modal from '../ui/Modal';
import { useFeedback } from '../../src/contexts/FeedbackContext';
import { PROPOSAL_EXPENSE_CATEGORY_OPTIONS, summarizeProposalExpenses } from '../../src/lib/proposalExpenses';
import { matchesSearch, normalizeSearchText } from '../../src/lib/textSearch';
import { buildReviewFollowUpMessage } from '../../src/lib/reviewMessage';
import { formatGarantiaMaoDeObra, garantiaEmDias } from '../../src/lib/filmWarranty';
import { applyFilmWarrantyOverrides } from '../../src/lib/filmWarrantyOverrides';
import ProposalShareModal from '../modals/ProposalShareModal';
import { Drawer } from 'vaul';
import { useIsMobile } from '../../src/hooks/useIsMobile';

interface PdfHistoryViewProps {
    pdfs: SavedPDF[];
    hasMoreServerPdfs?: boolean;
    isLoadingMoreServerPdfs?: boolean;
    onLoadMoreServerPdfs?: () => Promise<void>;
    onEnsureCompleteServerHistory?: () => Promise<void>;
    clients: Client[];
    agendamentos: Agendamento[];
    films: Film[];
    googleReviewsLink?: string;
    onDelete: (pdfId: number) => void;
    onDeleteMany: (pdfIds: number[]) => Promise<void>;
    onDownload: (pdf: SavedPDF, filename: string) => void;
    onUpdateStatus: (pdfId: number, status: SavedPDF['status']) => Promise<void> | void;
    onRenamePdfOption: (pdfId: number, name: string) => Promise<void>;
    onSchedule: (info: { pdf: SavedPDF; agendamento?: Agendamento } | { agendamento: Agendamento; pdf?: SavedPDF }) => void;
    onOpenInAgenda: (agendamento: Agendamento) => void;
    onGenerateCombinedPdf: (pdfs: SavedPDF[]) => void;
    onNavigateToOption: (clientId: number, optionId: number) => void;
    /** Botão central do menu fixo no celular (mesma ação do "Criar proposta" do início). */
    onCreateProposal?: () => void;
}

type HistoryFocusFilter = 'all' | 'pending' | 'approved' | 'revised' | 'expenses' | 'expired';
type HistorySortKey = 'recent' | 'oldest' | 'highest' | 'name';
type HistoryPeriodKey =
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
type DateRange = { start: Date; end: Date };

const HISTORY_FOCUS_FILTER_KEY = 'peliculas-br-history-focus-filter';
const HISTORY_FOCUS_CLIENT_KEY = 'peliculas-br-history-focus-client';

const HISTORY_FOCUS_FILTER_LABELS: Record<HistoryFocusFilter, string> = {
    all: 'Todos',
    pending: 'Pendentes',
    approved: 'Aprovados',
    revised: 'Em revisão',
    expenses: 'Com gastos',
    expired: 'Vencidos'
};

const HISTORY_SORT_LABELS: Record<HistorySortKey, string> = {
    recent: 'Mais recentes',
    oldest: 'Mais antigos',
    highest: 'Maior valor',
    name: 'Nome A-Z',
};

const HISTORY_PERIOD_OPTIONS: { key: HistoryPeriodKey; label: string }[] = [
    { key: 'custom', label: 'Personalizar' },
    { key: 'today', label: 'Hoje' },
    { key: 'yesterday', label: 'Ontem' },
    { key: 'thisWeekSunday', label: 'Esta semana (dom. até hoje)' },
    { key: 'last7', label: 'Últimos 7 dias' },
    { key: 'lastWeekSunday', label: 'Semana passada (dom. a sáb.)' },
    { key: 'last14', label: 'Últimos 14 dias' },
    { key: 'month', label: 'Este mês' },
    { key: 'last30', label: 'Últimos 30 dias' },
    { key: 'previousMonth', label: 'Mês passado' },
    { key: 'year', label: 'Este ano' },
    { key: 'all', label: 'Todo o período' }
];

const HISTORY_MOBILE_PERIOD_OPTIONS: { key: HistoryPeriodKey; label: string }[] = [
    { key: 'custom', label: 'Personalizado' },
    { key: 'today', label: 'Hoje' },
    { key: 'yesterday', label: 'Ontem' },
    { key: 'last7', label: 'Últimos 7 dias' },
    { key: 'last14', label: 'Últimos 14 dias' },
    { key: 'last30', label: 'Últimos 30 dias' },
    { key: 'thisWeekSunday', label: 'Esta semana (dom - hoje)' },
    { key: 'thisWeekMonday', label: 'Esta semana (seg - hoje)' },
    { key: 'lastWeekSunday', label: 'Semana passada (dom - sáb)' },
    { key: 'lastWeekMonday', label: 'Semana passada (seg - dom)' },
    { key: 'month', label: 'Este mês' },
    { key: 'previousMonth', label: 'Mês passado' },
    { key: 'year', label: 'Este ano' },
    { key: 'all', label: 'Todo o período' }
];

const HISTORY_PERIOD_LABELS: Record<HistoryPeriodKey, string> = {
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
    month: 'Este mês',
    previousMonth: 'Mês passado',
    year: 'Este ano',
    all: 'Todo o período'
};

const readInitialHistoryFocusFilter = (): HistoryFocusFilter => {
    if (typeof window === 'undefined') return 'all';

    const stored = window.localStorage.getItem(HISTORY_FOCUS_FILTER_KEY);
    window.localStorage.removeItem(HISTORY_FOCUS_FILTER_KEY);

    return stored === 'pending' || stored === 'approved' || stored === 'revised' || stored === 'expenses' || stored === 'expired'
        ? stored
        : 'all';
};

const readInitialHistoryFocusClient = (): number | null => {
    if (typeof window === 'undefined') return null;

    const stored = window.localStorage.getItem(HISTORY_FOCUS_CLIENT_KEY);
    window.localStorage.removeItem(HISTORY_FOCUS_CLIENT_KEY);

    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
};

const isExpiredOpenPdf = (pdf: SavedPDF) => {
    if (!pdf.expirationDate || pdf.status === 'approved') return false;

    const expirationDate = new Date(pdf.expirationDate);
    if (Number.isNaN(expirationDate.getTime())) return false;

    return new Date(expirationDate.toDateString()) < new Date(new Date().toDateString());
};

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

// Valor curto para caber em 3 colunas no celular: "R$ 4.850" ou "R$ 31,3 mil".
const formatCompactCurrencyBR = (number: number) => (
    Math.abs(number) < 10000
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(number)
        : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(number)
);

const formatPercentageBR = (number: number) => {
    return `${new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }).format(number)}%`;
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
    if (!range) return 'Todo o período';

    if (isSameDay(range.start, range.end)) {
        return formatFullDate(range.start);
    }

    return `${range.start.toLocaleDateString('pt-BR')} - ${range.end.toLocaleDateString('pt-BR')}`;
};

const formatMobileRangeLabel = (range: DateRange | null) => {
    if (!range) return 'Todo o período';

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

    if (!start || !end) return 'Data inválida';

    return formatMobileRangeLabel({ start, end });
};

const formatMonthTitle = (date: Date) =>
    date.toLocaleDateString('pt-BR', {
        month: 'short',
        year: 'numeric'
    }).replace('.', '').toUpperCase();

// "Outubro de 2026"
const formatLongMonthTitle = (date: Date) => {
    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const getCalendarCells = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const firstVisibleDate = startOfWeek(monthStart, 0);

    return Array.from({ length: 42 }, (_, index) => {
        const date = addDays(firstVisibleDate, index);

        return {
            date,
            isCurrentMonth: date.getMonth() === monthDate.getMonth()
        };
    });
};

const parseDateInput = (value: string, boundary: 'start' | 'end'): Date | null => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;

    const date = boundary === 'start'
        ? new Date(year, month - 1, day, 0, 0, 0, 0)
        : new Date(year, month - 1, day, 23, 59, 59, 999);

    return Number.isNaN(date.getTime()) ? null : date;
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

    if (start.getTime() > end.getTime()) {
        return {
            start: endAsStart,
            end: startAsEnd
        };
    }

    return { start, end };
};

const getStrictDateRangeValidation = (startValue: string | null, endValue: string | null) => {
    const start = startValue ? parseDateInput(startValue, 'start') : null;
    const end = endValue ? parseDateInput(endValue, 'end') : null;
    const today = endOfDay(new Date());

    if (!startValue || !start) {
        return { range: null, startError: 'Informe uma data inicial valida.', endError: null };
    }

    if (!endValue || !end) {
        return { range: null, startError: null, endError: 'Informe uma data final valida.' };
    }

    if (start > today) {
        return { range: null, startError: 'A data inicial não pode ficar no futuro.', endError: null };
    }

    if (end > today) {
        return { range: null, startError: null, endError: 'A data final não pode ficar no futuro.' };
    }

    if (start > end) {
        return { range: null, startError: 'A data inicial precisa vir antes da final.', endError: 'Revise o período.' };
    }

    return { range: { start, end }, startError: null, endError: null };
};

const getPeriodRange = (period: HistoryPeriodKey, customRange?: DateRange | null): DateRange | null => {
    const now = new Date();
    const end = new Date(now);

    if (period === 'today') return getDayRange(now);
    if (period === 'yesterday') return getDayRange(addDays(now, -1));

    if (period === 'month') {
        return {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: endOfDay(end)
        };
    }

    if (period === 'last7') return { start: startOfDay(addDays(now, -6)), end: endOfDay(end) };
    if (period === 'last14') return { start: startOfDay(addDays(now, -13)), end: endOfDay(end) };
    if (period === 'last30') return { start: startOfDay(addDays(now, -29)), end: endOfDay(end) };

    if (period === 'thisWeekSunday') return { start: startOfWeek(now, 0), end: endOfDay(end) };
    if (period === 'thisWeekMonday') return { start: startOfWeek(now, 1), end: endOfDay(end) };

    if (period === 'lastWeekSunday') {
        const currentWeekStart = startOfWeek(now, 0);
        const previousWeekStart = addDays(currentWeekStart, -7);
        return { start: previousWeekStart, end: endOfDay(addDays(previousWeekStart, 6)) };
    }

    if (period === 'lastWeekMonday') {
        const currentWeekStart = startOfWeek(now, 1);
        const previousWeekStart = addDays(currentWeekStart, -7);
        return { start: previousWeekStart, end: endOfDay(addDays(previousWeekStart, 6)) };
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
            end: endOfDay(end)
        };
    }

    if (period === 'custom') return customRange || null;
    return null;
};

const isWithinRange = (date: Date | null, range: DateRange | null) => {
    if (!range) return true;
    if (!date) return false;

    return date >= range.start && date <= range.end;
};

const getTodayRange = () => getDayRange(new Date());

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

const toFiniteNumber = (value?: number | null) => (
    typeof value === 'number' && Number.isFinite(value) ? value : 0
);

type MonthlyExpenseSummary = {
    key: string;
    label: string;
    pdfCount: number;
    approvedCount: number;
    opportunityCount: number;
    totalRevenue: number;
    presentedRevenue: number;
    duplicatedRevenue: number;
    alternativeCount: number;
    operationalExpenses: number;
    estimatedMaterialCost: number;
    estimatedTotalCost: number;
    estimatedProfit: number;
    estimatedMarginPercentage: number;
    expensesByCategory: ProposalExpenseCategoryTotal[];
};

type FunnelReferencePdfMap = Record<string, number>;

type OpportunitySummary = {
    key: string;
    monthKey: string;
    monthLabel: string;
    sortTime: number;
    pdfs: SavedPDF[];
    referencePdf: SavedPDF;
    presentedRevenue: number;
    funnelRevenue: number;
    approvedCount: number;
};

const categoryOrder = PROPOSAL_EXPENSE_CATEGORY_OPTIONS.reduce((acc, option, index) => {
    acc[option.category] = index;
    return acc;
}, {} as Record<ProposalExpenseCategory, number>);

const categoryLabels = PROPOSAL_EXPENSE_CATEGORY_OPTIONS.reduce((acc, option) => {
    acc[option.category] = option.label;
    return acc;
}, {} as Record<ProposalExpenseCategory, string>);

const mergeCategoryTotals = (items: ProposalExpenseCategoryTotal[]): ProposalExpenseCategoryTotal[] => {
    const totalsByCategory = new Map<ProposalExpenseCategory, number>();

    items.forEach(item => {
        const total = toFiniteNumber(item.total);
        if (total <= 0) return;

        totalsByCategory.set(
            item.category,
            (totalsByCategory.get(item.category) || 0) + total
        );
    });

    return Array.from(totalsByCategory.entries())
        .map(([category, total]) => ({
            category,
            label: categoryLabels[category] || 'Outros',
            total
        }))
        .sort((a, b) => (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99));
};

const getPdfExpenseData = (pdf: SavedPDF) => {
    const snapshot = pdf.generalDiscount?.expenseSnapshot;

    if (snapshot) {
        const operationalExpenses = toFiniteNumber(snapshot.operationalExpenses);
        const estimatedMaterialCost = toFiniteNumber(snapshot.estimatedMaterialCost);
        const estimatedTotalCost = toFiniteNumber(snapshot.estimatedTotalCost);
        const estimatedProfit = toFiniteNumber(snapshot.estimatedProfit);

        return {
            operationalExpenses,
            estimatedMaterialCost,
            estimatedTotalCost: estimatedTotalCost || operationalExpenses + estimatedMaterialCost,
            estimatedProfit: estimatedProfit || toFiniteNumber(pdf.totalPreco) - (estimatedTotalCost || operationalExpenses + estimatedMaterialCost),
            expensesByCategory: snapshot.expensesByCategory || []
        };
    }

    const expenseSummary = summarizeProposalExpenses(pdf.generalDiscount?.expenses);
    const estimatedTotalCost = expenseSummary.total;

    return {
        operationalExpenses: expenseSummary.total,
        estimatedMaterialCost: 0,
        estimatedTotalCost,
        estimatedProfit: toFiniteNumber(pdf.totalPreco) - estimatedTotalCost,
        expensesByCategory: expenseSummary.byCategory
    };
};

const getPdfSortTime = (pdf: SavedPDF) => {
    const time = new Date(pdf.date).getTime();
    return Number.isNaN(time) ? 0 : time;
};

const getPdfMonthInfo = (pdf: SavedPDF) => {
    const date = new Date(pdf.date);
    const time = date.getTime();

    if (Number.isNaN(time)) return null;

    return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric'
        }),
        sortTime: time
    };
};

const getPdfOpportunityKey = (pdf: SavedPDF) => {
    const monthInfo = getPdfMonthInfo(pdf);
    if (!monthInfo) return null;

    return `${pdf.clienteId}-${monthInfo.key}`;
};

const sortPdfsByDateDesc = (items: SavedPDF[]) => (
    [...items].sort((a, b) => getPdfSortTime(b) - getPdfSortTime(a))
);

const chooseOpportunityReferencePdf = (opportunityPdfs: SavedPDF[], referencePdfId?: number) => {
    const sortedPdfs = sortPdfsByDateDesc(opportunityPdfs);
    const manualReference = typeof referencePdfId === 'number'
        ? sortedPdfs.find(pdf => pdf.id === referencePdfId)
        : undefined;

    return manualReference
        || sortedPdfs.find(pdf => pdf.status === 'approved')
        || sortedPdfs[0];
};

const buildOpportunitySummaries = (
    pdfs: SavedPDF[],
    referencePdfIds: FunnelReferencePdfMap = {}
): OpportunitySummary[] => {
    const groups = new Map<string, { monthKey: string; monthLabel: string; pdfs: SavedPDF[] }>();

    pdfs.forEach(pdf => {
        const monthInfo = getPdfMonthInfo(pdf);
        if (!monthInfo) return;

        const key = getPdfOpportunityKey(pdf);
        if (!key) return;

        const current = groups.get(key) || {
            monthKey: monthInfo.key,
            monthLabel: monthInfo.label,
            pdfs: []
        };

        current.pdfs.push(pdf);
        groups.set(key, current);
    });

    return Array.from(groups.entries())
        .map(([key, group]) => {
            const sortedPdfs = sortPdfsByDateDesc(group.pdfs);
            const referencePdf = chooseOpportunityReferencePdf(sortedPdfs, referencePdfIds[key]);
            if (!referencePdf) return null;
            const presentedRevenue = sortedPdfs.reduce((sum, pdf) => sum + toFiniteNumber(pdf.totalPreco), 0);

            return {
                key,
                monthKey: group.monthKey,
                monthLabel: group.monthLabel,
                sortTime: Math.max(...sortedPdfs.map(getPdfSortTime)),
                pdfs: sortedPdfs,
                referencePdf,
                presentedRevenue,
                funnelRevenue: toFiniteNumber(referencePdf.totalPreco),
                approvedCount: sortedPdfs.some(pdf => pdf.status === 'approved') ? 1 : 0
            };
        })
        .filter((summary): summary is OpportunitySummary => Boolean(summary))
        .sort((a, b) => b.sortTime - a.sortTime);
};

// "Valor principal" só importa quando o atendimento tem mais de uma opção.
const hasFunnelAlternatives = (opportunities: OpportunitySummary[], pdfId?: number) => (
    opportunities.some(opportunity => opportunity.pdfs.length > 1 && opportunity.pdfs.some(pdf => pdf.id === pdfId))
);

const buildMonthlyExpenseSummaries = (
    pdfs: SavedPDF[],
    referencePdfIds: FunnelReferencePdfMap = {}
): MonthlyExpenseSummary[] => {
    const summaries = new Map<string, Omit<MonthlyExpenseSummary, 'expensesByCategory'> & {
        sortTime: number;
        rawCategoryTotals: ProposalExpenseCategoryTotal[];
    }>();
    const opportunities = buildOpportunitySummaries(pdfs, referencePdfIds);

    opportunities.forEach(opportunity => {
        const referencePdf = opportunity.referencePdf;
        const expenseData = getPdfExpenseData(referencePdf);
        const current = summaries.get(opportunity.monthKey) || {
            key: opportunity.monthKey,
            label: opportunity.monthLabel,
            sortTime: opportunity.sortTime,
            pdfCount: 0,
            approvedCount: 0,
            opportunityCount: 0,
            totalRevenue: 0,
            presentedRevenue: 0,
            duplicatedRevenue: 0,
            alternativeCount: 0,
            operationalExpenses: 0,
            estimatedMaterialCost: 0,
            estimatedTotalCost: 0,
            estimatedProfit: 0,
            estimatedMarginPercentage: 0,
            rawCategoryTotals: []
        };

        current.pdfCount += opportunity.pdfs.length;
        current.approvedCount += opportunity.approvedCount;
        current.opportunityCount += 1;
        current.totalRevenue += opportunity.funnelRevenue;
        current.presentedRevenue += opportunity.presentedRevenue;
        current.duplicatedRevenue += Math.max(0, opportunity.presentedRevenue - opportunity.funnelRevenue);
        current.alternativeCount += Math.max(0, opportunity.pdfs.length - 1);
        current.operationalExpenses += expenseData.operationalExpenses;
        current.estimatedMaterialCost += expenseData.estimatedMaterialCost;
        current.estimatedTotalCost += expenseData.estimatedTotalCost;
        current.estimatedProfit += expenseData.estimatedProfit;
        current.rawCategoryTotals.push(...expenseData.expensesByCategory);
        current.sortTime = Math.max(current.sortTime, opportunity.sortTime);

        summaries.set(opportunity.monthKey, current);
    });

    return Array.from(summaries.values())
        .map(summary => {
            const estimatedMarginPercentage = summary.totalRevenue > 0
                ? (summary.estimatedProfit / summary.totalRevenue) * 100
                : 0;
            const { rawCategoryTotals, sortTime, ...rest } = summary;

            return {
                ...rest,
                estimatedMarginPercentage,
                expensesByCategory: mergeCategoryTotals(rawCategoryTotals)
            };
        })
        .sort((a, b) => b.key.localeCompare(a.key));
};

const buildPeriodExpenseSummary = (
    pdfs: SavedPDF[],
    referencePdfIds: FunnelReferencePdfMap = {},
    label: string
): MonthlyExpenseSummary | null => {
    const opportunities = buildOpportunitySummaries(pdfs, referencePdfIds);
    if (opportunities.length === 0) return null;

    const base = opportunities.reduce((summary, opportunity) => {
        const expenseData = getPdfExpenseData(opportunity.referencePdf);

        summary.pdfCount += opportunity.pdfs.length;
        summary.approvedCount += opportunity.approvedCount;
        summary.opportunityCount += 1;
        summary.totalRevenue += opportunity.funnelRevenue;
        summary.presentedRevenue += opportunity.presentedRevenue;
        summary.alternativeCount += Math.max(0, opportunity.pdfs.length - 1);
        summary.operationalExpenses += expenseData.operationalExpenses;
        summary.estimatedMaterialCost += expenseData.estimatedMaterialCost;
        summary.estimatedTotalCost += expenseData.estimatedTotalCost;
        summary.estimatedProfit += expenseData.estimatedProfit;
        summary.rawCategoryTotals.push(...expenseData.expensesByCategory);

        return summary;
    }, {
        key: 'period',
        label,
        pdfCount: 0,
        approvedCount: 0,
        opportunityCount: 0,
        totalRevenue: 0,
        presentedRevenue: 0,
        alternativeCount: 0,
        operationalExpenses: 0,
        estimatedMaterialCost: 0,
        estimatedTotalCost: 0,
        estimatedProfit: 0,
        rawCategoryTotals: [] as ProposalExpenseCategoryTotal[]
    });

    const estimatedMarginPercentage = base.totalRevenue > 0
        ? (base.estimatedProfit / base.totalRevenue) * 100
        : 0;

    const { rawCategoryTotals, ...summary } = base;

    return {
        ...summary,
        duplicatedRevenue: Math.max(0, summary.presentedRevenue - summary.totalRevenue),
        estimatedMarginPercentage,
        expensesByCategory: mergeCategoryTotals(rawCategoryTotals)
    };
};

const buildEmptyExpenseSummary = (label: string): MonthlyExpenseSummary => ({
    key: 'period',
    label,
    pdfCount: 0,
    approvedCount: 0,
    opportunityCount: 0,
    totalRevenue: 0,
    presentedRevenue: 0,
    duplicatedRevenue: 0,
    alternativeCount: 0,
    operationalExpenses: 0,
    estimatedMaterialCost: 0,
    estimatedTotalCost: 0,
    estimatedProfit: 0,
    estimatedMarginPercentage: 0,
    expensesByCategory: []
});

const buildFunnelTotals = (pdfs: SavedPDF[], referencePdfIds: FunnelReferencePdfMap = {}) => {
    const opportunities = buildOpportunitySummaries(pdfs, referencePdfIds);
    const presentedRevenue = opportunities.reduce((sum, opportunity) => sum + opportunity.presentedRevenue, 0);
    const funnelRevenue = opportunities.reduce((sum, opportunity) => sum + opportunity.funnelRevenue, 0);

    return {
        opportunities,
        opportunityCount: opportunities.length,
        pdfCount: opportunities.reduce((sum, opportunity) => sum + opportunity.pdfs.length, 0),
        approvedCount: opportunities.reduce((sum, opportunity) => sum + opportunity.approvedCount, 0),
        presentedRevenue,
        funnelRevenue,
        duplicatedRevenue: Math.max(0, presentedRevenue - funnelRevenue),
        alternativeCount: opportunities.reduce((sum, opportunity) => sum + Math.max(0, opportunity.pdfs.length - 1), 0),
        latestReferencePdf: opportunities[0]?.referencePdf
    };
};

const buildPartnerExpenseSummaryText = (summary: MonthlyExpenseSummary) => {
    const categoryLines = summary.expensesByCategory.length > 0
        ? summary.expensesByCategory.map(item => `- ${item.label}: ${formatNumberBR(item.total)}`)
        : ['- Sem gastos lançados por categoria.'];

    return [
        `Fechamento interno - ${summary.label}`,
        `Oportunidades: ${summary.opportunityCount}`,
        `Opções apresentadas: ${summary.pdfCount}`,
        `Aprovados: ${summary.approvedCount}`,
        `Pipeline real: ${formatNumberBR(summary.totalRevenue)}`,
        `Volume apresentado: ${formatNumberBR(summary.presentedRevenue)}`,
        `Duplicidade evitada: ${formatNumberBR(summary.duplicatedRevenue)}`,
        `Gastos lançados: ${formatNumberBR(summary.operationalExpenses)}`,
        `Material da película estimado: ${formatNumberBR(summary.estimatedMaterialCost)}`,
        `Custo total estimado: ${formatNumberBR(summary.estimatedTotalCost)}`,
        `Resultado estimado: ${formatNumberBR(summary.estimatedProfit)} (${formatPercentageBR(summary.estimatedMarginPercentage)})`,
        '',
        'Por categoria:',
        ...categoryLines,
        '',
        'Obs.: resumo interno; o pipeline real usa um valor por oportunidade e não soma alternativas do mesmo cliente no mês.'
    ].join('\n');
};

const PDF_MESSAGE_TEMPLATES_STORAGE_KEY = 'peliculas-br-pdf-message-templates';
const PDF_READY_MESSAGE_OVERRIDES_STORAGE_KEY = 'peliculas-br-pdf-ready-message-overrides-v1';
const PDF_COMBINED_MESSAGE_OVERRIDES_STORAGE_KEY = 'peliculas-br-pdf-combined-message-overrides-v1';
const PDF_SELECTED_FOR_COMBINED_STORAGE_KEY = 'peliculas-br-pdf-selected-for-combined-v1';
const PDF_FUNNEL_REFERENCE_STORAGE_KEY = 'peliculas-br-pdf-funnel-reference-v1';
const PDF_REVIEW_REQUESTS_SENT_STORAGE_KEY = 'peliculas-br-pdf-review-requests-sent-v1';

type ReviewRequestsSentMap = Record<string, string>;
type ReviewCampaignCandidate = {
    pdf: SavedPDF;
    client: Client;
    agendamento?: Agendamento;
    message: string;
    requestKey: string;
    sentAt?: string;
};

const DEFAULT_PDF_MESSAGE_TEMPLATES = [
    'Segue seu orçamento, {{primeiroNome}}. Considerei {{peliculas}} {{garantia}}. Se quiser, eu também posso te orientar sobre a melhor aplicação para cada ambiente.',
    '{{primeiroNome}}, preparei seu orçamento. Orcei {{peliculas}} {{garantia}}. Se quiser, ajusto rapidinho qualquer detalhe para chegar na melhor opção para você.',
    'Segue o orçamento, {{primeiroNome}}. A opção com {{peliculas}} {{garantia}} ficou em {{valor}}. Se fizer sentido para você, já posso te explicar os próximos passos da instalação.'
];

// Padrões anteriores ao envio por link: quem ainda usa esses textos recebe os novos.
const PREVIOUS_PDF_MESSAGE_TEMPLATES = [
    'Segue seu orçamento, {{primeiroNome}}. Considerei {{peliculas}} {{garantia}}. Se quiser, eu também posso te orientar sobre a melhor aplicação para cada ambiente.',
    '{{primeiroNome}}, te enviei o orçamento em PDF. Orcei {{peliculas}} {{garantia}}. Se quiser, ajusto rapidinho qualquer detalhe para chegar na melhor opção para você.',
    'Segue o orçamento, {{primeiroNome}}. A opção com {{peliculas}} {{garantia}} ficou em {{valor}}. Se fizer sentido para você, já posso te explicar os próximos passos da instalação.'
];

const LEGACY_PDF_MESSAGE_TEMPLATES = [
    'Segue seu orcamento, {{primeiroNome}}. Considerei {{peliculas}} {{garantia}}. Se quiser, eu tambem posso te orientar sobre a melhor aplicacao para cada ambiente.',
    '{{primeiroNome}}, te enviei o orcamento em PDF. Orcei {{peliculas}} {{garantia}}. Se quiser, ajusto rapidinho qualquer detalhe para chegar na melhor opcao para voce.',
    'Segue o orcamento, {{primeiroNome}}. A opcao com {{peliculas}} {{garantia}} ficou em {{valor}}. Se fizer sentido para voce, ja posso te explicar os proximos passos da instalacao.'
];

const hasSameTemplates = (left: string[], right: string[]) => {
    return left.length === right.length && left.every((template, index) => template === right[index]);
};

const normalizeStoredPdfMessageTemplates = (templates: string[]) => {
    return hasSameTemplates(templates, LEGACY_PDF_MESSAGE_TEMPLATES) || hasSameTemplates(templates, PREVIOUS_PDF_MESSAGE_TEMPLATES)
        ? [...DEFAULT_PDF_MESSAGE_TEMPLATES]
        : templates;
};

const getReadyMessageOverrideKey = (pdf: SavedPDF) => {
    return String(pdf.id ?? `${pdf.clienteId}-${pdf.nomeArquivo}-${pdf.date}`);
};

const getReviewRequestKey = (pdf: SavedPDF) => {
    return getReadyMessageOverrideKey(pdf);
};

const readReviewRequestsSent = (): ReviewRequestsSentMap => {
    if (typeof window === 'undefined') return {};

    try {
        const rawRequests = window.localStorage.getItem(PDF_REVIEW_REQUESTS_SENT_STORAGE_KEY);
        if (!rawRequests) return {};

        const parsedRequests = JSON.parse(rawRequests);
        if (!parsedRequests || typeof parsedRequests !== 'object' || Array.isArray(parsedRequests)) {
            return {};
        }

        return Object.entries(parsedRequests).reduce((acc, [key, value]) => {
            if (key && typeof value === 'string') {
                acc[key] = value;
            }
            return acc;
        }, {} as ReviewRequestsSentMap);
    } catch (error) {
        console.error('Erro ao carregar pedidos de avaliacao:', error);
        return {};
    }
};

const saveReviewRequestsSent = (requests: ReviewRequestsSentMap) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(PDF_REVIEW_REQUESTS_SENT_STORAGE_KEY, JSON.stringify(requests));
    } catch (error) {
        console.error('Erro ao salvar pedidos de avaliacao:', error);
    }
};

const readReadyMessageOverrides = (overrideKey: string): string[] | null => {
    if (typeof window === 'undefined') return null;

    try {
        const rawOverrides = window.localStorage.getItem(PDF_READY_MESSAGE_OVERRIDES_STORAGE_KEY);
        if (!rawOverrides) return null;

        const parsedOverrides = JSON.parse(rawOverrides);
        const messages = parsedOverrides?.[overrideKey];

        return Array.isArray(messages) && messages.every(message => typeof message === 'string')
            ? messages
            : null;
    } catch (error) {
        console.error('Erro ao carregar mensagens editadas do orçamento:', error);
        return null;
    }
};

const getCombinedMessageOverrideKey = (selectedPdfs: SavedPDF[]) => {
    return selectedPdfs
        .map(pdf => String(pdf.id ?? `${pdf.clienteId}-${pdf.nomeArquivo}-${pdf.date}`))
        .sort()
        .join('|');
};

const readCombinedMessageOverrides = (overrideKey: string): string[] | null => {
    if (typeof window === 'undefined' || !overrideKey) return null;

    try {
        const rawOverrides = window.localStorage.getItem(PDF_COMBINED_MESSAGE_OVERRIDES_STORAGE_KEY);
        if (!rawOverrides) return null;

        const parsedOverrides = JSON.parse(rawOverrides);
        const messages = parsedOverrides?.[overrideKey];

        return Array.isArray(messages) && messages.every(message => typeof message === 'string')
            ? messages
            : null;
    } catch (error) {
        console.error('Erro ao carregar mensagens editadas do PDF combinado:', error);
        return null;
    }
};

const saveCombinedMessageOverrides = (overrideKey: string, messages: string[]) => {
    if (typeof window === 'undefined' || !overrideKey) return;

    try {
        const rawOverrides = window.localStorage.getItem(PDF_COMBINED_MESSAGE_OVERRIDES_STORAGE_KEY);
        const parsedOverrides = rawOverrides ? JSON.parse(rawOverrides) : {};
        window.localStorage.setItem(
            PDF_COMBINED_MESSAGE_OVERRIDES_STORAGE_KEY,
            JSON.stringify({
                ...parsedOverrides,
                [overrideKey]: messages,
            })
        );
    } catch (error) {
        console.error('Erro ao salvar mensagens editadas do PDF combinado:', error);
    }
};

const readSelectedCombinedPdfIds = () => {
    if (typeof window === 'undefined') return new Set<number>();

    try {
        const rawIds = window.localStorage.getItem(PDF_SELECTED_FOR_COMBINED_STORAGE_KEY);
        if (!rawIds) return new Set<number>();

        const parsedIds = JSON.parse(rawIds);
        if (!Array.isArray(parsedIds)) return new Set<number>();

        return new Set(
            parsedIds
                .map(id => Number(id))
                .filter(id => Number.isFinite(id))
        );
    } catch (error) {
        console.error('Erro ao carregar seleção do PDF combinado:', error);
        return new Set<number>();
    }
};

const saveSelectedCombinedPdfIds = (selectedIds: Set<number>) => {
    if (typeof window === 'undefined') return;

    try {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) {
            window.localStorage.removeItem(PDF_SELECTED_FOR_COMBINED_STORAGE_KEY);
            return;
        }

        window.localStorage.setItem(PDF_SELECTED_FOR_COMBINED_STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
        console.error('Erro ao salvar seleção do PDF combinado:', error);
    }
};

const readFunnelReferencePdfIds = (): FunnelReferencePdfMap => {
    if (typeof window === 'undefined') return {};

    try {
        const rawReferences = window.localStorage.getItem(PDF_FUNNEL_REFERENCE_STORAGE_KEY);
        if (!rawReferences) return {};

        const parsedReferences = JSON.parse(rawReferences);
        if (!parsedReferences || typeof parsedReferences !== 'object' || Array.isArray(parsedReferences)) {
            return {};
        }

        return Object.entries(parsedReferences).reduce((acc, [key, value]) => {
            const pdfId = Number(value);
            if (key && Number.isFinite(pdfId)) {
                acc[key] = pdfId;
            }
            return acc;
        }, {} as FunnelReferencePdfMap);
    } catch (error) {
        console.error('Erro ao carregar PDFs principais do funil:', error);
        return {};
    }
};

const saveFunnelReferencePdfIds = (references: FunnelReferencePdfMap) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(PDF_FUNNEL_REFERENCE_STORAGE_KEY, JSON.stringify(references));
    } catch (error) {
        console.error('Erro ao salvar PDF principal do funil:', error);
    }
};

const getFirstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const buildFilmSummary = (filmNames: string[]) => {
    if (filmNames.length === 0) return 'as películas selecionadas';
    if (filmNames.length === 1) return `a película ${filmNames[0]}`;
    if (filmNames.length === 2) return `as películas ${filmNames[0]} e ${filmNames[1]}`;
    return `as películas ${filmNames[0]}, ${filmNames[1]} e outras`;
};

// Películas usadas no PDF já com a garantia personalizada naquela proposta.
const getPdfWarrantyFilms = (pdf: SavedPDF, films: Film[], filmNames: string[]) => {
    const withOverrides = applyFilmWarrantyOverrides(films, pdf.generalDiscount?.filmWarrantyOverrides);
    return filmNames
        .map(name => withOverrides.find(film => film.nome === name))
        .filter((film): film is Film => Boolean(film));
};

const buildWarrantyTextFromFilms = (matchedFilms: Film[]) => {
    const fabricante = matchedFilms
        .map(film => film.garantiaFabricante)
        .filter((value): value is number => typeof value === 'number' && value > 0);

    const maoDeObraFilms = matchedFilms
        .filter(film => typeof film.garantiaMaoDeObra === 'number' && film.garantiaMaoDeObra > 0);

    const parts: string[] = [];

    if (fabricante.length > 0) {
        const maxFabricante = Math.max(...fabricante);
        parts.push(`garantia de fabricante de ${maxFabricante} ano${maxFabricante > 1 ? 's' : ''}`);
    }

    if (maoDeObraFilms.length > 0) {
        const best = maoDeObraFilms.reduce((a, b) =>
            garantiaEmDias(b.garantiaMaoDeObra, b.garantiaMaoDeObraUnidade) > garantiaEmDias(a.garantiaMaoDeObra, a.garantiaMaoDeObraUnidade) ? b : a);
        parts.push(`garantia de instalação de ${formatGarantiaMaoDeObra(best.garantiaMaoDeObra, best.garantiaMaoDeObraUnidade)}`);
    }

    if (parts.length === 0) {
        return 'com garantia conforme a película escolhida';
    }

    return `com ${parts.join(' e ')}`;
};

const buildPersuasiveMessages = (pdf: SavedPDF, clientName: string, films: Film[]) => {
    const filmTotals = new Map<string, number>();

    (pdf.measurements || []).forEach(measurement => {
        if (!measurement.pelicula) return;
        const width = parseFloat(String(measurement.largura).replace(',', '.'));
        const height = parseFloat(String(measurement.altura).replace(',', '.'));
        const quantity = measurement.quantidade || 1;

        if (Number.isNaN(width) || Number.isNaN(height)) return;

        const totalM2 = (width * height * quantity) / 10000;
        filmTotals.set(measurement.pelicula, (filmTotals.get(measurement.pelicula) || 0) + totalM2);
    });

    const orderedFilmNames = Array.from(filmTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([filmName]) => filmName);

    const firstName = getFirstName(clientName);
    const filmSummary = buildFilmSummary(orderedFilmNames);
    const warrantyText = buildWarrantyTextFromFilms(getPdfWarrantyFilms(pdf, films, orderedFilmNames));
    const totalText = formatNumberBR(pdf.totalPreco);

    return [
        `Segue seu orçamento, ${firstName}. Considerei ${filmSummary} ${warrantyText}. Se quiser, eu também posso te orientar sobre a melhor aplicação para cada ambiente.`,
        `${firstName}, te enviei o orçamento em PDF. Orcei ${filmSummary} ${warrantyText}. Se quiser, ajusto rapidinho qualquer detalhe para chegar na melhor opção para você.`,
        `Segue o orçamento, ${firstName}. A opção com ${filmSummary} ${warrantyText} ficou em ${totalText}. Se fizer sentido para você, já posso te explicar os próximos passos da instalação.`
    ];
};

const buildPdfMessageContext = (pdf: SavedPDF, clientName: string, films: Film[]) => {
    const filmNames = Array.from(new Set((pdf.measurements || []).map(measurement => measurement.pelicula).filter(Boolean)));

    return {
        cliente: clientName,
        primeiroNome: getFirstName(clientName),
        peliculas: buildFilmSummary(filmNames),
        garantia: buildWarrantyTextFromFilms(getPdfWarrantyFilms(pdf, films, filmNames)),
        valor: formatNumberBR(pdf.totalPreco)
    };
};

const renderPdfMessageTemplate = (template: string, context: Record<string, string>) => {
    return template.replace(/\{\{\s*(cliente|primeiroNome|peliculas|garantia|valor)\s*\}\}/g, (_, key: string) => {
        return context[key] || '';
    });
};

const isMeaningfulText = (value?: string | null) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized !== '' && normalized !== 'desconhecido';
};

const getUniqueMeaningfulValues = (values: Array<string | undefined>) => {
    return Array.from(
        new Set(
            values
                .map(value => value?.trim())
                .filter((value): value is string => isMeaningfulText(value))
        )
    );
};

const formatNaturalList = (items: string[]) => {
    const normalizedItems = items.map(item => item.trim()).filter(Boolean);

    if (normalizedItems.length === 0) return '';
    if (normalizedItems.length === 1) return normalizedItems[0];
    if (normalizedItems.length === 2) return `${normalizedItems[0]} e ${normalizedItems[1]}`;

    return `${normalizedItems.slice(0, -1).join(', ')} e ${normalizedItems[normalizedItems.length - 1]}`;
};

const getProposalOptionLabel = (pdf: SavedPDF, index: number) => {
    return pdf.proposalOptionName?.trim() || `Opção ${index + 1}`;
};

const buildCombinedProposalMessages = (selectedPdfs: SavedPDF[], client: Client | null | undefined, films: Film[]) => {
    if (selectedPdfs.length === 0) return [];

    const firstName = getFirstName(client?.nome || selectedPdfs[0]?.clientName || 'cliente');
    const selectedCount = selectedPdfs.length;
    const optionLabel = selectedCount === 1 ? 'opção' : 'opções';
    const optionSubject = selectedCount === 1 ? 'essa opção' : `essas ${selectedCount} opções`;
    const optionEntries = selectedPdfs.map((pdf, index) => ({
        name: getProposalOptionLabel(pdf, index),
        price: toFiniteNumber(pdf.totalPreco),
    }));
    const optionNamesText = formatNaturalList(optionEntries.map(option => option.name));
    const optionPricesText = formatNaturalList(optionEntries.map(option => `${option.name} (${formatNumberBR(option.price)})`));
    const filmNames = getUniqueMeaningfulValues(selectedPdfs.flatMap(pdf => (
        (pdf.measurements || []).map(measurement => measurement.pelicula)
    )));
    const filmSummary = filmNames.length > 0 ? buildFilmSummary(filmNames) : 'as películas selecionadas';
    const warrantyText = buildWarrantyTextFromFilms(selectedPdfs.flatMap(pdf => getPdfWarrantyFilms(pdf, films, filmNames)));
    const cheapestOption = optionEntries.reduce((cheapest, option) => (
        option.price < cheapest.price ? option : cheapest
    ), optionEntries[0]);
    const cheapestOptionText = selectedCount > 1
        ? `A opção de menor valor é ${cheapestOption.name}, em ${formatNumberBR(cheapestOption.price)}.`
        : '';

    return [
        `${firstName}, estou te enviando ${selectedCount} ${optionLabel} de orçamento no mesmo PDF: ${optionPricesText}. Considerei ${filmSummary} ${warrantyText}, para você comparar com calma e escolher a que fizer mais sentido.`,
        `Segue o PDF combinado, ${firstName}. Coloquei ${optionNamesText} no mesmo arquivo para facilitar sua análise. ${cheapestOptionText} Se preferir, também posso enviar os orçamentos separados.`,
        `${firstName}, deixei ${optionSubject} juntas para você comparar película, garantia e valor lado a lado. A ideia é você escolher a alternativa que combina melhor com o que precisa; quando decidir, já posso te orientar sobre os próximos passos da instalação.`
    ];
};

// buildReviewLocationHint e buildReviewFollowUpMessage foram movidos para
// ../../src/lib/reviewMessage para serem reaproveitados na Agenda (card concluido).

const normalizeWhatsappPhone = (phone?: string | null) => {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (!digits) return null;

    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
        digits = `55${digits}`;
    }

    if (digits.length < 12) return null;
    return digits;
};

const isLikelyMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;

    const mobileByUserAgent = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const mobileByUserAgentData = Boolean((navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile);

    return mobileByUserAgent || mobileByUserAgentData;
};

const buildWhatsAppMessageUrl = (phone: string, message: string) => {
    const encodedMessage = encodeURIComponent(message);

    if (isLikelyMobileDevice()) {
        return `https://wa.me/${phone}?text=${encodedMessage}`;
    }

    return `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}&type=phone_number&app_absent=0`;
};

const buildRegularWhatsAppAppUrl = (phone: string, message: string) => {
    const encodedMessage = encodeURIComponent(message);

    if (isLikelyMobileDevice()) {
        return `whatsapp://send?phone=${phone}&text=${encodedMessage}`;
    }

    return buildWhatsAppMessageUrl(phone, message);
};

const buildBusinessWhatsAppAppUrl = (phone: string, message: string) => {
    const encodedMessage = encodeURIComponent(message);

    if (typeof window !== 'undefined' && /Android/i.test(window.navigator.userAgent)) {
        // browser_fallback_url: se o WhatsApp Business nao estiver instalado, abre o WhatsApp Web.
        const fallback = encodeURIComponent(buildWhatsAppMessageUrl(phone, message));
        return `intent://send?phone=${phone}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${fallback};end`;
    }

    if (typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(window.navigator.userAgent)) {
        return `whatsapp-business://send?phone=${phone}&text=${encodedMessage}`;
    }

    return buildWhatsAppMessageUrl(phone, message);
};

const copyTextWithFallback = async (text: string) => {
    if (typeof window !== 'undefined' && window.isSecureContext && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.warn('Clipboard API falhou, tentando fallback.', error);
        }
    }

    if (typeof document === 'undefined') return false;

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('aria-hidden', 'true');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';

    document.body.appendChild(textArea);

    const previousSelection = document.getSelection();
    const activeElement = document.activeElement as HTMLElement | null;

    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch (error) {
        console.error('Fallback de copia falhou:', error);
        copied = false;
    } finally {
        document.body.removeChild(textArea);
        activeElement?.focus?.();
        previousSelection?.removeAllRanges();
    }

    return copied;
};

const WhatsAppChooserModal: React.FC<{
    clientName: string;
    phone: string | null;
    message: string | null;
    onClose: () => void;
}> = ({ clientName, phone, message, onClose }) => {
    if (!phone || !message) return null;

    const regularUrl = buildRegularWhatsAppAppUrl(phone, message);
    const businessUrl = buildBusinessWhatsAppAppUrl(phone, message);
    // WhatsApp Business só no mobile (deep link Android/iOS); no desktop ambos abrem o WhatsApp Web.
    const showBusiness = isLikelyMobileDevice();

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            wrapperClassName="backdrop-blur-sm"
            title={
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <i className="fab fa-whatsapp"></i>
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-semibold text-slate-800 dark:text-white">
                            Abrir conversa
                        </div>
                    </div>
                </div>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Escolha qual app deseja usar para falar com <strong className="text-slate-700 dark:text-slate-200">{clientName}</strong>.
                </p>

                <div className={`grid gap-3 ${showBusiness ? 'sm:grid-cols-2' : ''}`}>
                    <a
                        href={regularUrl}
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
                    >
                        <i className="fab fa-whatsapp text-base"></i>
                        WhatsApp
                    </a>

                    {showBusiness && (
                        <a
                            href={businessUrl}
                            onClick={onClose}
                            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                        >
                            <i className="fas fa-briefcase text-sm"></i>
                            WhatsApp Business
                        </a>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    Cancelar
                </button>
            </div>
        </Modal>
    );
};

const getReviewExecutionDate = (candidate: Pick<ReviewCampaignCandidate, 'pdf' | 'agendamento'>) => {
    return parseDate(candidate.agendamento?.end || candidate.agendamento?.start || candidate.pdf.date);
};

const isApprovedReviewCandidate = (pdf: SavedPDF, agendamento?: Agendamento) => {
    if (pdf.status !== 'approved') return false;

    const scheduledDate = parseDate(agendamento?.end || agendamento?.start);
    if (!scheduledDate) return true;

    return scheduledDate.getTime() <= Date.now();
};

const formatReviewCandidateDate = (candidate: ReviewCampaignCandidate) => {
    const date = getReviewExecutionDate(candidate);
    if (!date) return 'Sem data';

    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short'
    }).replace('.', '');
};

const formatReviewSentDate = (sentAt?: string) => {
    const date = parseDate(sentAt);
    if (!date) return null;

    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short'
    }).replace('.', '');
};

const ReviewRequestsPanel: React.FC<{
    candidates: ReviewCampaignCandidate[];
    pendingCount: number;
    copiedKey: string | null;
    onOpenWhatsApp: (candidate: ReviewCampaignCandidate) => void;
    onCopyMessage: (candidate: ReviewCampaignCandidate) => void;
    onMarkSent: (candidate: ReviewCampaignCandidate) => void;
    onOpenApproved: () => void;
}> = ({ candidates, pendingCount, copiedKey, onOpenWhatsApp, onCopyMessage, onMarkSent, onOpenApproved }) => {
    const [isQueueOpen, setIsQueueOpen] = useState(false);

    if (candidates.length === 0) return null;

    const sentCount = candidates.length - pendingCount;
    const mobileCandidates = candidates.slice(0, 3);
    const desktopCandidates = candidates.slice(0, 5);
    const hiddenMobileCount = Math.max(0, candidates.length - mobileCandidates.length);

    return (
        <section className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)] sm:rounded-[var(--radius-panel)] sm:p-4">
            {/* No celular a linha inteira abre/fecha a fila (o botão se estende por cima dela). */}
            <div className={`relative flex items-center justify-between gap-3 border-[var(--border-subtle)] px-3 py-2.5 sm:border-b sm:px-0 sm:pb-3 sm:pt-0 lg:items-center ${isQueueOpen ? 'border-b' : ''}`}>
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 sm:rounded-[var(--radius-control)]">
                        <Star className="h-4 w-4 sm:hidden" aria-hidden="true" />
                        <MessageSquareText className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <p className="ui-kicker hidden sm:block">Avaliações locais</p>
                        <h2 className="truncate text-sm font-semibold leading-tight text-[var(--text-strong)] sm:mt-0.5 sm:text-lg sm:font-bold">
                            Fila de avaliação
                        </h2>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)] sm:hidden">
                            {pendingCount === 0
                                ? 'Todos os pedidos já foram feitos'
                                : `${pendingCount} ${pendingCount === 1 ? 'cliente aprovado' : 'clientes aprovados'} para pedir`}
                        </p>
                        <p className="mt-1 hidden text-xs leading-relaxed text-[var(--text-muted)] sm:block">
                            Clientes aprovados/concluídos no período, com mensagem pronta usando o link do Google.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsQueueOpen((prev) => !prev)}
                    aria-expanded={isQueueOpen}
                    aria-label={isQueueOpen ? 'Recolher fila de avaliação' : 'Expandir fila de avaliação'}
                    className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--text-muted)] after:absolute after:inset-0 after:content-[''] sm:hidden"
                >
                    <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isQueueOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <div className="hidden flex-wrap gap-2 sm:flex">
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                        {pendingCount} para pedir
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        {sentCount} solicitadas
                    </span>
                </div>
            </div>

            <div className={`divide-y divide-[var(--border-subtle)] sm:hidden ${isQueueOpen ? '' : 'hidden'}`}>
                {mobileCandidates.map(candidate => {
                    const phone = normalizeWhatsappPhone(candidate.client.telefone);
                    const sentDate = formatReviewSentDate(candidate.sentAt);
                    const isSent = !!candidate.sentAt;

                    return (
                        <article
                            key={candidate.requestKey}
                            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 ${isSent ? 'opacity-70' : ''}`}
                        >
                            <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${
                                        candidate.sentAt ? 'bg-slate-300 dark:bg-slate-600' : 'bg-emerald-500'
                                    }`} aria-hidden="true" />
                                    <p className="truncate text-[13px] font-bold leading-tight text-[var(--text-strong)]">{candidate.client.nome}</p>
                                </div>
                                <p className="mt-1 truncate pl-4 text-[11px] font-semibold text-[var(--text-muted)]">
                                    {formatReviewCandidateDate(candidate)} · {candidate.pdf.proposalOptionName || 'Serviço aprovado'}
                                </p>
                                {candidate.sentAt ? (
                                    <p className="mt-1 pl-4 text-[10px] font-bold uppercase text-slate-400">
                                        Solicitada{sentDate ? ` ${sentDate}` : ''}
                                    </p>
                                ) : null}
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => onOpenWhatsApp(candidate)}
                                    disabled={!phone}
                                    aria-label={`Abrir WhatsApp de ${candidate.client.nome}`}
                                    title="WhatsApp"
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                        isSent
                                            ? 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                                            : 'border-emerald-500/15 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500 hover:text-white dark:text-emerald-200'
                                    }`}
                                >
                                    <i className="fab fa-whatsapp text-[13px]" aria-hidden="true"></i>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onCopyMessage(candidate)}
                                    aria-label={`Copiar mensagem de avaliação de ${candidate.client.nome}`}
                                    title="Copiar mensagem"
                                    className={`inline-flex h-8 min-w-[72px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-[11px] font-bold transition-colors ${
                                        copiedKey === candidate.requestKey
                                            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                            : isSent
                                                ? 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                                                : 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-strong)]'
                                    }`}
                                >
                                    {copiedKey === candidate.requestKey ? (
                                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                    ) : (
                                        <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
                                    )}
                                    <span>{copiedKey === candidate.requestKey ? 'Copiado' : 'Copiar'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onMarkSent(candidate)}
                                    disabled={isSent}
                                    aria-label={`Marcar pedido de avaliação de ${candidate.client.nome} como feito`}
                                    title={isSent ? 'Avaliação já solicitada' : 'Marcar como feito'}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border transition-colors disabled:cursor-not-allowed ${
                                        isSent
                                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                            : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-strong)]'
                                    }`}
                                >
                                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            </div>
                        </article>
                    );
                })}
                {hiddenMobileCount > 0 ? (
                    <button
                        type="button"
                        onClick={onOpenApproved}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[11px] font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)]"
                    >
                        <span>Mais {hiddenMobileCount} cliente{hiddenMobileCount > 1 ? 's' : ''} na fila</span>
                        <span className="inline-flex items-center gap-1 text-[var(--brand-primary)]">
                            Ver aprovados
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                    </button>
                ) : null}
            </div>

            <div className="mt-3 hidden gap-2 sm:grid lg:grid-cols-2">
                {desktopCandidates.map(candidate => {
                    const phone = normalizeWhatsappPhone(candidate.client.telefone);
                    const sentDate = formatReviewSentDate(candidate.sentAt);

                    return (
                        <article
                            key={candidate.requestKey}
                            className={`rounded-[var(--radius-card)] border p-3 ${
                                candidate.sentAt
                                    ? 'border-slate-200 bg-[var(--surface-muted)] dark:border-slate-800'
                                    : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/15'
                            }`}
                        >
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-[var(--text-strong)]">{candidate.client.nome}</p>
                                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                                        {formatReviewCandidateDate(candidate)} - {candidate.pdf.proposalOptionName || 'Serviço aprovado'}
                                    </p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                    candidate.sentAt
                                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                                        : 'bg-white text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
                                }`}>
                                    {candidate.sentAt ? `Solicitada${sentDate ? ` ${sentDate}` : ''}` : 'Pendente'}
                                </span>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => onOpenWhatsApp(candidate)}
                                    disabled={!phone}
                                    className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-white px-2 text-sm font-bold text-emerald-700 shadow-[var(--shadow-hairline)] transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-900/50 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
                                >
                                    <i className="fab fa-whatsapp text-[12px]" aria-hidden="true"></i>
                                    <span className="truncate">WhatsApp</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onCopyMessage(candidate)}
                                    className={`inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2 text-sm font-bold shadow-[var(--shadow-hairline)] transition-colors ${
                                        copiedKey === candidate.requestKey
                                            ? 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]'
                                            : 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-strong)]'
                                    }`}
                                >
                                    {copiedKey === candidate.requestKey ? (
                                        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    ) : (
                                        <ClipboardCopy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    )}
                                    <span className="truncate">{copiedKey === candidate.requestKey ? 'Copiado' : 'Copiar'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onMarkSent(candidate)}
                                    disabled={!!candidate.sentAt}
                                    aria-label={`Marcar pedido de avaliação de ${candidate.client.nome} como feito`}
                                    title="Marcar como feito"
                                    className="inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-white px-3 text-[var(--text-body)] shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-900/50"
                                >
                                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span className="ml-1.5">Feito</span>
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>

            <div className="mt-3 hidden flex-col gap-2 sm:flex sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                    Dica: marque como feito depois de enviar para não pedir avaliação duplicada.
                </p>
                <ActionButton
                    onClick={onOpenApproved}
                    variant="secondary"
                    size="sm"
                    icon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    className="w-full justify-center sm:w-auto"
                >
                    Ver aprovados
                </ActionButton>
            </div>
        </section>
    );
};

const PDF_STATUS_META = {
    approved: {
        label: 'Aprovado',
        chipClassName: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
        dotClassName: 'bg-emerald-500',
    },
    revised: {
        label: 'Revisão',
        chipClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
        dotClassName: 'bg-amber-500',
    },
    pending: {
        label: 'Pendente',
        chipClassName: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        dotClassName: 'bg-slate-400',
    },
} as const;

// Só para o resumo do grupo na lista: o PDF continua "pendente", mas a validade já passou.
const EXPIRED_GROUP_TONE = {
    label: 'Vencido',
    chipClassName: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300',
    dotClassName: 'bg-rose-500',
} as const;

// Iniciais do avatar da lista, colorido pelo status do grupo.
const GROUP_AVATAR_CLASSNAMES = new Map<object, string>([
    [PDF_STATUS_META.approved, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'],
    [PDF_STATUS_META.revised, 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'],
    [PDF_STATUS_META.pending, 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'],
    [EXPIRED_GROUP_TONE, 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'],
]);

const getClientInitials = (name: string) => {
    const words = name.trim().split(/\s+/).filter(word => /^[\p{L}\d]/u.test(word));
    if (words.length === 0) return '?';
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : (words[0][1] || '');
    return `${first}${last}`.toUpperCase();
};

// "Hoje", "Ontem", "08 out" ou "08 out 2025" (outro ano).
const formatShortDayLabel = (value?: string) => {
    const date = parseDate(value);
    if (!date) return '';
    const today = startOfDay(new Date());
    const day = startOfDay(date);
    if (isSameDay(day, today)) return 'Hoje';
    if (isSameDay(day, addDays(today, -1))) return 'Ontem';
    const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(' de ', ' ').replace('.', '');
    return date.getFullYear() === today.getFullYear() ? label : `${label} ${date.getFullYear()}`;
};

const formatAreaBR = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(2).replace('.', ',')} m²`;

const getHistoryGroupStatus = (pdfs: SavedPDF[]) => {
    const approvedCount = pdfs.filter(p => p.status === 'approved').length;

    if (approvedCount > 0) {
        return {
            text: `${approvedCount} aprovado${approvedCount > 1 ? 's' : ''}`,
            tone: PDF_STATUS_META.approved,
        };
    }

    if (pdfs.some(p => p.status === 'revised')) {
        return {
            text: 'Em revisão',
            tone: PDF_STATUS_META.revised,
        };
    }

    if (pdfs.length > 0 && pdfs.every(isExpiredOpenPdf)) {
        return {
            text: 'Validade vencida',
            tone: EXPIRED_GROUP_TONE,
        };
    }

    return {
        text: 'Aguardando resposta',
        tone: PDF_STATUS_META.pending,
    };
};

const PdfHistoryMobileToolbar: React.FC<{
    totalGroups: number;
    totalPdfs: number;
    filteredCount: number;
    periodLabel: string;
    searchTerm: string;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    onOpenPeriod: () => void;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
}> = ({
    totalGroups,
    totalPdfs,
    filteredCount,
    periodLabel,
    searchTerm,
    searchInputRef,
    onOpenPeriod,
    onSearchChange,
    onClearSearch,
}) => {
    return (
        <section className="space-y-4 sm:hidden">
            <div className="flex items-end justify-between gap-3 px-1 pt-1">
                <div className="min-w-0">
                    <h1 className="truncate text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">
                        Histórico
                    </h1>
                    <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
                        {totalGroups === 0
                            ? 'Nenhum orçamento no período'
                            : `${totalGroups} ${totalGroups === 1 ? 'cliente' : 'clientes'} · ${totalPdfs} ${totalPdfs === 1 ? 'orçamento' : 'orçamentos'}`}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onOpenPeriod}
                    aria-label={`Abrir período do histórico: ${periodLabel}`}
                    title={periodLabel}
                    className="inline-flex h-8 max-w-[55%] shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)]"
                >
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
                    <span className="truncate">{periodLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                </button>
            </div>

            <label className="relative block">
                <span className="sr-only">Buscar no histórico</span>
                <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]"
                    aria-hidden="true"
                />
                <input
                    ref={searchInputRef}
                    type="search"
                    value={searchTerm}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Buscar cliente, valor ou data"
                    autoComplete="off"
                    style={{ fontSize: 16 }}
                    className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] pl-10 pr-10 text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10"
                />
                {searchTerm ? (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                        aria-label="Limpar busca"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                ) : null}
                {searchTerm.trim() ? (
                    <span className="sr-only" aria-live="polite">
                        {filteredCount} de {totalGroups} clientes encontrados
                    </span>
                ) : null}
            </label>
        </section>
    );
};

const PdfHistoryDesktopHeader: React.FC<{
    totalGroups: number;
    filteredCount: number;
    totalPdfs: number;
    totalOpportunities: number;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onOpenTemplates: () => void;
}> = ({
    totalGroups,
    filteredCount,
    totalPdfs,
    totalOpportunities,
    searchTerm,
    onSearchChange,
    onClearSearch,
    onOpenTemplates,
}) => {
    const summary =
        totalGroups === 0
            ? 'Acompanhe cada proposta enviada e mantenha os textos de follow-up sempre prontos.'
            : filteredCount !== totalGroups
              ? `${filteredCount} de ${totalGroups} clientes em foco agora.`
              : `${totalGroups} clientes, ${totalOpportunities} oportunidades e ${totalPdfs} opções organizadas para acompanhamento.`;

    return (
        <section className="hidden sm:block">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold text-[var(--text-strong)]">
                                Histórico
                            </h1>
                            <span className="inline-flex h-7 items-center rounded-full bg-[var(--surface-muted)] px-2.5 text-[11px] font-bold text-[var(--text-muted)]">
                                {totalGroups}
                            </span>
                            {totalGroups > 0 ? (
                                <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 text-[11px] font-bold text-blue-600 dark:text-blue-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                    {filteredCount} visíveis
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                            {summary}
                        </p>
                    </div>

                    <div className="flex w-full items-center gap-2 xl:w-[620px]">
                        <label className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]"
                                aria-hidden="true"
                            />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder="Buscar por cliente, proposta, data ou valor..."
                                className="ui-field h-11 w-full pl-10 pr-9 text-sm font-semibold"
                            />
                            {searchTerm ? (
                                <button
                                    type="button"
                                    onClick={onClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]"
                                    aria-label="Limpar busca"
                                >
                                    <i className="fas fa-times-circle text-[13px]" aria-hidden="true"></i>
                                </button>
                            ) : null}
                        </label>

                        <button
                            type="button"
                            onClick={onOpenTemplates}
                            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 text-xs font-bold text-white shadow-[var(--shadow-hairline)] transition-colors duration-200 hover:bg-[var(--brand-primary-strong)]"
                        >
                            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                            Textos prontos
                        </button>
                    </div>
            </div>
        </section>
    );
};

const HistoryPeriodPicker: React.FC<{
    isOpen: boolean;
    selectedLabel: string;
    rangeLabel: string;
    draftPeriod: HistoryPeriodKey;
    draftStartDate: string;
    draftEndDate: string;
    activeBoundary: 'start' | 'end';
    calendarMonth: Date;
    canShiftPeriod: boolean;
    onOpen: () => void;
    onClose: () => void;
    onSelectPeriod: (period: HistoryPeriodKey) => void;
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
                ? 'cursor-not-allowed text-slate-500 opacity-35'
                : isEdge
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isInRange
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-400/15 dark:text-blue-100'
                        : isCurrentMonth
                            ? 'text-slate-950 hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-slate-800'
                            : 'text-slate-400 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-800'
        ].join(' ');
    };

    return (
        <div className="relative w-full">
            <div className="flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-2 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <span className="hidden min-w-[66px] text-right text-xs font-semibold text-slate-500 dark:text-slate-400 sm:inline">
                    {selectedLabel}
                </span>
                <button
                    type="button"
                    onClick={onOpen}
                    aria-label={`Abrir filtro de data: ${rangeLabel}`}
                    className="flex h-10 min-w-0 flex-1 items-center justify-between gap-3 rounded-[9px] border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                    <span className="truncate">{rangeLabel}</span>
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => onShiftPeriod(-1)}
                    disabled={!canShiftPeriod}
                    aria-label="Período anterior"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => onShiftPeriod(1)}
                    disabled={!canShiftPeriod}
                    aria-label="Próximo período"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
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
                        aria-label="Filtro de data do histórico"
                        className="absolute right-0 top-[calc(100%+10px)] z-50 grid w-[min(920px,calc(100vw-2rem))] grid-cols-1 overflow-hidden rounded-[16px] border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 sm:grid-cols-[260px_minmax(0,1fr)]"
                    >
                        <div className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 sm:border-b-0 sm:border-r">
                            {HISTORY_PERIOD_OPTIONS.map(option => {
                                const isSelected = draftPeriod === option.key;

                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => onSelectPeriod(option.key)}
                                        className={[
                                            'flex min-h-[46px] w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold transition-colors',
                                            isSelected
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-400/15 dark:text-blue-200'
                                                : 'text-slate-900 hover:bg-white dark:text-slate-100 dark:hover:bg-slate-900'
                                        ].join(' ')}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="min-w-0 bg-white dark:bg-slate-900">
                            <div className="flex items-end gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
                                <label className="block min-w-0 flex-1">
                                    <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">Data inicial</span>
                                    <input
                                        type="date"
                                        max={maxDateValue}
                                        value={draftStartDate}
                                        onFocus={() => onChangeActiveBoundary('start')}
                                        onChange={event => onChangeDraftDate('start', event.target.value)}
                                        className={[
                                            'h-10 w-full rounded-[9px] border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50',
                                            activeBoundary === 'start' ? 'border-blue-500 ring-2 ring-blue-500/20' : ''
                                        ].join(' ')}
                                    />
                                </label>
                                <span className="pb-2 text-lg font-semibold text-slate-400">-</span>
                                <label className="block min-w-0 flex-1">
                                    <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">Data final</span>
                                    <input
                                        type="date"
                                        max={maxDateValue}
                                        value={draftEndDate}
                                        onFocus={() => onChangeActiveBoundary('end')}
                                        onChange={event => onChangeDraftDate('end', event.target.value)}
                                        className={[
                                            'h-10 w-full rounded-[9px] border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50',
                                            activeBoundary === 'end' ? 'border-blue-500 ring-2 ring-blue-500/20' : ''
                                        ].join(' ')}
                                    />
                                </label>
                            </div>

                            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => onChangeCalendarMonth(addMonths(calendarMonth, -1))}
                                    aria-label="Mês anterior"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                                >
                                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                </button>
                                <p className="text-sm font-bold tracking-wide text-slate-900 dark:text-slate-50">{formatMonthTitle(calendarMonth)}</p>
                                <button
                                    type="button"
                                    onClick={() => onChangeCalendarMonth(addMonths(calendarMonth, 1))}
                                    aria-label="Próximo mês"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                                >
                                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>

                            <div className="grid grid-cols-7 px-4 pt-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                                    <span key={`${day}-${index}`}>{day}</span>
                                ))}
                            </div>

                            <div className="max-h-[360px] overflow-y-auto px-4 pb-4 pt-2">
                                {months.map(month => (
                                    <div key={month.toISOString()} className="mb-5 last:mb-0">
                                        <p className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">{formatMonthTitle(month)}</p>
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

                            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="h-9 rounded-[9px] px-4 text-sm font-bold text-slate-500 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={onApply}
                                    disabled={!canApply}
                                    className="h-9 rounded-[9px] bg-blue-600 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800"
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

const MobileHistoryPeriodSelector: React.FC<{
    isOpen: boolean;
    selectedPeriod: HistoryPeriodKey;
    customStartDate: string;
    customEndDate: string;
    onClose: () => void;
    onSelectPeriod: (period: HistoryPeriodKey) => void;
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
    }, [customEndDate, customStartDate, isOpen, selectedPeriod]);

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

    const handleSelectPeriod = (nextPeriod: HistoryPeriodKey) => {
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
    const showManualStartError = manualStartDate.length === 10 && (!parsedManualStartDate || !!manualValidation.startError);
    const showManualEndError = manualEndDate.length === 10 && (!parsedManualEndDate || !!manualValidation.endError);
    const manualErrorMessage = manualValidation.startError || manualValidation.endError || 'Data inválida.';

    const getDayClassName = (date: Date, isCurrentMonth: boolean) => {
        const dayTime = startOfDay(date).getTime();
        const rangeStart = currentRange ? startOfDay(currentRange.start).getTime() : null;
        const rangeEnd = currentRange ? startOfDay(currentRange.end).getTime() : null;
        const isFuture = startOfDay(date) > maxSelectableDate;
        const isEdge = (!!currentRange && isSameDay(date, currentRange.start)) || (!!currentRange && isSameDay(date, currentRange.end));
        const isInRange = rangeStart !== null && rangeEnd !== null && dayTime > rangeStart && dayTime < rangeEnd;

        return [
            'flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-medium transition-colors',
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
            aria-label="Filtro de período"
            className="fixed inset-0 z-[90] flex min-h-[100dvh] w-screen flex-col bg-[var(--app-bg)] pt-[env(safe-area-inset-top,0px)] text-[var(--text-strong)] sm:hidden"
        >
            {view === 'list' ? (
                <>
                    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-2">
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar filtro de período"
                            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-muted)]"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <h2 className="text-lg font-semibold">Período</h2>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {HISTORY_MOBILE_PERIOD_OPTIONS.map(option => {
                            const isSelected = selectedPeriod === option.key;

                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => handleSelectPeriod(option.key)}
                                    className={[
                                        'flex min-h-[52px] w-full items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 text-left text-[15px] transition-colors',
                                        isSelected ? 'font-semibold text-[var(--brand-primary)]' : 'text-[var(--text-strong)] hover:bg-[var(--surface-muted)]'
                                    ].join(' ')}
                                >
                                    <span>{option.label}</span>
                                    {isSelected && <Check className="h-5 w-5 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                        <div className="flex h-14 items-center justify-between gap-3 px-2">
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Fechar filtro de período"
                                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-muted)]"
                            >
                                <X className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                onClick={onApplyCustom}
                                disabled={!canApplyCustom}
                                className="h-9 rounded-lg px-3 text-[15px] font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--text-soft)]"
                            >
                                Salvar
                            </button>
                        </div>
                        <div className="px-4 pb-4">
                            <p className="text-xs font-semibold text-[var(--text-muted)]">Personalizado</p>
                            <div className="mt-1 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={handleOpenManualDates}
                                    aria-label="Editar datas manualmente"
                                    className="min-w-0 text-left text-xl font-semibold leading-tight text-[var(--text-strong)]"
                                >
                                    {formatMobileRangeLabel(currentRange)}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenManualDates}
                                    aria-label="Editar datas manualmente"
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                >
                                    <Pencil className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 border-t border-[var(--border-subtle)] px-3 py-2 text-center text-xs font-semibold text-[var(--text-muted)]">
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
                                className="mb-6 last:mb-0 scroll-mt-3"
                            >
                                <p className="mb-2 px-2 text-sm font-semibold text-[var(--text-muted)]">
                                    {formatLongMonthTitle(month)}
                                </p>
                                <div className="grid grid-cols-7 justify-items-center gap-y-1">
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
                                    <p className="text-xs font-semibold text-[var(--text-muted)]">Personalizado</p>
                                    <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-strong)]">
                                        {manualPreviewLabel}
                                    </p>
                                </div>
                                <CalendarDays className="h-6 w-6 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
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
                                        'ui-field h-12 w-full px-3 text-base font-semibold',
                                        showManualStartError ? 'border-red-400 text-red-500 ring-2 ring-red-500/20 dark:border-red-400 dark:text-red-200' : ''
                                    ].join(' ')}
                                />
                                {showManualStartError && (
                                    <span className="mt-1 block text-xs font-bold text-red-500 dark:text-red-300">
                                        {manualErrorMessage}
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
                                        'ui-field h-12 w-full px-3 text-base font-semibold',
                                        showManualEndError ? 'border-red-400 text-red-500 ring-2 ring-red-500/20 dark:border-red-400 dark:text-red-200' : ''
                                    ].join(' ')}
                                />
                                {showManualEndError && (
                                    <span className="mt-1 block text-xs font-bold text-red-500 dark:text-red-300">
                                        {manualErrorMessage}
                                    </span>
                                )}
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
                            <button
                                type="button"
                                onClick={() => setIsManualOpen(false)}
                                className="h-9 rounded-lg px-3 text-sm font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmManualDates}
                                disabled={!manualValidation.range}
                                className="h-9 rounded-lg px-3 text-sm font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--text-soft)]"
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

const HistoryStatusFilters: React.FC<{
    activeFilter: HistoryFocusFilter;
    counts: Record<HistoryFocusFilter, number>;
    onChange: (filter: HistoryFocusFilter) => void;
}> = ({ activeFilter, counts, onChange }) => {
    const filters: { key: HistoryFocusFilter; label: string }[] = [
        { key: 'all', label: 'Todos' },
        { key: 'pending', label: 'Pendentes' },
        { key: 'approved', label: 'Aprovados' },
        { key: 'revised', label: HISTORY_FOCUS_FILTER_LABELS.revised },
        { key: 'expired', label: 'Vencidos' },
        { key: 'expenses', label: 'Com gastos' }
    ];

    // Mesmo formato dos filtros da tela de Clientes.
    return (
        <div className="-mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 pb-0.5 text-xs font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Filtrar por status">
            {filters.map(filter => {
                const isActive = activeFilter === filter.key;
                // No celular, filtros sem nenhum orçamento só ocupariam espaço.
                const isEmptyOnMobile = !isActive && filter.key !== 'all' && !counts[filter.key];

                return (
                    <button
                        key={filter.key}
                        type="button"
                        aria-label={`${filter.label}: ${counts[filter.key] || 0}`}
                        aria-pressed={isActive}
                        onClick={() => onChange(filter.key)}
                        className={[
                            'h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors',
                            isEmptyOnMobile ? 'hidden sm:inline-flex' : 'inline-flex',
                            isActive
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:border-[var(--border-strong)]'
                        ].join(' ')}
                    >
                        {filter.label}
                        <span className={`tabular-nums ${isActive ? 'text-white/80' : 'opacity-70'}`}>
                            {counts[filter.key] || 0}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

const HISTORY_SORT_ORDER = Object.keys(HISTORY_SORT_LABELS) as HistorySortKey[];

const HistoryListToolbar: React.FC<{
    count: number;
    total: number;
    sort: HistorySortKey;
    onSortChange: (sort: HistorySortKey) => void;
}> = ({ count, total, sort, onSortChange }) => (
    <div className="flex items-center justify-between gap-3 px-1 sm:items-end sm:px-0">
        {/* Celular: igual à tela de Clientes, um toque troca a ordem */}
        <button
            type="button"
            onClick={() => onSortChange(HISTORY_SORT_ORDER[(HISTORY_SORT_ORDER.indexOf(sort) + 1) % HISTORY_SORT_ORDER.length])}
            aria-label={`Ordem: ${HISTORY_SORT_LABELS[sort]}. Toque para mudar`}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] sm:hidden"
        >
            <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
            Ordem: <span className="font-semibold text-[var(--text-body)]">{HISTORY_SORT_LABELS[sort].toLowerCase()}</span>
        </button>
        {count !== total ? (
            <span className="text-xs text-[var(--text-muted)] sm:hidden">{count} de {total}</span>
        ) : null}
        <div className="hidden min-w-0 sm:block">
            <p className="ui-kicker">Propostas</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-[var(--text-muted)]">
                {count} {count === 1 ? 'cliente encontrado' : 'clientes encontrados'}
            </p>
        </div>
        <label className="relative hidden shrink-0 sm:block">
            <span className="sr-only">Ordenar histórico</span>
            <select
                value={sort}
                onChange={(event) => onSortChange(event.target.value as HistorySortKey)}
                aria-label="Ordenar histórico"
                className="h-10 appearance-none rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] pl-3 pr-8 text-xs font-bold text-[var(--text-strong)] shadow-[var(--shadow-hairline)] outline-none transition-colors focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10"
            >
                {(Object.keys(HISTORY_SORT_LABELS) as HistorySortKey[]).map(key => (
                    <option key={key} value={key}>{HISTORY_SORT_LABELS[key]}</option>
                ))}
            </select>
            <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
            />
        </label>
    </div>
);

const MonthlyExpenseSummaryCard: React.FC<{
    selectedSummary: MonthlyExpenseSummary | null;
    periodControl: React.ReactNode;
    onCopySummary: () => void;
    isExpanded: boolean;
    onToggleExpanded: () => void;
}> = ({
    selectedSummary,
    periodControl,
    onCopySummary,
    isExpanded,
    onToggleExpanded,
}) => {
    // No mobile o detalhe abre em modal de tela cheia; trava o scroll do body enquanto aberto.
    useEffect(() => {
        if (!isExpanded) return;
        const isMobile = typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches;
        if (!isMobile) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, [isExpanded]);

    if (!selectedSummary) return null;

    const hasCategoryExpenses = selectedSummary.expensesByCategory.length > 0;
    const resultTone = selectedSummary.estimatedProfit >= 0
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-rose-700 dark:text-rose-300';
    const statCards = [
        {
            label: 'Pipeline real',
            value: formatNumberBR(selectedSummary.totalRevenue),
            hint: `${selectedSummary.opportunityCount} oportunidade${selectedSummary.opportunityCount === 1 ? '' : 's'}`,
            icon: CircleDollarSign,
            tone: 'text-blue-600 dark:text-blue-300 bg-blue-500/10'
        },
        {
            label: 'Apresentado',
            value: formatNumberBR(selectedSummary.presentedRevenue),
            hint: selectedSummary.duplicatedRevenue > 0
                ? `${formatNumberBR(selectedSummary.duplicatedRevenue)} em alternativas`
                : `${selectedSummary.pdfCount} opções`,
            icon: BarChart3,
            tone: 'text-cyan-600 dark:text-cyan-300 bg-cyan-500/10'
        },
        {
            label: 'Gastos',
            value: formatNumberBR(selectedSummary.operationalExpenses),
            hint: hasCategoryExpenses ? `${selectedSummary.expensesByCategory.length} categorias` : 'Sem gastos manuais',
            icon: ReceiptText,
            tone: 'text-amber-600 dark:text-amber-300 bg-amber-500/10'
        },
        {
            label: 'Custo estimado',
            value: formatNumberBR(selectedSummary.estimatedTotalCost),
            hint: 'Material e operação',
            icon: FileText,
            tone: 'text-slate-600 dark:text-slate-300 bg-slate-500/10'
        },
        {
            label: 'Resultado',
            value: formatNumberBR(selectedSummary.estimatedProfit),
            hint: formatPercentageBR(selectedSummary.estimatedMarginPercentage),
            icon: TrendingUp,
            tone: selectedSummary.estimatedProfit >= 0
                ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10'
                : 'text-rose-600 dark:text-rose-300 bg-rose-500/10'
        }
    ];
    const compactStats = [
        {
            label: 'Pipeline',
            value: formatNumberBR(selectedSummary.totalRevenue)
        },
        {
            label: 'Aprovados',
            value: String(selectedSummary.approvedCount)
        },
        {
            label: 'Resultado',
            value: formatNumberBR(selectedSummary.estimatedProfit),
            className: resultTone
        }
    ];
    // Celular: mesmo cartão de números das telas de Estoque e Propostas.
    const mobileStats = [
        {
            label: 'Pipeline',
            value: formatCompactCurrencyBR(selectedSummary.totalRevenue),
            detail: `${selectedSummary.opportunityCount} ${selectedSummary.opportunityCount === 1 ? 'oportunidade' : 'oportunidades'}`
        },
        {
            label: 'Aprovados',
            value: String(selectedSummary.approvedCount),
            detail: selectedSummary.approvedCount === 1 ? 'orçamento' : 'orçamentos'
        },
        {
            label: 'Resultado',
            value: formatCompactCurrencyBR(selectedSummary.estimatedProfit),
            detail: `margem ${formatPercentageBR(selectedSummary.estimatedMarginPercentage)}`,
            className: resultTone
        }
    ];
    const summaryHeader = (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="ui-kicker">Resumo do período</span>
                    <span className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-muted)]">
                        {selectedSummary.opportunityCount} oportunidade{selectedSummary.opportunityCount === 1 ? '' : 's'}
                    </span>
                </div>
                <div className="mt-3 grid max-w-[560px] grid-cols-3 gap-2">
                    {compactStats.map(stat => (
                        <div key={stat.label} className="min-w-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
                            <p className="truncate text-[10px] font-bold uppercase text-[var(--text-soft)]">{stat.label}</p>
                            <p className={`mt-1 truncate text-base font-bold text-[var(--text-strong)] ${stat.className || ''}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="hidden flex-col gap-2 sm:flex sm:flex-row sm:items-center xl:justify-end">
                <div className="hidden sm:block">
                    {periodControl}
                </div>
                <ActionButton
                    onClick={onToggleExpanded}
                    variant="secondary"
                    size="sm"
                    icon={isExpanded ? <ChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                    className="w-full justify-center sm:w-auto"
                >
                    {isExpanded ? 'Recolher indicadores' : 'Ver indicadores'}
                </ActionButton>
            </div>
        </div>
    );

    const expandedDetails = (
            <div className="space-y-3">
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
                {statCards.map(({ label, value, hint, icon: Icon, tone }) => (
                    <div key={label} className="ui-card p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] ${tone}`}>
                                <Icon className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <span className="text-right text-[11px] font-semibold text-[var(--text-muted)]">
                                {label}
                            </span>
                        </div>
                        <p className="mt-2 truncate text-lg font-semibold tabular-nums tracking-[-0.01em] text-[var(--text-strong)] sm:text-xl">
                            {value}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                            {hint}
                        </p>
                    </div>
                ))}
            </div>

            <div className="ui-card grid overflow-visible lg:grid-cols-[minmax(0,1fr)_390px]">
                <div className="border-b border-[var(--border-subtle)] p-4 sm:p-5 lg:border-b-0 lg:border-r">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                        Interno
                    </span>
                    <h3 className="mt-2 text-base font-semibold text-[var(--text-strong)]">
                        Fechamento de gastos
                    </h3>
                    <p className="mt-1 max-w-[34rem] text-sm leading-6 text-[var(--text-muted)]">
                        Pipeline real conta uma opção por oportunidade. Alternativas continuam registradas.
                    </p>

                    <div className="mt-5 grid gap-2">
                        <button
                            type="button"
                            onClick={onCopySummary}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-emerald-600 px-3 text-sm font-semibold text-white shadow-[var(--shadow-hairline)] transition-colors duration-200 hover:bg-emerald-500"
                        >
                            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                            Copiar resumo
                        </button>
                    </div>
                </div>

                <div className="min-w-0">
                    {false && (
                    <dl className="hidden">
                        <div className="border-b border-r border-slate-100 p-4 dark:border-slate-800 md:border-b-0">
                            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                Pipeline real
                            </dt>
                            <dd className="mt-1 text-base font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                                {formatNumberBR(selectedSummary.totalRevenue)}
                            </dd>
                        </div>
                        <div className="border-b border-r border-slate-100 p-4 dark:border-slate-800 md:border-b-0">
                            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                Apresentado
                            </dt>
                            <dd className="mt-1 text-base font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                                {formatNumberBR(selectedSummary.presentedRevenue)}
                            </dd>
                            {selectedSummary.duplicatedRevenue > 0 ? (
                                <dd className="mt-0.5 text-[11px] font-semibold text-blue-500 dark:text-blue-300">
                                    {formatNumberBR(selectedSummary.duplicatedRevenue)} em alternativas
                                </dd>
                            ) : null}
                        </div>
                        <div className="border-b border-slate-100 p-4 dark:border-slate-800 md:border-b-0 md:border-r">
                            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                Gastos lançados
                            </dt>
                            <dd className="mt-1 text-base font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                                {formatNumberBR(selectedSummary.operationalExpenses)}
                            </dd>
                        </div>
                        <div className="border-r border-slate-100 p-4 dark:border-slate-800">
                            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                Custo estimado
                            </dt>
                            <dd className="mt-1 text-base font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                                {formatNumberBR(selectedSummary.estimatedTotalCost)}
                            </dd>
                        </div>
                        <div className="p-4">
                            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                Resultado
                            </dt>
                            <dd className={`mt-1 text-base font-semibold tracking-[-0.03em] ${resultTone}`}>
                                {formatNumberBR(selectedSummary.estimatedProfit)}
                            </dd>
                            <dd className="mt-0.5 text-[11px] font-semibold text-slate-400">
                                {formatPercentageBR(selectedSummary.estimatedMarginPercentage)}
                            </dd>
                        </div>
                    </dl>
                    )}

                    <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_auto] md:items-end">
                        <div className="min-w-0">
                            <p className="ui-kicker">
                                Por categoria
                            </p>
                            {hasCategoryExpenses ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {selectedSummary.expensesByCategory.map(item => (
                                        <span
                                            key={item.category}
                                            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-muted)]"
                                        >
                                            <span>{item.label}</span>
                                            <span className="text-[var(--text-strong)]">{formatNumberBR(item.total)}</span>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">
                                    Nenhum gasto manual lançado neste período.
                                </p>
                            )}
                        </div>

                        <p className="rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-bold text-[var(--text-muted)] md:text-right">
                            {selectedSummary.opportunityCount} oportunidade{selectedSummary.opportunityCount > 1 ? 's' : ''} / {selectedSummary.pdfCount} {selectedSummary.pdfCount === 1 ? 'opção' : 'opções'}
                            {selectedSummary.approvedCount > 0 ? ` / ${selectedSummary.approvedCount} aprovado${selectedSummary.approvedCount > 1 ? 's' : ''}` : ''}
                        </p>
                    </div>
                </div>
            </div>
            </div>
    );

    return (
        <section className="space-y-3 overflow-visible">
            <button
                type="button"
                onClick={onToggleExpanded}
                aria-label="Resumo do período: ver detalhes"
                className="block w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] text-left sm:hidden"
            >
                <span className="grid grid-cols-3 divide-x divide-[var(--border-subtle)]">
                    {mobileStats.map(stat => (
                        <span key={stat.label} className="block min-w-0 px-2 py-3 text-center">
                            <span className="block truncate text-[11px] text-[var(--text-muted)]">{stat.label}</span>
                            <span className={`mt-0.5 block truncate text-lg font-semibold tabular-nums tracking-[-0.01em] text-[var(--text-strong)] ${stat.className || ''}`}>{stat.value}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{stat.detail}</span>
                        </span>
                    ))}
                </span>
                <span className="flex items-center justify-center gap-1 border-t border-[var(--border-subtle)] py-2 text-xs font-semibold text-[var(--brand-primary)]">
                    Ver resumo do período
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
            </button>
            <div className="ui-card hidden overflow-visible p-4 sm:block">
                {summaryHeader}
            </div>

            {isExpanded ? (
                <div className="hidden sm:block sm:space-y-3">
                    {expandedDetails}
                </div>
            ) : null}

            {isExpanded ? createPortal(
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Resumo do período"
                    className="fixed inset-0 z-[60] flex flex-col bg-[var(--app-bg)] pt-[env(safe-area-inset-top,0px)] sm:hidden"
                >
                    {/* Mesmo cabeçalho da tela do cliente */}
                    <header className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-2">
                        <button
                            type="button"
                            onClick={onToggleExpanded}
                            aria-label="Fechar resumo do período"
                            className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-[var(--surface-muted)] dark:text-slate-300"
                        >
                            <i className="fas fa-arrow-left text-base" aria-hidden="true"></i>
                        </button>
                        <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold leading-tight text-[var(--text-strong)]">Resumo do período</p>
                            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                                {selectedSummary.opportunityCount} oportunidade{selectedSummary.opportunityCount === 1 ? '' : 's'}
                            </p>
                        </div>
                    </header>
                    <div className="flex-1 overflow-y-auto px-3 pb-6 pt-3">
                        {expandedDetails}
                    </div>
                </div>,
                document.body
            ) : null}
        </section>
    );
};

type HistoryPdfStatus = NonNullable<SavedPDF['status']>;

const HistoryMenuItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    hint?: string;
    tone?: 'default' | 'danger';
    onClick: () => void;
}> = ({ icon, label, hint, tone = 'default', onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
            tone === 'danger'
                ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30'
                : 'text-[var(--text-strong)] hover:bg-[var(--surface-muted)]'
        }`}
    >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone === 'danger' ? 'bg-rose-50 dark:bg-rose-950/40' : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'}`}>
            {icon}
        </span>
        <span className="min-w-0">
            <span className="block text-sm font-semibold">{label}</span>
            {hint ? <span className="block truncate text-xs text-[var(--text-muted)]">{hint}</span> : null}
        </span>
    </button>
);

const HistoryActionSheet: React.FC<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ isOpen, title, subtitle, onClose, children }) => {
    const isMobile = useIsMobile();

    useEffect(() => {
        if (!isOpen || isMobile) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMobile, isOpen, onClose]);

    const header = (
        <div className="min-w-0 px-2">
            <p className="truncate text-lg font-bold leading-tight text-[var(--text-strong)]">{title}</p>
            {subtitle ? <p className="mt-0.5 truncate text-xs font-semibold text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>
    );

    if (isMobile) {
        return (
            <Drawer.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[10020] bg-slate-950/50" />
                    <Drawer.Content
                        aria-describedby={undefined}
                        className="fixed bottom-0 left-0 right-0 z-[10021] flex max-h-[85dvh] flex-col rounded-t-[20px] border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none"
                    >
                        <div className="overflow-y-auto overscroll-contain px-3 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <Drawer.Title asChild>{header}</Drawer.Title>
                            <div className="mt-2 space-y-1">{children}</div>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        );
    }

    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/50 p-4">
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar ações" onClick={onClose} />
            <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-sm rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-2xl">
                <div className="flex items-start justify-between gap-2">
                    {header}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
                <div className="mt-2 space-y-1">{children}</div>
            </div>
        </div>,
        document.body
    );
};

const PdfHistoryItem: React.FC<{
    pdf: SavedPDF;
    client: Client;
    agendamento: Agendamento | undefined;
    onDownload: (pdf: SavedPDF, filename: string) => void;
    onDelete: (id: number) => void;
    onUpdateStatus: (id: number, status: SavedPDF['status']) => Promise<void> | void;
    onRenamePdfOption: (id: number, name: string) => Promise<void>;
    onSchedule: (info: { pdf: SavedPDF; agendamento?: Agendamento } | { agendamento: Agendamento; pdf?: SavedPDF }) => void;
    films: Film[];
    messageTemplates: string[];
    onOpenInAgenda: (agendamento: Agendamento) => void;
    googleReviewsLink?: string;
    isSelected: boolean;
    onToggleSelect: (id: number) => void;
    onNavigateToOption: (clientId: number, optionId: number) => void;
    isFunnelReference: boolean;
    canChooseFunnelReference: boolean;
    onSetFunnelReference: (pdf: SavedPDF) => void;
    onShare: (client: Client, pdf: SavedPDF, messages?: string[]) => void;
    fitContent?: boolean;
    selectable?: boolean;
}> = React.memo(({ pdf, client, agendamento, onDownload, onDelete, onUpdateStatus, onRenamePdfOption, onSchedule, onOpenInAgenda, films, messageTemplates, googleReviewsLink, isSelected, onToggleSelect, onNavigateToOption, isFunnelReference, canChooseFunnelReference, onSetFunnelReference, onShare, fitContent = false, selectable = true }) => {
    const { showToast } = useFeedback();
    const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null);
    const [whatsAppMessage, setWhatsAppMessage] = useState<string | null>(null);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameDraft, setRenameDraft] = useState('');
    const [renameError, setRenameError] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState<{ status: HistoryPdfStatus } | null>(null);
    const [isActionsOpen, setIsActionsOpen] = useState(false);
    const activeStatus = pendingStatusChange?.status || pdf.status || 'pending';
    const isUpdatingStatus = pendingStatusChange !== null;

    const handleOpenRenameModal = () => {
        setRenameDraft(pdf.proposalOptionName?.trim() || '');
        setRenameError('');
        setIsRenameModalOpen(true);
    };

    const handleCloseRenameModal = () => {
        if (isRenaming) return;
        setIsRenameModalOpen(false);
        setRenameError('');
    };

    const handleRenamePdfOption = async () => {
        if (!pdf.id || isRenaming) return;

        const normalizedName = renameDraft.trim().replace(/\s+/g, ' ');
        if (!normalizedName) {
            setRenameError('Digite um nome para identificar esta opção.');
            return;
        }

        if (normalizedName === pdf.proposalOptionName?.trim()) {
            setIsRenameModalOpen(false);
            return;
        }

        setIsRenaming(true);
        setRenameError('');
        try {
            await onRenamePdfOption(pdf.id, normalizedName);
            setIsRenameModalOpen(false);
            showToast('Nome atualizado no PDF e na página do cliente.', {
                tone: 'success',
                duration: 3200,
            });
        } catch (error) {
            console.error('Erro ao renomear opção do histórico:', error);
            setRenameError('Não foi possível salvar o novo nome. Tente novamente.');
        } finally {
            setIsRenaming(false);
        }
    };

    const handleStatusChange = async (status: HistoryPdfStatus) => {
        if (isUpdatingStatus || !pdf.id) return;

        setPendingStatusChange({ status });
        try {
            await onUpdateStatus(pdf.id, status);
        } finally {
            setPendingStatusChange(null);
        }
    };

    const expirationDate = pdf.expirationDate ? new Date(pdf.expirationDate) : null;
    const isExpired = isExpiredOpenPdf({ ...pdf, status: activeStatus });
    const persuasiveMessages = useMemo(() => {
        const context = buildPdfMessageContext(pdf, client.nome, films);
        return messageTemplates.map(template => renderPdfMessageTemplate(template, context));
    }, [pdf, client.nome, films, messageTemplates]);
    const readyMessageOverrideKey = useMemo(() => getReadyMessageOverrideKey(pdf), [pdf.id, pdf.clienteId, pdf.nomeArquivo, pdf.date]);
    const [editableMessages, setEditableMessages] = useState<string[]>(() => (
        readReadyMessageOverrides(readyMessageOverrideKey) || persuasiveMessages
    ));
    const reviewFollowUpMessage = useMemo(() => {
        if (activeStatus !== 'approved') return '';
        return buildReviewFollowUpMessage(pdf, client, googleReviewsLink);
    }, [activeStatus, pdf, client, googleReviewsLink]);
    const normalizedPhone = useMemo(() => normalizeWhatsappPhone(client.telefone), [client.telefone]);

    useEffect(() => {
        setEditableMessages(readReadyMessageOverrides(readyMessageOverrideKey) || persuasiveMessages);
    }, [readyMessageOverrideKey, persuasiveMessages]);

    const handleCopyMessage = useCallback(async (message: string, key: string) => {
        const isReviewMessage = key === 'review-follow-up';
        const successMessage = isReviewMessage ? 'Mensagem de avaliação copiada.' : 'Mensagem de orçamento copiada.';
        const errorMessage = isReviewMessage ? 'Não foi possível copiar a mensagem de avaliação agora.' : 'Não foi possível copiar a mensagem de orçamento agora.';

        try {
            const copied = await copyTextWithFallback(message);
            if (!copied) {
                throw new Error('Falha ao copiar texto');
            }
            setCopiedMessageKey(key);
            showToast(successMessage, {
                tone: 'success',
                duration: 2200,
            });
            window.setTimeout(() => {
                setCopiedMessageKey(current => current === key ? null : current);
            }, 1800);
        } catch (error) {
            console.error('Erro ao copiar mensagem do orçamento:', error);
            showToast(errorMessage, {
                tone: 'error',
            });
        }
    }, [showToast]);

    const handleOpenWhatsApp = useCallback((message: string) => {
        if (!normalizedPhone) {
            showToast('Esse cliente ainda não tem um telefone válido para abrir no WhatsApp.', {
                tone: 'warning',
            });
            return;
        }

        setWhatsAppMessage(message);
    }, [normalizedPhone, showToast]);

    const optionLabel = pdf.proposalOptionName?.trim() || 'Orçamento';
    const createdAt = new Date(pdf.date);
    const createdAtLabel = `${formatShortDayLabel(pdf.date)}, ${createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    // Medidas ficam em metros (ex.: "1,20" x "2,10").
    const filmAreas = useMemo(() => {
        const filmMap = new Map<string, number>();
        (pdf.measurements || []).forEach(m => {
            if (!m.pelicula) return;
            const m2 = parseFloat(String(m.largura).replace(',', '.')) * parseFloat(String(m.altura).replace(',', '.')) * (m.quantidade || 1);
            filmMap.set(m.pelicula, (filmMap.get(m.pelicula) || 0) + (Number.isFinite(m2) ? m2 : 0));
        });
        return Array.from(filmMap.entries());
    }, [pdf.measurements]);
    // Película só vale mostrar quando não repete o nome da opção.
    const filmSummary = filmAreas.length === 1 && normalizeSearchText(filmAreas[0][0]) === normalizeSearchText(optionLabel)
        ? ''
        : filmAreas.map(([nome]) => nome).join(', ');
    const statusBadge = activeStatus === 'approved'
        ? { label: 'Aprovado', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', dot: 'bg-emerald-500' }
        : activeStatus === 'revised'
            ? { label: 'Em revisão', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', dot: 'bg-amber-500' }
            : isExpired
                ? { label: 'Vencido', className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300', dot: 'bg-rose-500' }
                : { label: 'Pendente', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' };
    const isApproved = activeStatus === 'approved';
    const scheduleLabel = agendamento
        ? new Date(agendamento.start).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(' de ', ' ').replace('.', '')
        : '';
    const closeActions = useCallback(() => setIsActionsOpen(false), []);
    const runMenuAction = (action: () => void) => {
        action();
        setIsActionsOpen(false);
    };
    const actionButtonClassName = 'flex h-11 min-w-0 items-center justify-center gap-1.5 px-2 text-[13px] font-semibold transition-colors disabled:cursor-wait';

    return (
        <article className={`relative overflow-hidden rounded-2xl border bg-[var(--surface-raised)] transition-shadow ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-[var(--border-subtle)] shadow-[var(--shadow-hairline)]'} ${fitContent ? '' : 'h-full'}`}>
            <div className="p-3.5 sm:p-4">
                {/* Nome, data, status e menu */}
                <div className="flex items-start gap-3">
                    {selectable ? (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(pdf.id!)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border-slate-300 text-blue-600 focus:ring-blue-500"
                            aria-label={`Selecionar orçamento ${pdf.proposalOptionName || pdf.nomeArquivo}`}
                            title="Selecionar para criar um link, gerar PDF combinado ou excluir em massa"
                        />
                    ) : null}
                    <div className="min-w-0 flex-1">
                        {pdf.proposalOptionId ? (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onNavigateToOption(pdf.clienteId, pdf.proposalOptionId!); }}
                                className="block max-w-full truncate text-left text-[15px] font-semibold leading-tight text-[var(--text-strong)] transition-colors hover:text-[var(--brand-primary)]"
                                title="Abrir esta opção no orçamento"
                            >
                                {optionLabel}
                            </button>
                        ) : (
                            <p className="truncate text-[15px] font-semibold leading-tight text-[var(--text-strong)]">
                                {optionLabel}
                            </p>
                        )}
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{createdAtLabel}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot}`} aria-hidden="true" />
                        {statusBadge.label}
                    </span>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            setIsActionsOpen(true);
                        }}
                        className="-mr-2 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                        aria-label={`Mais ações de ${optionLabel}`}
                        title="Revisão, renomear, baixar, excluir..."
                    >
                        <MoreVertical className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>
                </div>

                {/* Valor e detalhes */}
                <div className={`mt-3 ${selectable ? 'pl-8' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                        <p className={`text-xl font-semibold tabular-nums tracking-[-0.01em] ${isApproved ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-strong)]'}`}>
                            {formatNumberBR(pdf.totalPreco)}
                        </p>
                        {isFunnelReference && canChooseFunnelReference ? (
                            <span
                                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-primary)] dark:border-blue-900/60"
                                title="É esta opção que conta no pipeline deste atendimento."
                            >
                                <Target className="h-3 w-3" aria-hidden="true" />
                                Valor principal
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                        <span className="tabular-nums">{formatAreaBR(pdf.totalM2)}</span>
                        {expirationDate && !isApproved ? (
                            <>
                                <span aria-hidden="true"> · </span>
                                <span className={isExpired ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>
                                    {isExpired ? 'Validade vencida' : `Vence ${expirationDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                                </span>
                            </>
                        ) : null}
                        {filmSummary ? (
                            <>
                                <span aria-hidden="true"> · </span>
                                <span className="text-[var(--text-body)]">{filmSummary}</span>
                            </>
                        ) : null}
                    </p>
                </div>

                {pdf.archivedAt || agendamento ? (
                    <div className={`mt-2.5 space-y-1 text-xs text-[var(--text-muted)] ${selectable ? 'pl-8' : ''}`}>
                        {pdf.archivedAt ? (
                            <p title="O arquivo foi removido para economizar espaço. O PDF é gerado novamente ao baixar.">
                                PDF arquivado · gerado de novo ao baixar
                            </p>
                        ) : null}
                        {agendamento ? (
                            <p className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
                                <span className="min-w-0 truncate">
                                    Agendado para <span className="font-semibold text-[var(--text-body)]">{scheduleLabel}</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onOpenInAgenda(agendamento);
                                    }}
                                    aria-label="Abrir agendamento na agenda"
                                    title="Abrir na agenda"
                                    className="shrink-0 font-semibold text-[var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                    Ver na agenda
                                </button>
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {reviewFollowUpMessage ? (
                <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-3.5 py-2.5 sm:px-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                        <Star className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[var(--text-strong)]">Pedir avaliação no Google</p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">Mensagem pronta para depois da instalação</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleOpenWhatsApp(reviewFollowUpMessage)}
                        aria-label="Enviar pedido de avaliação pelo WhatsApp"
                        title="Enviar pelo WhatsApp"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                        <i className="fab fa-whatsapp text-[17px]" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleCopyMessage(reviewFollowUpMessage, 'review-follow-up')}
                        aria-label="Copiar pedido de avaliação"
                        title="Copiar mensagem"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                    >
                        {copiedMessageKey === 'review-follow-up'
                            ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                            : <ClipboardCopy className="h-4 w-4" aria-hidden="true" />}
                    </button>
                </div>
            ) : null}

            {/* Ações: uma barra fina, como nos apps de gestão */}
            <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        void handleStatusChange(isApproved ? 'pending' : 'approved');
                    }}
                    aria-pressed={isApproved}
                    aria-busy={isUpdatingStatus}
                    disabled={isUpdatingStatus}
                    title={isApproved ? 'Toque para voltar para pendente' : 'Marcar como aprovado pelo cliente'}
                    className={`${actionButtonClassName} ${isApproved ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'text-[var(--text-body)] hover:bg-[var(--surface-muted)]'}`}
                >
                    {isUpdatingStatus
                        ? <i className="fas fa-circle-notch animate-spin text-[11px]" aria-hidden="true" />
                        : <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    <span className="truncate">
                        {isUpdatingStatus
                            ? pendingStatusChange?.status === 'approved' ? 'Aprovando...' : 'Salvando...'
                            : isApproved ? 'Aprovado' : 'Aprovar'}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onSchedule(agendamento ? { pdf, agendamento } : { pdf });
                    }}
                    className={`${actionButtonClassName} text-[var(--text-body)] hover:bg-[var(--surface-muted)]`}
                >
                    <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{agendamento ? 'Reagendar' : 'Agendar'}</span>
                </button>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onShare(client, pdf, editableMessages);
                    }}
                    className={`${actionButtonClassName} text-[var(--brand-primary)] hover:bg-blue-50 dark:hover:bg-blue-950/30`}
                >
                    <i className="fab fa-whatsapp text-[15px]" aria-hidden="true" />
                    <span className="truncate">Enviar</span>
                </button>
            </div>
            {isUpdatingStatus ? (
                <span className="sr-only" role="status" aria-live="polite">
                    Salvando status do orçamento
                </span>
            ) : null}

            <HistoryActionSheet
                isOpen={isActionsOpen}
                onClose={closeActions}
                title={optionLabel}
                subtitle={`${client.nome} · ${formatNumberBR(pdf.totalPreco)}`}
            >
                    {activeStatus !== 'approved' ? (
                        <HistoryMenuItem
                            icon={<Eye className="h-4 w-4" aria-hidden="true" />}
                            label={activeStatus === 'revised' ? 'Tirar da revisão' : 'Marcar em revisão'}
                            hint={activeStatus === 'revised' ? 'Volta para pendente' : 'O cliente pediu ajustes nesta opção'}
                            onClick={() => runMenuAction(() => { void handleStatusChange(activeStatus === 'revised' ? 'pending' : 'revised'); })}
                        />
                    ) : null}
                    <HistoryMenuItem
                        icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                        label="Renomear opção"
                        hint="Muda o nome no PDF e na página do cliente"
                        onClick={() => runMenuAction(handleOpenRenameModal)}
                    />
                    <HistoryMenuItem
                        icon={<Download className="h-4 w-4" aria-hidden="true" />}
                        label="Baixar PDF"
                        onClick={() => runMenuAction(() => onDownload(pdf, pdf.nomeArquivo))}
                    />
                    {canChooseFunnelReference && !isFunnelReference ? (
                        <HistoryMenuItem
                            icon={<Target className="h-4 w-4" aria-hidden="true" />}
                            label="Usar como valor principal"
                            hint="Esta opção passa a contar no pipeline do atendimento"
                            onClick={() => runMenuAction(() => onSetFunnelReference(pdf))}
                        />
                    ) : null}
                    <HistoryMenuItem
                        icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                        label="Excluir orçamento"
                        tone="danger"
                        onClick={() => runMenuAction(() => onDelete(pdf.id!))}
                    />
            </HistoryActionSheet>
            <Modal
                isOpen={isRenameModalOpen}
                onClose={handleCloseRenameModal}
                title="Renomear opção"
                disableClose={isRenaming}
                keyboardAwareFooter
                footer={(
                    <>
                        <ActionButton
                            onClick={handleCloseRenameModal}
                            disabled={isRenaming}
                            variant="ghost"
                            size="md"
                        >
                            Cancelar
                        </ActionButton>
                        <ActionButton
                            onClick={() => { void handleRenamePdfOption(); }}
                            disabled={isRenaming || !renameDraft.trim()}
                            loading={isRenaming}
                            loadingText="Atualizando PDF..."
                            variant="primary"
                            size="md"
                        >
                            Salvar nome
                        </ActionButton>
                    </>
                )}
            >
                <div className="space-y-4">
                    <div className="rounded-[var(--radius-control)] border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                        O novo nome será exibido no PDF e na página do orçamento enviada ao cliente.
                    </div>
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-semibold text-[var(--text-strong)]">
                            Nome da opção
                        </span>
                        <input
                            type="text"
                            autoFocus
                            maxLength={80}
                            value={renameDraft}
                            onChange={(event) => {
                                setRenameDraft(event.target.value);
                                if (renameError) setRenameError('');
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleRenamePdfOption();
                                }
                            }}
                            aria-label="Nome da opção"
                            aria-invalid={Boolean(renameError)}
                            placeholder="Ex.: Película Premium"
                            className={`h-12 w-full rounded-[var(--radius-control)] border bg-[var(--surface)] px-3 text-base font-semibold text-[var(--text-strong)] outline-none transition focus:ring-4 ${
                                renameError
                                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                                    : 'border-[var(--border-subtle)] focus:border-blue-500 focus:ring-blue-500/10'
                            }`}
                        />
                        <div className="mt-1.5 flex items-start justify-between gap-3">
                            <p className={`text-xs ${renameError ? 'font-semibold text-red-500' : 'text-[var(--text-muted)]'}`} role={renameError ? 'alert' : undefined}>
                                {renameError || 'Use um nome curto e fácil para o cliente identificar.'}
                            </p>
                            <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-soft)]">
                                {renameDraft.length}/80
                            </span>
                        </div>
                    </label>
                </div>
            </Modal>
            <WhatsAppChooserModal
                clientName={client.nome}
                phone={normalizedPhone}
                message={whatsAppMessage}
                onClose={() => setWhatsAppMessage(null)}
            />
        </article>
    );
});


const PdfHistoryMobileFooter: React.FC<{
    onSearch: () => void;
    onOpenPeriod: () => void;
    onFollowUp: () => void;
    followUpPending: number;
    onOpenTemplates: () => void;
    onCreateProposal?: () => void;
}> = ({ onSearch, onOpenPeriod, onFollowUp, followUpPending, onOpenTemplates, onCreateProposal }) => {
    // Mesmo botão do menu fixo de Clientes, Estoque e Propostas.
    const FooterButton: React.FC<{
        onClick: () => void;
        label: string;
        icon: React.ReactNode;
        badge?: number;
    }> = ({ onClick, label, icon, badge }) => (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="group relative flex h-14 w-16 flex-col items-center justify-center rounded-xl text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
        >
            <span className="transition-transform duration-300 group-active:scale-90">{icon}</span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">{label}</span>
            {badge && badge > 0 ? (
                <span className="absolute right-1.5 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
                    {badge > 99 ? '99+' : badge}
                </span>
            ) : null}
        </button>
    );

    // Atalhos ao alcance do polegar. O resumo do período fica no cartão do topo da lista.
    return (
        <div
            className="fixed left-4 right-4 z-40 sm:hidden"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
            <nav aria-label="Menu do histórico" className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <div className="relative flex items-center justify-between">
                    <div className="flex gap-1">
                        <FooterButton onClick={onSearch} label="Buscar" icon={<Search className="h-5 w-5" aria-hidden="true" />} />
                        <FooterButton onClick={onOpenPeriod} label="Período" icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />} />
                    </div>

                    {onCreateProposal ? (
                        <div className="absolute left-1/2 -top-12 -translate-x-1/2">
                            <button
                                type="button"
                                onClick={onCreateProposal}
                                aria-label="Novo orçamento"
                                className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_8px_20px_rgba(21,94,239,0.4)] transition-all duration-300 hover:-translate-y-1 active:scale-95 dark:border-slate-900"
                            >
                                <Plus className="h-7 w-7" aria-hidden="true" />
                            </button>
                        </div>
                    ) : null}

                    <div className="flex gap-1">
                        <FooterButton onClick={onFollowUp} label="Avaliações" icon={<Star className="h-5 w-5" aria-hidden="true" />} badge={followUpPending} />
                        <FooterButton onClick={onOpenTemplates} label="Textos" icon={<MessageSquareText className="h-5 w-5" aria-hidden="true" />} />
                    </div>
                </div>
            </nav>
        </div>
    );
};

const PdfHistoryView: React.FC<PdfHistoryViewProps> = ({ pdfs, hasMoreServerPdfs = false, isLoadingMoreServerPdfs = false, onLoadMoreServerPdfs, onEnsureCompleteServerHistory, clients, agendamentos, films, googleReviewsLink, onDelete, onDeleteMany, onDownload, onUpdateStatus, onRenamePdfOption, onSchedule, onOpenInAgenda, onGenerateCombinedPdf, onNavigateToOption, onCreateProposal }) => {
    const { confirm, showToast } = useFeedback();
    const [pendingFocusClientId] = useState<number | null>(() => readInitialHistoryFocusClient());
    const [expandedClientId, setExpandedClientId] = useState<number | null>(pendingFocusClientId);
    const [highlightedClientId, setHighlightedClientId] = useState<number | null>(pendingFocusClientId);
    const clientGroupRefs = useRef(new Map<number, HTMLDivElement>());
    const [optionsModalClientId, setOptionsModalClientId] = useState<number | null>(null);
    const [selectedPdfIds, setSelectedPdfIds] = useState<Set<number>>(() => readSelectedCombinedPdfIds());
    const [isDeletingSelectedPdfs, setIsDeletingSelectedPdfs] = useState(false);
    const [focusFilter, setFocusFilter] = useState<HistoryFocusFilter>(() => readInitialHistoryFocusFilter());
    const [period, setPeriod] = useState<HistoryPeriodKey>('month');
    const [customStartDate, setCustomStartDate] = useState(() => toDateInputValue(addDays(new Date(), -6)));
    const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));
    const [isDesktopPeriodOpen, setIsDesktopPeriodOpen] = useState(false);
    const [desktopDraftPeriod, setDesktopDraftPeriod] = useState<HistoryPeriodKey>('month');
    const [desktopDraftStartDate, setDesktopDraftStartDate] = useState(() => toDateInputValue(addDays(new Date(), -6)));
    const [desktopDraftEndDate, setDesktopDraftEndDate] = useState(() => toDateInputValue(new Date()));
    const [desktopActiveBoundary, setDesktopActiveBoundary] = useState<'start' | 'end'>('start');
    const [desktopCalendarMonth, setDesktopCalendarMonth] = useState(() => startOfMonth(new Date()));
    const [isMobilePeriodOpen, setIsMobilePeriodOpen] = useState(false);
    const [mobileDraftPeriod, setMobileDraftPeriod] = useState<HistoryPeriodKey>('month');
    const [mobileDraftStartDate, setMobileDraftStartDate] = useState(() => toDateInputValue(addDays(new Date(), -6)));
    const [mobileDraftEndDate, setMobileDraftEndDate] = useState(() => toDateInputValue(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [historySort, setHistorySort] = useState<HistorySortKey>('recent');
    const [visibleCount, setVisibleCount] = useState(10);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isExpenseSummaryExpanded, setIsExpenseSummaryExpanded] = useState(false);
    const reviewPanelRef = useRef<HTMLDivElement>(null);
    const [funnelReferencePdfIds, setFunnelReferencePdfIds] = useState<FunnelReferencePdfMap>(() => readFunnelReferencePdfIds());
    const [reviewRequestsSent, setReviewRequestsSent] = useState<ReviewRequestsSentMap>(() => readReviewRequestsSent());
    const [copiedReviewRequestKey, setCopiedReviewRequestKey] = useState<string | null>(null);
    const [reviewCampaignWhatsApp, setReviewCampaignWhatsApp] = useState<{
        clientName: string;
        phone: string | null;
        message: string;
    } | null>(null);
    const [messageTemplates, setMessageTemplates] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [...DEFAULT_PDF_MESSAGE_TEMPLATES];
        try {
            const savedTemplates = window.localStorage.getItem(PDF_MESSAGE_TEMPLATES_STORAGE_KEY);
            if (!savedTemplates) return [...DEFAULT_PDF_MESSAGE_TEMPLATES];
            const parsedTemplates = JSON.parse(savedTemplates);
            if (Array.isArray(parsedTemplates) && parsedTemplates.length === 3) {
                const normalizedTemplates = parsedTemplates.map(template => typeof template === 'string' ? template : '');
                return normalizeStoredPdfMessageTemplates(normalizedTemplates);
            }
        } catch (error) {
            console.error('Erro ao carregar templates de mensagens do historico:', error);
        }
        return [...DEFAULT_PDF_MESSAGE_TEMPLATES];
    });
    const [draftMessageTemplates, setDraftMessageTemplates] = useState<string[]>(messageTemplates);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const deferredSearchTerm = React.useDeferredValue(searchTerm);

    useEffect(() => {
        const needsCompleteHistory = Boolean(searchTerm.trim()) || focusFilter !== 'all' || period !== 'month';
        if (!needsCompleteHistory || !hasMoreServerPdfs || isLoadingMoreServerPdfs) return;
        void onEnsureCompleteServerHistory?.();
    }, [focusFilter, hasMoreServerPdfs, isLoadingMoreServerPdfs, onEnsureCompleteServerHistory, period, searchTerm]);

    const customRange = useMemo(() => getCustomDateRange(customStartDate, customEndDate), [customEndDate, customStartDate]);
    const periodRange = useMemo(() => getPeriodRange(period, customRange), [customRange, period]);
    const periodRangeLabel = formatRangeButtonLabel(periodRange);
    const customDateSummary = `${formatDateInputLabel(customStartDate)} - ${formatDateInputLabel(customEndDate)}`;
    const periodDisplayLabel = period === 'custom'
        ? periodRangeLabel
        : HISTORY_PERIOD_LABELS[period];
    const mobilePeriodTriggerLabel = period === 'custom'
        ? customDateSummary
        : HISTORY_PERIOD_LABELS[period];
    const periodFilteredPdfs = useMemo(() => (
        pdfs.filter(pdf => isWithinRange(parseDate(pdf.date), periodRange))
    ), [pdfs, periodRange]);
    // Serviços avulsos: atendimentos concluídos com valor final, mas SEM orçamento
    // vinculado. Eles não existem como PDF/orçamento, então sintetizamos um
    // "orçamento virtual aprovado" só para entrar no resultado financeiro.
    // Usamos um clienteId sintético (negativo, derivado do id do agendamento)
    // para garantir que cada serviço avulso forme sua própria oportunidade e
    // nunca se misture ao grupo de um orçamento real do mesmo cliente/mês.
    const standaloneServicePdfs = useMemo<SavedPDF[]>(() => (
        agendamentos
            .filter(agendamento => (
                agendamento.serviceStatus === 'completed'
                && !agendamento.pdfId
                && typeof agendamento.valorFinal === 'number'
                && Number.isFinite(agendamento.valorFinal)
                && agendamento.valorFinal > 0
            ))
            .map(agendamento => ({
                id: agendamento.id ? -agendamento.id : undefined,
                clienteId: agendamento.id ? -agendamento.id : -1,
                clientName: agendamento.clienteNome,
                date: agendamento.start,
                totalPreco: agendamento.valorFinal as number,
                totalM2: 0,
                nomeArquivo: 'Serviço avulso',
                status: 'approved' as const
            }))
    ), [agendamentos]);
    // Array exclusivo do resultado financeiro: PDFs reais do período + serviços
    // avulsos do período. Não alimenta a lista/cards do histórico.
    const periodFilteredPdfsWithStandalone = useMemo(() => {
        const standaloneInPeriod = standaloneServicePdfs.filter(pdf => isWithinRange(parseDate(pdf.date), periodRange));
        return standaloneInPeriod.length > 0 ? [...periodFilteredPdfs, ...standaloneInPeriod] : periodFilteredPdfs;
    }, [periodFilteredPdfs, standaloneServicePdfs, periodRange]);
    const selectedExpenseSummary = useMemo(() => (
        buildPeriodExpenseSummary(periodFilteredPdfsWithStandalone, funnelReferencePdfIds, periodRangeLabel)
            || (pdfs.length > 0 || standaloneServicePdfs.length > 0 ? buildEmptyExpenseSummary(periodRangeLabel) : null)
    ), [funnelReferencePdfIds, pdfs.length, periodFilteredPdfsWithStandalone, standaloneServicePdfs.length, periodRangeLabel]);

    useEffect(() => {
        if (!isTemplateModalOpen) {
            setDraftMessageTemplates(messageTemplates);
        }
    }, [isTemplateModalOpen, messageTemplates]);

    useEffect(() => {
        if (!isDesktopPeriodOpen || typeof window === 'undefined') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsDesktopPeriodOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDesktopPeriodOpen]);

    const handleSaveTemplates = useCallback(() => {
        const normalizedTemplates = draftMessageTemplates.map((template, index) => template.trim() || DEFAULT_PDF_MESSAGE_TEMPLATES[index]);
        setMessageTemplates(normalizedTemplates);
        window.localStorage.setItem(PDF_MESSAGE_TEMPLATES_STORAGE_KEY, JSON.stringify(normalizedTemplates));
        setIsTemplateModalOpen(false);
    }, [draftMessageTemplates]);

    const handleResetTemplates = useCallback(() => {
        setDraftMessageTemplates([...DEFAULT_PDF_MESSAGE_TEMPLATES]);
    }, []);

    const clientsById = useMemo(() => {
        return new Map(clients.map(c => [c.id, c]));
    }, [clients]);

    const agendamentosByPdfId = useMemo(() => {
        return agendamentos.reduce((acc, ag) => {
            const linkedIds = ag.pdfIds?.length ? ag.pdfIds : (ag.pdfId ? [ag.pdfId] : []);
            linkedIds.forEach((pdfId) => {
                acc[pdfId] = ag;
            });
            return acc;
        }, {} as Record<number, Agendamento>);
    }, [agendamentos]);

    const reviewCampaignCandidates = useMemo<ReviewCampaignCandidate[]>(() => {
        if (!googleReviewsLink?.trim()) return [];

        const latestByClient = new Map<number, ReviewCampaignCandidate>();

        periodFilteredPdfs.forEach(pdf => {
            const client = clientsById.get(pdf.clienteId);
            const agendamento = typeof pdf.id === 'number' ? agendamentosByPdfId[pdf.id] : undefined;

            if (!client || !normalizeWhatsappPhone(client.telefone)) return;
            if (!isApprovedReviewCandidate(pdf, agendamento)) return;

            const message = buildReviewFollowUpMessage(pdf, client, googleReviewsLink);
            if (!message) return;

            const requestKey = getReviewRequestKey(pdf);
            const candidate: ReviewCampaignCandidate = {
                pdf,
                client,
                agendamento,
                message,
                requestKey,
                sentAt: reviewRequestsSent[requestKey]
            };
            const existing = latestByClient.get(pdf.clienteId);
            const candidateDate = getReviewExecutionDate(candidate)?.getTime() || 0;
            const existingDate = existing ? (getReviewExecutionDate(existing)?.getTime() || 0) : -1;

            if (!existing || candidateDate > existingDate) {
                latestByClient.set(pdf.clienteId, candidate);
            }
        });

        return Array.from(latestByClient.values()).sort((a, b) => {
            if (!!a.sentAt !== !!b.sentAt) {
                return a.sentAt ? 1 : -1;
            }

            return (getReviewExecutionDate(b)?.getTime() || 0) - (getReviewExecutionDate(a)?.getTime() || 0);
        });
    }, [agendamentosByPdfId, clientsById, googleReviewsLink, periodFilteredPdfs, reviewRequestsSent]);

    const groupedHistory = useMemo(() => {
        const groups = new Map<number, { client: Client, pdfs: SavedPDF[] }>();

        // 1. Sort PDFs by date descending
        const sortedPdfs = [...periodFilteredPdfs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // 2. Group by client
        sortedPdfs.forEach(pdf => {
            const clientId = pdf.clienteId;
            const client = clientsById.get(clientId) || {
                id: clientId,
                nome: pdf.clientName?.trim() || 'Cliente não identificado',
                telefone: '',
                email: '',
                cpfCnpj: '',
            };

            if (!groups.has(clientId)) {
                groups.set(clientId, { client, pdfs: [] });
            }

            groups.get(clientId)!.pdfs.push(pdf);
        });

        // 3. Convert Map values to array
        return Array.from(groups.values());
    }, [periodFilteredPdfs, clientsById]);

    const filteredGroupedHistory = useMemo(() => {
        let groups = groupedHistory;

        if (focusFilter !== 'all') {
            groups = groups
                .map(group => ({
                    ...group,
                    pdfs: group.pdfs.filter(pdf => {
                        if (focusFilter === 'pending') {
                            return (pdf.status || 'pending') === 'pending';
                        }

                        if (focusFilter === 'approved') {
                            return pdf.status === 'approved';
                        }

                        if (focusFilter === 'revised') {
                            return pdf.status === 'revised';
                        }

                        if (focusFilter === 'expired') {
                            return isExpiredOpenPdf(pdf);
                        }

                        return getPdfExpenseData(pdf).operationalExpenses > 0;
                    })
                }))
                .filter(group => group.pdfs.length > 0);
        }

        if (deferredSearchTerm.trim()) {
            const normalizedTerm = normalizeSearchText(deferredSearchTerm);
            const compactTerm = normalizedTerm.replace(/[\s./()$-]/g, '');
            groups = groups.filter(group => {
                const clientSearchText = [
                    group.client.nome,
                    group.client.telefone,
                    group.client.email,
                    group.client.cpfCnpj,
                ].join(' ');
                const pdfSearchText = group.pdfs.map(pdf => {
                    const date = parseDate(pdf.date);
                    const statusLabel = PDF_STATUS_META[pdf.status || 'pending'].label;

                    return [
                        pdf.proposalOptionName,
                        pdf.nomeArquivo,
                        pdf.totalPreco,
                        formatNumberBR(pdf.totalPreco),
                        date?.toLocaleDateString('pt-BR'),
                        statusLabel,
                    ].join(' ');
                }).join(' ');
                const haystack = normalizeSearchText(`${clientSearchText} ${pdfSearchText}`);
                const compactHaystack = haystack.replace(/[\s./()$-]/g, '');

                return matchesSearch(haystack, normalizedTerm)
                    || Boolean(compactTerm && compactHaystack.includes(compactTerm));
            });
        }
        return groups;
    }, [groupedHistory, deferredSearchTerm, focusFilter]);

    const organizedGroupedHistory = useMemo(() => {
        const groups = [...filteredGroupedHistory];

        return groups.sort((left, right) => {
            if (historySort === 'name') {
                return left.client.nome.localeCompare(right.client.nome, 'pt-BR', { sensitivity: 'base' });
            }

            if (historySort === 'highest') {
                return buildFunnelTotals(right.pdfs, funnelReferencePdfIds).funnelRevenue
                    - buildFunnelTotals(left.pdfs, funnelReferencePdfIds).funnelRevenue;
            }

            const leftDate = parseDate(left.pdfs[0]?.date)?.getTime() || 0;
            const rightDate = parseDate(right.pdfs[0]?.date)?.getTime() || 0;
            return historySort === 'oldest' ? leftDate - rightDate : rightDate - leftDate;
        });
    }, [filteredGroupedHistory, funnelReferencePdfIds, historySort]);

    const visibleApprovedPdfIds = useMemo(() => {
        const ids = new Set<number>();

        organizedGroupedHistory.forEach(group => {
            group.pdfs.forEach(pdf => {
                if (pdf.status === 'approved' && typeof pdf.id === 'number') {
                    ids.add(pdf.id);
                }
            });
        });

        return ids;
    }, [organizedGroupedHistory]);

    const visibleReviewCampaignCandidates = useMemo(() => {
        if (visibleApprovedPdfIds.size === 0) return [];

        return reviewCampaignCandidates.filter(candidate => (
            typeof candidate.pdf.id === 'number' && visibleApprovedPdfIds.has(candidate.pdf.id)
        ));
    }, [reviewCampaignCandidates, visibleApprovedPdfIds]);

    const visiblePendingReviewCampaignCount = useMemo(() => (
        visibleReviewCampaignCandidates.filter(candidate => !candidate.sentAt).length
    ), [visibleReviewCampaignCandidates]);

    const displayedHistory = useMemo(() => {
        return organizedGroupedHistory.slice(0, visibleCount);
    }, [organizedGroupedHistory, visibleCount]);

    const handleLoadMore = async () => {
        const hasHiddenLoadedGroups = visibleCount < organizedGroupedHistory.length;
        if (hasHiddenLoadedGroups) {
            setVisibleCount(prev => prev + 10);
        }

        const reachesEndOfLoadedGroups = visibleCount + 10 >= organizedGroupedHistory.length;
        if (reachesEndOfLoadedGroups && hasMoreServerPdfs && onLoadMoreServerPdfs) {
            await onLoadMoreServerPdfs();
        }
    };

    const handleToggleExpand = (clientId: number) => {
        const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
        if (isDesktop) {
            setExpandedClientId(prev => prev === clientId ? null : clientId);
            return;
        }
        setOptionsModalClientId(clientId);
    };

    // Tela do cliente no celular: as caixas de seleção só aparecem depois de tocar em "Selecionar".
    const [isSelectingOptions, setIsSelectingOptions] = useState(false);

    const closeOptionsModal = useCallback(() => {
        setOptionsModalClientId(null);
        setIsSelectingOptions(false);
    }, []);

    const handleCancelGroupSelection = useCallback((groupPdfs: SavedPDF[]) => {
        setSelectedPdfIds(previous => {
            const next = new Set<number>(previous);
            groupPdfs.forEach(pdf => { if (typeof pdf.id === 'number') next.delete(pdf.id); });
            saveSelectedCombinedPdfIds(next);
            return next;
        });
        setIsSelectingOptions(false);
    }, []);

    useEffect(() => {
        if (optionsModalClientId == null) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeOptionsModal();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [optionsModalClientId, closeOptionsModal]);

    // Ao chegar do orçamento recém-gerado, rola até o cliente e o destaca brevemente.
    // No mobile, abre direto o modal de opções do cliente para já gerenciar a proposta.
    useEffect(() => {
        if (pendingFocusClientId == null) return;

        const node = clientGroupRefs.current.get(pendingFocusClientId);
        node?.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const isMobile = typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches;
        if (isMobile) {
            setOptionsModalClientId(pendingFocusClientId);
        }

        const timeout = window.setTimeout(() => setHighlightedClientId(null), 2400);
        return () => window.clearTimeout(timeout);
    }, [pendingFocusClientId]);

    const handleToggleSelect = (pdfId: number) => {
        setSelectedPdfIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pdfId)) {
                newSet.delete(pdfId);
            } else {
                // Se for o primeiro item selecionado, expande o grupo do cliente
                const pdf = pdfs.find(p => p.id === pdfId);
                if (pdf && newSet.size === 0) {
                    setExpandedClientId(pdf.clienteId);
                }
                newSet.add(pdfId);
            }
            saveSelectedCombinedPdfIds(newSet);
            return newSet;
        });
    };

    const handleClearSelection = () => {
        const empty = new Set<number>();
        setSelectedPdfIds(empty);
        saveSelectedCombinedPdfIds(empty);
    };

    const handleToggleSelectGroup = useCallback((groupPdfs: SavedPDF[]) => {
        const groupIds = groupPdfs
            .map(pdf => pdf.id)
            .filter((pdfId): pdfId is number => typeof pdfId === 'number');

        setSelectedPdfIds(previous => {
            const next = new Set(previous);
            const allSelected = groupIds.length > 0 && groupIds.every(pdfId => next.has(pdfId));

            groupIds.forEach(pdfId => {
                if (allSelected) {
                    next.delete(pdfId);
                } else {
                    next.add(pdfId);
                }
            });

            saveSelectedCombinedPdfIds(next);
            return next;
        });
    }, []);

    const selectedPdfs = useMemo(() => {
        return pdfs.filter(pdf => typeof pdf.id === 'number' && selectedPdfIds.has(pdf.id));
    }, [pdfs, selectedPdfIds]);

    const hasOnlySameClientSelectedPdfs = selectedPdfs.length > 0
        ? selectedPdfs.every(pdf => pdf.clienteId === selectedPdfs[0].clienteId)
        : true;
    const selectedClientForCombinedMessages = selectedPdfs.length > 0
        ? clientsById.get(selectedPdfs[0].clienteId)
        : null;
    const combinedProposalClientMessages = useMemo(() => {
        if (!hasOnlySameClientSelectedPdfs) return [];
        return buildCombinedProposalMessages(selectedPdfs, selectedClientForCombinedMessages, films);
    }, [films, hasOnlySameClientSelectedPdfs, selectedClientForCombinedMessages, selectedPdfs]);
    const combinedMessageOverrideKey = useMemo(() => {
        return getCombinedMessageOverrideKey(selectedPdfs);
    }, [selectedPdfs]);
    const [editableCombinedProposalMessages, setEditableCombinedProposalMessages] = useState<string[]>([]);
    const [combinedWhatsAppMessage, setCombinedWhatsAppMessage] = useState<string | null>(null);
    const [isCombinedShareOpen, setIsCombinedShareOpen] = useState(false);
    const [isCombinedMessagesOpen, setIsCombinedMessagesOpen] = useState(false);
    const [singleProposalShare, setSingleProposalShare] = useState<{ client: Client; pdf: SavedPDF; messages?: string[] } | null>(null);
    const [copiedCombinedMessageIndex, setCopiedCombinedMessageIndex] = useState<number | null>(null);

    const handleDeleteSelectedPdfs = useCallback(async () => {
        if (selectedPdfs.length === 0 || isDeletingSelectedPdfs) return;

        const count = selectedPdfs.length;
        const shouldDelete = await confirm({
            title: count === 1 ? 'Excluir orçamento?' : `Excluir ${count} orçamentos?`,
            message: count === 1
                ? 'O orçamento selecionado será apagado do histórico. Esta ação não pode ser desfeita.'
                : `Os ${count} orçamentos selecionados serão apagados do histórico. Esta ação não pode ser desfeita.`,
            confirmButtonText: count === 1 ? 'Sim, excluir' : `Excluir ${count}`,
            cancelButtonText: 'Cancelar',
            confirmButtonVariant: 'danger',
            presentation: 'auto',
        });

        if (!shouldDelete) return;

        setIsDeletingSelectedPdfs(true);
        try {
            await onDeleteMany(selectedPdfs.map(pdf => pdf.id!));
            handleClearSelection();
            showToast(
                count === 1 ? 'Orçamento excluído.' : `${count} orçamentos excluídos.`,
                { tone: 'success', duration: 2400 }
            );
        } catch (error) {
            console.error('Erro ao excluir orçamentos selecionados:', error);
            showToast('Não foi possível concluir a exclusão. Tente novamente.', { tone: 'error' });
        } finally {
            setIsDeletingSelectedPdfs(false);
        }
    }, [confirm, isDeletingSelectedPdfs, onDeleteMany, selectedPdfs, showToast]);

    const handleOpenSingleProposalShare = useCallback((client: Client, pdf: SavedPDF, messages?: string[]) => {
        setSingleProposalShare({ client, pdf, messages });
    }, []);
    const normalizedCombinedClientPhone = useMemo(() => {
        return normalizeWhatsappPhone(selectedClientForCombinedMessages?.telefone);
    }, [selectedClientForCombinedMessages?.telefone]);

    useEffect(() => {
        if (!combinedMessageOverrideKey) {
            setEditableCombinedProposalMessages([]);
            return;
        }

        setEditableCombinedProposalMessages(
            readCombinedMessageOverrides(combinedMessageOverrideKey) || combinedProposalClientMessages
        );
    }, [combinedMessageOverrideKey, combinedProposalClientMessages]);

    useEffect(() => {
        if (selectedPdfs.length === 0 || !hasOnlySameClientSelectedPdfs) return;
        setExpandedClientId(current => current ?? selectedPdfs[0].clienteId);
    }, [hasOnlySameClientSelectedPdfs, selectedPdfs]);

    const handleCombinedProposalMessageChange = useCallback((index: number, value: string) => {
        setEditableCombinedProposalMessages(current => {
            const nextMessages = current.map((message, messageIndex) => (
                messageIndex === index ? value : message
            ));
            saveCombinedMessageOverrides(combinedMessageOverrideKey, nextMessages);
            return nextMessages;
        });
    }, [combinedMessageOverrideKey]);

    const handleOpenCombinedWhatsApp = useCallback((message: string) => {
        if (!hasOnlySameClientSelectedPdfs || !selectedClientForCombinedMessages) {
            showToast('Selecione apenas orçamentos do mesmo cliente para abrir a conversa no WhatsApp.', {
                tone: 'warning',
            });
            return;
        }

        if (!normalizedCombinedClientPhone) {
            showToast('Esse cliente ainda não tem um telefone válido para abrir no WhatsApp.', {
                tone: 'warning',
            });
            return;
        }

        setCombinedWhatsAppMessage(message);
    }, [hasOnlySameClientSelectedPdfs, normalizedCombinedClientPhone, selectedClientForCombinedMessages, showToast]);

    const handleOpenReviewCampaignWhatsApp = useCallback((candidate: ReviewCampaignCandidate) => {
        const phone = normalizeWhatsappPhone(candidate.client.telefone);

        if (!phone) {
            showToast('Esse cliente ainda não tem um telefone válido para abrir no WhatsApp.', {
                tone: 'warning',
            });
            return;
        }

        setReviewCampaignWhatsApp({
            clientName: candidate.client.nome,
            phone,
            message: candidate.message,
        });
    }, [showToast]);

    const handleCopyReviewCampaignMessage = useCallback(async (candidate: ReviewCampaignCandidate) => {
        try {
            const copied = await copyTextWithFallback(candidate.message);
            if (!copied) {
                throw new Error('Falha ao copiar pedido de avaliacao');
            }

            setCopiedReviewRequestKey(candidate.requestKey);
            showToast('Mensagem de avaliação copiada.', {
                tone: 'success',
                duration: 2200,
            });
            window.setTimeout(() => {
                setCopiedReviewRequestKey(current => current === candidate.requestKey ? null : current);
            }, 1800);
        } catch (error) {
            console.error('Erro ao copiar pedido de avaliacao:', error);
            showToast('Não foi possível copiar a mensagem agora.', {
                tone: 'error',
            });
        }
    }, [showToast]);

    const handleMarkReviewRequestSent = useCallback((candidate: ReviewCampaignCandidate) => {
        setReviewRequestsSent(current => {
            if (current[candidate.requestKey]) {
                return current;
            }

            const next = {
                ...current,
                [candidate.requestKey]: new Date().toISOString(),
            };
            saveReviewRequestsSent(next);
            return next;
        });

        showToast('Pedido de avaliação marcado como feito.', {
            tone: 'success',
            duration: 2200,
        });
    }, [showToast]);

    const handleGenerateCombined = () => {
        if (selectedPdfs.length < 2) {
            showToast('Selecione pelo menos dois orçamentos para gerar um PDF combinado.', { tone: 'warning' });
            return;
        }

        // Verifica se todos os PDFs selecionados são do mesmo cliente
        if (!hasOnlySameClientSelectedPdfs) {
            showToast('Apenas orçamentos do mesmo cliente podem ser combinados em um único PDF.', { tone: 'warning' });
            return;
        }

        onGenerateCombinedPdf(selectedPdfs);
        const emptySelection = new Set<number>();
        setSelectedPdfIds(emptySelection); // Limpa a seleção após a ação
        saveSelectedCombinedPdfIds(emptySelection);
    };

    const handleCopyCombinedProposalMessage = useCallback(async (message: string, index: number) => {
        try {
            const copied = await copyTextWithFallback(message);
            if (!copied) {
                throw new Error('Falha ao copiar mensagem do orçamento combinado');
            }

            setCopiedCombinedMessageIndex(index);
            showToast('Mensagem do orçamento combinado copiada.', {
                tone: 'success',
                duration: 2200,
            });
            window.setTimeout(() => {
                setCopiedCombinedMessageIndex(current => current === index ? null : current);
            }, 1800);
        } catch (error) {
            console.error('Erro ao copiar mensagem do orçamento combinado:', error);
            showToast('Não foi possível copiar a mensagem agora.', {
                tone: 'error',
            });
        }
    }, [showToast]);

    const handleCopyExpenseSummary = useCallback(async () => {
        if (!selectedExpenseSummary) return;

        try {
            const copied = await copyTextWithFallback(buildPartnerExpenseSummaryText(selectedExpenseSummary));
            if (!copied) {
                throw new Error('Falha ao copiar resumo interno');
            }

            showToast('Resumo de gastos copiado para enviar ao sócio.', {
                tone: 'success',
                duration: 2400,
            });
        } catch (error) {
            console.error('Erro ao copiar resumo de gastos:', error);
            showToast('Não foi possível copiar o resumo de gastos agora.', {
                tone: 'error',
            });
        }
    }, [selectedExpenseSummary, showToast]);

    const handleSetFunnelReference = useCallback((pdf: SavedPDF) => {
        if (typeof pdf.id !== 'number') {
            showToast('Esse orçamento ainda não tem ID para virar principal do funil.', { tone: 'warning' });
            return;
        }

        const opportunityKey = getPdfOpportunityKey(pdf);
        if (!opportunityKey) {
            showToast('Não foi possível identificar o atendimento desse orçamento.', { tone: 'warning' });
            return;
        }

        setFunnelReferencePdfIds(current => {
            const nextReferences = {
                ...current,
                [opportunityKey]: pdf.id!
            };
            saveFunnelReferencePdfIds(nextReferences);
            return nextReferences;
        });

        showToast('Opção marcada como valor principal do funil.', {
            tone: 'success',
            duration: 2200,
        });
    }, [showToast]);

    const ClientHistoryGroup: React.FC<{
        group: typeof groupedHistory[0];
    }> = React.memo(({ group }) => {
        const { client, pdfs } = group;
        const isExpanded = expandedClientId === client.id;
        const isHighlighted = highlightedClientId === client.id;
        const hasSelectedInGroup = pdfs.some(p => selectedPdfIds.has(p.id!));
        const selectedInGroupCount = pdfs.filter(p => selectedPdfIds.has(p.id!)).length;
        const areAllPdfsInGroupSelected = selectedInGroupCount === pdfs.length;
        const totalPdfs = pdfs.length;
        const latestPdf = pdfs[0];
        const clientFunnelSummary = buildFunnelTotals(pdfs, funnelReferencePdfIds);
        const displayReferencePdf = clientFunnelSummary.latestReferencePdf || latestPdf;
        const status = getHistoryGroupStatus(pdfs);
        const initials = getClientInitials(client.nome);
        const optionCountLabel = `${totalPdfs} ${totalPdfs === 1 ? 'opção' : 'opções'}`;
        const latestContext = clientFunnelSummary.opportunityCount > 1
            ? `${clientFunnelSummary.opportunityCount} atendimentos`
            : displayReferencePdf.proposalOptionName || optionCountLabel;
        // No celular: "Opção Premium · 3 opções" (o nome sozinho esconderia as alternativas).
        const mobileContext = totalPdfs > 1 && latestContext !== optionCountLabel
            ? `${latestContext} · ${optionCountLabel}`
            : latestContext;
        const latestDate = formatShortDayLabel(latestPdf.date);
        const avatarClassName = GROUP_AVATAR_CLASSNAMES.get(status.tone) || GROUP_AVATAR_CLASSNAMES.get(PDF_STATUS_META.pending);

        return (
            <div
                ref={(node) => {
                    if (node) {
                        clientGroupRefs.current.set(client.id!, node);
                    } else {
                        clientGroupRefs.current.delete(client.id!);
                    }
                }}
                className={`relative overflow-hidden rounded-2xl border shadow-[var(--shadow-hairline)] transition-all duration-300 sm:rounded-[var(--radius-panel)] sm:bg-[var(--surface)] sm:hover:-translate-y-0.5 sm:hover:border-[var(--border-strong)] ${isHighlighted ? 'ring-2 ring-blue-500 sm:ring-offset-2 sm:ring-offset-[var(--surface)] sm:!border-[var(--brand-primary)]' : ''} ${hasSelectedInGroup ? 'border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/20 sm:border-[var(--brand-primary)] sm:ring-2 sm:ring-blue-500/15' : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]'}`}>
                <button
                    onClick={() => handleToggleExpand(client.id!)}
                    className="w-full px-3 py-3 text-left transition-colors duration-200 hover:bg-[var(--surface-muted)] active:bg-[var(--surface-muted)] sm:px-4 sm:py-3"
                    aria-expanded={isExpanded}
                >
                    <div className="flex items-center gap-3 sm:items-start">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold sm:hidden ${avatarClassName}`} aria-hidden="true">
                            {initials}
                        </div>
                        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-xs font-semibold text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 sm:flex">
                            {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5 sm:items-start">
                                <span className={`mt-[0.38rem] hidden h-2 w-2 shrink-0 rounded-full sm:block ${status.tone.dotClassName}`} />
                                <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-slate-900 dark:text-slate-50 sm:flex-none sm:text-[1rem]">
                                    {client.nome}
                                </h3>
                                <p className={`shrink-0 text-sm font-semibold tabular-nums sm:hidden ${status.tone === PDF_STATUS_META.approved ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-strong)]'}`}>
                                    {formatNumberBR(clientFunnelSummary.funnelRevenue)}
                                </p>
                            </div>
                            <p className="mt-1 hidden truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">
                                {status.text} / {latestContext}
                            </p>

                            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)] sm:hidden">
                                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.tone.chipClassName}`}>
                                    {status.tone.label}
                                </span>
                                {hasSelectedInGroup ? (
                                    <span
                                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                                        aria-label={`${selectedInGroupCount} ${selectedInGroupCount === 1 ? 'selecionada' : 'selecionadas'}`}
                                    >
                                        <Check className="h-3 w-3" aria-hidden="true" />
                                        {selectedInGroupCount}
                                    </span>
                                ) : null}
                                <span className="min-w-0 flex-1 truncate">{mobileContext}</span>
                                <span className="shrink-0 text-[11px]">{latestDate}</span>
                            </div>
                        </div>

                        <div className="hidden shrink-0 pl-2 text-right sm:block">
                            <p className="text-[1rem] font-semibold leading-none tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                                {formatNumberBR(clientFunnelSummary.funnelRevenue)}
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-slate-400">
                                {latestDate} · {optionCountLabel}
                            </p>
                        </div>

                        <div className="hidden h-8 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-slate-100 px-2.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:flex">
                            Detalhes
                            <i className={`fas fa-chevron-right text-[10px] transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}></i>
                        </div>
                    </div>
                </button>

                <div className={`hidden overflow-hidden transition-all duration-300 sm:block ${isExpanded ? 'max-h-[2200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-2.5 border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:space-y-3 sm:p-4 sm:pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.tone.chipClassName}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${status.tone.dotClassName}`}></span>
                                {status.text}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                                {clientFunnelSummary.opportunityCount} oportunidade{clientFunnelSummary.opportunityCount > 1 ? 's' : ''}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                                {totalPdfs} {totalPdfs === 1 ? 'opção' : 'opções'}
                            </span>
                            {totalPdfs > 1 ? (
                                <button
                                    type="button"
                                    onClick={() => handleToggleSelectGroup(pdfs)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40"
                                >
                                    <i className={`fas ${areAllPdfsInGroupSelected ? 'fa-times' : 'fa-check-double'} text-[9px]`} aria-hidden="true" />
                                    {areAllPdfsInGroupSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                                </button>
                            ) : null}
                            {clientFunnelSummary.duplicatedRevenue > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                                    Apresentado {formatNumberBR(clientFunnelSummary.presentedRevenue)}
                                </span>
                            ) : null}
                            {hasSelectedInGroup ? (
                                <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                                    {selectedInGroupCount} selecionado{selectedInGroupCount > 1 ? 's' : ''}
                                </span>
                            ) : null}
                        </div>

                        <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-col sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
                            {pdfs.map(pdf => (
                                <div
                                    key={pdf.id}
                                    className={`${totalPdfs > 1 ? 'w-[85%]' : 'w-full'} shrink-0 snap-start sm:w-full sm:shrink`}
                                >
                                    <PdfHistoryItem
                                        pdf={pdf}
                                        client={client}
                                        agendamento={agendamentosByPdfId[pdf.id!]}
                                        onDownload={onDownload}
                                        onDelete={onDelete}
                                        onUpdateStatus={onUpdateStatus}
                                        onRenamePdfOption={onRenamePdfOption}
                                        onSchedule={onSchedule}
                                        onOpenInAgenda={onOpenInAgenda}
                                        films={films}
                                        messageTemplates={messageTemplates}
                                        googleReviewsLink={googleReviewsLink}
                                        isSelected={selectedPdfIds.has(pdf.id!)}
                                        onToggleSelect={handleToggleSelect}
                                        onNavigateToOption={onNavigateToOption}
                                        isFunnelReference={clientFunnelSummary.opportunities.some(opportunity => opportunity.referencePdf.id === pdf.id)}
                                        canChooseFunnelReference={hasFunnelAlternatives(clientFunnelSummary.opportunities, pdf.id)}
                                        onSetFunnelReference={handleSetFunnelReference}
                                        onShare={handleOpenSingleProposalShare}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    });

    const totalPdfCount = useMemo(() => groupedHistory.reduce((total, group) => total + group.pdfs.length, 0), [groupedHistory]);
    const historyFunnelTotals = useMemo(() => buildFunnelTotals(periodFilteredPdfs, funnelReferencePdfIds), [periodFilteredPdfs, funnelReferencePdfIds]);
    const statusFilterCounts = useMemo<Record<HistoryFocusFilter, number>>(() => ({
        all: periodFilteredPdfs.length,
        pending: periodFilteredPdfs.filter(pdf => (pdf.status || 'pending') === 'pending').length,
        approved: periodFilteredPdfs.filter(pdf => pdf.status === 'approved').length,
        revised: periodFilteredPdfs.filter(pdf => pdf.status === 'revised').length,
        expenses: periodFilteredPdfs.filter(pdf => getPdfExpenseData(pdf).operationalExpenses > 0).length,
        expired: periodFilteredPdfs.filter(isExpiredOpenPdf).length
    }), [periodFilteredPdfs]);

    const resetHistoryViewport = useCallback(() => {
        setVisibleCount(10);
        setExpandedClientId(null);
    }, []);

    const syncDesktopDraftFromPeriod = useCallback((nextPeriod: HistoryPeriodKey) => {
        const nextRange = getPeriodRange(nextPeriod, customRange) || periodRange || getTodayRange();

        setDesktopDraftPeriod(nextPeriod);
        if (nextPeriod === 'custom') {
            setDesktopDraftStartDate(customStartDate);
            setDesktopDraftEndDate(customEndDate);
            const draftRange = getCustomDateRange(customStartDate, customEndDate) || nextRange;
            setDesktopCalendarMonth(startOfMonth(draftRange.start));
        } else {
            setDesktopDraftStartDate(toDateInputValue(nextRange.start));
            setDesktopDraftEndDate(toDateInputValue(nextRange.end));
            setDesktopCalendarMonth(startOfMonth(nextRange.start));
        }
        setDesktopActiveBoundary('start');
    }, [customEndDate, customRange, customStartDate, periodRange]);

    const openDesktopPeriodSelector = useCallback(() => {
        syncDesktopDraftFromPeriod(period);
        setIsDesktopPeriodOpen(true);
    }, [period, syncDesktopDraftFromPeriod]);

    const handleSelectDesktopPeriod = useCallback((nextPeriod: HistoryPeriodKey) => {
        const nextRange = getPeriodRange(nextPeriod, customRange) || getTodayRange();

        setDesktopDraftPeriod(nextPeriod);
        if (nextPeriod === 'custom') {
            setDesktopDraftStartDate(customStartDate);
            setDesktopDraftEndDate(customEndDate);
            const draftRange = getCustomDateRange(customStartDate, customEndDate) || nextRange;
            setDesktopCalendarMonth(startOfMonth(draftRange.start));
        } else {
            setDesktopDraftStartDate(toDateInputValue(nextRange.start));
            setDesktopDraftEndDate(toDateInputValue(nextRange.end));
            setDesktopCalendarMonth(startOfMonth(nextRange.start));
        }
        setDesktopActiveBoundary('start');
    }, [customEndDate, customRange, customStartDate]);

    const handleChangeDesktopDraftDate = useCallback((boundary: 'start' | 'end', value: string) => {
        setDesktopDraftPeriod('custom');
        setDesktopActiveBoundary(boundary);

        if (boundary === 'start') {
            setDesktopDraftStartDate(value);
            return;
        }

        setDesktopDraftEndDate(value);
    }, []);

    const handleSelectDesktopCalendarDay = useCallback((date: Date) => {
        const nextValue = toDateInputValue(date);

        setDesktopDraftPeriod('custom');
        if (desktopActiveBoundary === 'start') {
            setDesktopDraftStartDate(nextValue);
            setDesktopActiveBoundary('end');
            return;
        }

        setDesktopDraftEndDate(nextValue);
        setDesktopActiveBoundary('start');
    }, [desktopActiveBoundary]);

    const handleApplyDesktopPeriod = useCallback(() => {
        if (desktopDraftPeriod === 'custom') {
            const validation = getStrictDateRangeValidation(desktopDraftStartDate, desktopDraftEndDate);

            if (!validation.range) {
                showToast(validation.startError || validation.endError || 'Revise o período informado.', {
                    tone: 'warning',
                });
                return;
            }

            setCustomStartDate(toDateInputValue(validation.range.start));
            setCustomEndDate(toDateInputValue(validation.range.end));
        }

        setPeriod(desktopDraftPeriod);
        setIsDesktopPeriodOpen(false);
        resetHistoryViewport();
    }, [desktopDraftEndDate, desktopDraftPeriod, desktopDraftStartDate, resetHistoryViewport, showToast]);

    const handleShiftDesktopPeriod = useCallback((direction: -1 | 1) => {
        if (!periodRange || period === 'all') return;

        const rangeStart = startOfDay(periodRange.start);
        const rangeEnd = endOfDay(periodRange.end);
        const daySpan = Math.max(
            1,
            Math.round((startOfDay(rangeEnd).getTime() - rangeStart.getTime()) / 86400000) + 1
        );
        let nextStart = startOfDay(addDays(rangeStart, direction * daySpan));
        let nextEnd = endOfDay(addDays(rangeEnd, direction * daySpan));
        const todayEnd = endOfDay(new Date());

        if (nextEnd > todayEnd) {
            nextEnd = todayEnd;
            nextStart = startOfDay(addDays(todayEnd, -(daySpan - 1)));
        }

        const nextStartValue = toDateInputValue(nextStart);
        const nextEndValue = toDateInputValue(nextEnd);

        setPeriod('custom');
        setCustomStartDate(nextStartValue);
        setCustomEndDate(nextEndValue);
        setDesktopDraftPeriod('custom');
        setDesktopDraftStartDate(nextStartValue);
        setDesktopDraftEndDate(nextEndValue);
        setDesktopCalendarMonth(startOfMonth(nextStart));
        setIsDesktopPeriodOpen(false);
        resetHistoryViewport();
    }, [period, periodRange, resetHistoryViewport]);

    const openMobilePeriodSelector = useCallback(() => {
        setMobileDraftPeriod(period);
        setMobileDraftStartDate(customStartDate);
        setMobileDraftEndDate(customEndDate);
        setIsMobilePeriodOpen(true);
    }, [customEndDate, customStartDate, period]);

    const handleOpenFollowUp = useCallback(() => {
        if (visibleReviewCampaignCandidates.length === 0) {
            showToast('Nenhuma avaliação na fila neste período.', { tone: 'info' });
            return;
        }
        reviewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [visibleReviewCampaignCandidates.length, showToast]);

    const handleSelectMobilePeriod = useCallback((nextPeriod: HistoryPeriodKey) => {
        if (nextPeriod === 'custom') {
            setMobileDraftPeriod('custom');
            return;
        }

        setPeriod(nextPeriod);
        setMobileDraftPeriod(nextPeriod);
        setIsMobilePeriodOpen(false);
        resetHistoryViewport();
    }, [resetHistoryViewport]);

    const handleApplyMobileCustomPeriod = useCallback(() => {
        const validation = getStrictDateRangeValidation(mobileDraftStartDate, mobileDraftEndDate);

        if (!validation.range) {
            showToast(validation.startError || validation.endError || 'Revise o período informado.', {
                tone: 'warning',
            });
            return;
        }

        setCustomStartDate(toDateInputValue(validation.range.start));
        setCustomEndDate(toDateInputValue(validation.range.end));
        setPeriod('custom');
        setIsMobilePeriodOpen(false);
        resetHistoryViewport();
    }, [mobileDraftEndDate, mobileDraftStartDate, resetHistoryViewport, showToast]);

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        resetHistoryViewport();
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        resetHistoryViewport();
    };

    const handleStatusFilterChange = (filter: HistoryFocusFilter) => {
        setFocusFilter(filter);
        resetHistoryViewport();
    };

    const handleClearFocusFilter = () => {
        handleStatusFilterChange('all');
    };

    const handleFocusSearch = () => {
        searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => searchInputRef.current?.focus(), 250);
    };

    const canCreateSelectionLink = hasOnlySameClientSelectedPdfs && Boolean(selectedClientForCombinedMessages);
    const canCombineSelection = selectedPdfs.length > 1 && hasOnlySameClientSelectedPdfs;

    const combinedMessagesEditor = (
        <div className="grid gap-2 lg:grid-cols-3">
            {editableCombinedProposalMessages.map((message, index) => (
                <div
                    key={`combined-message-${index}`}
                    className="rounded-[12px] border border-blue-100 bg-white/80 p-3 dark:border-blue-900/50 dark:bg-blue-950/30"
                >
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-500 dark:text-blue-300">
                            Mensagem {index + 1}
                        </span>
                    </div>
                    <label className="block">
                        <span className="sr-only">Editar mensagem combinada {index + 1}</span>
                        <textarea
                            value={message}
                            onChange={(event) => handleCombinedProposalMessageChange(index, event.target.value)}
                            rows={Math.max(6, Math.ceil(message.length / 40))}
                            className="min-h-[132px] w-full resize-y rounded-[10px] border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] leading-5 text-blue-950 outline-none transition placeholder:text-blue-300 focus:border-blue-300 focus:bg-blue-50 focus:ring-4 focus:ring-blue-500/10 dark:border-blue-800/70 dark:!bg-[#0b1633] dark:text-blue-50 dark:placeholder:text-blue-300/45 dark:focus:border-blue-500 dark:focus:!bg-[#0b1633] dark:focus:ring-blue-400/20"
                        />
                    </label>
                    <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => handleOpenCombinedWhatsApp(message)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-3 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                        >
                            <i className="fab fa-whatsapp text-[12px]" aria-hidden="true"></i>
                            WhatsApp
                        </button>
                        <button
                            type="button"
                            onClick={() => handleCopyCombinedProposalMessage(message, index)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-blue-200 bg-white px-3 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/40"
                        >
                            <i className={`${copiedCombinedMessageIndex === index ? 'fas fa-check' : 'fas fa-copy'} text-[10px]`} aria-hidden="true"></i>
                            {copiedCombinedMessageIndex === index ? 'Copiado' : 'Copiar mensagem'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );

    // Barra de ações da seleção no celular (lista e tela do cliente): fica sempre ao alcance do polegar.
    const selectionActions = (
        <div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleClearSelection}
                    aria-label="Limpar seleção"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-[var(--surface-muted)] hover:text-slate-800 dark:text-slate-300"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--text-strong)]">
                    {selectedPdfs.length} {selectedPdfs.length === 1 ? 'selecionada' : 'selecionadas'}
                </p>
                {canCombineSelection ? (
                    <button
                        type="button"
                        onClick={() => setIsCombinedMessagesOpen(true)}
                        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-[var(--brand-primary)] transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    >
                        Mensagens
                    </button>
                ) : null}
            </div>
            {!hasOnlySameClientSelectedPdfs ? (
                <p className="mt-1 pl-10 text-[11px] font-medium leading-4 text-amber-700 dark:text-amber-300">
                    Para criar link ou PDF, deixe só opções do mesmo cliente.
                </p>
            ) : null}
            <div className="mt-2 flex gap-2">
                <button
                    type="button"
                    onClick={() => setIsCombinedShareOpen(true)}
                    disabled={!canCreateSelectionLink}
                    className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <i className="fas fa-link text-xs" aria-hidden="true" />
                    <span className="truncate">Criar link</span>
                </button>
                {canCombineSelection ? (
                    <button
                        type="button"
                        onClick={handleGenerateCombined}
                        aria-label="Gerar PDF combinado"
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-muted)]"
                    >
                        <i className="fas fa-file-pdf text-xs text-[var(--text-muted)]" aria-hidden="true" />
                        PDF
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={handleDeleteSelectedPdfs}
                    disabled={isDeletingSelectedPdfs}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                >
                    <i className={`${isDeletingSelectedPdfs ? 'fas fa-circle-notch animate-spin' : 'fas fa-trash-alt'} text-xs`} aria-hidden="true" />
                    {isDeletingSelectedPdfs ? 'Excluindo...' : 'Excluir'}
                </button>
            </div>
        </div>
    );

    const periodControl = (
        <HistoryPeriodPicker
            isOpen={isDesktopPeriodOpen}
            selectedLabel={periodDisplayLabel}
            rangeLabel={periodRangeLabel}
            draftPeriod={desktopDraftPeriod}
            draftStartDate={desktopDraftStartDate}
            draftEndDate={desktopDraftEndDate}
            activeBoundary={desktopActiveBoundary}
            calendarMonth={desktopCalendarMonth}
            canShiftPeriod={!!periodRange && period !== 'all'}
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
    );

    return (
        <div className="space-y-4 pb-28 sm:pb-0">
            <PdfHistoryMobileToolbar
                totalGroups={groupedHistory.length}
                totalPdfs={totalPdfCount}
                filteredCount={filteredGroupedHistory.length}
                periodLabel={mobilePeriodTriggerLabel}
                searchTerm={searchTerm}
                searchInputRef={searchInputRef}
                onOpenPeriod={openMobilePeriodSelector}
                onSearchChange={handleSearchChange}
                onClearSearch={handleClearSearch}
            />

            <MobileHistoryPeriodSelector
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

            <PdfHistoryDesktopHeader
                totalGroups={groupedHistory.length}
                filteredCount={filteredGroupedHistory.length}
                totalPdfs={totalPdfCount}
                totalOpportunities={historyFunnelTotals.opportunityCount}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                onClearSearch={handleClearSearch}
                onOpenTemplates={() => setIsTemplateModalOpen(true)}
            />

            {pdfs.length > 0 ? (
                <section className="border-0 bg-transparent p-0 shadow-none sm:rounded-[var(--radius-panel)] sm:border sm:border-[var(--border-subtle)] sm:bg-[var(--surface)] sm:p-4 sm:shadow-[var(--shadow-hairline)]">
                    <div className="flex flex-col gap-2 sm:gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="hidden min-w-0 items-center gap-3 sm:flex">
                            <div className="ui-icon-frame h-10 w-10 shrink-0">
                                <Filter className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <p className="ui-kicker">
                                    Encontre rápido
                                </p>
                                <p className="mt-0.5 text-xs font-semibold text-[var(--text-muted)]">
                                    Filtre por status antes de abrir cada atendimento.
                                </p>
                            </div>
                        </div>
                        <HistoryStatusFilters
                            activeFilter={focusFilter}
                            counts={statusFilterCounts}
                            onChange={handleStatusFilterChange}
                        />
                    </div>
                </section>
            ) : null}

            <div ref={reviewPanelRef} className="scroll-mt-4">
                <ReviewRequestsPanel
                    candidates={visibleReviewCampaignCandidates}
                    pendingCount={visiblePendingReviewCampaignCount}
                    copiedKey={copiedReviewRequestKey}
                    onOpenWhatsApp={handleOpenReviewCampaignWhatsApp}
                    onCopyMessage={handleCopyReviewCampaignMessage}
                    onMarkSent={handleMarkReviewRequestSent}
                    onOpenApproved={() => handleStatusFilterChange('approved')}
                />
            </div>

            <MonthlyExpenseSummaryCard
                selectedSummary={selectedExpenseSummary}
                periodControl={periodControl}
                onCopySummary={handleCopyExpenseSummary}
                isExpanded={isExpenseSummaryExpanded}
                onToggleExpanded={() => setIsExpenseSummaryExpanded(current => !current)}
            />

            {(focusFilter !== 'all' || searchTerm.trim()) && groupedHistory.length > 0 ? (
                <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:text-xs">
                            {filteredGroupedHistory.length} de {groupedHistory.length} clientes
                        </span>
                        <span className="hidden items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300 sm:inline-flex sm:text-xs">
                            {historyFunnelTotals.opportunityCount} oportunidades
                        </span>
                        <span className="hidden items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex sm:text-xs">
                            {totalPdfCount} opções
                        </span>
                        {historyFunnelTotals.duplicatedRevenue > 0 ? (
                            <span className="hidden items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300 sm:inline-flex sm:text-xs">
                                Funil {formatNumberBR(historyFunnelTotals.funnelRevenue)}
                            </span>
                        ) : null}
                        {historyFunnelTotals.duplicatedRevenue > 0 ? (
                            <span className="hidden items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300 sm:inline-flex sm:text-xs">
                                Apresentado {formatNumberBR(historyFunnelTotals.presentedRevenue)}
                            </span>
                        ) : null}
                        {focusFilter !== 'all' ? (
                            <button
                                type="button"
                                onClick={handleClearFocusFilter}
                                className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/15 sm:text-xs"
                            >
                                <i className="fas fa-filter text-[10px]" aria-hidden="true"></i>
                                {HISTORY_FOCUS_FILTER_LABELS[focusFilter]}
                                <i className="fas fa-times text-[10px]" aria-hidden="true"></i>
                            </button>
                        ) : null}
                        {searchTerm.trim() ? (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100 sm:text-xs"
                            >
                                <i className="fas fa-times-circle text-[11px]" aria-hidden="true"></i>
                                Limpar busca
                            </button>
                        ) : null}
                    </div>

                    <span className="hidden xl:block" aria-hidden="true" />
                </div>
            ) : null}

            {selectedPdfs.length > 0 && (
                <div className="relative mb-3 hidden rounded-[14px] border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:block">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-50">
                                        {selectedPdfs.length} orçamento{selectedPdfs.length > 1 ? 's' : ''} selecionado{selectedPdfs.length > 1 ? 's' : ''}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                        Envie uma ou várias propostas no mesmo link ou gere um PDF combinado.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClearSelection}
                                    aria-label="Limpar seleção"
                                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                                >
                                    <i className="fas fa-times text-[11px]" aria-hidden="true"></i>
                                    Limpar
                                </button>
                            </div>
                            {selectedPdfs.length < 2 ? (
                                <p className="rounded-[12px] border border-blue-100 bg-blue-50/80 px-3 py-2 text-[11px] leading-5 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100">
                                    Você já pode criar o link desta proposta. Selecione outra opção do mesmo cliente para reuni-las no mesmo link e gerar o PDF combinado.
                                </p>
                            ) : (
                                <div className="space-y-3 rounded-[12px] border border-blue-100 bg-blue-50/80 p-3 text-[11px] leading-5 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100">
                                    <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-300">
                                        <i className="fas fa-comment-dots text-[10px]" aria-hidden="true"></i>
                                        Mensagens sugeridas
                                    </div>
                                    {hasOnlySameClientSelectedPdfs ? (
                                        combinedMessagesEditor
                                    ) : (
                                        <p className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                                            Selecione apenas orçamentos do mesmo cliente para gerar mensagens do PDF combinado.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="grid w-full gap-2 sm:w-auto">
                            <ActionButton
                                onClick={() => setIsCombinedShareOpen(true)}
                                disabled={!hasOnlySameClientSelectedPdfs || !selectedClientForCombinedMessages}
                                variant="primary"
                                size="sm"
                                iconClassName="fas fa-link"
                                className="w-full sm:w-auto"
                            >
                                Criar link com selecionadas
                            </ActionButton>
                            <ActionButton
                                onClick={handleDeleteSelectedPdfs}
                                disabled={isDeletingSelectedPdfs}
                                loading={isDeletingSelectedPdfs}
                                loadingText="Excluindo..."
                                variant="danger"
                                size="sm"
                                iconClassName="fas fa-trash-alt"
                                className="w-full sm:w-auto"
                            >
                                Excluir selecionadas
                            </ActionButton>
                            <ActionButton
                                onClick={handleGenerateCombined}
                                disabled={selectedPdfs.length < 2 || !hasOnlySameClientSelectedPdfs}
                                variant="secondary"
                                size="sm"
                                iconClassName="fas fa-file-pdf"
                                className="w-full sm:w-auto"
                            >
                                Gerar PDF Combinado
                            </ActionButton>
                        </div>
                    </div>
                </div>
            )}
            <HistoryListToolbar
                count={filteredGroupedHistory.length}
                total={groupedHistory.length}
                sort={historySort}
                onSortChange={(nextSort) => {
                    setHistorySort(nextSort);
                    resetHistoryViewport();
                }}
            />
            <div>
                {displayedHistory.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 items-start gap-2 sm:gap-3 2xl:grid-cols-2">
                            {displayedHistory.map(group => (
                                <ClientHistoryGroup key={group.client.id} group={group} />
                            ))}
                        </div>

                        {(visibleCount < organizedGroupedHistory.length || hasMoreServerPdfs) && (
                            <div className="flex justify-center pt-3 sm:pt-4">
                                <ActionButton
                                    onClick={handleLoadMore}
                                    variant="secondary"
                                    iconClassName="fas fa-chevron-down"
                                    disabled={isLoadingMoreServerPdfs}
                                >
                                    {isLoadingMoreServerPdfs ? 'Carregando...' : 'Carregar mais'}
                                </ActionButton>
                            </div>
                        )}
                    </>
                ) : (
                    isLoadingMoreServerPdfs ? (
                        <ContentState
                            iconClassName="fas fa-spinner fa-spin"
                            title="Carregando histórico"
                            description="Buscando os orçamentos mais recentes..."
                        />
                    ) : searchTerm ? (
                        <ContentState
                            compact
                            iconClassName="fas fa-search"
                            title="Nenhum resultado encontrado"
                            description="Tente buscar por outro cliente, data ou valor."
                        />
                    ) : pdfs.length > 0 ? (
                        <ContentState
                            iconClassName="fas fa-calendar-alt"
                            title="Nenhum orçamento neste período"
                            description="Ajuste o filtro de datas ou escolha Todo o período para ver tudo."
                        />
                    ) : (
                        <ContentState
                            iconClassName="fas fa-history"
                            title="Nenhum orçamento salvo"
                            description="Quando você gerar um orçamento, ele aparece aqui."
                        />
                    ))}
            </div>
            <WhatsAppChooserModal
                clientName={selectedClientForCombinedMessages?.nome || 'cliente'}
                phone={normalizedCombinedClientPhone}
                message={combinedWhatsAppMessage}
                onClose={() => setCombinedWhatsAppMessage(null)}
            />
            {selectedClientForCombinedMessages ? (
                <ProposalShareModal
                    isOpen={isCombinedShareOpen}
                    client={selectedClientForCombinedMessages}
                    pdfs={selectedPdfs}
                    onClose={() => setIsCombinedShareOpen(false)}
                />
            ) : null}
            {singleProposalShare ? (
                <ProposalShareModal
                    isOpen
                    client={singleProposalShare.client}
                    pdfs={[singleProposalShare.pdf]}
                    messageOptions={singleProposalShare.messages}
                    onClose={() => setSingleProposalShare(null)}
                />
            ) : null}
            <WhatsAppChooserModal
                clientName={reviewCampaignWhatsApp?.clientName || 'cliente'}
                phone={reviewCampaignWhatsApp?.phone || null}
                message={reviewCampaignWhatsApp?.message || null}
                onClose={() => setReviewCampaignWhatsApp(null)}
            />
            <Modal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                title="Editar textos prontos"
                fullScreenOnMobile
                footer={
                    <>
                        <ActionButton onClick={handleResetTemplates} variant="ghost" size="sm">
                            Restaurar padrão
                        </ActionButton>
                        <ActionButton onClick={handleSaveTemplates} variant="primary" size="sm" iconClassName="fas fa-save">
                            Salvar textos
                        </ActionButton>
                    </>
                }
            >
                <div className="space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Personalize os 3 textos enviados junto com o link da proposta. O link entra no fim da mensagem, ou onde você colocar {'{{link}}'}. Você pode usar:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {['{{cliente}}', '{{primeiroNome}}', '{{peliculas}}', '{{garantia}}', '{{valor}}', '{{link}}', '{{validade}}'].map(token => (
                            <span
                                key={token}
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                            >
                                {token}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    {draftMessageTemplates.map((template, index) => (
                        <label key={`template-${index}`} className="block space-y-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Texto {index + 1}
                            </span>
                            <textarea
                                value={template}
                                onChange={(event) => {
                                    const nextTemplates = [...draftMessageTemplates];
                                    nextTemplates[index] = event.target.value;
                                    setDraftMessageTemplates(nextTemplates);
                                }}
                                rows={4}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-slate-500 dark:focus:ring-slate-700"
                            />
                        </label>
                    ))}
                </div>
            </Modal>

            {/* Tela do cliente (mobile): todas as opções em lista vertical; ações da seleção fixas embaixo */}
            {optionsModalClientId != null && (() => {
                const group = organizedGroupedHistory.find(item => item.client.id === optionsModalClientId);
                if (!group) return null;
                const { client, pdfs: groupPdfs } = group;
                const funnelSummary = buildFunnelTotals(groupPdfs, funnelReferencePdfIds);
                const total = groupPdfs.length;
                const selectedInGroupCount = groupPdfs.filter(pdf => selectedPdfIds.has(pdf.id!)).length;
                const areAllPdfsInGroupSelected = selectedInGroupCount === total;
                const groupStatus = getHistoryGroupStatus(groupPdfs);
                const isSelectionMode = isSelectingOptions || selectedInGroupCount > 0;

                return createPortal(
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Opções de ${client.nome}`}
                        className="fixed inset-0 z-[60] flex flex-col bg-[var(--app-bg)] pt-[env(safe-area-inset-top,0px)] sm:hidden"
                    >
                        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-2">
                            <button
                                type="button"
                                onClick={closeOptionsModal}
                                aria-label="Fechar"
                                className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-[var(--surface-muted)] dark:text-slate-300"
                            >
                                <i className="fas fa-arrow-left text-base" aria-hidden="true" />
                            </button>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold leading-tight text-[var(--text-strong)]">
                                    {client.nome}
                                </p>
                                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${groupStatus.tone.dotClassName}`} aria-hidden="true" />
                                    <span className="truncate">
                                        {groupStatus.tone === PDF_STATUS_META.approved ? groupStatus.text : groupStatus.tone.label} · {total} {total === 1 ? 'opção' : 'opções'}
                                    </span>
                                </p>
                            </div>
                            {isSelectionMode ? (
                                <>
                                    {total > 1 ? (
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSelectGroup(groupPdfs)}
                                            aria-label={areAllPdfsInGroupSelected ? 'Desmarcar todas as opções' : 'Selecionar todas as opções'}
                                            className="inline-flex h-8 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold text-[var(--brand-primary)] transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                        >
                                            {areAllPdfsInGroupSelected ? 'Nenhuma' : 'Todas'}
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => handleCancelGroupSelection(groupPdfs)}
                                        className="inline-flex h-8 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                                    >
                                        Cancelar
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsSelectingOptions(true)}
                                    className="inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-semibold text-[var(--brand-primary)] transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                >
                                    Selecionar
                                </button>
                            )}
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3">
                            <div className="space-y-2.5">
                                {groupPdfs.map(pdf => (
                                    <PdfHistoryItem
                                        key={pdf.id}
                                        pdf={pdf}
                                        client={client}
                                        agendamento={agendamentosByPdfId[pdf.id!]}
                                        onDownload={onDownload}
                                        onDelete={onDelete}
                                        onUpdateStatus={onUpdateStatus}
                                        onRenamePdfOption={onRenamePdfOption}
                                        onSchedule={onSchedule}
                                        onOpenInAgenda={onOpenInAgenda}
                                        films={films}
                                        messageTemplates={messageTemplates}
                                        googleReviewsLink={googleReviewsLink}
                                        isSelected={selectedPdfIds.has(pdf.id!)}
                                        onToggleSelect={handleToggleSelect}
                                        onNavigateToOption={onNavigateToOption}
                                        isFunnelReference={funnelSummary.opportunities.some(opportunity => opportunity.referencePdf.id === pdf.id)}
                                        canChooseFunnelReference={hasFunnelAlternatives(funnelSummary.opportunities, pdf.id)}
                                        onSetFunnelReference={handleSetFunnelReference}
                                        onShare={handleOpenSingleProposalShare}
                                        fitContent
                                        selectable={isSelectionMode}
                                    />
                                ))}
                            </div>
                        </div>

                        {selectedPdfs.length > 0 ? (
                            <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)] px-3 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
                                {selectionActions}
                            </div>
                        ) : null}
                    </div>,
                    document.body
                );
            })()}

            {selectedPdfs.length > 0 && optionsModalClientId == null ? (
                <div
                    className="fixed left-3 right-3 z-40 sm:hidden"
                    style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
                >
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-white/95 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:bg-slate-900/95">
                        {selectionActions}
                    </div>
                </div>
            ) : (
                <PdfHistoryMobileFooter
                    onSearch={handleFocusSearch}
                    onOpenPeriod={openMobilePeriodSelector}
                    onFollowUp={handleOpenFollowUp}
                    followUpPending={visiblePendingReviewCampaignCount}
                    onOpenTemplates={() => setIsTemplateModalOpen(true)}
                    onCreateProposal={onCreateProposal}
                />
            )}

            <Modal
                isOpen={isCombinedMessagesOpen && selectedPdfs.length > 1}
                onClose={() => setIsCombinedMessagesOpen(false)}
                title="Mensagens para o PDF combinado"
            >
                {hasOnlySameClientSelectedPdfs ? combinedMessagesEditor : (
                    <p className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                        Selecione apenas orçamentos do mesmo cliente para gerar mensagens do PDF combinado.
                    </p>
                )}
            </Modal>
        </div>
    );
};

export default PdfHistoryView;

