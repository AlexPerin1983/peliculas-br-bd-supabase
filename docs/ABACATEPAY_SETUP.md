# AbacatePay Setup

## Objetivo

Ativar o novo sistema de cobranca do Peliculas BR com:

- Pix avulso por modulo ou pacote completo, com acesso por 6 meses
- Assinatura recorrente em cartao, renovando a cada 6 meses
- Bloqueio automatico quando a validade expirar

## O que ja esta no codigo

- Migration de billing AbacatePay-only
- Checkout Pix via Edge Function
- Checkout de assinatura recorrente via Edge Function
- Webhook com idempotencia e validacao HMAC
- Frontend com CTAs para Pix e assinatura

## Variaveis de ambiente

Configure:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `ABACATE_API_KEY`
- `ABACATE_WEBHOOK_SECRET`
- `ABACATE_WEBHOOK_PUBLIC_KEY`
- `RESEND_API_KEY`

Exemplo em `.env.example`.

## Deploy

Rode:

```powershell
.\deploy_abacate_billing.ps1 -ProjectRef "SEU_PROJECT_REF" -DbPassword "SUA_SENHA_DB"
```

## Webhook no painel AbacatePay

Cadastre a URL:

```text
https://SEU_PROJECT_REF.supabase.co/functions/v1/abacate-webhook?webhookSecret=SEU_SECRET
```

Eventos minimos:

- `transparent.completed`
- `checkout.completed`
- `subscription.completed`
- `subscription.renewed`
- `subscription.cancelled`

## Produtos no AbacatePay

### Pix avulso

Nao precisa salvar ID de produto no banco.

O sistema cria a cobranca diretamente com:

- nome do modulo
- descricao
- preco atual do modulo
- frequencia `ONE_TIME`
- metodo `PIX`

### Assinatura recorrente

Cada modulo que pode ter assinatura recorrente precisa ter um produto recorrente criado no AbacatePay.

Esse produto deve representar:

- 1 modulo
- ciclo de 6 meses
- cobranca recorrente

Depois de criar os produtos, atualize a coluna `abacate_subscription_product_id` na tabela `subscription_modules`.

Use o arquivo:

- [supabase_abacate_product_ids.sql](/C:/Users/Alex%20Lacerda/Desktop/App%20testes/Películas%20BR%20BD/supabase_abacate_product_ids.sql)

## Regras de negocio ativas

### Pix

- pagamento confirmado libera 6 meses
- se vencer e nao pagar de novo, bloqueia

### Assinatura recorrente

- primeiro pagamento libera 6 meses
- cada renovacao soma mais 6 meses
- se cancelar, o sistema mantem acesso ate a data de vencimento
- se nao renovar e vencer, bloqueia

## Cancelamento de assinatura

O app ja possui cancelamento de renovacao automatica.

Fluxo atual:

- o usuario cancela a renovacao no proprio app
- a assinatura deixa de renovar no AbacatePay
- o acesso permanece ativo ate `expires_at`
- depois do vencimento, o modulo e bloqueado

Observacao:

- a documentacao publica da AbacatePay nao expoe com clareza a rota de cancelamento, entao esse fluxo foi validado na pratica no sandbox
- antes de virar a chave em producao, valide 1 cancelamento real de baixo risco

## Checklist de producao

1. Desativar `Dev mode` no painel da AbacatePay e concluir a verificacao da conta.
2. Gerar a `ABACATE_API_KEY` de producao.
3. Criar o webhook de producao apontando para:
   `https://SEU_PROJECT_REF.supabase.co/functions/v1/abacate-webhook?webhookSecret=SEU_SECRET`
4. Criar os produtos recorrentes semestrais reais no AbacatePay e atualizar `abacate_subscription_product_id`.
5. Definir os secrets no Supabase:
   - `ABACATE_API_KEY`
   - `ABACATE_WEBHOOK_SECRET`
   - `ABACATE_WEBHOOK_PUBLIC_KEY`
   - `RESEND_API_KEY`
6. Rodar `.\deploy_abacate_billing.ps1`.
7. Validar um Pix real.
8. Validar uma assinatura real.
9. Validar um cancelamento real.
