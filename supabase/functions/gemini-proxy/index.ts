import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createSupabaseAdminClient } from '../_shared/billing.ts';

const MODEL = 'gemini-3.5-flash-lite';
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_REQUESTS_PER_DAY = 200;
const ALLOWED_FEATURES = new Set([
    'client_extraction',
    'quick_proposal',
    'film_extraction',
    'measurement_extraction',
    'stock_extraction'
]);

interface GeminiProxyRequest {
    feature?: string;
    parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }>;
    generationConfig?: Record<string, unknown>;
    systemInstruction?: string;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: corsHeaders });

const safeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Metodo nao permitido' }, 405);
    }

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
        return jsonResponse({ error: 'Entrada muito grande' }, 413);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return jsonResponse({ error: 'Nao autorizado' }, 401);
    }

    const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
            global: { headers: { Authorization: authHeader } },
            auth: { autoRefreshToken: false, persistSession: false }
        }
    );
    const admin = createSupabaseAdminClient();
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
        return jsonResponse({ error: 'Usuario nao autenticado' }, 401);
    }

    const body = await req.json() as GeminiProxyRequest;
    const feature = String(body.feature || '');

    if (!ALLOWED_FEATURES.has(feature)) {
        return jsonResponse({ error: 'Funcionalidade de IA invalida' }, 400);
    }

    const parts = Array.isArray(body.parts) ? body.parts.slice(0, 12) : [];
    if (!parts.length) {
        return jsonResponse({ error: 'Conteudo vazio' }, 400);
    }

    const requestSize = JSON.stringify(parts).length;
    if (requestSize > MAX_REQUEST_BYTES) {
        return jsonResponse({ error: 'Entrada muito grande' }, 413);
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const [{ count: minuteCount }, { count: dayCount }] = await Promise.all([
        admin.from('ai_usage_events').select('id', { count: 'exact', head: true })
            .eq('user_id', user.id).gte('created_at', oneMinuteAgo),
        admin.from('ai_usage_events').select('id', { count: 'exact', head: true })
            .eq('user_id', user.id).gte('created_at', oneDayAgo)
    ]);

    if ((minuteCount || 0) >= MAX_REQUESTS_PER_MINUTE || (dayCount || 0) >= MAX_REQUESTS_PER_DAY) {
        return jsonResponse({
            error: 'Limite de uso por usuario atingido',
            code: 'USER_RATE_LIMIT'
        }, 429);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
        return jsonResponse({
            error: 'Chave global ainda nao configurada',
            code: 'GLOBAL_KEY_NOT_CONFIGURED'
        }, 503);
    }

    const requestedConfig = body.generationConfig || {};
    const generationConfig = {
        ...requestedConfig,
        maxOutputTokens: Math.min(
            Math.max(safeNumber(requestedConfig.maxOutputTokens) || 1200, 64),
            1600
        ),
        thinkingConfig: requestedConfig.thinkingConfig || { thinkingLevel: 'MINIMAL' }
    };

    const payload: Record<string, unknown> = {
        contents: [{ role: 'user', parts }],
        generationConfig
    };

    if (body.systemInstruction?.trim()) {
        payload.systemInstruction = {
            parts: [{ text: body.systemInstruction.slice(0, 30_000) }]
        };
    }

    let googleResponse: Response;
    let googleBody: any;

    try {
        googleResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify(payload)
            }
        );
        googleBody = await googleResponse.json();
    } catch (error) {
        await admin.from('ai_usage_events').insert({
            user_id: user.id,
            feature,
            model: MODEL,
            success: false,
            error_code: 'NETWORK_ERROR'
        });
        return jsonResponse({ error: 'Falha ao conectar ao Gemini' }, 502);
    }

    const usage = googleBody?.usageMetadata || {};
    const status = googleResponse.status;
    const googleErrorCode = googleBody?.error?.status || String(status);

    await admin.from('ai_usage_events').insert({
        user_id: user.id,
        feature,
        model: MODEL,
        success: googleResponse.ok,
        error_code: googleResponse.ok ? null : googleErrorCode,
        prompt_token_count: safeNumber(usage.promptTokenCount),
        candidates_token_count: safeNumber(usage.candidatesTokenCount),
        thoughts_token_count: safeNumber(usage.thoughtsTokenCount),
        total_token_count: safeNumber(usage.totalTokenCount)
    });

    if (!googleResponse.ok) {
        const isQuota = status === 429 || googleErrorCode === 'RESOURCE_EXHAUSTED';
        return jsonResponse({
            error: isQuota ? 'Limite da chave global atingido' : 'Falha na IA global',
            code: isQuota ? 'GLOBAL_QUOTA_EXHAUSTED' : googleErrorCode
        }, isQuota ? 429 : 502);
    }

    const text = (googleBody?.candidates?.[0]?.content?.parts || [])
        .filter((part: any) => !part.thought && typeof part.text === 'string')
        .map((part: any) => part.text)
        .join('');

    if (!text) {
        return jsonResponse({ error: 'Gemini nao retornou conteudo' }, 502);
    }

    return jsonResponse({
        text,
        usageMetadata: usage,
        model: MODEL
    });
});
