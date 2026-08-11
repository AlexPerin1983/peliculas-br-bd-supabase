import { supabase } from './supabaseClient';
import { GEMINI_TEXT_MODEL } from '../src/lib/geminiModel';

export const GLOBAL_GEMINI_UNAVAILABLE_EVENT = 'filmstec:global-gemini-unavailable';

type GeminiPart = string | {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
};

interface GeminiModelOptions {
    apiKey?: string | null;
    feature: string;
    generationConfig?: Record<string, unknown>;
    systemInstruction?: string;
}

interface GatewayResponse {
    text: string;
    usageMetadata?: Record<string, unknown>;
    finishReason?: string;
    finishMessage?: string;
}

export class GeminiGatewayError extends Error {
    code: string;
    status?: number;
    finishReason?: string;

    constructor(
        code: string,
        message: string,
        options: { status?: number; finishReason?: string } = {}
    ) {
        super(message);
        this.name = 'GeminiGatewayError';
        this.code = code;
        this.status = options.status;
        this.finishReason = options.finishReason;
    }
}

const NON_FALLBACK_ERROR_CODES = new Set([
    'USER_RATE_LIMIT',
    'OUTPUT_TRUNCATED',
    'CONTENT_BLOCKED',
    'INPUT_TOO_LARGE',
    'INVALID_INPUT',
    'UNAUTHORIZED'
]);

const shouldUsePersonalFallback = (error: unknown) => {
    if (!(error instanceof GeminiGatewayError)) return true;
    if (NON_FALLBACK_ERROR_CODES.has(error.code)) return false;
    if (error.status && [400, 401, 403, 413, 422].includes(error.status)) return false;
    return true;
};

const assertCompletedResponse = (finishReason?: string, finishMessage?: string) => {
    if (!finishReason || finishReason === 'STOP' || finishReason === 'FINISH_REASON_UNSPECIFIED') return;
    if (finishReason === 'MAX_TOKENS') {
        throw new GeminiGatewayError(
            'OUTPUT_TRUNCATED',
            finishMessage || 'A resposta da IA atingiu o limite de tamanho.',
            { finishReason }
        );
    }
    if (/SAFETY|PROHIBITED_CONTENT|BLOCKLIST|RECITATION/i.test(finishReason)) {
        throw new GeminiGatewayError(
            'CONTENT_BLOCKED',
            finishMessage || 'O conteúdo não pôde ser processado.',
            { finishReason }
        );
    }
    throw new GeminiGatewayError(
        'INCOMPLETE_RESPONSE',
        finishMessage || 'A IA não concluiu a resposta.',
        { finishReason }
    );
};

const buildPersonalConfig = (
    generationConfig?: Record<string, unknown>,
    systemInstruction?: string
): Record<string, unknown> => ({
    ...(generationConfig || {}),
    thinkingConfig: generationConfig?.thinkingConfig || { thinkingLevel: 'MINIMAL' },
    ...(systemInstruction?.trim() ? { systemInstruction } : {})
});

const normalizeParts = (input: unknown): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> => {
    const rawParts = Array.isArray(input)
        ? input
        : Array.isArray((input as any)?.contents)
            ? (input as any).contents.flatMap((content: any) => content?.parts || [])
            : [(input as any)?.contents ?? input];

    return rawParts
        .filter(part => part !== null && part !== undefined)
        .map((part: GeminiPart) => {
            if (typeof part === 'string') return { text: part };
            if (part.inlineData?.mimeType && part.inlineData?.data) {
                return {
                    inlineData: {
                        mimeType: part.inlineData.mimeType,
                        data: part.inlineData.data
                    }
                };
            }
            return { text: String(part.text || '') };
        });
};

const notifyGlobalUnavailable = (reason: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(GLOBAL_GEMINI_UNAVAILABLE_EVENT, {
        detail: { reason }
    }));
};

const globalRequest = async (
    feature: string,
    input: unknown,
    generationConfig?: Record<string, unknown>,
    systemInstruction?: string
): Promise<GatewayResponse> => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
            feature,
            parts: normalizeParts(input),
            generationConfig,
            systemInstruction
        }
    });

    if (error) {
        const context = (error as any)?.context;
        const status = context?.status;
        let reason = error.message || 'global_gemini_error';
        let code = 'GLOBAL_GEMINI_ERROR';
        let finishReason: string | undefined;

        try {
            const payload = context ? await context.clone().json() : null;
            reason = payload?.error || payload?.code || reason;
            code = payload?.code || code;
            finishReason = payload?.finishReason;
        } catch {
            // Mantem a mensagem original quando o corpo nao e JSON.
        }

        if (status === 413 && code === 'GLOBAL_GEMINI_ERROR') code = 'INPUT_TOO_LARGE';
        if (status === 401 && code === 'GLOBAL_GEMINI_ERROR') code = 'UNAUTHORIZED';
        throw new GeminiGatewayError(code, reason, { status, finishReason });
    }

    if (!data?.text) {
        throw new GeminiGatewayError('EMPTY_RESPONSE', 'Gemini nao retornou conteudo.');
    }

    return {
        text: data.text,
        usageMetadata: data.usageMetadata,
        finishReason: data.finishReason,
        finishMessage: data.finishMessage
    };
};

export const createGeminiModel = ({
    apiKey,
    feature,
    generationConfig,
    systemInstruction
}: GeminiModelOptions) => {
    const personalKey = apiKey?.trim();
    const personalClientPromise = personalKey
        ? import('@google/genai').then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey: personalKey }))
        : null;

    const usePersonalFallback = async <T>(operation: () => Promise<T>, globalError: unknown): Promise<T> => {
        if (!shouldUsePersonalFallback(globalError)) {
            throw globalError;
        }

        if (!personalClientPromise) {
            const reason = globalError instanceof GeminiGatewayError
                ? globalError.code
                : globalError instanceof Error
                    ? globalError.message
                    : 'global_gemini_error';
            notifyGlobalUnavailable(reason);
            throw globalError;
        }

        try {
            return await operation();
        } catch (personalError) {
            const message = personalError instanceof Error ? personalError.message : String(personalError);
            if (/API_KEY_INVALID|API key not valid|API key invalid|400/i.test(message)) {
                notifyGlobalUnavailable('PERSONAL_KEY_INVALID');
                throw new Error('Sua chave pessoal do Gemini é inválida e a IA compartilhada está indisponível. Remova ou atualize a chave pessoal.');
            }
            throw personalError;
        }
    };

    const generateContent = async (input: unknown) => {
        try {
            const gateway = await globalRequest(feature, input, generationConfig, systemInstruction);
            assertCompletedResponse(gateway.finishReason, gateway.finishMessage);
            return {
                response: {
                    text: () => gateway.text,
                    usageMetadata: gateway.usageMetadata,
                    finishReason: gateway.finishReason,
                    finishMessage: gateway.finishMessage
                }
            } as any;
        } catch (globalError) {
            return usePersonalFallback(async () => {
                const personalClient = await personalClientPromise!;
                const response = await personalClient!.models.generateContent({
                    model: GEMINI_TEXT_MODEL,
                    contents: input as any,
                    config: buildPersonalConfig(generationConfig, systemInstruction) as any
                });
                const finishReason = (response as any).candidates?.[0]?.finishReason;
                const finishMessage = (response as any).candidates?.[0]?.finishMessage;
                assertCompletedResponse(finishReason, finishMessage);
                return {
                    response: {
                        text: () => response.text || '',
                        usageMetadata: response.usageMetadata,
                        finishReason,
                        finishMessage
                    }
                } as any;
            }, globalError);
        }
    };

    const generateContentStream = async (input: unknown) => {
        try {
            const gateway = await globalRequest(
                feature,
                (input as any)?.contents ?? input,
                generationConfig,
                systemInstruction
            );
            assertCompletedResponse(gateway.finishReason, gateway.finishMessage);
            async function* stream() {
                yield { text: () => gateway.text };
            }
            return {
                stream: stream(),
                response: Promise.resolve({
                    text: () => gateway.text,
                    usageMetadata: gateway.usageMetadata,
                    finishReason: gateway.finishReason,
                    finishMessage: gateway.finishMessage
                })
            } as any;
        } catch (globalError) {
            return usePersonalFallback(async () => {
                const personalClient = await personalClientPromise!;
                const responseStream = await personalClient!.models.generateContentStream({
                    model: GEMINI_TEXT_MODEL,
                    contents: ((input as any)?.contents ?? input) as any,
                    config: buildPersonalConfig(generationConfig, systemInstruction) as any
                });
                async function* stream() {
                    for await (const chunk of responseStream) {
                        yield { text: () => chunk.text || '' };
                    }
                }
                return { stream: stream() } as any;
            }, globalError);
        }
    };

    return {
        generateContent,
        generateContentStream
    } as any;
};
