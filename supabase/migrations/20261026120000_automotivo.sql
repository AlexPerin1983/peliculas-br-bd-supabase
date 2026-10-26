-- Orçamento automotivo: chave para mostrar a aba e a tabela de preços por
-- película e categoria de carro. Fica na linha do dono, como a marca.
-- Os carros de cada orçamento vão no snapshot das opções (JSON), sem coluna nova.
ALTER TABLE public.user_info ADD COLUMN IF NOT EXISTS automotivo jsonb;
