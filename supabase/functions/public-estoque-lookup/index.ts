import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, createSupabaseAdminClient } from '../_shared/billing.ts';

function getLookupCode(req: Request): Promise<string> | string {
    if (req.method === 'GET') {
        return new URL(req.url).searchParams.get('code') ?? '';
    }

    return req
        .json()
        .then((payload) => payload?.code ?? '')
        .catch(() => '');
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const rawCode = await getLookupCode(req);
        const code = String(rawCode ?? '').trim();

        if (!code || code.length < 4 || code.length > 128) {
            return new Response(
                JSON.stringify({ success: false, error: 'Codigo QR invalido' }),
                {
                    headers: corsHeaders,
                    status: 400
                }
            );
        }

        const supabase = createSupabaseAdminClient();

        const { data: bobina, error: bobinaError } = await supabase
            .from('bobinas')
            .select('id, film_id, codigo_qr, largura_cm, comprimento_total_m, comprimento_restante_m, status, localizacao, data_cadastro')
            .eq('codigo_qr', code)
            .limit(1)
            .maybeSingle();

        if (bobinaError) {
            throw new Error(bobinaError.message);
        }

        if (bobina) {
            const { data: retalhos, error: retalhosError } = await supabase
                .from('retalhos')
                .select('id, codigo_qr, largura_cm, comprimento_cm, status')
                .eq('bobina_id', bobina.id)
                .order('data_cadastro', { ascending: false });

            if (retalhosError) {
                throw new Error(retalhosError.message);
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    data: {
                        id: bobina.id,
                        tipo: 'bobina',
                        filmId: bobina.film_id,
                        codigoQr: bobina.codigo_qr,
                        larguraCm: bobina.largura_cm,
                        comprimentoTotalM: bobina.comprimento_total_m,
                        comprimentoRestanteM: bobina.comprimento_restante_m,
                        status: bobina.status,
                        localizacao: bobina.localizacao,
                        dataCadastro: bobina.data_cadastro,
                        retalhosAssociados: (retalhos ?? []).map((retalho) => ({
                            id: retalho.id,
                            codigoQr: retalho.codigo_qr,
                            larguraCm: retalho.largura_cm,
                            comprimentoCm: retalho.comprimento_cm,
                            status: retalho.status
                        }))
                    }
                }),
                {
                    headers: corsHeaders,
                    status: 200
                }
            );
        }

        const { data: retalho, error: retalhoError } = await supabase
            .from('retalhos')
            .select('id, film_id, codigo_qr, largura_cm, comprimento_cm, area_m2, status, localizacao, data_cadastro')
            .eq('codigo_qr', code)
            .limit(1)
            .maybeSingle();

        if (retalhoError) {
            throw new Error(retalhoError.message);
        }

        if (!retalho) {
            return new Response(
                JSON.stringify({ success: false, error: 'Item nao encontrado no sistema' }),
                {
                    headers: corsHeaders,
                    status: 404
                }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    id: retalho.id,
                    tipo: 'retalho',
                    filmId: retalho.film_id,
                    codigoQr: retalho.codigo_qr,
                    larguraCm: retalho.largura_cm,
                    comprimentoCm: retalho.comprimento_cm,
                    areaM2: retalho.area_m2,
                    status: retalho.status,
                    localizacao: retalho.localizacao,
                    dataCadastro: retalho.data_cadastro
                }
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
                error: error instanceof Error ? error.message : 'Erro inesperado'
            }),
            {
                headers: corsHeaders,
                status: 400
            }
        );
    }
});
