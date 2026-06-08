-- ============================================================================
-- Limpeza automática de orçamentos vencidos
-- ============================================================================
-- Objetivo: manter o Storage enxuto removendo o ARQUIVO PDF de orçamentos
-- vencidos há mais de 30 dias, preservando a linha em saved_pdfs (histórico,
-- valores, medidas). O app regenera o PDF sob demanda a partir desses dados.
--
-- Aplicar manualmente no SQL Editor do dashboard (este projeto mantém o
-- histórico de migrations fora de sync; não rodar `db push` às cegas).
-- ============================================================================

-- 1) Marca quando o arquivo foi arquivado (removido do Storage). NULL = ativo.
ALTER TABLE saved_pdfs
    ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2) Extensões necessárias para agendar a chamada HTTP à Edge Function.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3) Agenda a execução diária (03:00 UTC) da função cleanup-expired-pdfs.
--    IMPORTANTE: substitua <CLEANUP_PDFS_CRON_SECRET> pelo MESMO valor
--    configurado como secret da função (deve bater com o header x-cron-secret).
--    A URL usa o ref deste projeto (avlefzsipbqvollukgyt).
SELECT cron.unschedule('cleanup-expired-pdfs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-pdfs');

SELECT cron.schedule(
    'cleanup-expired-pdfs',
    '0 3 * * *',
    $$
    SELECT net.http_post(
        url := 'https://avlefzsipbqvollukgyt.supabase.co/functions/v1/cleanup-expired-pdfs',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', '<CLEANUP_PDFS_CRON_SECRET>'
        ),
        body := '{}'::jsonb
    );
    $$
);

-- Para rodar manualmente uma vez (teste), execute o bloco net.http_post acima
-- diretamente no SQL Editor, ou chame a função via curl com o header x-cron-secret.
