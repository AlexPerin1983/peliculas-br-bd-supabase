import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    FileText,
    Loader2,
    Lock,
    Megaphone,
    PiggyBank,
    ReceiptText,
    RefreshCw,
    Send,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Wallet,
    type LucideIcon
} from 'lucide-react';
import { Client, SavedPDF, StandaloneExpense } from '../../types';
import { getAllStandaloneExpenses } from '../../services/db';
import {
    ANALYSIS_PERIODS,
    AnalysisPeriodKey,
    buildFinancialSummary,
    FinancialAnalysisCache,
    FinancialSummary,
    getAnalysisPeriodRanges
} from '../../src/lib/financialAnalytics';
import {
    buildSignature,
    renderMarkdown,
    SUGGESTION_CHIPS,
    useFinancialAssistantChat
} from '../modals/financialAssistantCore';

interface AssistentesViewProps {
    allSavedPdfs: SavedPDF[];
    clients: Client[];
    aiConfig?: { provider: 'gemini' | 'openai' | 'local_ocr'; apiKey: string };
    onOpenApiKeyModal?: (provider: 'gemini' | 'openai') => void;
}

type AssistantId = 'financeiro' | 'secretaria' | 'vendedor' | 'marketing';

interface AssistantConfig {
    id: AssistantId;
    name: string;
    subtitle: string;
    icon: LucideIcon;
    dotClass: string;
    iconWrapClass: string;
    enabled: boolean;
}

const ASSISTANTS: AssistantConfig[] = [
    {
        id: 'financeiro',
        name: 'Financeiro',
        subtitle: 'Financas sem complicacao',
        icon: PiggyBank,
        dotClass: 'bg-rose-500',
        iconWrapClass: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white',
        enabled: true
    },
    {
        id: 'secretaria',
        name: 'Secretaria',
        subtitle: 'Clientes, agenda e mensagens',
        icon: CalendarDays,
        dotClass: 'bg-emerald-500',
        iconWrapClass: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
        enabled: false
    },
    {
        id: 'vendedor',
        name: 'Vendedor',
        subtitle: 'Follow-up e fechamento',
        icon: Wallet,
        dotClass: 'bg-blue-500',
        iconWrapClass: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
        enabled: false
    },
    {
        id: 'marketing',
        name: 'Marketing',
        subtitle: 'Posts, promocoes e ideias',
        icon: Megaphone,
        dotClass: 'bg-amber-500',
        iconWrapClass: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white',
        enabled: false
    }
];

const compactCurrency = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
});

const formatPercent = (value: number) => `${value.toFixed(1).replace('.', ',')}%`;

// Variacao percentual vs periodo anterior. `invert` marca metricas em que
// subir e ruim (despesas): inverte a cor, nao a seta.
const DeltaBadge: React.FC<{ current: number; previous?: number; invert?: boolean }> = ({
    current,
    previous,
    invert = false
}) => {
    if (previous === undefined || previous === 0) return null;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (!Number.isFinite(pct) || Math.abs(pct) < 0.5) return null;
    const up = pct >= 0;
    const good = invert ? !up : up;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-bold ${
                good
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300'
            }`}
            title="Variacao vs periodo anterior"
        >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {Math.abs(pct) >= 1000 ? '999%+' : `${Math.abs(pct).toFixed(0)}%`}
        </span>
    );
};

const KpiCard: React.FC<{
    icon: LucideIcon;
    iconClass: string;
    label: string;
    value: string;
    helper?: string;
    delta?: React.ReactNode;
}> = ({ icon: Icon, iconClass, label, value, helper, delta }) => (
    <div className="ui-card min-w-[148px] flex-1 snap-start p-3 sm:min-w-0">
        <div className="flex items-center justify-between gap-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-card)] ${iconClass}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            {delta}
        </div>
        <p className="mt-2 truncate text-lg font-bold leading-tight text-[var(--text-strong)]">{value}</p>
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
        {helper && <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{helper}</p>}
    </div>
);

// Faixa de KPIs com os numeros reais do periodo: valor imediato sem depender
// da IA. Carrossel horizontal no mobile, grade no desktop.
const KpiStrip: React.FC<{ summary: FinancialSummary }> = ({ summary }) => {
    const prev = summary.comparativo;
    return (
        <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0">
            <KpiCard
                icon={FileText}
                iconClass="bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-200"
                label="Cotado"
                value={compactCurrency.format(summary.faturamentoTotal)}
                helper={`${summary.orcamentosGerados} orcamento${summary.orcamentosGerados === 1 ? '' : 's'}`}
                delta={<DeltaBadge current={summary.faturamentoTotal} previous={prev?.faturamentoTotal} />}
            />
            <KpiCard
                icon={CheckCircle2}
                iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200"
                label="Aprovado"
                value={compactCurrency.format(summary.faturamentoAprovado)}
                helper={`${compactCurrency.format(summary.faturamentoPendente)} pendente`}
                delta={<DeltaBadge current={summary.faturamentoAprovado} previous={prev?.faturamentoAprovado} />}
            />
            <KpiCard
                icon={ReceiptText}
                iconClass="bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-200"
                label="Despesas"
                value={compactCurrency.format(summary.despesas)}
                helper={`${compactCurrency.format(summary.gastoDiarioMedio)}/dia`}
                delta={<DeltaBadge current={summary.despesas} previous={prev?.despesas} invert />}
            />
            <KpiCard
                icon={PiggyBank}
                iconClass="bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-200"
                label="Lucro estimado"
                value={compactCurrency.format(summary.lucroEstimado)}
                helper={`Margem de ${formatPercent(summary.margemEstimada)}`}
                delta={<DeltaBadge current={summary.lucroEstimado} previous={prev?.lucroEstimado} />}
            />
        </div>
    );
};

// Painel de chat do assistente Financeiro (full-page). Reaproveita o mesmo hook
// do modal do Dashboard, mudando apenas o layout para tela inteira.
const FinancialAssistantPanel: React.FC<{
    config: AssistantConfig;
    summary: FinancialSummary;
    periodLabel: string;
    apiKey?: string;
    provider?: 'gemini' | 'openai' | 'local_ocr';
    cache: FinancialAnalysisCache | null;
    onCached: (entry: FinancialAnalysisCache) => void;
    onActivateAI?: () => void;
}> = ({ config, summary, periodLabel, apiKey, provider, cache, onCached, onActivateAI }) => {
    const {
        messages,
        input,
        setInput,
        isLoading,
        pendingReply,
        error,
        canUseAI,
        dataAvailable,
        sendMessage,
        runDiagnosis,
        retryLast,
        lastTurnIsUser
    } = useFinancialAssistantChat({ isOpen: true, summary, apiKey, provider, cache, onCached });

    const threadEndRef = useRef<HTMLDivElement | null>(null);
    const Icon = config.icon;

    useEffect(() => {
        threadEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    }, [messages, isLoading, pendingReply]);

    const chatEnabled = canUseAI && dataAvailable;

    const assistantBubble = (content: React.ReactNode, key: React.Key, streaming = false) => (
        <div key={key} className="flex items-start gap-2.5">
            <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm ${config.iconWrapClass}`}
                aria-hidden="true"
            >
                <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 rounded-[var(--radius-control)] rounded-tl-sm border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                {content}
                {streaming && (
                    <span className="mt-1 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-rose-500" aria-hidden="true" />
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-[calc(100dvh-430px)] min-h-[420px] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] shadow-sm ${config.iconWrapClass}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-[var(--text-strong)]">{config.name}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{config.subtitle}</p>
                </div>
                <span className="hidden shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] sm:inline-flex">
                    {periodLabel}
                </span>
                {chatEnabled && (
                    <button
                        type="button"
                        onClick={() => runDiagnosis(true)}
                        disabled={isLoading}
                        title="Refazer a analise deste periodo"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Refazer analise"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    </button>
                )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {!canUseAI && (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                        <div
                            className="flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{ background: 'var(--brand-primary-soft)' }}
                        >
                            <Sparkles className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
                        </div>
                        <p className="max-w-sm text-sm text-[var(--text-body)]">
                            Ative a inteligência artificial para o assistente analisar os números do seu negócio. É grátis e leva uns 2 minutinhos.
                        </p>
                        {onActivateAI && (
                            <button
                                type="button"
                                onClick={onActivateAI}
                                className="inline-flex items-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(21,94,239,0.18)] transition-colors"
                                style={{ background: 'var(--brand-primary)' }}
                            >
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                Ativar Inteligência Artificial
                            </button>
                        )}
                    </div>
                )}

                {canUseAI && !dataAvailable && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <BarChart3 className="h-10 w-10 text-[var(--text-muted)]" aria-hidden="true" />
                        <p className="max-w-sm text-sm text-[var(--text-body)]">
                            Sem dados neste periodo. Gere orcamentos ou registre despesas e volte aqui — ou escolha
                            outro periodo acima.
                        </p>
                    </div>
                )}

                {chatEnabled &&
                    messages.map((message, index) =>
                        message.role === 'assistant' ? (
                            assistantBubble(renderMarkdown(message.text), index)
                        ) : (
                            <div key={index} className="flex justify-end">
                                <p className="max-w-[85%] rounded-[var(--radius-control)] rounded-tr-sm bg-rose-600 px-3 py-2 text-sm text-white">
                                    {message.text}
                                </p>
                            </div>
                        )
                    )}

                {chatEnabled && isLoading && pendingReply && assistantBubble(renderMarkdown(pendingReply), 'streaming', true)}

                {chatEnabled && isLoading && !pendingReply && (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]" aria-live="polite">
                        <Sparkles className="h-4 w-4 animate-pulse text-rose-500" aria-hidden="true" />
                        {messages.length === 0 ? 'Analisando seus numeros...' : 'Pensando...'}
                    </div>
                )}

                {chatEnabled && !isLoading && error && (
                    <div className="flex flex-col items-start gap-2 rounded-[var(--radius-control)] border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
                        <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                            {error}
                        </p>
                        <button
                            type="button"
                            onClick={() => (lastTurnIsUser ? retryLast() : runDiagnosis(true))}
                            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                        >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            Tentar novamente
                        </button>
                    </div>
                )}

                <div ref={threadEndRef} />
            </div>

            {chatEnabled && (
                <div className="space-y-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                    <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                        {SUGGESTION_CHIPS.map(chip => (
                            <button
                                key={chip}
                                type="button"
                                onClick={() => sendMessage(chip)}
                                disabled={isLoading}
                                className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text-body)] transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                            >
                                {chip}
                            </button>
                        ))}
                    </div>
                    <form
                        onSubmit={event => {
                            event.preventDefault();
                            sendMessage(input);
                        }}
                        className="flex items-center gap-2"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={event => setInput(event.target.value)}
                            disabled={isLoading}
                            enterKeyHint="send"
                            placeholder="Pergunte para o Financeiro..."
                            className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none transition-colors focus:border-rose-400 disabled:opacity-60"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-rose-600 text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-400"
                            aria-label="Enviar pergunta"
                        >
                            <Send className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

const AssistentesView: React.FC<AssistentesViewProps> = ({ allSavedPdfs, clients, aiConfig, onOpenApiKeyModal }) => {
    const [activeAssistant, setActiveAssistant] = useState<AssistantId>('financeiro');
    const [periodKey, setPeriodKey] = useState<AnalysisPeriodKey>('month');
    const [standaloneExpenses, setStandaloneExpenses] = useState<StandaloneExpense[]>([]);
    const [expensesLoaded, setExpensesLoaded] = useState(false);
    // Cache de analises por assinatura: trocar de periodo e voltar nao gera
    // nova chamada na IA se os numeros nao mudaram.
    const [cacheMap, setCacheMap] = useState<Record<string, FinancialAnalysisCache>>({});

    useEffect(() => {
        let active = true;
        getAllStandaloneExpenses()
            .then(data => {
                if (active) setStandaloneExpenses(data);
            })
            .catch(error => console.error('[AssistentesView] Falha ao carregar despesas:', error))
            .finally(() => {
                if (active) setExpensesLoaded(true);
            });
        return () => {
            active = false;
        };
    }, []);

    // Resumo do periodo escolhido com o periodo anterior equivalente como
    // comparativo. Tudo em memoria.
    const { summary, periodLabel } = useMemo(() => {
        const { range, previousRange, periodLabel: label } = getAnalysisPeriodRanges(periodKey);
        return {
            periodLabel: label,
            summary: buildFinancialSummary({
                pdfs: allSavedPdfs,
                standaloneExpenses,
                clients,
                range,
                previousRange,
                periodLabel: label
            })
        };
    }, [allSavedPdfs, standaloneExpenses, clients, periodKey]);

    const signature = useMemo(() => buildSignature(summary), [summary]);

    const activeConfig = ASSISTANTS.find(assistant => assistant.id === activeAssistant) || ASSISTANTS[0];

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4">
            <div>
                <h1 className="flex items-center gap-2 text-xl font-bold tracking-[-0.02em] text-[var(--text-strong)]">
                    <Sparkles className="h-5 w-5 text-rose-500" aria-hidden="true" />
                    Assistentes
                    <span className="rounded-full bg-blue-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                        beta
                    </span>
                </h1>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Converse com seus assistentes de IA. Eles usam os numeros do seu negocio para te ajudar.
                </p>
            </div>

            <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                {ASSISTANTS.map(assistant => {
                    const isActive = assistant.id === activeAssistant;
                    return (
                        <button
                            key={assistant.id}
                            type="button"
                            onClick={() => assistant.enabled && setActiveAssistant(assistant.id)}
                            disabled={!assistant.enabled}
                            className={[
                                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                                isActive
                                    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300'
                                    : assistant.enabled
                                        ? 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]'
                                        : 'cursor-not-allowed border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] opacity-70'
                            ].join(' ')}
                        >
                            <span className={`h-2 w-2 rounded-full ${assistant.dotClass}`} aria-hidden="true" />
                            {assistant.name}
                            {!assistant.enabled && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                                    <Lock className="h-2.5 w-2.5" aria-hidden="true" /> Em breve
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {!expensesLoaded ? (
                <div className="flex h-[calc(100dvh-330px)] min-h-[460px] items-center justify-center rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500" aria-hidden="true" />
                </div>
            ) : (
                <>
                    <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                        {ANALYSIS_PERIODS.map(period => {
                            const isActive = period.key === periodKey;
                            return (
                                <button
                                    key={period.key}
                                    type="button"
                                    onClick={() => setPeriodKey(period.key)}
                                    className={[
                                        'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                        isActive
                                            ? 'border-blue-200 bg-blue-50 text-[var(--brand-primary)] dark:border-blue-400/30 dark:bg-blue-400/15 dark:text-blue-200'
                                            : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-muted)]'
                                    ].join(' ')}
                                >
                                    {period.label}
                                </button>
                            );
                        })}
                    </div>

                    <KpiStrip summary={summary} />

                    <FinancialAssistantPanel
                        config={activeConfig}
                        summary={summary}
                        periodLabel={periodLabel}
                        apiKey={aiConfig?.apiKey}
                        provider={aiConfig?.provider}
                        cache={cacheMap[signature] ?? null}
                        onCached={entry => setCacheMap(prev => ({ ...prev, [entry.signature]: entry }))}
                        onActivateAI={onOpenApiKeyModal ? () => onOpenApiKeyModal('gemini') : undefined}
                    />
                </>
            )}
        </div>
    );
};

export default AssistentesView;
