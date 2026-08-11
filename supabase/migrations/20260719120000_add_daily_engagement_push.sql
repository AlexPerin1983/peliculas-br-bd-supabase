-- Lembrete diario de engajamento para dispositivos que ja autorizaram push.
-- O horario e definido pela Edge Function (19:00 em America/Sao_Paulo).
CREATE TABLE IF NOT EXISTS public.agenda_push_daily_engagement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.agenda_push_subscriptions(id) ON DELETE CASCADE,
    engagement_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    receipt_token UUID NOT NULL DEFAULT gen_random_uuid(),
    push_received_at TIMESTAMPTZ,
    notification_shown_at TIMESTAMPTZ,
    notification_clicked_at TIMESTAMPTZ,
    receipt_error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, engagement_date)
);

CREATE INDEX IF NOT EXISTS idx_agenda_push_daily_engagement_receipt
    ON public.agenda_push_daily_engagement(id, receipt_token);

CREATE INDEX IF NOT EXISTS idx_agenda_push_daily_engagement_date
    ON public.agenda_push_daily_engagement(engagement_date);

ALTER TABLE public.agenda_push_daily_engagement ENABLE ROW LEVEL SECURITY;

-- Nao ha politica para clientes: somente as Edge Functions, usando service role,
-- podem ler ou alterar os registros de entrega.
