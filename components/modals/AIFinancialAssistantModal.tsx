import React, { useEffect, useRef } from 'react';
import { Sparkles, AlertCircle, KeyRound, BarChart3, Send, RefreshCw } from 'lucide-react';
import Modal from '../ui/Modal';
import {
    FinancialSummary,
    FinancialAnalysisCache,
    SUGGESTION_CHIPS,
    renderMarkdown,
    useFinancialAssistantChat
} from './financialAssistantCore';

export type { FinancialSummary, FinancialAnalysisCache, PeriodComparison } from './financialAssistantCore';

const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatPercent = (value: number) => `${value.toFixed(1).replace('.', ',')}%`;

interface AIFinancialAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: FinancialSummary;
    apiKey?: string;
    provider?: 'gemini' | 'openai' | 'local_ocr';
    cache: FinancialAnalysisCache | null;
    onCached: (entry: FinancialAnalysisCache) => void;
}

const AIFinancialAssistantModal: React.FC<AIFinancialAssistantModalProps> = ({
    isOpen,
    onClose,
    summary,
    apiKey,
    provider,
    cache,
    onCached
}) => {
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
    } = useFinancialAssistantChat({ isOpen, summary, apiKey, provider, cache, onCached });

    const threadEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        threadEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    }, [messages, isLoading]);

    const metricChips = [
        { label: 'Faturamento', value: formatCurrency(summary.faturamentoTotal) },
        { label: 'Lucro est.', value: formatCurrency(summary.lucroEstimado) },
        { label: 'Margem', value: formatPercent(summary.margemEstimada) },
        { label: 'Aprovacao', value: formatPercent(summary.taxaAprovacao) }
    ];

    const chatEnabled = canUseAI && dataAvailable;

    const footer = chatEnabled ? (
        <div className="w-full space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {SUGGESTION_CHIPS.map(chip => (
                    <button
                        key={chip}
                        type="button"
                        onClick={() => sendMessage(chip)}
                        disabled={isLoading}
                        className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text-body)] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
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
                    placeholder="Pergunte sobre seus numeros..."
                    className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none transition-colors focus:border-blue-400 disabled:opacity-60"
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                    aria-label="Enviar pergunta"
                >
                    <Send className="h-4 w-4" aria-hidden="true" />
                </button>
            </form>
        </div>
    ) : null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <span className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-500" aria-hidden="true" />
                    Assistente Financeiro
                </span>
            }
            footer={footer}
            fullScreenOnMobile
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {metricChips.map(chip => (
                        <div
                            key={chip.label}
                            className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2"
                        >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                {chip.label}
                            </p>
                            <p className="mt-0.5 text-sm font-bold text-[var(--text-strong)]">{chip.value}</p>
                        </div>
                    ))}
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-4">
                    {!canUseAI && (
                        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                            <KeyRound className="h-10 w-10 text-blue-500" aria-hidden="true" />
                            <p className="max-w-sm text-sm text-[var(--text-body)]">
                                Para usar o Assistente Financeiro, configure o provedor <strong>Gemini</strong> e
                                sua chave de API em <strong>Configuracoes &gt; Empresa</strong>.
                            </p>
                        </div>
                    )}

                    {canUseAI && !dataAvailable && (
                        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                            <BarChart3 className="h-10 w-10 text-[var(--text-muted)]" aria-hidden="true" />
                            <p className="max-w-sm text-sm text-[var(--text-body)]">
                                Ainda nao ha dados suficientes neste periodo. Gere orcamentos ou registre despesas
                                e volte aqui para receber a analise.
                            </p>
                        </div>
                    )}

                    {chatEnabled && (
                        <div className="space-y-4">
                            {messages.map((message, index) =>
                                message.role === 'assistant' ? (
                                    <div
                                        key={index}
                                        className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"
                                    >
                                        {renderMarkdown(message.text)}
                                    </div>
                                ) : (
                                    <div key={index} className="flex justify-end">
                                        <p className="max-w-[85%] rounded-[var(--radius-control)] bg-blue-600 px-3 py-2 text-sm text-white">
                                            {message.text}
                                        </p>
                                    </div>
                                )
                            )}

                            {isLoading && (
                                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]" aria-live="polite">
                                    <Sparkles className="h-4 w-4 animate-pulse text-blue-500" aria-hidden="true" />
                                    {messages.length === 0 ? 'Analisando seus numeros...' : 'Pensando...'}
                                </div>
                            )}

                            {!isLoading && error && (
                                <div className="flex flex-col items-start gap-2 rounded-[var(--radius-control)] border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
                                    <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                        <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                                        {error}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => (lastTurnIsUser ? retryLast() : runDiagnosis(true))}
                                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                        Tentar novamente
                                    </button>
                                </div>
                            )}

                            <div ref={threadEndRef} />
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default AIFinancialAssistantModal;
