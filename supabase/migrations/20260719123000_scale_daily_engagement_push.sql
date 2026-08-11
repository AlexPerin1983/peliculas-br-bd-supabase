ALTER TABLE public.agenda_push_daily_engagement
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_daily_engagement_retry
    ON public.agenda_push_daily_engagement(engagement_date, status, next_attempt_at)
    WHERE status = 'failed';

CREATE OR REPLACE FUNCTION public.claim_daily_engagement_batch(
    p_engagement_date DATE,
    p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE (
    delivery_id UUID,
    subscription_id UUID,
    user_id UUID,
    endpoint TEXT,
    p256dh TEXT,
    auth TEXT,
    first_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    safe_batch_size INTEGER := LEAST(GREATEST(COALESCE(p_batch_size, 100), 1), 200);
BEGIN
    -- Mantem apenas 90 dias de historico para a tabela nao crescer indefinidamente.
    DELETE FROM public.agenda_push_daily_engagement
     WHERE engagement_date < (p_engagement_date - 90);

    -- Uma execucao interrompida libera o lote para uma nova tentativa.
    UPDATE public.agenda_push_daily_engagement
       SET status = 'failed',
           failed_at = NOW(),
           next_attempt_at = CASE WHEN attempt_count < 3 THEN NOW() ELSE NULL END,
           error_message = COALESCE(error_message, 'Processamento interrompido antes da confirmacao')
     WHERE engagement_date = p_engagement_date
       AND status = 'pending'
       AND processing_started_at < NOW() - INTERVAL '10 minutes';

    RETURN QUERY
    WITH retry_candidates AS (
        SELECT d.id
          FROM public.agenda_push_daily_engagement d
          JOIN public.agenda_push_subscriptions s ON s.id = d.subscription_id
         WHERE d.engagement_date = p_engagement_date
           AND d.status = 'failed'
           AND d.attempt_count < 3
           AND COALESCE(d.next_attempt_at, NOW()) <= NOW()
           AND s.enabled = TRUE
         ORDER BY d.next_attempt_at NULLS FIRST, d.id
         LIMIT safe_batch_size
         FOR UPDATE OF d SKIP LOCKED
    ),
    claimed_retries AS (
        UPDATE public.agenda_push_daily_engagement d
           SET status = 'pending',
               attempt_count = d.attempt_count + 1,
               processing_started_at = NOW(),
               next_attempt_at = NULL
          FROM retry_candidates r
         WHERE d.id = r.id
        RETURNING d.id, d.subscription_id
    ),
    remaining_capacity AS (
        SELECT GREATEST(safe_batch_size - COUNT(*)::INTEGER, 0) AS available
          FROM claimed_retries
    ),
    new_candidates AS (
        SELECT s.id
          FROM public.agenda_push_subscriptions s
         WHERE s.enabled = TRUE
           AND NOT EXISTS (
               SELECT 1
                 FROM public.agenda_push_daily_engagement d
                WHERE d.subscription_id = s.id
                  AND d.engagement_date = p_engagement_date
           )
         ORDER BY s.id
         LIMIT (SELECT available FROM remaining_capacity)
    ),
    inserted AS (
        INSERT INTO public.agenda_push_daily_engagement (
            subscription_id,
            engagement_date,
            status,
            attempt_count,
            processing_started_at
        )
        SELECT c.id, p_engagement_date, 'pending', 1, NOW()
          FROM new_candidates c
        ON CONFLICT (subscription_id, engagement_date) DO NOTHING
        RETURNING id, subscription_id
    ),
    claimed AS (
        SELECT id, subscription_id FROM claimed_retries
        UNION ALL
        SELECT id, subscription_id FROM inserted
    )
    SELECT
        c.id AS delivery_id,
        s.id AS subscription_id,
        s.user_id,
        s.endpoint,
        s.p256dh,
        s.auth,
        LEFT(COALESCE(
            NULLIF(SPLIT_PART(BTRIM(ui.nome), ' ', 1), ''),
            NULLIF(SPLIT_PART(p.email, '@', 1), '')
        ), 40) AS first_name
      FROM claimed c
      JOIN public.agenda_push_subscriptions s ON s.id = c.subscription_id
      LEFT JOIN public.user_info ui ON ui.user_id = s.user_id
      LEFT JOIN public.profiles p ON p.id = s.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_engagement_batch(DATE, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_engagement_batch(DATE, INTEGER) TO service_role;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-engagement-push-every-5-minutes') THEN
        PERFORM cron.unschedule('daily-engagement-push-every-5-minutes');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-engagement-batch-every-minute') THEN
        PERFORM cron.unschedule('daily-engagement-batch-every-minute');
    END IF;
END $$;

SELECT cron.schedule(
    'daily-engagement-batch-every-minute',
    '* * * * *',
    $$
    WITH secrets AS (
        SELECT
            MAX(decrypted_secret) FILTER (WHERE name = 'agenda_push_anon_key') AS anon_key,
            MAX(decrypted_secret) FILTER (WHERE name = 'agenda_push_cron_secret') AS cron_secret
          FROM vault.decrypted_secrets
         WHERE name IN ('agenda_push_anon_key', 'agenda_push_cron_secret')
    )
    SELECT net.http_post(
        url := 'https://avlefzsipbqvollukgyt.supabase.co/functions/v1/daily-engagement-batch',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE((SELECT anon_key FROM secrets), ''),
            'apikey', COALESCE((SELECT anon_key FROM secrets), ''),
            'x-cron-secret', COALESCE((SELECT cron_secret FROM secrets), '')
        ),
        body := jsonb_build_object('source', 'pg_cron', 'triggeredAt', NOW()),
        timeout_milliseconds := 15000
    );
    $$
);
