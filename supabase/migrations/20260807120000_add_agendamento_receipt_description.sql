-- Guarda a descrição confirmada no momento da emissão do recibo.
-- A coluna é opcional para manter os agendamentos antigos compatíveis.
ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS receipt_description text;

COMMENT ON COLUMN public.agendamentos.receipt_description IS
    'Snapshot do texto referente ao serviço confirmado ao emitir o recibo.';
