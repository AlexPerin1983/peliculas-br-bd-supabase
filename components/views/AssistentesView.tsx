import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    BarChart3,
    CalendarDays,
    KeyRound,
    Loader2,
    Lock,
    Megaphone,
    PiggyBank,
    RefreshCw,
    Send,
    Sparkles,
    Wallet,
    type LucideIcon
} from 'lucide-react';
import { Client, SavedPDF, StandaloneExpense } from '../../types';
import { getAllStandaloneExpenses } from '../../services/db';
import {
    buildFinancialSummary,
    FinancialAnalysisCache,
    FinancialSummary,
    getCurrentMonthRanges
} from '../../src/lib/financialAnalytics';
import {
    renderMarkdown,
    SUGGESTION_CHIPS,
    useFinancialAssistantChat
} from '../modals/financialAssistantCore';

interface AssistentesViewProps {
    allSavedPdfs: SavedPDF[];
    clients: Client[];
    aiConfig?: { provider: 'gemini' | 'openai' | 'local_ocr'; apiKey: string };
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

// Painel de chat do assistente Financeiro (full-page). Reaproveita o mesmo hook
// do modal do Dashboard, mudando apenas o layout para tela inteira.
const FinancialAssistantPanel: React.FC<{
    config: AssistantConfig;
    summary: FinancialSummary;
    apiKey?: string;
    provider?: 'gemini' | 'openai' | 'local_ocr';
    cache: FinancialAnalysisCache | null;
    onCached: (entry: FinancialAnalysisCache) => void;
}> = ({ config, summary, apiKey, provider, cache, onCached }) => {
    const {
        messages,
        input,
        setInput,
        isLoading,
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
    }, [messages, isLoading]);

    const chatEnabled = canUseAI && dataAvailable;

    return (
        <div className="flex h-[calc(100dvh-230px)] min-h-[460px] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] shadow-sm ${config.iconWrapClass}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-base font-bold text-[var(--text-strong)]">{config.name}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{config.subtitle}</p>
                </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {!canUseAI && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <KeyRound className="h-10 w-10 text-rose-500" aria-hidden="true" />
                        <p className="max-w-sm text-sm text-[var(--text-body)]">
                            Para usar o assistente, configure o provedor <strong>Gemini</strong> e sua chave de API em{' '}
                            <strong>Configuracoes &gt; Empresa</strong>.
                        </p>
                    </div>
                )}

                {canUseAI && !dataAvailable && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <BarChart3 className="h-10 w-10 text-[var(--text-muted)]" aria-hidden="true" />
                        <p className="max-w-sm text-sm text-[var(--text-body)]">
                            Ainda nao ha dados suficientes neste mes. Gere orcamentos ou registre despesas e volte aqui.
                        </p>
                    </div>
                )}

                {chatEnabled &&
                    messages.map((message, index) =>
                        message.role === 'assistant' ? (
                            <div
                                key={index}
                                className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"
                            >
                                {renderMarkdown(message.text)}
                            </div>
                        ) : (
                            <div key={index} className="flex justify-end">
                                <p className="max-w-[85%] rounded-[var(--radius-control)] bg-rose-600 px-3 py-2 text-sm text-white">
                                    {message.text}
                                </p>
                            </div>
                        )
                    )}

                {chatEnabled && isLoading && (
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
                    <div className="flex flex-wrap gap-1.5">
                        {SUGGESTION_CHIPS.map(chip => (
                            <button
                                key={chip}
                                type="button"
                                onClick={() => sendMessage(chip)}
                                disabled={isLoading}
                                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text-body)] transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
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

const AssistentesView: React.FC<AssistentesViewProps> = ({ allSavedPdfs, clients, aiConfig }) => {
    const [activeAssistant, setActiveAssistant] = useState<AssistantId>('financeiro');
    const [standaloneExpenses, setStandaloneExpenses] = useState<StandaloneExpense[]>([]);
    const [expensesLoaded, setExpensesLoaded] = useState(false);
    const [cache, setCache] = useState<FinancialAnalysisCache | null>(null);

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

    // Resumo do mes atual com o mes anterior como comparativo. Tudo em memoria.
    const summary = useMemo<FinancialSummary>(() => {
        const { range, previousRange } = getCurrentMonthRanges();
        return buildFinancialSummary({
            pdfs: allSavedPdfs,
            standaloneExpenses,
            clients,
            range,
            previousRange,
            periodLabel: 'Este mes'
        });
    }, [allSavedPdfs, standaloneExpenses, clients]);

    const activeConfig = ASSISTANTS.find(assistant => assistant.id === activeAssistant) || ASSISTANTS[0];

    return (
        <div className="mx-auto w-full max-w-3xl space-y-4">
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

            <div className="flex flex-wrap gap-2">
                {ASSISTANTS.map(assistant => {
                    const isActive = assistant.id === activeAssistant;
                    return (
                        <button
                            key={assistant.id}
                            type="button"
                            onClick={() => assistant.enabled && setActiveAssistant(assistant.id)}
                            disabled={!assistant.enabled}
                            className={[
                                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
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
                <div className="flex h-[calc(100dvh-230px)] min-h-[460px] items-center justify-center rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500" aria-hidden="true" />
                </div>
            ) : (
                <FinancialAssistantPanel
                    config={activeConfig}
                    summary={summary}
                    apiKey={aiConfig?.apiKey}
                    provider={aiConfig?.provider}
                    cache={cache}
                    onCached={setCache}
                />
            )}
        </div>
    );
};

export default AssistentesView;
