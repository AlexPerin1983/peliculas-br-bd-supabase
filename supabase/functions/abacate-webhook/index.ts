import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Hello from AbacatePay Webhook ROBUST TEST!")

serve(async (req) => {
    // Permite acesso de qualquer origem (CORS) para facilitar testes
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Content-Type": "application/json"
    }

    try {
        // Se for um acesso pelo navegador (GET), avisa que está funcionando
        if (req.method === 'GET') {
            return new Response(JSON.stringify({ message: 'Função está ONLINE! O Webhook deve ser POST.' }), {
                status: 200,
                headers
            })
        }

        // Tenta ler o corpo, mas não quebra se falhar
        let payload = {}
        try {
            payload = await req.json()
        } catch (e) {
            console.log('Não foi possível ler JSON (pode ser teste vazio)')
        }

        console.log('Webhook recebido:', JSON.stringify(payload))

        return new Response(JSON.stringify({ message: 'Recebido com sucesso!' }), {
            status: 200,
            headers
        })

    } catch (error) {
        console.error('Erro genérico:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200, // Retorna 200 mesmo com erro para o AbacatePay ver que conectou
            headers
        })
    }
})
