-- =====================================================
-- Ocultar medidas no PDF (anti-cópia) — padrão global por empresa
-- =====================================================
-- Quando ligado, os PDFs de orçamento saem sem as colunas Dimensões e M²
-- (continuam com Ambiente, Qtd e preços). Evita que o cliente leve as medidas
-- discriminadas e cote com concorrentes. Pode ser sobrescrito por orçamento
-- (esse override vai no JSON de general_discount, sem coluna nova).
-- NULL/false = comportamento atual (mostra tudo). Retrocompatível.
--
-- Aplique manualmente no SQL Editor do Supabase.

ALTER TABLE user_info
    ADD COLUMN IF NOT EXISTS hide_measurements_in_pdf BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';
