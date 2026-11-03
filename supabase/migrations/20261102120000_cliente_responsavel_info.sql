-- Cadastro do cliente: responsável, cargo e outras informações (Unidade,
-- Processo...) que aparecem no PDF do orçamento. Colunas novas e opcionais.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS responsavel text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS info_adicional text;
