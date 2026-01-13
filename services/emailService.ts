/**
 * Serviço de envio de emails usando Resend
 * 
 * Este serviço gerencia o envio de emails transacionais através da API do Resend.
 * Suporta diferentes tipos de emails: boas-vindas, redefinição de senha, convites, etc.
 */

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface WelcomeEmailData {
  userName: string;
  organizationName: string;
}

interface PasswordResetEmailData {
  userName: string;
  resetLink: string;
  expiresIn?: string;
}

interface InviteEmailData {
  inviterName: string;
  organizationName: string;
  inviteLink: string;
}

class EmailService {
  private apiKey: string;
  private defaultFrom: string = 'naoresponder@filmstec.shop';
  private baseUrl: string = 'https://api.resend.com/emails';

  constructor() {
    // Em produção, a API key virá das variáveis de ambiente
    this.apiKey = import.meta.env.RESEND_API_KEY || '';

    if (!this.apiKey) {
      console.warn('⚠️ RESEND_API_KEY não configurada. Emails não serão enviados.');
    }
  }

  /**
   * Envia um email genérico
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.apiKey) {
      console.error('❌ Não é possível enviar email: API key não configurada');
      return { success: false, error: 'API key não configurada' };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from || this.defaultFrom,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          reply_to: options.replyTo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro ao enviar email:', errorData);
        return { success: false, error: errorData.message || 'Erro desconhecido' };
      }

      const data = await response.json();
      console.log('✅ Email enviado com sucesso:', data.id);
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  /**
   * Envia email de boas-vindas para novos usuários
   */
  async sendWelcomeEmail(to: string, data: WelcomeEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
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
    `;

    return this.sendEmail({
      to,
      subject: `Bem-vindo ao Películas BR BD, ${data.userName}!`,
      html,
    });
  }

  /**
   * Envia email de redefinição de senha
   */
  async sendPasswordResetEmail(to: string, data: PasswordResetEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
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
    `;

    return this.sendEmail({
      to,
      subject: 'Redefinição de Senha - Películas BR BD',
      html,
    });
  }

  /**
   * Envia email de convite para organização
   */
  async sendInviteEmail(to: string, data: InviteEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
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
    `;

    return this.sendEmail({
      to,
      subject: `${data.inviterName} convidou você para ${data.organizationName}`,
      html,
    });
  }
}

// Exporta uma instância única do serviço
export const emailService = new EmailService();
export default emailService;
