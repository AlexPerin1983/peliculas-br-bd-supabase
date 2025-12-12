import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Hello from AbacatePay Webhook RPC VERSION!")

serve(async (req) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Content-Type": "application/json"
    }

    try {
        if (req.method === 'GET') {
            return new Response(JSON.stringify({ message: 'Função está ONLINE!' }), { status: 200, headers })
        }

        const url = new URL(req.url)
        const secret = url.searchParams.get('webhookSecret')
        const envSecret = Deno.env.get('ABACATE_WEBHOOK_SECRET')

        if (envSecret && secret !== envSecret) {
            return new Response(JSON.stringify({ error: 'Secret inválido' }), { status: 401, headers })
        }

        const payload = await req.json()
        console.log("Payload recebido:", JSON.stringify(payload)) // DEBUG
        console.log("Evento recebido:", payload.event) // DEBUG

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SERVICE_ROLE_KEY') ?? ''
        )
        const normalizedEmail = email.trim().toLowerCase()

        console.log(`Tentando aprovar via RPC: ${normalizedEmail}`)

        // CHAMADA RPC (Função de Banco) - INFALÍVEL
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('approve_user_by_email', {
            user_email: normalizedEmail
        })

        if (rpcError) {
            console.error('Erro no RPC:', rpcError)
            return new Response(JSON.stringify({ error: 'Erro ao executar RPC de aprovação', detalhe: rpcError }), { status: 500, headers })
        }

        console.log("Resultado do RPC (Usuário Atualizado):", JSON.stringify(rpcData))

        if (!rpcData) {
            console.error('ALERTA: RPC executou mas NÃO retornou dados. Nenhum usuário encontrado?')
            return new Response(JSON.stringify({ message: `RPC executado, mas nenhum usuário foi atualizado. Verifique se o email ${normalizedEmail} existe no banco.` }), { status: 200, headers })
        }

        return new Response(JSON.stringify({ message: `SUCESSO: Usuário ${normalizedEmail} aprovado!`, data: rpcData }), { status: 200, headers })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers })
    }
})
