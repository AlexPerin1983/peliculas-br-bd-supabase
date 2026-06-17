import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    BarChart3,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    ClipboardCopy,
    FileText,
    Filter,
    LockKeyhole,
    MessageSquareText,
    Pencil,
    ReceiptText,
    Search,
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

interface PdfHistoryViewProps {
    pdfs: SavedPDF[];
    clients: Client[];
    agendamentos: Agendamento[];
    films: Film[];
    googleReviewsLink?: string;
    onDelete: (pdfId: number) => void;
    onDownload: (pdf: SavedPDF, filename: string) => void;
    onUpdateStatus: (pdfId: number, status: SavedPDF['status']) => void;
    onSchedule: (info: { pdf: SavedPDF; agendamento?: Agendamento } | { agendamento: Agendamento; pdf?: SavedPDF }) => void;
    onGenerateCombinedPdf: (pdfs: SavedPDF[]) => void;
    onNavigateToOption: (clientId: number, optionId: number) => void;
}

type HistoryFocusFilter = 'all' | 'pending' | 'approved' | 'revised' | 'expenses' | 'expired';
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
    revised: 'Revisar',
    expenses: 'Com gastos',
    expired: 'Vencidos'
};

const HISTORY_PERIOD_OPTIONS: { key: HistoryPeriodKey; label: string }[] = [
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
    { key: 'year', label: 'Este ano' },
    { key: 'all', label: 'Todo o periodo' }
];

const HISTORY_MOBILE_PERIOD_OPTIONS: { key: HistoryPeriodKey; label: string }[] = [
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
    month: 'Este mes',
    previousMonth: 'Mes passado',
    year: 'Este ano',
    all: 'Todo o periodo'
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
        return { range: null, startError: 'A data inicial nao pode ficar no futuro.', endError: null };
    }

    if (end > today) {
        return { range: null, startError: null, endError: 'A data final nao pode ficar no futuro.' };
    }

    if (start > end) {
        return { range: null, startError: 'A data inicial precisa vir antes da final.', endError: 'Revise o periodo.' };
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
    return hasSameTemplates(templates, LEGACY_PDF_MESSAGE_TEMPLATES)
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

const saveReadyMessageOverrides = (overrideKey: string, messages: string[]) => {
    if (typeof window === 'undefined') return;

    try {
        const rawOverrides = window.localStorage.getItem(PDF_READY_MESSAGE_OVERRIDES_STORAGE_KEY);
        const parsedOverrides = rawOverrides ? JSON.parse(rawOverrides) : {};
        window.localStorage.setItem(
            PDF_READY_MESSAGE_OVERRIDES_STORAGE_KEY,
            JSON.stringify({
                ...parsedOverrides,
                [overrideKey]: messages,
            })
        );
    } catch (error) {
        console.error('Erro ao salvar mensagens editadas do orçamento:', error);
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

const buildWarrantyText = (films: Film[], filmNames: string[]) => {
    const matchedFilms = filmNames
        .map(name => films.find(film => film.nome === name))
        .filter((film): film is Film => Boolean(film));

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
    const warrantyText = buildWarrantyText(films, orderedFilmNames);
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
        garantia: buildWarrantyText(films, filmNames),
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
    const warrantyText = buildWarrantyText(films, filmNames);
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
        return `intent://send?phone=${phone}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
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

                <div className="grid gap-3 sm:grid-cols-2">
                    <a
                        href={regularUrl}
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
                    >
                        <i className="fab fa-whatsapp text-base"></i>
                        WhatsApp
                    </a>

                    <a
                        href={businessUrl}
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                        <i className="fas fa-briefcase text-sm"></i>
                        WhatsApp Business
                    </a>
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
        <section className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)] sm:p-4">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-3 py-2 sm:px-0 sm:pb-3 sm:pt-0 lg:items-center">
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 sm:flex">
                        <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <p className="ui-kicker">Avaliacoes locais</p>
                        </div>
                        <h2 className="mt-0.5 truncate text-[15px] font-bold leading-tight text-[var(--text-strong)] sm:text-lg">
                            Fila de avaliacao
                        </h2>
                        <p className="mt-1 hidden text-xs leading-relaxed text-[var(--text-muted)] sm:block">
                            Clientes aprovados/concluidos no periodo, com mensagem pronta usando o link do Google.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsQueueOpen((prev) => !prev)}
                    aria-expanded={isQueueOpen}
                    aria-label={isQueueOpen ? 'Recolher fila de avaliacao' : 'Expandir fila de avaliacao'}
                    className="flex shrink-0 items-center gap-1.5 sm:hidden"
                >
                    <span className="inline-flex h-7 items-center rounded-full bg-emerald-500/10 px-2.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-200">
                        {pendingCount} pend.
                    </span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                        <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isQueueOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </span>
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
                                    {formatReviewCandidateDate(candidate)} · {candidate.pdf.proposalOptionName || 'Servico aprovado'}
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
                                    aria-label={`Copiar mensagem de avaliacao de ${candidate.client.nome}`}
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
                                    aria-label={`Marcar pedido de avaliacao de ${candidate.client.nome} como feito`}
                                    title={isSent ? 'Avaliacao ja solicitada' : 'Marcar como feito'}
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
                                        {formatReviewCandidateDate(candidate)} - {candidate.pdf.proposalOptionName || 'Servico aprovado'}
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
                                    aria-label={`Marcar pedido de avaliacao de ${candidate.client.nome} como feito`}
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
                    Dica: marque como feito depois de enviar para nao pedir avaliacao duplicada.
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
        label: 'Revisao',
        chipClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
        dotClassName: 'bg-amber-500',
    },
    pending: {
        label: 'Pendente',
        chipClassName: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        dotClassName: 'bg-slate-400',
    },
} as const;

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
            text: 'Revisao pendente',
            tone: PDF_STATUS_META.revised,
        };
    }

    return {
        text: 'Aguardando resposta',
        tone: PDF_STATUS_META.pending,
    };
};

const PdfHistoryMobileToolbar: React.FC<{
    totalGroups: number;
    filteredCount: number;
    periodLabel: string;
    searchTerm: string;
    isSearchActive: boolean;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    onOpenPeriod: () => void;
    onCloseSearch: () => void;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
}> = ({
    totalGroups,
    filteredCount,
    periodLabel,
    searchTerm,
    isSearchActive,
    searchInputRef,
    onOpenPeriod,
    onCloseSearch,
    onSearchChange,
    onClearSearch,
}) => {
    if (isSearchActive) {
        return (
            <section className="sm:hidden">
                <div className="rounded-[18px] border border-slate-200/80 bg-white/96 p-2 shadow-[0_8px_18px_rgba(15,23,42,0.05)] dark:border-slate-700/70 dark:bg-slate-900/95">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onCloseSearch}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            aria-label="Fechar busca"
                        >
                            <i className="fas fa-arrow-left text-[13px]" aria-hidden="true"></i>
                        </button>

                        <label className="relative flex-1">
                            <i
                                className="fas fa-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-slate-500"
                                aria-hidden="true"
                            ></i>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder="Buscar por cliente, proposta..."
                                className="h-10 w-full rounded-[14px] border border-slate-200 bg-slate-50/90 pl-9 pr-9 text-[13px] font-medium text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800"
                            />
                            {searchTerm ? (
                                <button
                                    type="button"
                                    onClick={onClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                                    aria-label="Limpar busca"
                                >
                                    <i className="fas fa-times-circle text-[13px]" aria-hidden="true"></i>
                                </button>
                            ) : null}
                        </label>
                    </div>

                    <div className="pl-11 pt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {searchTerm.trim()
                            ? `${filteredCount} clientes em foco`
                            : totalGroups > 0
                              ? 'Busque por cliente, proposta, data ou valor'
                              : 'Seus orçamentos aparecerão aqui'}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="sm:hidden">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <h1 className="min-w-0 truncate text-2xl font-bold leading-tight text-[var(--text-strong)]">
                        Histórico
                    </h1>
                    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-[var(--surface-muted)] px-2 text-[10px] font-bold text-[var(--text-muted)]">
                        {totalGroups}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onOpenPeriod}
                    aria-label={`Abrir periodo do historico: ${periodLabel}`}
                    title={periodLabel}
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text-strong)] shadow-[var(--shadow-hairline)] transition-colors hover:bg-[var(--surface-muted)]"
                >
                    <CalendarDays className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                    <span>{periodLabel}</span>
                </button>
            </div>
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
                    aria-label="Periodo anterior"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => onShiftPeriod(1)}
                    disabled={!canShiftPeriod}
                    aria-label="Proximo periodo"
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
                        aria-label="Filtro de data do historico"
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
                                    aria-label="Mes anterior"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                                >
                                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                </button>
                                <p className="text-sm font-bold tracking-wide text-slate-900 dark:text-slate-50">{formatMonthTitle(calendarMonth)}</p>
                                <button
                                    type="button"
                                    onClick={() => onChangeCalendarMonth(addMonths(calendarMonth, 1))}
                                    aria-label="Proximo mes"
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
    const manualErrorMessage = manualValidation.startError || manualValidation.endError || 'Data invalida.';

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
                        {HISTORY_MOBILE_PERIOD_OPTIONS.map(option => {
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
                                        'ui-field h-14 w-full px-3 text-lg font-bold',
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

const HistoryStatusFilters: React.FC<{
    activeFilter: HistoryFocusFilter;
    counts: Record<HistoryFocusFilter, number>;
    onChange: (filter: HistoryFocusFilter) => void;
}> = ({ activeFilter, counts, onChange }) => {
    const filters: { key: HistoryFocusFilter; label: string; dotClassName: string; activeClassName: string }[] = [
        { key: 'all', label: 'Todos', dotClassName: 'bg-slate-400', activeClassName: 'border-blue-500/70 bg-blue-500/10 text-blue-700 dark:border-blue-400/60 dark:text-blue-200' },
        { key: 'pending', label: 'Pendentes', dotClassName: 'bg-slate-400', activeClassName: 'border-slate-400/70 bg-slate-500/10 text-slate-700 dark:border-slate-400/60 dark:text-slate-200' },
        { key: 'approved', label: 'Aprovados', dotClassName: 'bg-emerald-500', activeClassName: 'border-emerald-500/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/60 dark:text-emerald-200' },
        { key: 'revised', label: 'Revisar', dotClassName: 'bg-amber-500', activeClassName: 'border-amber-500/70 bg-amber-500/10 text-amber-700 dark:border-amber-400/60 dark:text-amber-200' },
        { key: 'expired', label: 'Vencidos', dotClassName: 'bg-rose-500', activeClassName: 'border-rose-500/70 bg-rose-500/10 text-rose-700 dark:border-rose-400/60 dark:text-rose-200' },
        { key: 'expenses', label: 'Com gastos', dotClassName: 'bg-blue-500', activeClassName: 'border-blue-500/70 bg-blue-500/10 text-blue-700 dark:border-blue-400/60 dark:text-blue-200' }
    ];

    return (
        <div className="-mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0">
            {filters.map(filter => {
                const isActive = activeFilter === filter.key;

                return (
                    <button
                        key={filter.key}
                        type="button"
                        aria-label={`${filter.label}: ${counts[filter.key] || 0}`}
                        onClick={() => onChange(filter.key)}
                        className={[
                            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 text-[10px] font-bold transition-colors duration-200 sm:h-10 sm:gap-2 sm:px-3 sm:text-xs',
                            isActive
                                ? `${filter.activeClassName} shadow-[var(--shadow-hairline)]`
                                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-strong)]'
                        ].join(' ')}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${filter.dotClassName}`} aria-hidden="true" />
                        <span>{filter.label}</span>
                        <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black ${isActive ? 'bg-white/60 text-current dark:bg-white/10' : 'bg-[var(--surface-muted)] text-slate-400'}`}>
                            {counts[filter.key] || 0}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

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
    const summaryHeader = (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
                {/* No mobile recolhido vira barra fina e tocavel (titulo + Resultado + seta). No desktop nao e clicavel. */}
                <button
                    type="button"
                    onClick={onToggleExpanded}
                    className="flex w-full items-center justify-between gap-2 text-left sm:pointer-events-none sm:w-auto sm:justify-start"
                >
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="ui-kicker">Resumo do periodo</span>
                        <span className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-muted)]">
                            {selectedSummary.opportunityCount} oportunidade{selectedSummary.opportunityCount === 1 ? '' : 's'}
                        </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 sm:hidden">
                        <span className={`truncate text-sm font-bold ${resultTone}`}>
                            {formatNumberBR(selectedSummary.estimatedProfit)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                    </span>
                </button>
                <div className="mt-3 hidden grid-cols-3 gap-2 sm:grid sm:max-w-[560px]">
                    {compactStats.map(stat => (
                        <div key={stat.label} className="min-w-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
                            <p className="truncate text-[10px] font-bold uppercase text-[var(--text-soft)]">{stat.label}</p>
                            <p className={`mt-1 truncate text-sm font-bold text-[var(--text-strong)] sm:text-base ${stat.className || ''}`}>{stat.value}</p>
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
                    <div key={label} className="ui-card min-h-[112px] p-3.5 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] ${tone}`}>
                                <Icon className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <span className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                                {label}
                            </span>
                        </div>
                        <p className="mt-4 truncate text-xl font-bold tracking-[-0.03em] text-[var(--text-strong)] sm:text-2xl">
                            {value}
                        </p>
                        <p className="mt-1 truncate text-xs font-semibold text-[var(--text-muted)]">
                            {hint}
                        </p>
                    </div>
                ))}
            </div>

            <div className="ui-card grid overflow-visible lg:grid-cols-[minmax(0,1fr)_390px]">
                <div className="border-b border-[var(--border-subtle)] p-4 sm:p-5 lg:border-b-0 lg:border-r">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                        <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                        Interno
                    </span>
                    <h3 className="mt-3 text-lg font-bold text-[var(--text-strong)]">
                        Fechamento de gastos
                    </h3>
                    <p className="mt-1 max-w-[34rem] text-sm leading-6 text-[var(--text-muted)]">
                        Pipeline real conta uma opção por oportunidade. Alternativas continuam registradas.
                    </p>

                    <div className="mt-5 grid gap-2">
                        <button
                            type="button"
                            onClick={onCopySummary}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-emerald-600 px-3 text-xs font-bold text-white shadow-[var(--shadow-hairline)] transition-colors duration-200 hover:bg-emerald-500"
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
                                    Nenhum gasto manual lançado neste periodo.
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
            <div className="ui-card overflow-visible p-3 sm:p-4">
                {summaryHeader}
            </div>

            {isExpanded ? (
                <div className="hidden sm:block sm:space-y-3">
                    {expandedDetails}
                </div>
            ) : null}

            {isExpanded ? createPortal(
                <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--surface)] sm:hidden">
                    <header className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
                        <button
                            type="button"
                            onClick={onToggleExpanded}
                            aria-label="Fechar resumo do periodo"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
                        >
                            <i className="fas fa-arrow-left text-[13px]" aria-hidden="true"></i>
                        </button>
                        <div className="min-w-0">
                            <p className="ui-kicker">Resumo do periodo</p>
                            <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                                {selectedSummary.opportunityCount} oportunidade{selectedSummary.opportunityCount === 1 ? '' : 's'}
                            </p>
                        </div>
                    </header>
                    <div className="flex-1 overflow-y-auto p-4">
                        {expandedDetails}
                    </div>
                </div>,
                document.body
            ) : null}
        </section>
    );
};

const PdfHistoryItem: React.FC<{
    pdf: SavedPDF;
    client: Client;
    agendamento: Agendamento | undefined;
    onDownload: (pdf: SavedPDF, filename: string) => void;
    onDelete: (id: number) => void;
    onUpdateStatus: (id: number, status: SavedPDF['status']) => void;
    onSchedule: (info: { pdf: SavedPDF; agendamento?: Agendamento } | { agendamento: Agendamento; pdf?: SavedPDF }) => void;
    films: Film[];
    messageTemplates: string[];
    googleReviewsLink?: string;
    isSelected: boolean;
    onToggleSelect: (id: number) => void;
    onNavigateToOption: (clientId: number, optionId: number) => void;
    isFunnelReference: boolean;
    onSetFunnelReference: (pdf: SavedPDF) => void;
    fitContent?: boolean;
}> = React.memo(({ pdf, client, agendamento, onDownload, onDelete, onUpdateStatus, onSchedule, films, messageTemplates, googleReviewsLink, isSelected, onToggleSelect, onNavigateToOption, isFunnelReference, onSetFunnelReference, fitContent = false }) => {
    const { showToast } = useFeedback();
    const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null);
    const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
    const [selectedMessageIndex, setSelectedMessageIndex] = useState(0);
    const [isEditingMessage, setIsEditingMessage] = useState(false);
    const [whatsAppMessage, setWhatsAppMessage] = useState<string | null>(null);

    const handleActionClick = (status: SavedPDF['status']) => {
        onUpdateStatus(pdf.id!, status);
    };

    const StatusBadge: React.FC<{ status?: SavedPDF['status'] }> = ({ status = 'pending' }) => {
        const meta = PDF_STATUS_META[status];
        return (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.chipClassName}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`}></span>
                {meta.label}
            </span>
        );
    };

    const expirationDate = pdf.expirationDate ? new Date(pdf.expirationDate) : null;
    const isExpired = isExpiredOpenPdf(pdf);
    const persuasiveMessages = useMemo(() => {
        const context = buildPdfMessageContext(pdf, client.nome, films);
        return messageTemplates.map(template => renderPdfMessageTemplate(template, context));
    }, [pdf, client.nome, films, messageTemplates]);
    const readyMessageOverrideKey = useMemo(() => getReadyMessageOverrideKey(pdf), [pdf.id, pdf.clienteId, pdf.nomeArquivo, pdf.date]);
    const [editableMessages, setEditableMessages] = useState<string[]>(() => (
        readReadyMessageOverrides(readyMessageOverrideKey) || persuasiveMessages
    ));
    const reviewFollowUpMessage = useMemo(() => {
        if (pdf.status !== 'approved') return '';
        return buildReviewFollowUpMessage(pdf, client, googleReviewsLink);
    }, [pdf, client, googleReviewsLink]);
    const normalizedPhone = useMemo(() => normalizeWhatsappPhone(client.telefone), [client.telefone]);

    useEffect(() => {
        setEditableMessages(readReadyMessageOverrides(readyMessageOverrideKey) || persuasiveMessages);
    }, [readyMessageOverrideKey, persuasiveMessages]);

    const handleReadyMessageChange = useCallback((index: number, value: string) => {
        setEditableMessages(current => {
            const nextMessages = current.map((message, messageIndex) => (
                messageIndex === index ? value : message
            ));
            saveReadyMessageOverrides(readyMessageOverrideKey, nextMessages);
            return nextMessages;
        });
    }, [readyMessageOverrideKey]);

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

    return (
        <div className={`relative overflow-hidden rounded-[var(--radius-panel)] bg-[var(--surface-muted)] ring-1 ring-[var(--border-subtle)] ${fitContent ? '' : 'h-full'}`}>
            {/* Conteúdo do card */}
            <div className={`relative z-10 w-full ${fitContent ? '' : 'h-full'}`}>
                {/* Status accent bar */}
                <div className={`absolute bottom-0 left-0 top-0 z-20 w-[3px] rounded-l-[12px] ${
                    pdf.status === 'approved' ? 'bg-emerald-500' :
                    pdf.status === 'revised'  ? 'bg-amber-400' :
                                                'bg-slate-300 dark:bg-slate-600'
                }`} />

                <div className="relative z-10 w-full rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">

                    {/* Row 1: checkbox + titulo + acoes */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(pdf.id!)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 flex-shrink-0 text-slate-800 border-slate-300 rounded focus:ring-slate-500 cursor-pointer"
                            aria-label="Selecionar para PDF combinado"
                        />
                        <div className="flex-grow min-w-0">
                            {pdf.proposalOptionName && (
                                pdf.proposalOptionId ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onNavigateToOption(pdf.clienteId, pdf.proposalOptionId!); }}
                                        className="w-full truncate text-left text-[15px] font-semibold leading-tight tracking-[-0.02em] text-slate-900 transition-colors hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                                    >
                                        {pdf.proposalOptionName}
                                    </button>
                                ) : (
                                    <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                                        {pdf.proposalOptionName}
                                    </p>
                                )
                            )}
                            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                                {new Date(pdf.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div className="flex items-center gap-0.5 text-slate-400 flex-shrink-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); onDownload(pdf, pdf.nomeArquivo); }}
                                className="flex h-8 w-8 items-center justify-center rounded-[10px] text-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                                aria-label="Baixar PDF"
                            >
                                <i className="fas fa-download"></i>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(pdf.id!); }}
                                className="flex h-8 w-8 items-center justify-center rounded-[10px] text-sm text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                                aria-label="Excluir PDF"
                            >
                                <i className="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>

                    {/* Row 2: status + validade */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <StatusBadge status={pdf.status} />
                        {pdf.archivedAt && (
                            <span
                                title="O arquivo foi removido para economizar espaço. O PDF é gerado novamente ao baixar."
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            >
                                <i className="fas fa-box-archive text-[9px]" aria-hidden="true" />
                                Arquivado
                            </span>
                        )}
                        {expirationDate && (
                            <span className={`text-[11px] ${isExpired ? 'font-semibold text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                                {isExpired ? <><i className="fas fa-exclamation-circle mr-1"/>Vencido</> : <>Vence {expirationDate.toLocaleDateString('pt-BR')}</>}
                            </span>
                        )}
                        {reviewFollowUpMessage ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                <i className="fas fa-star text-[9px]" aria-hidden="true" />
                                Avaliação pronta
                            </span>
                        ) : null}
                        {isFunnelReference ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                                <i className="fas fa-bullseye text-[9px]" aria-hidden="true" />
                                Valor do funil
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSetFunnelReference(pdf);
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-900/70 dark:hover:bg-blue-950/25 dark:hover:text-blue-300"
                            >
                                <i className="fas fa-bullseye text-[9px]" aria-hidden="true" />
                                Marcar principal
                            </button>
                        )}
                    </div>

                    {/* Ações rápidas de status (substituem o antigo swipe) */}
                    <div className="mt-2.5 flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleActionClick(pdf.status === 'revised' ? 'pending' : 'revised'); }}
                            aria-pressed={pdf.status === 'revised'}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                                pdf.status === 'revised'
                                    ? 'bg-amber-400 text-white shadow-sm'
                                    : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40'
                            }`}
                        >
                            <i className="fas fa-eye text-[10px]" aria-hidden="true" />
                            Revisar
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleActionClick(pdf.status === 'approved' ? 'pending' : 'approved'); }}
                            aria-pressed={pdf.status === 'approved'}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                                pdf.status === 'approved'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40'
                            }`}
                        >
                            <i className="fas fa-check text-[10px]" aria-hidden="true" />
                            Aprovado
                        </button>
                    </div>

                    {/* Row 3: filmes */}
                    {pdf.measurements && pdf.measurements.length > 0 && (() => {
                        const filmMap = new Map<string, number>();
                        pdf.measurements!.forEach(m => {
                            if (m.pelicula) {
                                const m2 = (parseFloat(String(m.largura).replace(',', '.')) * parseFloat(String(m.altura).replace(',', '.'))) * (m.quantidade || 1) / 10000;
                                filmMap.set(m.pelicula, (filmMap.get(m.pelicula) || 0) + m2);
                            }
                        });
                        if (filmMap.size === 0) return null;
                        return (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {Array.from(filmMap.entries()).map(([nome, m2]) => (
                                    <span key={nome} style={{ fontSize: '9px' }} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-700 dark:text-slate-400 font-medium leading-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0" />
                                        {nome} · {m2.toFixed(2).replace('.', ',')} m2
                                    </span>
                                ))}
                            </div>
                        );
                    })()}

                    {/* Row 4: metragem + agendamento + preco */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                {pdf.totalM2.toFixed(2).replace('.', ',')} m2
                            </span>
                            {agendamento ? (
                                <button onClick={() => onSchedule({ pdf, agendamento })} className="text-left">
                                    <div className="flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                                        <i className="fas fa-check-circle mr-1 text-[9px]"></i>
                                        {new Date(agendamento.start).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </button>
                            ) : (
                                <button
                                    onClick={() => onSchedule({ pdf })}
                                    className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-semibold text-slate-500 transition-all hover:border-slate-800 hover:bg-slate-800 hover:text-white dark:border-slate-600 dark:text-slate-400"
                                >
                                    <i className="fas fa-calendar-plus text-[9px]"></i>
                                    Agendar
                                </button>
                            )}
                        </div>
                        <p className="text-base font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatNumberBR(pdf.totalPreco)}
                        </p>
                    </div>

                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700/60">
                        {reviewFollowUpMessage ? (
                            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-3.5 dark:border-emerald-800/60 dark:bg-emerald-950/20">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
                                            Pós-venda e avaliação
                                        </p>
                                        <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-200/80">
                                            Use essa mensagem depois da instalação para pedir fotos e a avaliação.
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded-full border border-emerald-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-200">
                                        Google
                                    </span>
                                </div>
                                <div className="mt-3 rounded-[18px] border border-white/70 bg-white/90 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:border-slate-800/70 dark:bg-slate-950/30">
                                    <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700 dark:text-slate-200">
                                        {reviewFollowUpMessage}
                                    </p>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <ActionButton
                                        onClick={() => handleOpenWhatsApp(reviewFollowUpMessage)}
                                        variant="ghost"
                                        size="sm"
                                        iconClassName="fab fa-whatsapp"
                                        className="w-full justify-center bg-white/80 dark:bg-slate-900/40"
                                    >
                                        WhatsApp
                                    </ActionButton>
                                    <ActionButton
                                        onClick={() => handleCopyMessage(reviewFollowUpMessage, 'review-follow-up')}
                                        variant={copiedMessageKey === 'review-follow-up' ? 'secondary' : 'primary'}
                                        size="sm"
                                        iconClassName={copiedMessageKey === 'review-follow-up' ? 'fas fa-check' : 'fas fa-copy'}
                                        className="w-full justify-center"
                                    >
                                        {copiedMessageKey === 'review-follow-up' ? 'Copiado' : 'Copiar texto'}
                                    </ActionButton>
                                </div>
                            </div>
                        ) : null}
                        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-700/70 dark:bg-slate-900/25">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                        Mensagens prontas
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Escolha a mensagem que fizer mais sentido e envie sem precisar ajustar tudo manualmente.
                                    </p>
                                </div>
                                <ActionButton
                                    onClick={() => setIsMessagesExpanded(current => !current)}
                                    variant="ghost"
                                    size="sm"
                                    iconClassName={isMessagesExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'}
                                    className="w-full justify-center sm:w-auto"
                                >
                                    {isMessagesExpanded ? 'Recolher' : 'Ver mensagens'}
                                </ActionButton>
                            </div>
                            {isMessagesExpanded && editableMessages.length > 0 && (() => {
                                const safeIndex = Math.min(Math.max(selectedMessageIndex, 0), editableMessages.length - 1);
                                const message = editableMessages[safeIndex];
                                return (
                                    <div className="space-y-2.5">
                                        {editableMessages.length > 1 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {editableMessages.map((_, idx) => (
                                                    <button
                                                        key={`${pdf.id}-message-pill-${idx}`}
                                                        type="button"
                                                        onClick={() => { setSelectedMessageIndex(idx); setIsEditingMessage(false); }}
                                                        aria-pressed={idx === safeIndex}
                                                        aria-label={`Mensagem ${idx + 1}`}
                                                        className={`h-7 min-w-[1.75rem] rounded-full px-2.5 text-[12px] font-semibold tabular-nums transition-colors ${
                                                            idx === safeIndex
                                                                ? 'bg-blue-600 text-white shadow-sm'
                                                                : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        {idx + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="rounded-[16px] border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/25">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                                    Mensagem {safeIndex + 1} de {editableMessages.length}
                                                </p>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingMessage(current => !current)}
                                                        aria-label={isEditingMessage ? `Concluir edição da mensagem ${safeIndex + 1}` : `Editar mensagem ${safeIndex + 1}`}
                                                        aria-pressed={isEditingMessage}
                                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                                                            isEditingMessage
                                                                ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
                                                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        <i className={`${isEditingMessage ? 'fas fa-check' : 'fas fa-pen'} text-[12px]`} aria-hidden="true"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenWhatsApp(message)}
                                                        aria-label={`Enviar mensagem ${safeIndex + 1} pelo WhatsApp`}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                    >
                                                        <i className="fab fa-whatsapp text-[13px]" aria-hidden="true"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyMessage(message, `template-${safeIndex}`)}
                                                        aria-label={`Copiar mensagem ${safeIndex + 1}`}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                                                    >
                                                        <i className={`${copiedMessageKey === `template-${safeIndex}` ? 'fas fa-check' : 'fas fa-copy'} text-[12px]`} aria-hidden="true"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            {isEditingMessage ? (
                                                <label className="mt-2 block">
                                                    <span className="sr-only">Editar mensagem {safeIndex + 1}</span>
                                                    <textarea
                                                        value={message}
                                                        autoFocus
                                                        ref={(el) => {
                                                            if (el) {
                                                                el.style.height = 'auto';
                                                                el.style.height = `${el.scrollHeight}px`;
                                                            }
                                                        }}
                                                        onChange={(event) => {
                                                            handleReadyMessageChange(safeIndex, event.target.value);
                                                            event.target.style.height = 'auto';
                                                            event.target.style.height = `${event.target.scrollHeight}px`;
                                                        }}
                                                        rows={3}
                                                        className="block w-full resize-none overflow-hidden rounded-[12px] border border-blue-300 bg-white p-2.5 text-[13px] leading-6 text-slate-700 outline-none transition focus:ring-4 focus:ring-blue-500/10 dark:border-blue-800 dark:bg-slate-950/70 dark:text-slate-200"
                                                    />
                                                </label>
                                            ) : (
                                                <p className="mt-2 whitespace-pre-wrap break-words rounded-[12px] border border-slate-100 bg-slate-50/80 p-2.5 text-[13px] leading-6 text-slate-700 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-300">
                                                    {message}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>
            <WhatsAppChooserModal
                clientName={client.nome}
                phone={normalizedPhone}
                message={whatsAppMessage}
                onClose={() => setWhatsAppMessage(null)}
            />
        </div>
    );
});


/**
 * Pager horizontal controlado para o modal de opções no mobile.
 *
 * Em vez de depender de CSS scroll-snap (que conflita com o scroll vertical
 * das páginas), este componente controla a posição por transform e usa uma
 * "trava de eixo": no início do toque decide se o gesto é horizontal (trocar
 * de opção) ou vertical (rolar o conteúdo da opção). Cada página tem seu
 * próprio scroll vertical nativo. As setas/bolinhas controlam via prop `index`.
 */
const OptionsPager: React.FC<{
    count: number;
    index: number;
    onIndexChange: (index: number) => void;
    renderItem: (index: number) => React.ReactNode;
}> = ({ count, index, onIndexChange, renderItem }) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [dragX, setDragX] = useState(0);
    const [animating, setAnimating] = useState(true);
    const gesture = useRef<{ startX: number; startY: number; axis: null | 'x' | 'y'; active: boolean }>({
        startX: 0,
        startY: 0,
        axis: null,
        active: false,
    });

    useEffect(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        const measure = () => setWidth(vp.clientWidth);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(vp);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const vp = viewportRef.current;
        if (!vp) return;

        const onStart = (event: TouchEvent) => {
            if (event.touches.length !== 1) return;
            const touch = event.touches[0];
            gesture.current = { startX: touch.clientX, startY: touch.clientY, axis: null, active: true };
            setAnimating(false);
        };

        const onMove = (event: TouchEvent) => {
            const g = gesture.current;
            if (!g.active || event.touches.length !== 1) return;
            const touch = event.touches[0];
            const dx = touch.clientX - g.startX;
            const dy = touch.clientY - g.startY;
            if (g.axis === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            }
            if (g.axis === 'x') {
                event.preventDefault();
                let offset = dx;
                if ((index === 0 && dx > 0) || (index === count - 1 && dx < 0)) {
                    offset = dx * 0.35; // resistência nas bordas
                }
                setDragX(offset);
            }
        };

        const onEnd = () => {
            const g = gesture.current;
            if (!g.active) return;
            const wasHorizontal = g.axis === 'x';
            g.active = false;
            g.axis = null;
            setAnimating(true);
            if (wasHorizontal) {
                const w = vp.clientWidth || 1;
                setDragX(current => {
                    const threshold = w * 0.18;
                    let next = index;
                    if (current <= -threshold && index < count - 1) next = index + 1;
                    else if (current >= threshold && index > 0) next = index - 1;
                    if (next !== index) onIndexChange(next);
                    return 0;
                });
            } else {
                setDragX(0);
            }
        };

        vp.addEventListener('touchstart', onStart, { passive: true });
        vp.addEventListener('touchmove', onMove, { passive: false });
        vp.addEventListener('touchend', onEnd, { passive: true });
        vp.addEventListener('touchcancel', onEnd, { passive: true });
        return () => {
            vp.removeEventListener('touchstart', onStart);
            vp.removeEventListener('touchmove', onMove);
            vp.removeEventListener('touchend', onEnd);
            vp.removeEventListener('touchcancel', onEnd);
        };
    }, [index, count, onIndexChange]);

    const translate = -(index * width) + dragX;

    return (
        <div ref={viewportRef} className="absolute inset-0 overflow-hidden" style={{ touchAction: 'pan-y' }}>
            <div
                className="flex h-full"
                style={{
                    transform: `translate3d(${translate}px, 0, 0)`,
                    transition: animating ? 'transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
                }}
            >
                {Array.from({ length: count }).map((_, i) => (
                    <div
                        key={i}
                        className="h-full shrink-0 overflow-y-auto overscroll-contain p-4"
                        style={{ width: width || '100%' }}
                    >
                        {renderItem(i)}
                    </div>
                ))}
            </div>
        </div>
    );
};


const PdfHistoryMobileFooter: React.FC<{
    onSearch: () => void;
    onOpenPeriod: () => void;
    onOpenFaturamento: () => void;
    faturamentoEnabled: boolean;
    onFollowUp: () => void;
    followUpPending: number;
    onOpenTemplates: () => void;
}> = ({ onSearch, onOpenPeriod, onOpenFaturamento, faturamentoEnabled, onFollowUp, followUpPending, onOpenTemplates }) => {
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
                <span className="absolute right-2 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
                    {badge}
                </span>
            ) : null}
        </button>
    );

    return (
        <div
            className="fixed left-4 right-4 z-40 sm:hidden"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
            <div className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <div className="relative flex items-center justify-between">
                    <div className="flex gap-1">
                        <FooterButton onClick={onSearch} label="Buscar" icon={<Search className="h-5 w-5" aria-hidden="true" />} />
                        <FooterButton onClick={onOpenPeriod} label="Período" icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />} />
                    </div>

                    <div className="absolute left-1/2 -top-12 -translate-x-1/2">
                        <button
                            type="button"
                            onClick={onOpenFaturamento}
                            disabled={!faturamentoEnabled}
                            aria-label="Faturamento do período"
                            className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.4)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:border-slate-900"
                        >
                            <CircleDollarSign className="h-7 w-7" aria-hidden="true" />
                        </button>
                    </div>

                    <div className="flex gap-1">
                        <FooterButton onClick={onFollowUp} label="Avaliações" icon={<MessageSquareText className="h-5 w-5" aria-hidden="true" />} badge={followUpPending} />
                        <FooterButton onClick={onOpenTemplates} label="Textos" icon={<FileText className="h-5 w-5" aria-hidden="true" />} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const PdfHistoryView: React.FC<PdfHistoryViewProps> = ({ pdfs, clients, agendamentos, films, googleReviewsLink, onDelete, onDownload, onUpdateStatus, onSchedule, onGenerateCombinedPdf, onNavigateToOption }) => {
    const { showToast } = useFeedback();
    const [pendingFocusClientId] = useState<number | null>(() => readInitialHistoryFocusClient());
    const [expandedClientId, setExpandedClientId] = useState<number | null>(pendingFocusClientId);
    const [highlightedClientId, setHighlightedClientId] = useState<number | null>(pendingFocusClientId);
    const clientGroupRefs = useRef(new Map<number, HTMLDivElement>());
    const [optionsModalClientId, setOptionsModalClientId] = useState<number | null>(null);
    const [optionsModalIndex, setOptionsModalIndex] = useState(0);
    const [selectedPdfIds, setSelectedPdfIds] = useState<Set<number>>(() => readSelectedCombinedPdfIds());
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
    const [isSearchActive, setIsSearchActive] = useState(false);
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
        if (!isSearchActive) return;

        const frame = window.requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isSearchActive]);

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
            if (ag.pdfId) {
                acc[ag.pdfId] = ag;
            }
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
            const client = clientsById.get(clientId);

            if (!client) return;

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
            const lowerTerm = normalizeSearchText(deferredSearchTerm);
            groups = groups.filter(group => {
                const clientMatch = matchesSearch(group.client.nome, lowerTerm);
                const pdfMatch = group.pdfs.some(pdf =>
                    (pdf.proposalOptionName && matchesSearch(pdf.proposalOptionName, lowerTerm)) ||
                    formatNumberBR(pdf.totalPreco).includes(lowerTerm) ||
                    new Date(pdf.date).toLocaleDateString('pt-BR').includes(lowerTerm)
                );
                return clientMatch || pdfMatch;
            });
        }
        return groups;
    }, [groupedHistory, deferredSearchTerm, focusFilter]);

    const visibleApprovedPdfIds = useMemo(() => {
        const ids = new Set<number>();

        filteredGroupedHistory.forEach(group => {
            group.pdfs.forEach(pdf => {
                if (pdf.status === 'approved' && typeof pdf.id === 'number') {
                    ids.add(pdf.id);
                }
            });
        });

        return ids;
    }, [filteredGroupedHistory]);

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
        return filteredGroupedHistory.slice(0, visibleCount);
    }, [filteredGroupedHistory, visibleCount]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    const handleToggleExpand = (clientId: number) => {
        const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
        if (isDesktop) {
            setExpandedClientId(prev => prev === clientId ? null : clientId);
            return;
        }
        setOptionsModalIndex(0);
        setOptionsModalClientId(clientId);
    };

    const closeOptionsModal = useCallback(() => {
        setOptionsModalClientId(null);
        setOptionsModalIndex(0);
    }, []);

    const goToOption = useCallback((index: number) => {
        setOptionsModalIndex(index);
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
            setOptionsModalIndex(0);
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
    const [copiedCombinedMessageIndex, setCopiedCombinedMessageIndex] = useState<number | null>(null);
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
            showToast('Esse cliente ainda nao tem um telefone valido para abrir no WhatsApp.', {
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
            showToast('Mensagem de avaliacao copiada.', {
                tone: 'success',
                duration: 2200,
            });
            window.setTimeout(() => {
                setCopiedReviewRequestKey(current => current === candidate.requestKey ? null : current);
            }, 1800);
        } catch (error) {
            console.error('Erro ao copiar pedido de avaliacao:', error);
            showToast('Nao foi possivel copiar a mensagem agora.', {
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

        showToast('Pedido de avaliacao marcado como feito.', {
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
        const totalPdfs = pdfs.length;
        const latestPdf = pdfs[0];
        const clientFunnelSummary = buildFunnelTotals(pdfs, funnelReferencePdfIds);
        const displayReferencePdf = clientFunnelSummary.latestReferencePdf || latestPdf;
        const status = getHistoryGroupStatus(pdfs);
        const initials = client.nome.slice(0, 2).toUpperCase();
        const latestContext = clientFunnelSummary.opportunityCount > 1
            ? `${clientFunnelSummary.opportunityCount} atendimentos`
            : displayReferencePdf.proposalOptionName || `${totalPdfs} opção${totalPdfs > 1 ? 'ões' : ''}`;
        const latestDate = new Date(latestPdf.date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
        });

        return (
            <div
                ref={(node) => {
                    if (node) {
                        clientGroupRefs.current.set(client.id!, node);
                    } else {
                        clientGroupRefs.current.delete(client.id!);
                    }
                }}
                className={`relative overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--surface)] transition-all duration-300 last:border-b-0 sm:rounded-[var(--radius-panel)] sm:border sm:shadow-[var(--shadow-hairline)] sm:hover:-translate-y-0.5 sm:hover:border-[var(--border-strong)] ${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--surface)] sm:!border-[var(--brand-primary)]' : ''} ${hasSelectedInGroup ? 'sm:border-[var(--brand-primary)] sm:ring-2 sm:ring-blue-500/15' : 'sm:border-[var(--border-subtle)]'}`}>
                <span className={`absolute left-0 top-0 h-full w-1 sm:hidden ${status.tone.dotClassName}`} aria-hidden="true" />
                <button
                    onClick={() => handleToggleExpand(client.id!)}
                    className="w-full px-3 py-2.5 text-left transition-colors duration-200 hover:bg-[var(--surface-muted)] sm:px-4 sm:py-3"
                    aria-expanded={isExpanded}
                >
                    <div className="flex items-start gap-3">
                        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-xs font-semibold text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 sm:flex">
                            {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-1.5">
                                <span className={`mt-[0.38rem] hidden h-2 w-2 shrink-0 rounded-full sm:block ${status.tone.dotClassName}`} />
                                <h3 className="text-[0.92rem] font-semibold leading-[1.2] tracking-[-0.02em] text-slate-900 dark:text-slate-50 sm:truncate sm:text-[1rem]">
                                    {client.nome}
                                </h3>
                            </div>
                            <p className="mt-1 hidden truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">
                                {status.text} / {latestContext}
                            </p>

                            <div className="mt-1.5 sm:hidden">
                                <div className="flex min-w-0 items-center gap-1.5">
                                    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${status.tone.chipClassName}`}>
                                        {status.tone.label}
                                    </span>
                                    <span className="truncate text-[11px] font-medium text-slate-400">{latestContext}</span>
                                </div>
                                <div className="mt-1.5 flex items-end justify-between gap-3 pr-1">
                                    <p className={`text-[1.05rem] font-bold leading-none tracking-[-0.03em] ${status.tone === PDF_STATUS_META.approved ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-950 dark:text-slate-50'}`}>
                                        {formatNumberBR(clientFunnelSummary.funnelRevenue)}
                                    </p>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                                        {latestDate} · {totalPdfs} {totalPdfs === 1 ? 'opção' : 'opções'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="hidden shrink-0 pl-2 text-right sm:block">
                            <p className="text-[1rem] font-semibold leading-none tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                                {formatNumberBR(clientFunnelSummary.funnelRevenue)}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                                {latestDate} · {totalPdfs} {totalPdfs === 1 ? 'opção' : 'opções'}
                            </p>
                        </div>

                        <div className="hidden h-8 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-slate-100 px-2.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:flex">
                            Detalhes
                            <i className={`fas fa-chevron-right text-[10px] transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}></i>
                        </div>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] sm:hidden">
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
                            {clientFunnelSummary.duplicatedRevenue > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                                    Apresentado {formatNumberBR(clientFunnelSummary.presentedRevenue)}
                                </span>
                            ) : null}
                            {hasSelectedInGroup ? (
                                <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                                    {pdfs.filter(p => selectedPdfIds.has(p.id!)).length} selecionado{pdfs.filter(p => selectedPdfIds.has(p.id!)).length > 1 ? 's' : ''}
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
                                        onSchedule={onSchedule}
                                        films={films}
                                        messageTemplates={messageTemplates}
                                        googleReviewsLink={googleReviewsLink}
                                        isSelected={selectedPdfIds.has(pdf.id!)}
                                        onToggleSelect={handleToggleSelect}
                                        onNavigateToOption={onNavigateToOption}
                                        isFunnelReference={clientFunnelSummary.opportunities.some(opportunity => opportunity.referencePdf.id === pdf.id)}
                                        onSetFunnelReference={handleSetFunnelReference}
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
                showToast(validation.startError || validation.endError || 'Revise o periodo informado.', {
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
            showToast(validation.startError || validation.endError || 'Revise o periodo informado.', {
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

    const handleCloseSearch = () => {
        setIsSearchActive(false);
        handleClearSearch();
    };

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
        <div className="space-y-3 pb-28 sm:space-y-4 sm:pb-0">
            <PdfHistoryMobileToolbar
                totalGroups={groupedHistory.length}
                filteredCount={filteredGroupedHistory.length}
                periodLabel={mobilePeriodTriggerLabel}
                searchTerm={searchTerm}
                isSearchActive={isSearchActive}
                searchInputRef={searchInputRef}
                onOpenPeriod={openMobilePeriodSelector}
                onCloseSearch={handleCloseSearch}
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
                                    Encontre rapido
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
                <div className="relative mb-3 rounded-[14px] border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-50">
                                        {selectedPdfs.length} orçamento{selectedPdfs.length > 1 ? 's' : ''} selecionado{selectedPdfs.length > 1 ? 's' : ''}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                        Combine apenas PDFs do mesmo cliente.
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
                                    Selecione mais um orçamento do mesmo cliente para gerar o PDF combinado e ver as mensagens sugeridas.
                                </p>
                            ) : (
                                <div className="space-y-3 rounded-[12px] border border-blue-100 bg-blue-50/80 p-3 text-[11px] leading-5 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100">
                                    <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-300">
                                        <i className="fas fa-comment-dots text-[10px]" aria-hidden="true"></i>
                                        Mensagens sugeridas
                                    </div>
                                    {hasOnlySameClientSelectedPdfs ? (
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
                                    ) : (
                                        <p className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                                            Selecione apenas orçamentos do mesmo cliente para gerar mensagens do PDF combinado.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
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
            )}
            <div>
                {displayedHistory.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 items-start gap-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)] sm:gap-3 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none 2xl:grid-cols-2">
                            {displayedHistory.map(group => (
                                <ClientHistoryGroup key={group.client.id} group={group} />
                            ))}
                        </div>

                        {visibleCount < filteredGroupedHistory.length && (
                            <div className="flex justify-center pt-3 sm:pt-4">
                                <ActionButton
                                    onClick={handleLoadMore}
                                    variant="secondary"
                                    iconClassName="fas fa-chevron-down"
                                >
                                    Carregar mais
                                </ActionButton>
                            </div>
                        )}
                    </>
                ) : (
                    searchTerm ? (
                        <ContentState
                            compact
                            iconClassName="fas fa-search"
                            title="Nenhum resultado encontrado"
                            description="Tente buscar por outro cliente, data ou valor."
                        />
                    ) : pdfs.length > 0 ? (
                        <ContentState
                            iconClassName="fas fa-calendar-alt"
                            title="Nenhum orçamento neste periodo"
                            description="Ajuste o filtro de datas ou escolha Todo o periodo para ver tudo."
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
                        Personalize os 3 textos que aparecem no histórico. Você pode usar:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {['{{cliente}}', '{{primeiroNome}}', '{{peliculas}}', '{{garantia}}', '{{valor}}'].map(token => (
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

            {/* Modal de opções (mobile) — navegação por setas, deslize e pontinhos */}
            {optionsModalClientId != null && (() => {
                const group = filteredGroupedHistory.find(item => item.client.id === optionsModalClientId);
                if (!group) return null;
                const { client, pdfs: groupPdfs } = group;
                const funnelSummary = buildFunnelTotals(groupPdfs, funnelReferencePdfIds);
                const total = groupPdfs.length;
                const current = Math.min(Math.max(optionsModalIndex, 0), total - 1);

                return createPortal(
                    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--surface)] sm:hidden">
                        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
                            <button
                                type="button"
                                onClick={closeOptionsModal}
                                aria-label="Fechar"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-[var(--surface-muted)] dark:text-slate-300"
                            >
                                <i className="fas fa-arrow-left text-base" aria-hidden="true" />
                            </button>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.02em] text-slate-900 dark:text-slate-50">
                                    {client.nome}
                                </p>
                                <p className="text-[11px] font-medium text-slate-400">
                                    {total} {total === 1 ? 'opção' : 'opções'}
                                </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {current + 1}/{total}
                            </span>
                        </div>

                        <div className="relative min-h-0 flex-1 overflow-hidden">
                            <OptionsPager
                                count={total}
                                index={current}
                                onIndexChange={goToOption}
                                renderItem={(i) => {
                                    const pdf = groupPdfs[i];
                                    return (
                                        <PdfHistoryItem
                                            pdf={pdf}
                                            client={client}
                                            agendamento={agendamentosByPdfId[pdf.id!]}
                                            onDownload={onDownload}
                                            onDelete={onDelete}
                                            onUpdateStatus={onUpdateStatus}
                                            onSchedule={onSchedule}
                                            films={films}
                                            messageTemplates={messageTemplates}
                                            googleReviewsLink={googleReviewsLink}
                                            isSelected={selectedPdfIds.has(pdf.id!)}
                                            onToggleSelect={handleToggleSelect}
                                            onNavigateToOption={onNavigateToOption}
                                            isFunnelReference={funnelSummary.opportunities.some(opportunity => opportunity.referencePdf.id === pdf.id)}
                                            onSetFunnelReference={handleSetFunnelReference}
                                            fitContent
                                        />
                                    );
                                }}
                            />

                            {total > 1 && current > 0 && (
                                <button
                                    type="button"
                                    onClick={() => goToOption(current - 1)}
                                    aria-label="Opção anterior"
                                    className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:ring-white/10"
                                >
                                    <i className="fas fa-chevron-left" aria-hidden="true" />
                                </button>
                            )}
                            {total > 1 && current < total - 1 && (
                                <button
                                    type="button"
                                    onClick={() => goToOption(current + 1)}
                                    aria-label="Próxima opção"
                                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:ring-white/10"
                                >
                                    <i className="fas fa-chevron-right" aria-hidden="true" />
                                </button>
                            )}
                        </div>

                        {total > 1 && (
                            <div className="flex items-center justify-center gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
                                {groupPdfs.map((pdf, index) => (
                                    <button
                                        key={pdf.id}
                                        type="button"
                                        onClick={() => goToOption(index)}
                                        aria-label={`Ir para opção ${index + 1}`}
                                        aria-current={index === current}
                                        className={`h-2 rounded-full transition-all ${index === current ? 'w-5 bg-slate-800 dark:bg-slate-100' : 'w-2 bg-slate-300 dark:bg-slate-600'}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>,
                    document.body
                );
            })()}

            <PdfHistoryMobileFooter
                onSearch={() => setIsSearchActive(true)}
                onOpenPeriod={openMobilePeriodSelector}
                onOpenFaturamento={() => setIsExpenseSummaryExpanded(true)}
                faturamentoEnabled={Boolean(selectedExpenseSummary)}
                onFollowUp={handleOpenFollowUp}
                followUpPending={visiblePendingReviewCampaignCount}
                onOpenTemplates={() => setIsTemplateModalOpen(true)}
            />
        </div>
    );
};

export default PdfHistoryView;

