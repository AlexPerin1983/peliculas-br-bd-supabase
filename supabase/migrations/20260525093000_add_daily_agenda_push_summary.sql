ALTER TABLE public.agenda_push_subscriptions
    ADD COLUMN IF NOT EXISTS daily_summary_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS daily_summary_time TIME NOT NULL DEFAULT '18:00';

CREATE INDEX IF NOT EXISTS idx_agenda_push_subscriptions_daily_summary
    ON public.agenda_push_subscriptions(daily_summary_enabled, daily_summary_time)
    WHERE enabled = TRUE AND daily_summary_enabled = TRUE;

CREATE TABLE IF NOT EXISTS public.agenda_push_daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.agenda_push_subscriptions(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    appointment_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subscription_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_agenda_push_daily_summaries_subscription
    ON public.agenda_push_daily_summaries(subscription_id);

ALTER TABLE public.agenda_push_daily_summaries ENABLE ROW LEVEL SECURITY;
