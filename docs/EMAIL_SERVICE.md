# Serviço de Email - Resend

## Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com sua API Key do Resend:

```env
RESEND_API_KEY=re_YzPRcM95_1QmrU1MQryq6_jaoZQEhT
```

⚠️ **Importante**: Nunca commite o arquivo `.env.local` no Git. Ele já está no `.gitignore`.

### 2. Domínio de Email

Atualmente, o serviço está configurado para usar:
- **From**: `naoresponder@peliculasbr.com.br`

Para usar em produção, você precisa:
1. Adicionar e verificar seu domínio no Resend
2. Atualizar o `defaultFrom` no arquivo `emailService.ts`

## Como Usar

### Importar o Serviço

```typescript
import { emailService } from './services/emailService';
```

### 1. Email de Boas-Vindas

Envie quando um novo usuário se registrar:

```typescript
const result = await emailService.sendWelcomeEmail(
  'usuario@example.com',
  {
    userName: 'João Silva',
    organizationName: 'Películas Premium'
  }
);

if (result.success) {
  console.log('Email enviado!', result.messageId);
} else {
  console.error('Erro:', result.error);
}
```

### 2. Email de Redefinição de Senha

Envie quando o usuário solicitar reset de senha:

```typescript
const result = await emailService.sendPasswordResetEmail(
  'usuario@example.com',
  {
    userName: 'João Silva',
    resetLink: 'https://peliculasbr.com.br/reset-password?token=abc123',
    expiresIn: '24 horas' // opcional
  }
);
```

### 3. Email de Convite

Envie quando convidar alguém para a organização:

```typescript
const result = await emailService.sendInviteEmail(
  'novousuario@example.com',
  {
    inviterName: 'Maria Santos',
    organizationName: 'Películas Premium',
    inviteLink: 'https://peliculasbr.com.br/invite?code=xyz789'
  }
);
```

### 4. Email Personalizado

Para enviar emails customizados:

```typescript
const result = await emailService.sendEmail({
  to: 'usuario@example.com',
  subject: 'Assunto do Email',
  html: '<h1>Conteúdo HTML</h1>',
  from: 'contato@peliculasbr.com.br', // opcional
  replyTo: 'suporte@peliculasbr.com.br' // opcional
});
```

## Integração com Supabase

### Opção 1: Usar Edge Functions (Recomendado)

Crie uma Edge Function no Supabase para enviar emails:

```typescript
// supabase/functions/send-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { type, to, data } = await req.json()
  
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  
  // Lógica de envio de email aqui
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### Opção 2: Usar Database Webhooks

Configure webhooks no Supabase para disparar emails automaticamente:

1. Vá em **Database** → **Webhooks**
2. Crie um webhook para a tabela desejada
3. Configure a URL da sua Edge Function

### Opção 3: Chamar do Frontend (Desenvolvimento)

Para testes, você pode chamar diretamente do frontend:

```typescript
// Após registro de usuário
const { data: user } = await supabase.auth.signUp({
  email: 'usuario@example.com',
  password: 'senha123'
})

if (user) {
  await emailService.sendWelcomeEmail(user.email, {
    userName: user.user_metadata.name,
    organizationName: 'Minha Organização'
  })
}
```

## Exemplos de Uso no Projeto

### 1. Ao Registrar Novo Usuário

```typescript
// src/components/Auth/Register.tsx
const handleRegister = async (email: string, password: string, name: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  })
  
  if (data.user) {
    // Enviar email de boas-vindas
    await emailService.sendWelcomeEmail(email, {
      userName: name,
      organizationName: 'Películas BR BD'
    })
  }
}
```

### 2. Ao Convidar Usuário

```typescript
// services/inviteService.ts
export const sendInvite = async (email: string, inviteCode: string) => {
  const currentUser = await getCurrentUser()
  const organization = await getOrganization()
  
  // Criar convite no banco
  const { data } = await supabase
    .from('invites')
    .insert({ email, code: inviteCode })
  
  // Enviar email
  await emailService.sendInviteEmail(email, {
    inviterName: currentUser.name,
    organizationName: organization.name,
    inviteLink: `https://peliculasbr.com.br/invite?code=${inviteCode}`
  })
}
```

### 3. Ao Solicitar Reset de Senha

```typescript
// src/components/Auth/ForgotPassword.tsx
const handleResetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://peliculasbr.com.br/reset-password'
  })
  
  // O Supabase já envia um email, mas você pode personalizar:
  // await emailService.sendPasswordResetEmail(email, {
  //   userName: 'Usuário',
  //   resetLink: 'link-gerado-pelo-supabase'
  // })
}
```

## Monitoramento

### Ver Logs no Resend

1. Acesse [resend.com/logs](https://resend.com/logs)
2. Veja todos os emails enviados, status de entrega, aberturas, etc.

### Tratamento de Erros

```typescript
const result = await emailService.sendWelcomeEmail(email, data)

if (!result.success) {
  // Log do erro
  console.error('Falha ao enviar email:', result.error)
  
  // Notificar usuário (opcional)
  toast.error('Não foi possível enviar o email de confirmação')
  
  // Tentar novamente depois (opcional)
  // await retryEmailSend(email, data)
}
```

## Próximos Passos

1. ✅ Configurar domínio no Resend
2. ✅ Adicionar API Key nas variáveis de ambiente
3. ⬜ Criar Edge Function no Supabase (recomendado para produção)
4. ⬜ Integrar com fluxos de autenticação
5. ⬜ Adicionar templates adicionais conforme necessário
6. ⬜ Configurar monitoramento e alertas

## Recursos Úteis

- [Documentação Resend](https://resend.com/docs)
- [Resend com Supabase](https://resend.com/docs/send-with-supabase-edge-functions)
- [Templates de Email](https://resend.com/docs/send-with-react)

## Custos

- **Plano Gratuito**: 100 emails/dia, 3.000 emails/mês
- **Plano Pro**: A partir de $20/mês para 50.000 emails/mês

Verifique os limites em [resend.com/pricing](https://resend.com/pricing)
