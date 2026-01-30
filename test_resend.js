import fetch from 'node-fetch';

const API_KEY = 're_6PqGSpbW_BQT4D23DB8cQ56eH8TzGTngX';
const SENDER = 'naoresponder@filmstec.shop';

async function testResend() {
    console.log('🚀 Testando conexão com a API do Resend...');

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: SENDER,
                to: 'windowfilm.br@gmail.com',
                subject: 'Teste de API Resend',
                html: '<p>Se você recebeu isso, a chave da API do Resend está funcionando!</p>',
            }),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ SUCESSO! O Resend enviou o e-mail. ID:', data.id);
            console.log('O problema está na conexão entre o Supabase e o Resend (possivelmente a manutenção).');
        } else {
            console.log('❌ ERRO NA API DO RESEND:', data.message);
            console.log('Verifique se a chave está correta ou se o domínio filmstec.shop já permite envios.');
        }
    } catch (error) {
        console.error('❌ FALHA AO CONECTAR NA API:', error.message);
    }
}

testResend();
