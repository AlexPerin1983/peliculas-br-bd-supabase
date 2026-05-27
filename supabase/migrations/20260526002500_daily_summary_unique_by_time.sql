ALTER TABLE public.agenda_push_daily_summaries
    ADD COLUMN IF NOT EXISTS scheduled_time TIME NOT NULL DEFAULT '00:00';

UPDATE public.agenda_push_daily_summaries
   SET scheduled_time = date_trunc('minute', created_at AT TIME ZONE 'America/Sao_Paulo')::time
 WHERE scheduled_time = '00:00';

ALTER TABLE public.agenda_push_daily_summaries
    DROP CONSTRAINT IF EXISTS agenda_push_daily_summaries_subscription_id_summary_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_push_daily_summaries_unique_time
    ON public.agenda_push_daily_summaries(subscription_id, summary_date, scheduled_time);
