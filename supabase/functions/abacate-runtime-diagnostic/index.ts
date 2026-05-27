import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/billing.ts';

function maskSecret(value: string | null): string | null {
    if (!value) return null;
    if (value.length <= 10) return `${value.slice(0, 3)}***`;
    return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (Deno.env.get('ENABLE_RUNTIME_DIAGNOSTIC') !== 'true') {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Nao encontrado'
                }),
                {
                    headers: corsHeaders,
                    status: 404
                }
            );
        }

        const url = new URL(req.url);
        const providedSecret = url.searchParams.get('secret');
        const expectedSecret = Deno.env.get('ABACATE_WEBHOOK_SECRET') ?? '';

        if (!providedSecret || !expectedSecret || providedSecret !== expectedSecret) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Nao autorizado'
                }),
                {
                    headers: corsHeaders,
                    status: 401
                }
            );
        }

        const apiKey = Deno.env.get('ABACATE_API_KEY') ?? '';

        return new Response(
            JSON.stringify({
                success: true,
                apiKeyPrefix: maskSecret(apiKey),
                isProductionKey: apiKey.startsWith('abc_prod_'),
                isSandboxKey: apiKey.startsWith('abc_dev_'),
                webhookSecretConfigured: Boolean(expectedSecret)
            }),
            {
                headers: corsHeaders,
                status: 200
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            }),
            {
                headers: corsHeaders,
                status: 400
            }
        );
    }
});
