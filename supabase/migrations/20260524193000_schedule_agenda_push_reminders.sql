CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM cron.job
         WHERE jobname = 'agenda-push-reminders-every-5-minutes'
    ) THEN
        PERFORM cron.unschedule('agenda-push-reminders-every-5-minutes');
    END IF;
END $$;

SELECT cron.schedule(
    'agenda-push-reminders-every-5-minutes',
    '*/5 * * * *',
    $$
    WITH secrets AS (
        SELECT
            MAX(decrypted_secret) FILTER (WHERE name = 'agenda_push_anon_key') AS anon_key,
            MAX(decrypted_secret) FILTER (WHERE name = 'agenda_push_cron_secret') AS cron_secret
          FROM vault.decrypted_secrets
         WHERE name IN ('agenda_push_anon_key', 'agenda_push_cron_secret')
    )
    SELECT net.http_post(
        url := 'https://avlefzsipbqvollukgyt.supabase.co/functions/v1/agenda-push-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE((SELECT anon_key FROM secrets), ''),
            'apikey', COALESCE((SELECT anon_key FROM secrets), ''),
            'x-cron-secret', COALESCE((SELECT cron_secret FROM secrets), '')
        ),
        body := jsonb_build_object(
            'source', 'pg_cron',
            'triggeredAt', NOW()
        ),
        timeout_milliseconds := 15000
    );
    $$
);
