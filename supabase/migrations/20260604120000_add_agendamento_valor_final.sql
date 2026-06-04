-- Valor final cobrado no atendimento, usado quando o agendamento NÃO tem
-- orçamento vinculado. Permite que serviços avulsos concluídos entrem no
-- resultado financeiro sem precisar gerar um orçamento/PDF.
ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS valor_final numeric;
