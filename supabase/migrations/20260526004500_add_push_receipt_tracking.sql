ALTER TABLE public.agenda_push_deliveries
    ADD COLUMN IF NOT EXISTS receipt_token UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS push_received_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notification_shown_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notification_clicked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS receipt_error_message TEXT;

ALTER TABLE public.agenda_push_daily_summaries
    ADD COLUMN IF NOT EXISTS receipt_token UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS push_received_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notification_shown_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notification_clicked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS receipt_error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_agenda_push_deliveries_receipt
    ON public.agenda_push_deliveries(id, receipt_token);

CREATE INDEX IF NOT EXISTS idx_agenda_push_daily_summaries_receipt
    ON public.agenda_push_daily_summaries(id, receipt_token);
