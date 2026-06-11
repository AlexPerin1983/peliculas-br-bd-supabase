import { Client, ProposalExpenseCategory, SavedPDF, StandaloneExpense } from '../../types';

// Periodo anterior equivalente (mesma duracao, imediatamente antes).
// Permite comparacoes sem reconsultar o banco.
export interface PeriodComparison {
    periodoAnterior: string;
    faturamentoTotal: number;
    faturamentoAprovado: number;
    despesas: number;
    lucroEstimado: number;
    margemEstimada: number;
    gastosPorCategoria: { label: string; value: number }[];
}

// Resumo financeiro compacto. E o unico dado enviado a IA: mantem o prompt
// pequeno (barato) e impede que a IA invente numeros.
export interface FinancialSummary {
    periodo: string;
    faturamentoTotal: number;
    faturamentoAprovado: number;
    faturamentoPendente: number;
    despesas: number;
    lucroEstimado: number;
    margemEstimada: number;
    ticketMedio: number;
    taxaAprovacao: number;
    orcamentosGerados: number;
    orcamentosAprovados: number;
    orcamentosPendentes: number;
    totalM2: number;
    gastoDiarioMedio: number;
    gastosPorCategoria: { label: string; value: number }[];
    melhorCliente: { name: string; value: number } | null;
    peliculaMaisUsada: { name: string; area: number; quantity: number } | null;
    diasNoPeriodo?: number;
    faturamentoDiarioMedio?: number;
    comparativo?: PeriodComparison | null;
}

export interface FinancialAnalysisCache {
    signature: string;
    text: string;
}

export interface DateRange {
    start: Date;
    end: Date;
}

const EXPENSE_CATEGORY_LABELS: Record<ProposalExpenseCategory, string> = {
    paid_traffic: 'Trafego pago',
    transport: 'Transporte',
    food: 'Alimentacao',
    tools: 'Ferramentas',
    material: 'Material',
    other: 'Outros'
};

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

const isWithinRange = (date: Date | null, range: DateRange | null) => {
    if (!range) return true;
    if (!date) return false;
    return date >= range.start && date <= range.end;
};

const getPdfStatus = (pdf: SavedPDF) => pdf.status || 'pending';

const getPdfValue = (pdf: SavedPDF) => parseNumber(pdf.totalPreco);

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

const formatRangeLabel = (range: DateRange) =>
    `${range.start.toLocaleDateString('pt-BR')} - ${range.end.toLocaleDateString('pt-BR')}`;

// Agrega gastos por categoria de um conjunto de orcamentos + despesas avulsas.
const aggregateCategories = (pdfs: SavedPDF[], expenses: StandaloneExpense[]) => {
    const totals = new Map<string, { label: string; value: number }>();
    const add = (key: string, label: string, value: number) => {
        const previous = totals.get(key) || { label, value: 0 };
        totals.set(key, { label: previous.label || label, value: previous.value + value });
    };

    pdfs.forEach(pdf => {
        const snapshotCategories = pdf.generalDiscount?.expenseSnapshot?.expensesByCategory || [];
        if (snapshotCategories.length) {
            snapshotCategories.forEach(category => {
                add(category.category, category.label || EXPENSE_CATEGORY_LABELS[category.category] || 'Gasto', parseNumber(category.total));
            });
            return;
        }
        (pdf.generalDiscount?.expenses || []).forEach(expense => {
            add(expense.category, EXPENSE_CATEGORY_LABELS[expense.category] || 'Gasto', parseNumber(expense.amount));
        });
    });

    expenses.forEach(expense => {
        add(expense.category, EXPENSE_CATEGORY_LABELS[expense.category] || 'Gasto avulso', parseNumber(expense.amount));
    });

    return Array.from(totals.values())
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
};

interface BuildFinancialSummaryInput {
    pdfs: SavedPDF[];
    standaloneExpenses: StandaloneExpense[];
    clients: Client[];
    range: DateRange;
    previousRange: DateRange | null;
    periodLabel: string;
}

// Calcula o resumo do periodo reaproveitando dados ja em memoria (zero egress).
export const buildFinancialSummary = ({
    pdfs,
    standaloneExpenses,
    clients,
    range,
    previousRange,
    periodLabel
}: BuildFinancialSummaryInput): FinancialSummary => {
    const periodPdfs = pdfs.filter(pdf => isWithinRange(parseDate(pdf.date), range));
    const periodExpenses = standaloneExpenses.filter(expense => isWithinRange(parseDate(expense.date), range));
    const standaloneTotal = periodExpenses.reduce((sum, expense) => sum + parseNumber(expense.amount), 0);

    const approved = periodPdfs.filter(pdf => getPdfStatus(pdf) === 'approved');
    const pending = periodPdfs.filter(pdf => getPdfStatus(pdf) === 'pending');
    const totalValue = periodPdfs.reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
    const approvedValue = approved.reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
    const pendingValue = pending.reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
    const proposalExpenses = periodPdfs.reduce((sum, pdf) => sum + getOperationalExpenses(pdf), 0);
    const expenses = proposalExpenses + standaloneTotal;
    const estimatedProfit = periodPdfs.reduce((sum, pdf) => sum + getEstimatedProfit(pdf), 0) - standaloneTotal;
    const totalM2 = periodPdfs.reduce((sum, pdf) => sum + parseNumber(pdf.totalM2), 0);
    const generatedCount = periodPdfs.length;

    const daysInPeriod = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / 86400000));

    // Melhor cliente do periodo.
    const clientTotals = new Map<number, number>();
    periodPdfs.forEach(pdf => {
        clientTotals.set(pdf.clienteId, (clientTotals.get(pdf.clienteId) || 0) + getPdfValue(pdf));
    });
    const bestClient = Array.from(clientTotals.entries()).sort((a, b) => b[1] - a[1])[0];
    const clientsById = new Map<number, Client>();
    clients.forEach(client => {
        if (client.id !== undefined) clientsById.set(client.id, client);
    });
    const melhorCliente = bestClient
        ? {
              name:
                  clientsById.get(bestClient[0])?.nome ||
                  periodPdfs.find(pdf => pdf.clienteId === bestClient[0])?.clientName ||
                  'Cliente',
              value: bestClient[1]
          }
        : null;

    // Pelicula mais usada (por area).
    const filmTotals = new Map<string, { quantity: number; area: number }>();
    periodPdfs.forEach(pdf => {
        (pdf.measurements || []).forEach(measurement => {
            const name = measurement.pelicula || 'Sem pelicula';
            const previous = filmTotals.get(name) || { quantity: 0, area: 0 };
            const largura = parseNumber(measurement.largura);
            const altura = parseNumber(measurement.altura);
            const quantity = parseNumber(measurement.quantidade) || 1;
            filmTotals.set(name, {
                quantity: previous.quantity + quantity,
                area: previous.area + largura * altura * quantity
            });
        });
    });
    const bestFilm = Array.from(filmTotals.entries()).sort((a, b) => b[1].area - a[1].area)[0];
    const peliculaMaisUsada = bestFilm
        ? { name: bestFilm[0], area: bestFilm[1].area, quantity: bestFilm[1].quantity }
        : null;

    // Comparativo com o periodo anterior equivalente.
    let comparativo: PeriodComparison | null = null;
    if (previousRange) {
        const prevPdfs = pdfs.filter(pdf => isWithinRange(parseDate(pdf.date), previousRange));
        const prevExpenses = standaloneExpenses.filter(expense => isWithinRange(parseDate(expense.date), previousRange));
        const prevStandaloneTotal = prevExpenses.reduce((sum, expense) => sum + parseNumber(expense.amount), 0);
        const prevTotalValue = prevPdfs.reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
        const prevApprovedValue = prevPdfs
            .filter(pdf => getPdfStatus(pdf) === 'approved')
            .reduce((sum, pdf) => sum + getPdfValue(pdf), 0);
        const prevProposalExpenses = prevPdfs.reduce((sum, pdf) => sum + getOperationalExpenses(pdf), 0);
        const prevTotalExpenses = prevProposalExpenses + prevStandaloneTotal;
        const prevProfit = prevPdfs.reduce((sum, pdf) => sum + getEstimatedProfit(pdf), 0) - prevStandaloneTotal;

        comparativo = {
            periodoAnterior: formatRangeLabel(previousRange),
            faturamentoTotal: prevTotalValue,
            faturamentoAprovado: prevApprovedValue,
            despesas: prevTotalExpenses,
            lucroEstimado: prevProfit,
            margemEstimada: prevTotalValue > 0 ? (prevProfit / prevTotalValue) * 100 : 0,
            gastosPorCategoria: aggregateCategories(prevPdfs, prevExpenses)
        };
    }

    return {
        periodo: periodLabel,
        faturamentoTotal: totalValue,
        faturamentoAprovado: approvedValue,
        faturamentoPendente: pendingValue,
        despesas: expenses,
        lucroEstimado: estimatedProfit,
        margemEstimada: totalValue > 0 ? (estimatedProfit / totalValue) * 100 : 0,
        ticketMedio: generatedCount > 0 ? totalValue / generatedCount : 0,
        taxaAprovacao: generatedCount > 0 ? (approved.length / generatedCount) * 100 : 0,
        orcamentosGerados: generatedCount,
        orcamentosAprovados: approved.length,
        orcamentosPendentes: pending.length,
        totalM2,
        gastoDiarioMedio: expenses / daysInPeriod,
        diasNoPeriodo: daysInPeriod,
        faturamentoDiarioMedio: totalValue / daysInPeriod,
        gastosPorCategoria: aggregateCategories(periodPdfs, periodExpenses),
        melhorCliente,
        peliculaMaisUsada,
        comparativo
    };
};

// Mes atual (dia 1 ate agora) com o mes anterior completo como comparativo.
export const getCurrentMonthRanges = (now: Date = new Date()) => {
    const range: DateRange = {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: now
    };
    const previousRange: DateRange = {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    };
    return { range, previousRange };
};

// Periodos disponiveis para analise nos assistentes. Cada um traz o periodo
// anterior equivalente para o comparativo.
export type AnalysisPeriodKey = 'month' | 'previousMonth' | 'last7' | 'last30' | 'year';

export const ANALYSIS_PERIODS: { key: AnalysisPeriodKey; label: string }[] = [
    { key: 'month', label: 'Este mes' },
    { key: 'previousMonth', label: 'Mes passado' },
    { key: 'last7', label: '7 dias' },
    { key: 'last30', label: '30 dias' },
    { key: 'year', label: 'Este ano' }
];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const lastNDaysRanges = (days: number, now: Date) => {
    const start = startOfDay(new Date(now.getTime() - (days - 1) * 86400000));
    const range: DateRange = { start, end: now };
    const previousRange: DateRange = {
        start: new Date(start.getTime() - days * 86400000),
        end: new Date(start.getTime() - 1)
    };
    return { range, previousRange };
};

export const getAnalysisPeriodRanges = (
    key: AnalysisPeriodKey,
    now: Date = new Date()
): { range: DateRange; previousRange: DateRange; periodLabel: string } => {
    switch (key) {
        case 'previousMonth': {
            const range: DateRange = {
                start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
            };
            const previousRange: DateRange = {
                start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
                end: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999)
            };
            return { range, previousRange, periodLabel: 'Mes passado' };
        }
        case 'last7':
            return { ...lastNDaysRanges(7, now), periodLabel: 'Ultimos 7 dias' };
        case 'last30':
            return { ...lastNDaysRanges(30, now), periodLabel: 'Ultimos 30 dias' };
        case 'year': {
            const range: DateRange = { start: new Date(now.getFullYear(), 0, 1), end: now };
            // Mesmo trecho do ano anterior (1 jan ate a mesma data), para
            // comparar periodos de duracao equivalente.
            const previousRange: DateRange = {
                start: new Date(now.getFullYear() - 1, 0, 1),
                end: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999)
            };
            return { range, previousRange, periodLabel: 'Este ano' };
        }
        case 'month':
        default:
            return { ...getCurrentMonthRanges(now), periodLabel: 'Este mes' };
    }
};
