// Supabase Edge Function para envio de emails via Resend
// Deploy: supabase functions deploy send-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  type: 'welcome' | 'password-reset' | 'invite' | 'custom'
  to: string
  data: any
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Não autorizado')
    }

    // Criar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verificar usuário autenticado
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Usuário não autenticado')
    }

    // Parse do body
    const { type, to, data }: EmailRequest = await req.json()

    // Obter API Key do Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY não configurada')
    }

    // Preparar email baseado no tipo
    let emailData: any

    switch (type) {
      case 'welcome':
        emailData = {
          from: 'naoresponder@filmstec.shop',
          to: [to],
          subject: `Bem-vindo ao Películas BR BD, ${data.userName}!`,
          html: generateWelcomeEmail(data),
        }
        break

      case 'password-reset':
        emailData = {
          from: 'naoresponder@peliculasbr.com.br',
          to: [to],
          subject: 'Redefinição de Senha - Películas BR BD',
          html: generatePasswordResetEmail(data),
        }
        break

      case 'invite':
        emailData = {
          from: 'naoresponder@peliculasbr.com.br',
          to: [to],
          subject: `${data.inviterName} convidou você para ${data.organizationName}`,
          html: generateInviteEmail(data),
        }
        break

      case 'custom':
        emailData = {
          from: data.from || 'naoresponder@peliculasbr.com.br',
          to: [to],
          subject: data.subject,
          html: data.html,
        }
        break

      default:
        throw new Error('Tipo de email inválido')
    }

    // Enviar email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Erro ao enviar email: ${error.message}`)
    }

    const result = await response.json()

    // Log do envio (opcional)
    await supabaseClient.from('email_logs').insert({
      user_id: user.id,
      email_type: type,
      recipient: to,
      resend_id: result.id,
      status: 'sent',
    })

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

// Templates de Email

function generateWelcomeEmail(data: any): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bem-vindo ao Películas BR BD</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Bem-vindo ao Películas BR BD! 🎉</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Olá <strong>${data.userName}</strong>,</p>
        
        <p>É um prazer tê-lo(a) conosco! Você foi adicionado(a) à organização <strong>${data.organizationName}</strong>.</p>
        
        <p>Com o Películas BR BD, você pode:</p>
        <ul style="line-height: 2;">
          <li>✅ Gerenciar seu estoque de películas</li>
          <li>📊 Criar orçamentos profissionais</li>
          <li>📱 Acessar offline através do PWA</li>
          <li>🤖 Usar IA para otimização de cortes</li>
          <li>📈 Acompanhar suas vendas e clientes</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://peliculasbr.com.br" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block;
                    font-weight: bold;">
            Acessar Plataforma
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Se você tiver alguma dúvida, não hesite em entrar em contato conosco.
        </p>
        
        <p style="color: #666; font-size: 14px;">
          Atenciosamente,<br>
          <strong>Equipe Películas BR BD</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Películas BR BD. Todos os direitos reservados.</p>
      </div>
    </body>
    </html>
  `
}

function generatePasswordResetEmail(data: any): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redefinição de Senha</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Redefinição de Senha 🔐</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Olá <strong>${data.userName}</strong>,</p>
        
        <p>Recebemos uma solicitação para redefinir sua senha no Películas BR BD.</p>
        
        <p>Clique no botão abaixo para criar uma nova senha:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetLink}" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block;
                    font-weight: bold;">
            Redefinir Senha
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Este link expira em <strong>${data.expiresIn || '24 horas'}</strong>.
        </p>
        
        <p style="color: #666; font-size: 14px; background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 5px;">
          ⚠️ <strong>Importante:</strong> Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.
        </p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Atenciosamente,<br>
          <strong>Equipe Películas BR BD</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Películas BR BD. Todos os direitos reservados.</p>
      </div>
    </body>
    </html>
  `
}

function generateInviteEmail(data: any): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Convite para Organização</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Você foi convidado! 🎊</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Olá!</p>
        
        <p><strong>${data.inviterName}</strong> convidou você para participar da organização <strong>${data.organizationName}</strong> no Películas BR BD.</p>
        
        <p>O Películas BR BD é uma plataforma completa para gestão de películas automotivas, oferecendo:</p>
        <ul style="line-height: 2;">
          <li>📦 Controle de estoque</li>
          <li>💰 Geração de orçamentos</li>
          <li>📱 Acesso offline (PWA)</li>
          <li>🤖 Otimização inteligente de cortes</li>
          <li>📊 Relatórios e análises</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.inviteLink}" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block;
                    font-weight: bold;">
            Aceitar Convite
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Clique no botão acima para criar sua conta e começar a usar a plataforma.
        </p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Atenciosamente,<br>
          <strong>Equipe Películas BR BD</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Películas BR BD. Todos os direitos reservados.</p>
      </div>
    </body>
    </html>
  `
}
