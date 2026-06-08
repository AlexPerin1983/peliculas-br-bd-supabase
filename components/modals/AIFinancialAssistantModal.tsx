import React, { useEffect, useMemo, useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Sparkles, AlertCircle, RefreshCw, KeyRound, BarChart3 } from 'lucide-react';
import Modal from '../ui/Modal';
import { GEMINI_TEXT_MODEL } from '../../src/lib/geminiModel';

// Resumo financeiro compacto (numeros ja calculados no Dashboard).
// E o unico dado enviado a IA: mantem o prompt pequeno = barato.
export interface FinancialSummary {
    periodo: string;
    faturamentoTotal: number;
    faturamentoAprovado: number;
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
}

export interface FinancialAnalysisCache {
    signature: string;
    text: string;
}

interface AIFinancialAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: FinancialSummary;
    apiKey?: string;
    provider?: 'gemini' | 'openai' | 'local_ocr';
    cache: FinancialAnalysisCache | null;
    onCached: (entry: FinancialAnalysisCache) => void;
}

const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatPercent = (value: number) => `${value.toFixed(1).replace('.', ',')}%`;

// Assinatura usada para cache: se os numeros nao mudaram, reaproveita a
// analise anterior em vez de gastar uma nova chamada na IA.
const buildSignature = (summary: FinancialSummary) => JSON.stringify(summary);

const hasData = (summary: FinancialSummary) =>
    summary.orcamentosGerados > 0 || summary.despesas > 0 || summary.faturamentoTotal > 0;

// Renderizador minimo de markdown -> React (sem dependencia externa, sem innerHTML).
const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={`${keyPrefix}-b-${index}`} className="font-bold text-[var(--text-strong)]">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return <React.Fragment key={`${keyPrefix}-t-${index}`}>{part}</React.Fragment>;
    });
};

const renderMarkdown = (markdown: string): React.ReactNode => {
    const lines = markdown.replace(/\r/g, '').split('\n');
    const blocks: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = (key: string) => {
        if (listItems.length === 0) return;
        const items = listItems;
        listItems = [];
        blocks.push(
            <ul key={key} className="ml-1 space-y-1.5">
                {items.map((item, index) => (
                    <li key={`${key}-${index}`} className="flex gap-2 text-sm leading-relaxed text-[var(--text-body)]">
                        <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                        <span>{renderInline(item, `${key}-${index}`)}</span>
                    </li>
                ))}
            </ul>
        );
    };

    lines.forEach((rawLine, index) => {
        const line = rawLine.trim();
        const key = `md-${index}`;

        if (!line) {
            flushList(`${key}-list`);
            return;
        }

        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
            flushList(`${key}-list`);
            blocks.push(
                <h3 key={key} className="mt-1 text-sm font-bold uppercase tracking-wide text-[var(--text-strong)]">
                    {renderInline(heading[2], key)}
                </h3>
            );
            return;
        }

        const bullet = line.match(/^[-*]\s+(.*)$/);
        if (bullet) {
            listItems.push(bullet[1]);
            return;
        }

        flushList(`${key}-list`);
        blocks.push(
            <p key={key} className="text-sm leading-relaxed text-[var(--text-body)]">
                {renderInline(line, key)}
            </p>
        );
    });

    flushList('md-tail-list');
    return <div className="space-y-3">{blocks}</div>;
};

const buildPrompt = (summary: FinancialSummary): string => {
    const categorias = summary.gastosPorCategoria.length
        ? summary.gastosPorCategoria.map(c => `${c.label}: ${formatCurrency(c.value)}`).join(' | ')
        : 'sem gastos categorizados';

    return `Voce e um consultor financeiro experiente de uma empresa de aplicacao de peliculas/insulfilm (vidros automotivos e residenciais). Analise os indicadores do periodo e responda em portugues do Brasil, de forma direta, pratica e amigavel para um pequeno empresario (sem jargao academico).

DADOS DO PERIODO (${summary.periodo}):
- Faturamento total cotado: ${formatCurrency(summary.faturamentoTotal)}
- Faturamento aprovado: ${formatCurrency(summary.faturamentoAprovado)}
- Despesas: ${formatCurrency(summary.despesas)}
- Lucro estimado: ${formatCurrency(summary.lucroEstimado)}
- Margem estimada: ${formatPercent(summary.margemEstimada)}
- Ticket medio: ${formatCurrency(summary.ticketMedio)}
- Taxa de aprovacao de orcamentos: ${formatPercent(summary.taxaAprovacao)}
- Orcamentos gerados: ${summary.orcamentosGerados} (aprovados: ${summary.orcamentosAprovados}, pendentes: ${summary.orcamentosPendentes})
- Area total cotada: ${summary.totalM2.toFixed(2)} m2
- Gasto diario medio: ${formatCurrency(summary.gastoDiarioMedio)}
- Gastos por categoria: ${categorias}
- Melhor cliente: ${summary.melhorCliente ? `${summary.melhorCliente.name} (${formatCurrency(summary.melhorCliente.value)})` : 'sem dados'}
- Pelicula mais usada: ${summary.peliculaMaisUsada ? `${summary.peliculaMaisUsada.name} (${summary.peliculaMaisUsada.area.toFixed(2)} m2)` : 'sem dados'}

Responda EXATAMENTE nesta estrutura, usando markdown simples (titulos com ## e listas com -). Seja conciso (no maximo ~5 itens por secao):

## Diagnostico
(2 a 3 frases resumindo a saude financeira do periodo)

## Pontos fortes
- ...

## Pontos de atencao
- ...

## Recomendacoes praticas
- (acoes concretas que o dono pode tomar)`;
};

const AIFinancialAssistantModal: React.FC<AIFinancialAssistantModalProps> = ({
    isOpen,
    onClose,
    summary,
    apiKey,
    provider,
    cache,
    onCached
}) => {
    const [result, setResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const signature = useMemo(() => buildSignature(summary), [summary]);
    const canUseAI = provider === 'gemini' && !!apiKey;
    const dataAvailable = hasData(summary);

    const runAnalysis = async (force: boolean) => {
        if (!canUseAI || !dataAvailable) return;

        // Reaproveita cache se os numeros nao mudaram (economiza chamada).
        if (!force && cache && cache.signature === signature) {
            setResult(cache.text);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const genAI = new GoogleGenerativeAI(apiKey as string);
            const model = genAI.getGenerativeModel({
                model: GEMINI_TEXT_MODEL,
                // Limita o tamanho da resposta -> controla o custo por chamada.
                generationConfig: { temperature: 0.4, maxOutputTokens: 900 }
            });
            const response = await model.generateContent(buildPrompt(summary));
            const text = response.response.text().trim();
            setResult(text);
            onCached({ signature, text });
        } catch (err) {
            console.error('[AIFinancialAssistant] Erro:', err);
            setError(
                err instanceof Error && err.message.includes('API key')
                    ? 'Chave de API invalida. Verifique sua configuracao em Configuracoes > Empresa.'
                    : 'Nao foi possivel gerar a analise agora. Tente novamente em instantes.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        // Ao abrir: mostra cache se valido, senao gera uma vez.
        if (cache && cache.signature === signature) {
            setResult(cache.text);
            setError(null);
            return;
        }
        setResult(null);
        if (canUseAI && dataAvailable) {
            runAnalysis(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, signature]);

    const metricChips = [
        { label: 'Faturamento', value: formatCurrency(summary.faturamentoTotal) },
        { label: 'Lucro est.', value: formatCurrency(summary.lucroEstimado) },
        { label: 'Margem', value: formatPercent(summary.margemEstimada) },
        { label: 'Aprovacao', value: formatPercent(summary.taxaAprovacao) }
    ];

    const footer = canUseAI && dataAvailable ? (
        <button
            type="button"
            onClick={() => runAnalysis(true)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400"
        >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isLoading ? 'Gerando...' : 'Gerar novamente'}
        </button>
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
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Periodo analisado
                    </p>
                    <p className="text-sm font-bold text-[var(--text-strong)]">{summary.periodo}</p>
                </div>

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

                    {canUseAI && dataAvailable && isLoading && (
                        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center" aria-live="polite">
                            <Sparkles className="h-10 w-10 animate-pulse text-blue-500" aria-hidden="true" />
                            <p className="text-sm font-medium text-[var(--text-body)]">Analisando seus numeros...</p>
                        </div>
                    )}

                    {canUseAI && dataAvailable && !isLoading && error && (
                        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                            <AlertCircle className="h-10 w-10 text-red-500" aria-hidden="true" />
                            <p className="max-w-sm text-sm text-red-600 dark:text-red-400">{error}</p>
                            <button
                                type="button"
                                onClick={() => runAnalysis(true)}
                                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {canUseAI && dataAvailable && !isLoading && !error && result && (
                        <div>{renderMarkdown(result)}</div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default AIFinancialAssistantModal;
