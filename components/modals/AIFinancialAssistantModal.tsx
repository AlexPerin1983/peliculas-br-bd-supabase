import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Sparkles, AlertCircle, KeyRound, BarChart3, Send, RefreshCw } from 'lucide-react';
import Modal from '../ui/Modal';
import { GEMINI_TEXT_MODEL } from '../../src/lib/geminiModel';

// Numeros do periodo anterior equivalente (mesma duracao, imediatamente antes).
// Permite a IA responder perguntas de comparacao sem inventar valores.
export interface PeriodComparison {
    periodoAnterior: string;
    faturamentoTotal: number;
    faturamentoAprovado: number;
    despesas: number;
    lucroEstimado: number;
    margemEstimada: number;
    gastosPorCategoria: { label: string; value: number }[];
}

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
    diasNoPeriodo?: number;
    faturamentoDiarioMedio?: number;
    comparativo?: PeriodComparison | null;
}

export interface FinancialAnalysisCache {
    signature: string;
    text: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

// Pergunta interna que dispara o diagnostico inicial. Fica no historico
// enviado a IA (como turno do usuario), mas nunca aparece na tela.
const DIAGNOSIS_REQUEST = 'Faca um diagnostico inicial e objetivo da saude financeira deste periodo.';

// Quantidade maxima de turnos enviados por chamada. Limita o custo: o
// contexto dos numeros vai no systemInstruction, nao no historico.
const MAX_HISTORY_TURNS = 8;

const SUGGESTION_CHIPS = [
    'Comparar com o periodo anterior',
    'Onde meu custo mais aumentou?',
    'Projete meu faturamento do mes',
    'Como melhorar minha margem?'
];

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

const formatCategorias = (categorias: { label: string; value: number }[]) =>
    categorias.length
        ? categorias.map(c => `${c.label}: ${formatCurrency(c.value)}`).join(' | ')
        : 'sem gastos categorizados';

// Contexto com TODOS os numeros do periodo. Vai no systemInstruction, entao a
// IA so conversa em cima de dados reais (nao inventa valores).
const buildSystemInstruction = (summary: FinancialSummary): string => {
    const linhas = [
        `Voce e um consultor financeiro experiente de uma empresa de aplicacao de peliculas/insulfilm (vidros automotivos e residenciais). Converse em portugues do Brasil, de forma direta, pratica e amigavel para um pequeno empresario (sem jargao academico).`,
        '',
        'REGRAS IMPORTANTES:',
        '- Use SOMENTE os numeros fornecidos abaixo. NUNCA invente valores que nao estejam nos dados.',
        '- Para projecoes, baseie-se no faturamento diario medio e nos dias do periodo, e deixe claro que e uma estimativa.',
        '- Se o usuario pedir algo que os dados nao cobrem, diga que esse dado nao esta disponivel neste resumo.',
        '- Responda em markdown simples (titulos com ## e listas com -). Seja conciso e va direto ao ponto.',
        '- Formate dinheiro em reais (R$) e percentuais com uma casa decimal.',
        '',
        `DADOS DO PERIODO ATUAL (${summary.periodo}):`,
        `- Faturamento total cotado: ${formatCurrency(summary.faturamentoTotal)}`,
        `- Faturamento aprovado: ${formatCurrency(summary.faturamentoAprovado)}`,
        `- Despesas: ${formatCurrency(summary.despesas)}`,
        `- Lucro estimado: ${formatCurrency(summary.lucroEstimado)}`,
        `- Margem estimada: ${formatPercent(summary.margemEstimada)}`,
        `- Ticket medio: ${formatCurrency(summary.ticketMedio)}`,
        `- Taxa de aprovacao de orcamentos: ${formatPercent(summary.taxaAprovacao)}`,
        `- Orcamentos gerados: ${summary.orcamentosGerados} (aprovados: ${summary.orcamentosAprovados}, pendentes: ${summary.orcamentosPendentes})`,
        `- Area total cotada: ${summary.totalM2.toFixed(2)} m2`,
        `- Gasto diario medio: ${formatCurrency(summary.gastoDiarioMedio)}`,
        summary.faturamentoDiarioMedio !== undefined
            ? `- Faturamento diario medio: ${formatCurrency(summary.faturamentoDiarioMedio)}`
            : '',
        summary.diasNoPeriodo !== undefined ? `- Dias no periodo: ${summary.diasNoPeriodo}` : '',
        `- Gastos por categoria: ${formatCategorias(summary.gastosPorCategoria)}`,
        `- Melhor cliente: ${summary.melhorCliente ? `${summary.melhorCliente.name} (${formatCurrency(summary.melhorCliente.value)})` : 'sem dados'}`,
        `- Pelicula mais usada: ${summary.peliculaMaisUsada ? `${summary.peliculaMaisUsada.name} (${summary.peliculaMaisUsada.area.toFixed(2)} m2)` : 'sem dados'}`
    ];

    if (summary.comparativo) {
        const c = summary.comparativo;
        linhas.push(
            '',
            `DADOS DO PERIODO ANTERIOR EQUIVALENTE (${c.periodoAnterior}):`,
            `- Faturamento total cotado: ${formatCurrency(c.faturamentoTotal)}`,
            `- Faturamento aprovado: ${formatCurrency(c.faturamentoAprovado)}`,
            `- Despesas: ${formatCurrency(c.despesas)}`,
            `- Lucro estimado: ${formatCurrency(c.lucroEstimado)}`,
            `- Margem estimada: ${formatPercent(c.margemEstimada)}`,
            `- Gastos por categoria: ${formatCategorias(c.gastosPorCategoria)}`
        );
    }

    return linhas.filter(Boolean).join('\n');
};

const DIAGNOSIS_FORMAT = `Responda EXATAMENTE nesta estrutura, usando markdown simples (## e listas com -). Maximo ~4 itens por secao:

## Diagnostico
(2 a 3 frases resumindo a saude financeira do periodo)

## Pontos fortes
- ...

## Pontos de atencao
- ...

## Recomendacoes praticas
- (acoes concretas que o dono pode tomar)`;

const AIFinancialAssistantModal: React.FC<AIFinancialAssistantModalProps> = ({
    isOpen,
    onClose,
    summary,
    apiKey,
    provider,
    cache,
    onCached
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const threadEndRef = useRef<HTMLDivElement | null>(null);

    const signature = useMemo(() => buildSignature(summary), [summary]);
    const canUseAI = provider === 'gemini' && !!apiKey;
    const dataAvailable = hasData(summary);

    // Monta os turnos enviados a IA. O contexto dos numeros fica no
    // systemInstruction; aqui vai so a conversa (limitada para baratear).
    const buildContents = (history: ChatMessage[]) => {
        const turns = [
            { role: 'user', parts: [{ text: DIAGNOSIS_REQUEST }] },
            ...history.map(message => ({
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: message.text }]
            }))
        ];
        let capped = turns.slice(-MAX_HISTORY_TURNS);
        while (capped.length && capped[0].role !== 'user') {
            capped = capped.slice(1);
        }
        return capped;
    };

    const callAI = async (history: ChatMessage[], extraInstruction?: string): Promise<string> => {
        const genAI = new GoogleGenerativeAI(apiKey as string);
        const model = genAI.getGenerativeModel({
            model: GEMINI_TEXT_MODEL,
            systemInstruction: buildSystemInstruction(summary) + (extraInstruction ? `\n\n${extraInstruction}` : ''),
            // Limita o tamanho da resposta -> controla o custo por chamada.
            generationConfig: { temperature: 0.4, maxOutputTokens: 700 }
        });
        const response = await model.generateContent({ contents: buildContents(history) });
        return response.response.text().trim();
    };

    const describeError = (err: unknown) =>
        err instanceof Error && err.message.includes('API key')
            ? 'Chave de API invalida. Verifique sua configuracao em Configuracoes > Empresa.'
            : 'Nao foi possivel responder agora. Tente novamente em instantes.';

    const runDiagnosis = async (force: boolean) => {
        if (!canUseAI || !dataAvailable) return;

        // Reaproveita cache se os numeros nao mudaram (economiza chamada).
        if (!force && cache && cache.signature === signature) {
            setMessages([{ role: 'assistant', text: cache.text }]);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const text = await callAI([], DIAGNOSIS_FORMAT);
            setMessages([{ role: 'assistant', text }]);
            onCached({ signature, text });
        } catch (err) {
            console.error('[AIFinancialAssistant] Erro:', err);
            setError(describeError(err));
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading || !canUseAI || !dataAvailable) return;

        const history = [...messages, { role: 'user' as const, text: trimmed }];
        setMessages(history);
        setInput('');
        setIsLoading(true);
        setError(null);
        try {
            const reply = await callAI(history);
            setMessages([...history, { role: 'assistant', text: reply }]);
        } catch (err) {
            console.error('[AIFinancialAssistant] Erro:', err);
            setError(describeError(err));
        } finally {
            setIsLoading(false);
        }
    };

    // Reenvia a conversa atual (cujo ultimo turno e do usuario) apos um erro.
    const retryLast = async () => {
        if (isLoading || !canUseAI || !dataAvailable) return;
        if (messages.length === 0) {
            runDiagnosis(true);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const reply = await callAI(messages);
            setMessages([...messages, { role: 'assistant', text: reply }]);
        } catch (err) {
            console.error('[AIFinancialAssistant] Erro:', err);
            setError(describeError(err));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        // Ao abrir: mostra cache se valido, senao gera o diagnostico uma vez.
        if (cache && cache.signature === signature) {
            setMessages([{ role: 'assistant', text: cache.text }]);
            setError(null);
            return;
        }
        setMessages([]);
        setError(null);
        if (canUseAI && dataAvailable) {
            runDiagnosis(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, signature]);

    useEffect(() => {
        threadEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    }, [messages, isLoading]);

    const metricChips = [
        { label: 'Faturamento', value: formatCurrency(summary.faturamentoTotal) },
        { label: 'Lucro est.', value: formatCurrency(summary.lucroEstimado) },
        { label: 'Margem', value: formatPercent(summary.margemEstimada) },
        { label: 'Aprovacao', value: formatPercent(summary.taxaAprovacao) }
    ];

    const lastTurnIsUser = messages.length > 0 && messages[messages.length - 1].role === 'user';
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
