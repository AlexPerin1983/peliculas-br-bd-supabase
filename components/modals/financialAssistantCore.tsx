import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_TEXT_MODEL } from '../../src/lib/geminiModel';
import { FinancialSummary, FinancialAnalysisCache } from '../../src/lib/financialAnalytics';

export type { FinancialSummary, FinancialAnalysisCache, PeriodComparison } from '../../src/lib/financialAnalytics';

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

// Pergunta interna que dispara o diagnostico inicial. Fica no historico
// enviado a IA (como turno do usuario), mas nunca aparece na tela.
const DIAGNOSIS_REQUEST = 'Faca um diagnostico inicial e objetivo da saude financeira deste periodo.';

// Quantidade maxima de turnos enviados por chamada. Limita o custo: o
// contexto dos numeros vai no systemInstruction, nao no historico.
const MAX_HISTORY_TURNS = 8;

export const SUGGESTION_CHIPS = [
    'Comparar com o periodo anterior',
    'Onde meu custo mais aumentou?',
    'Projete meu faturamento do mes',
    'Como melhorar minha margem?'
];

const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatPercent = (value: number) => `${value.toFixed(1).replace('.', ',')}%`;

// Assinatura usada para cache: se os numeros nao mudaram, reaproveita a
// analise anterior em vez de gastar uma nova chamada na IA.
const buildSignature = (summary: FinancialSummary) => JSON.stringify(summary);

export const summaryHasData = (summary: FinancialSummary) =>
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

export const renderMarkdown = (markdown: string): React.ReactNode => {
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

interface UseFinancialAssistantChatParams {
    isOpen: boolean;
    summary: FinancialSummary;
    apiKey?: string;
    provider?: 'gemini' | 'openai' | 'local_ocr';
    cache: FinancialAnalysisCache | null;
    onCached: (entry: FinancialAnalysisCache) => void;
}

// Hook com toda a logica do chat (chamadas, cache, custo). E reaproveitado pelo
// modal do Dashboard e pela tela de Assistentes.
export const useFinancialAssistantChat = ({
    isOpen,
    summary,
    apiKey,
    provider,
    cache,
    onCached
}: UseFinancialAssistantChatParams) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const signature = useMemo(() => buildSignature(summary), [summary]);
    const canUseAI = provider === 'gemini' && !!apiKey;
    const dataAvailable = summaryHasData(summary);

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

    const lastTurnIsUser = messages.length > 0 && messages[messages.length - 1].role === 'user';

    return {
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
    };
};
