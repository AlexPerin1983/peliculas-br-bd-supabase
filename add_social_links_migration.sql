-- Migração: Adicionar coluna social_links na tabela user_info
-- Execute este SQL no console do Supabase

ALTER TABLE user_info ADD COLUMN IF NOT EXISTS social_links jsonb;

-- A estrutura esperada do campo social_links é:
-- {
--   "facebook": "https://facebook.com/sua-pagina",
--   "instagram": "https://instagram.com/seu-perfil",
--   "tiktok": "https://tiktok.com/@seu-usuario",
--   "youtube": "https://youtube.com/@seu-canal",
--   "googleReviews": "https://link-google-reviews"
-- }
