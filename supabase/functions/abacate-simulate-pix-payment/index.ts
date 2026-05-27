import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { abacateRequest } from '../_shared/abacate.ts';
import { corsHeaders } from '../_shared/billing.ts';

interface SimulatePixRequest {
    sessionId: string;
}

function isProductionAbacateKey(): boolean {
    return (Deno.env.get('ABACATE_API_KEY') ?? '').startsWith('abc_prod_');
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (req.method !== 'POST') {
            throw new Error('Metodo nao permitido');
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Nao autorizado');
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: authHeader }
                },
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        if (!user) {
            throw new Error('Usuario nao autenticado');
        }

        const body = (await req.json()) as SimulatePixRequest;
        if (!body.sessionId) {
            throw new Error('sessionId obrigatorio');
        }

        if (isProductionAbacateKey()) {
            throw new Error('A simulacao de Pix esta desabilitada em producao');
        }

        const response = await abacateRequest<{
            data?: { id: string; status: string };
            error?: string | null;
        }>('v2', '/transparents/simulate-payment', {
            method: 'POST',
            body: {
                id: body.sessionId
            }
        });

        return new Response(
            JSON.stringify({
                success: true,
                status: response.data?.status || 'PROCESSING'
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
