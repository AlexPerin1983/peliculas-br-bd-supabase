import { createGeminiModel } from './geminiGateway';

const { invoke, personalGenerateContent } = vi.hoisted(() => ({
    invoke: vi.fn(),
    personalGenerateContent: vi.fn()
}));

vi.mock('./supabaseClient', () => ({
    supabase: { functions: { invoke } }
}));

vi.mock('@google/genai', () => ({
    ThinkingLevel: { MINIMAL: 'MINIMAL' },
    GoogleGenAI: class {
        models = {
            generateContent: personalGenerateContent,
            generateContentStream: vi.fn()
        };
    }
}));

describe('geminiGateway', () => {
    beforeEach(() => {
        invoke.mockReset();
        personalGenerateContent.mockReset();
    });

    it('usa a chave global primeiro mesmo quando existe chave pessoal', async () => {
        invoke.mockResolvedValue({ data: { text: 'resposta global' }, error: null });
        const model = createGeminiModel({ apiKey: 'chave-pessoal', feature: 'client_extraction' });

        const result = await model.generateContent('teste');

        expect(result.response.text()).toBe('resposta global');
        expect(personalGenerateContent).not.toHaveBeenCalled();
    });

    it('usa a chave pessoal quando a chave global fica indisponivel', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: {
                message: 'Limite global',
                context: new Response(JSON.stringify({ code: 'GLOBAL_QUOTA_EXHAUSTED' }), { status: 429 })
            }
        });
        personalGenerateContent.mockResolvedValue({ text: 'resposta pessoal' });
        const model = createGeminiModel({ apiKey: 'chave-pessoal', feature: 'client_extraction' });

        const result = await model.generateContent('teste');

        expect(result.response.text()).toBe('resposta pessoal');
        expect(personalGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('propaga o motivo de conclusao da resposta global', async () => {
        invoke.mockResolvedValue({
            data: { text: '{"medidas":[]}', finishReason: 'STOP', finishMessage: '' },
            error: null
        });
        const model = createGeminiModel({ feature: 'measurement_extraction' });

        const result = await model.generateContent('teste');

        expect(result.response.finishReason).toBe('STOP');
        expect(result.response.text()).toBe('{"medidas":[]}');
    });

    it('nao usa fallback nem anuncia cota global quando a resposta foi truncada', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: {
                message: 'Resposta incompleta',
                context: new Response(JSON.stringify({
                    code: 'OUTPUT_TRUNCATED',
                    error: 'A resposta atingiu o limite de tamanho',
                    finishReason: 'MAX_TOKENS'
                }), { status: 422 })
            }
        });
        const unavailableListener = vi.fn();
        window.addEventListener('filmstec:global-gemini-unavailable', unavailableListener);
        const model = createGeminiModel({ apiKey: 'chave-pessoal', feature: 'measurement_extraction' });

        await expect(model.generateContent('teste')).rejects.toMatchObject({
            code: 'OUTPUT_TRUNCATED',
            finishReason: 'MAX_TOKENS'
        });
        expect(personalGenerateContent).not.toHaveBeenCalled();
        expect(unavailableListener).not.toHaveBeenCalled();
        window.removeEventListener('filmstec:global-gemini-unavailable', unavailableListener);
    });
});
