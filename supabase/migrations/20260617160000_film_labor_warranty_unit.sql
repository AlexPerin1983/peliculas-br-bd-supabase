-- =====================================================
-- Garantia de mão de obra: unidade flexível (dias/meses/anos)
-- =====================================================
-- Antes a garantia de mão de obra era sempre em dias (número). Agora a empresa
-- pode escolher a unidade. Guardamos a unidade numa coluna nova; o valor numérico
-- continua em garantia_mao_de_obra. Linhas antigas ficam NULL → o app trata como
-- 'dias' (totalmente retrocompatível).
--
-- Aplique manualmente no SQL Editor do Supabase.

ALTER TABLE films
    ADD COLUMN IF NOT EXISTS garantia_mao_de_obra_unidade TEXT;

NOTIFY pgrst, 'reload schema';
