// Supabase Edge Function para envio de emails via Resend
// Deploy: supabase functions deploy send-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_FROM_EMAIL = 'naoresponder@filmstec.shop';

interface EmailRequest {
  type: 'welcome' | 'password-reset' | 'invite' | 'custom';
  to: string;
  data: any;
}

function createSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey =
    Deno.env.get('SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL ou SERVICE_ROLE_KEY nao configurada');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createSupabaseUserClient(authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY nao configurada');
  }

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getAuthenticatedUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;

  try {
    const userClient = createSupabaseUserClient(authHeader);
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (_error) {
    return null;
  }
}

async function resolveRecipientUserId(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  email: string
): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await adminClient
    .from('profiles')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error('Nao foi possivel validar o destinatario do email');
  }

  return data?.id ?? null;
}

interface RequesterProfile {
  id: string;
  email: string | null;
  role: string | null;
}

async function getRequesterProfile(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
): Promise<RequesterProfile | null> {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Nao foi possivel validar o usuario autenticado');
  }

  return data as RequesterProfile | null;
}

async function canManageOrganizationInvites(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  requesterUserId: string,
  organizationId: string
): Promise<boolean> {
  const { data: member, error: memberError } = await adminClient
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', requesterUserId)
    .maybeSingle();

  if (memberError) {
    throw new Error('Nao foi possivel validar permissao de convite');
  }

  if (member?.status === 'active' && (member.role === 'owner' || member.role === 'admin')) {
    return true;
  }

  const { data: organization, error: organizationError } = await adminClient
    .from('organizations')
    .select('owner_id')
    .eq('id', organizationId)
    .maybeSingle();

  if (organizationError) {
    throw new Error('Nao foi possivel validar organizacao do convite');
  }

  return organization?.owner_id === requesterUserId;
}

function isSafeSameOriginUrl(rawUrl: unknown, expectedOrigin: string | null, requiredPathFragment: string): boolean {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;

  try {
    const parsedUrl = new URL(rawUrl);

    if (expectedOrigin && parsedUrl.origin !== expectedOrigin) {
      return false;
    }

    return parsedUrl.pathname.includes(requiredPathFragment);
  } catch (_error) {
    return false;
  }
}

async function parseResendError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.message || body?.error || 'Erro desconhecido ao enviar email';
  } catch (_error) {
    return 'Erro desconhecido ao enviar email';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const { type, to, data }: EmailRequest = await req.json();
    const normalizedEmail = to.trim().toLowerCase();
    const adminClient = createSupabaseAdminClient();
    const requesterUserId = await getAuthenticatedUserId(req.headers.get('Authorization'));
    const requestOrigin = req.headers.get('origin');

    if (!requesterUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario nao autenticado' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const requesterProfile = await getRequesterProfile(adminClient, requesterUserId);
    if (!requesterProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario autenticado nao encontrado' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    let relatedUserId = requesterUserId;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY nao configurada');
    }

    let emailPayload: Record<string, unknown>;

    switch (type) {
      case 'welcome':
        if (!requesterProfile.email || requesterProfile.email.trim().toLowerCase() !== normalizedEmail) {
          return new Response(
            JSON.stringify({ success: false, error: 'Email de boas-vindas permitido apenas para o proprio usuario autenticado' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403,
            }
          );
        }

        emailPayload = {
          from: DEFAULT_FROM_EMAIL,
          to: [normalizedEmail],
          subject: `Bem-vindo ao Peliculas BR BD, ${data.userName}!`,
          html: generateWelcomeEmail(data),
        };
        break;

      case 'password-reset':
        return new Response(
          JSON.stringify({ success: false, error: 'Use o fluxo nativo do Supabase para redefinicao de senha' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );

      case 'invite':
        if (!data?.organizationId || typeof data.organizationId !== 'string') {
          return new Response(
            JSON.stringify({ success: false, error: 'organizationId obrigatorio para convites' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }

        if (!isSafeSameOriginUrl(data.inviteLink, requestOrigin, '/convite/')) {
          return new Response(
            JSON.stringify({ success: false, error: 'Link de convite invalido' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }

        if (!(await canManageOrganizationInvites(adminClient, requesterUserId, data.organizationId))) {
          return new Response(
            JSON.stringify({ success: false, error: 'Sem permissao para enviar convites desta organizacao' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403,
            }
          );
        }

        emailPayload = {
          from: DEFAULT_FROM_EMAIL,
          to: [normalizedEmail],
          subject: `${data.inviterName} convidou voce para ${data.organizationName}`,
          html: generateInviteEmail(data),
        };
        break;

      case 'custom':
        return new Response(
          JSON.stringify({ success: false, error: 'Emails personalizados foram desabilitados por seguranca' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );

      default:
        throw new Error('Tipo de email invalido');
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      const resendMessage = await parseResendError(resendResponse);
      throw new Error(`Erro ao enviar email: ${resendMessage}`);
    }

    const resendResult = await resendResponse.json();

    const { error: logError } = await adminClient.from('email_logs').insert({
      user_id: relatedUserId,
      email_type: type,
      recipient: normalizedEmail,
      resend_id: resendResult.id,
      status: 'sent',
      metadata: {
        public_request: false,
      },
    });

    if (logError) {
      console.error('[send-email] erro ao registrar log:', logError);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: resendResult.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[send-email] erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro inesperado',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function generateWelcomeEmail(data: any): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bem-vindo ao Peliculas BR BD</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Bem-vindo ao Peliculas BR BD! 🎉</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Ola <strong>${data.userName}</strong>,</p>
        
        <p>Eh um prazer te-lo(a) conosco! Voce foi adicionado(a) a organizacao <strong>${data.organizationName}</strong>.</p>
        
        <p>Com o Peliculas BR BD, voce pode:</p>
        <ul style="line-height: 2;">
          <li>✅ Gerenciar seu estoque de peliculas</li>
          <li>📊 Criar orcamentos profissionais</li>
          <li>📱 Acessar offline atraves do PWA</li>
          <li>🤖 Usar IA para otimizacao de cortes</li>
          <li>📈 Acompanhar suas vendas e clientes</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://www.filmstec.shop" 
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
          Se voce tiver alguma duvida, nao hesite em entrar em contato conosco.
        </p>
        
        <p style="color: #666; font-size: 14px;">
          Atenciosamente,<br>
          <strong>Equipe Peliculas BR BD</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Peliculas BR BD. Todos os direitos reservados.</p>
      </div>
    </body>
    </html>
  `;
}

function generatePasswordResetEmail(data: any): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redefinicao de Senha</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Redefinicao de Senha 🔐</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Ola <strong>${data.userName}</strong>,</p>
        
        <p>Recebemos uma solicitacao para redefinir sua senha no Peliculas BR BD.</p>
        
        <p>Clique no botao abaixo para criar uma nova senha:</p>
        
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
          ⚠️ <strong>Importante:</strong> Se voce nao solicitou esta redefinicao, ignore este email. Sua senha permanecera inalterada.
        </p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Atenciosamente,<br>
          <strong>Equipe Peliculas BR BD</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Peliculas BR BD. Todos os direitos reservados.</p>
      </div>
    </body>
    </html>
  `;
}

function generateInviteEmail(data: any): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Convite para Organizacao</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Voce foi convidado! 🎊</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Ola!</p>
        
        <p><strong>${data.inviterName}</strong> convidou voce para participar da organizacao <strong>${data.organizationName}</strong> no Peliculas BR BD.</p>
        
        <p>O Peliculas BR BD e uma plataforma completa para gestao de peliculas automotivas, oferecendo:</p>
        <ul style="line-height: 2;">
          <li>📦 Controle de estoque</li>
          <li>💰 Geracao de orcamentos</li>
          <li>📱 Acesso offline (PWA)</li>
          <li>🤖 Otimizacao inteligente de cortes</li>
          <li>📊 Relatorios e analises</li>
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
          Clique no botao acima para criar sua conta e comecar a usar a plataforma.
        </p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Atenciosamente,<br>
          <strong>Equipe Peliculas BR BD</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Peliculas BR BD. Todos os direitos reservados.</p>
      </div>
    </body>
    </html>
  `;
}
