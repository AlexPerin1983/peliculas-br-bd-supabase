# 📧 Integração com Resend - Guia Rápido

## ✅ O que foi configurado

Criei uma integração completa com o Resend para envio de emails transacionais na sua aplicação. Aqui está o que foi feito:

### Arquivos Criados

1. **`.env.example`** - Template de variáveis de ambiente
2. **`services/emailService.ts`** - Serviço de email (uso direto, para desenvolvimento)
3. **`services/emailHelper.ts`** - Helper para chamar Edge Function (recomendado para produção)
4. **`supabase/functions/send-email/index.ts`** - Edge Function do Supabase
5. **`supabase/functions/deno.json`** - Configuração Deno
6. **`supabase/migrations/email_logs.sql`** - Tabela de logs de emails
7. **`docs/EMAIL_SERVICE.md`** - Documentação completa
8. **`docs/EMAIL_DEPLOY.md`** - Guia de deploy

### Arquivos Modificados

- **`services/inviteService.ts`** - Adicionada função `sendInviteEmailToUser()` para enviar emails de convite

## 🚀 Próximos Passos

### 1. Configurar API Key (IMPORTANTE!)

A API Key que aparece na sua imagem já está no código de exemplo, mas você precisa:

1. **Criar arquivo `.env.local`** na raiz do projeto:
   ```env
   RESEND_API_KEY=your_resend_api_key_here
   ```

2. **Configurar no Supabase** (para produção):
   ```bash
   supabase secrets set RESEND_API_KEY=your_resend_api_key_here
   ```

### 2. Verificar Domínio no Resend

Atualmente o email está configurado como `naoresponder@peliculasbr.com.br`. Você precisa:

1. Ir em [resend.com/domains](https://resend.com/domains)
2. Adicionar seu domínio `peliculasbr.com.br`
3. Configurar os registros DNS (SPF, DKIM)
4. Aguardar verificação

**Enquanto não verificar**: Os emails vão usar o domínio de teste do Resend e podem cair em spam.

### 3. Deploy da Edge Function (Recomendado)

```bash
# Fazer login
supabase login

# Linkar projeto
supabase link --project-ref seu-project-ref

# Deploy
supabase functions deploy send-email
```

### 4. Aplicar Migration do Banco

```bash
supabase db push
```

## 💡 Como Usar

### Exemplo 1: Enviar Email de Convite

```typescript
import { sendInviteEmailToUser } from './services/inviteService'

// Ao criar um convite
const result = await sendInviteEmailToUser(
  'usuario@example.com',
  'ABC12345', // código do convite
  'João Silva', // nome de quem está convidando
  'Películas Premium' // nome da organização
)

if (result.success) {
  console.log('Email enviado!')
} else {
  console.error('Erro:', result.error)
}
```

### Exemplo 2: Email de Boas-Vindas

```typescript
import { sendWelcomeEmail } from './services/emailHelper'

const result = await sendWelcomeEmail('usuario@example.com', {
  userName: 'Maria Santos',
  organizationName: 'Películas Premium'
})
```

### Exemplo 3: Email de Reset de Senha

```typescript
import { sendPasswordResetEmail } from './services/emailHelper'

const result = await sendPasswordResetEmail('usuario@example.com', {
  userName: 'João Silva',
  resetLink: 'https://peliculasbr.com.br/reset?token=xyz',
  expiresIn: '24 horas'
})
```

## 📊 Tipos de Email Disponíveis

1. **Boas-vindas** - Quando usuário se registra
2. **Convite** - Quando convida alguém para organização
3. **Reset de Senha** - Quando solicita nova senha
4. **Personalizado** - Para qualquer outro caso

## 🔍 Monitoramento

### Ver emails enviados

1. **Dashboard Resend**: [resend.com/logs](https://resend.com/logs)
2. **Banco de dados**:
   ```sql
   SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10;
   ```

## ⚠️ Importante

- ✅ **Nunca commite** o arquivo `.env.local` (já está no .gitignore)
- ✅ **Use Edge Function** em produção (mais seguro)
- ✅ **Verifique domínio** para evitar spam
- ✅ **Monitore limites** do Resend (100 emails/dia no plano gratuito)

## 📚 Documentação Completa

- Ver `docs/EMAIL_SERVICE.md` para exemplos detalhados
- Ver `docs/EMAIL_DEPLOY.md` para guia de deploy completo

## 🆘 Precisa de Ajuda?

Se tiver dúvidas sobre:
- Como configurar o domínio
- Como fazer o deploy
- Como integrar com outras partes do sistema

É só me chamar! 😊
