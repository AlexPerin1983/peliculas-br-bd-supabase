-- Tabela para registrar logs de emails enviados
-- Útil para monitoramento e debugging

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('welcome', 'password-reset', 'invite', 'custom')),
  recipient TEXT NOT NULL,
  resend_id TEXT, -- ID retornado pelo Resend
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  error_message TEXT,
  metadata JSONB, -- Dados adicionais sobre o email
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_logs_updated_at();

-- RLS (Row Level Security) Policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas seus próprios logs
CREATE POLICY "Users can view their own email logs"
  ON email_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Apenas o sistema pode inserir logs (através da Edge Function)
CREATE POLICY "System can insert email logs"
  ON email_logs
  FOR INSERT
  WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE email_logs IS 'Registra todos os emails enviados através do sistema';
COMMENT ON COLUMN email_logs.user_id IS 'Usuário que solicitou o envio do email';
COMMENT ON COLUMN email_logs.email_type IS 'Tipo de email: welcome, password-reset, invite, custom';
COMMENT ON COLUMN email_logs.recipient IS 'Endereço de email do destinatário';
COMMENT ON COLUMN email_logs.resend_id IS 'ID do email retornado pelo Resend API';
COMMENT ON COLUMN email_logs.status IS 'Status do email: sent, delivered, bounced, failed';
COMMENT ON COLUMN email_logs.error_message IS 'Mensagem de erro, se houver';
COMMENT ON COLUMN email_logs.metadata IS 'Dados adicionais sobre o email em formato JSON';

-- View para estatísticas de emails
CREATE OR REPLACE VIEW email_stats AS
SELECT
  email_type,
  status,
  COUNT(*) as count,
  DATE_TRUNC('day', created_at) as date
FROM email_logs
GROUP BY email_type, status, DATE_TRUNC('day', created_at)
ORDER BY date DESC, email_type, status;

COMMENT ON VIEW email_stats IS 'Estatísticas de emails enviados agrupados por tipo, status e data';
