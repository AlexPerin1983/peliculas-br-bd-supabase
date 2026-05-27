# Guia de Deploy - Serviço de Email com Resend

## 📋 Pré-requisitos

- [ ] Conta no Resend criada
- [ ] API Key do Resend obtida
- [ ] Supabase CLI instalado
- [ ] Projeto Supabase configurado

## 🚀 Passo a Passo

### 1. Configurar Domínio no Resend (Recomendado)

1. Acesse [resend.com/domains](https://resend.com/domains)
2. Clique em "Add Domain"
3. Digite seu domínio (ex: `peliculasbr.com.br`)
4. Adicione os registros DNS fornecidos:
   - **SPF**: TXT record
   - **DKIM**: TXT record
   - **DMARC**: TXT record (opcional, mas recomendado)
5. Aguarde verificação (pode levar até 72h, mas geralmente é rápido)

**Nota**: Enquanto o domínio não for verificado, você pode usar o domínio de teste do Resend, mas os emails podem cair em spam.

### 2. Configurar Variáveis de Ambiente

#### No Supabase (para Edge Functions)

```bash
# Fazer login no Supabase
supabase login

# Linkar com seu projeto
supabase link --project-ref seu-project-ref

# Configurar secrets
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

#### Localmente (para desenvolvimento)

Crie o arquivo `.env.local`:

```env
RESEND_API_KEY=your_resend_api_key_here
```

### 3. Aplicar Migration do Banco de Dados

```bash
# Aplicar migration para criar tabela de logs
supabase db push

# Ou aplicar migration específica
supabase migration up
```

### 4. Deploy da Edge Function

```bash
# Deploy da função send-email
supabase functions deploy send-email

# Verificar se foi deployada com sucesso
supabase functions list
```

### 5. Testar a Edge Function

```bash
# Testar localmente primeiro
supabase functions serve send-email

# Em outro terminal, fazer uma requisição de teste
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"type":"welcome","to":"teste@example.com","data":{"userName":"Teste","organizationName":"Teste Org"}}'
```

### 6. Atualizar Código do Frontend

Certifique-se de que o código está usando o helper correto:

```typescript
import { sendWelcomeEmail } from './services/emailHelper'

// Exemplo de uso
const result = await sendWelcomeEmail('usuario@example.com', {
  userName: 'João Silva',
  organizationName: 'Minha Organização'
})

if (result.success) {
  console.log('Email enviado!')
} else {
  console.error('Erro:', result.error)
}
```

## 🔍 Verificação

### Checklist de Verificação

- [ ] API Key configurada no Supabase
- [ ] Edge Function deployada
- [ ] Migration aplicada (tabela email_logs criada)
- [ ] Domínio verificado no Resend (opcional, mas recomendado)
- [ ] Teste de envio realizado com sucesso
- [ ] Logs aparecendo no Resend Dashboard
- [ ] Logs aparecendo na tabela email_logs

### Comandos Úteis

```bash
# Ver logs da Edge Function
supabase functions logs send-email

# Ver secrets configurados
supabase secrets list

# Testar conexão com Resend
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer your_resend_api_key_here' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "seu-email@example.com",
    "subject": "Teste",
    "html": "<p>Email de teste</p>"
  }'
```

## 🐛 Troubleshooting

### Email não está sendo enviado

1. **Verificar API Key**:
   ```bash
   supabase secrets list
   ```

2. **Verificar logs da Edge Function**:
   ```bash
   supabase functions logs send-email --tail
   ```

3. **Verificar no Dashboard do Resend**:
   - Acesse [resend.com/logs](https://resend.com/logs)
   - Veja se há tentativas de envio

### Email cai em spam

1. **Verificar domínio**: Certifique-se de que seu domínio está verificado no Resend
2. **Configurar SPF/DKIM**: Adicione os registros DNS corretamente
3. **Usar domínio próprio**: Não use o domínio de teste em produção

### Erro de autenticação

1. **Verificar token**: Certifique-se de que está passando o token de autenticação do Supabase
2. **Verificar RLS**: Verifique as políticas de Row Level Security

## 📊 Monitoramento

### Ver estatísticas de emails

```sql
-- No Supabase SQL Editor
SELECT * FROM email_stats
ORDER BY date DESC
LIMIT 100;

-- Ver emails com erro
SELECT * FROM email_logs
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Dashboard do Resend

Acesse [resend.com/overview](https://resend.com/overview) para ver:
- Total de emails enviados
- Taxa de entrega
- Emails que falharam
- Aberturas e cliques (se configurado)

## 🔄 Atualizações Futuras

### Adicionar novo tipo de email

1. Adicionar template na Edge Function
2. Adicionar função no emailHelper.ts
3. Atualizar documentação

### Configurar Webhooks do Resend

Para receber notificações de entrega, bounces, etc:

1. Acesse [resend.com/webhooks](https://resend.com/webhooks)
2. Crie um webhook apontando para sua Edge Function
3. Implemente handler na Edge Function

## 📝 Notas Importantes

- **Limites do Resend**: Plano gratuito tem limite de 100 emails/dia
- **Custos**: Monitore o uso para evitar surpresas
- **Segurança**: Nunca exponha a API Key no frontend
- **Logs**: Mantenha logs por tempo limitado para não sobrecarregar o banco

## 🆘 Suporte

- [Documentação Resend](https://resend.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Comunidade Supabase](https://github.com/supabase/supabase/discussions)
