-- Permite vincular mais de uma proposta ao mesmo compromisso sem quebrar o campo legado pdf_id.
ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS pdf_ids integer[] NOT NULL DEFAULT '{}'::integer[];

UPDATE public.agendamentos
SET pdf_ids = ARRAY[pdf_id]
WHERE pdf_id IS NOT NULL
  AND cardinality(pdf_ids) = 0;

CREATE INDEX IF NOT EXISTS idx_agendamentos_pdf_ids
    ON public.agendamentos USING gin (pdf_ids);

COMMENT ON COLUMN public.agendamentos.pdf_ids IS
    'Lista de propostas vinculadas ao compromisso; pdf_id permanece como proposta principal para compatibilidade.';
