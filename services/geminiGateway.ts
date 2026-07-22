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
}

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

        try {
            const payload = context ? await context.clone().json() : null;
            reason = payload?.code || payload?.error || reason;
        } catch {
            // Mantem a mensagem original quando o corpo nao e JSON.
        }

        throw new Error(reason);
    }

    if (!data?.text) {
        throw new Error('Gemini nao retornou conteudo.');
    }

    return {
        text: data.text,
        usageMetadata: data.usageMetadata
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
        if (!personalClientPromise) {
            const reason = globalError instanceof Error ? globalError.message : 'global_gemini_error';
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
            return {
                response: {
                    text: () => gateway.text,
                    usageMetadata: gateway.usageMetadata
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
                return {
                    response: {
                        text: () => response.text || '',
                        usageMetadata: response.usageMetadata
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
            async function* stream() {
                yield { text: () => gateway.text };
            }
            return {
                stream: stream(),
                response: Promise.resolve({
                    text: () => gateway.text,
                    usageMetadata: gateway.usageMetadata
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
