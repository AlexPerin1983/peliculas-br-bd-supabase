-- Status operacional do agendamento (separado do status comercial do orçamento).
-- Valores: 'scheduled' (Agendado), 'completed' (Concluído), 'cancelled' (Cancelado), 'no_show' (Não compareceu).
ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS service_status text NOT NULL DEFAULT 'scheduled';

UPDATE public.agendamentos
   SET service_status = 'scheduled'
 WHERE service_status IS NULL;
