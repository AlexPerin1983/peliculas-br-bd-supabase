-- =====================================================
-- ATUALIZAÇÃO DE PREÇOS - MODELO SEMESTRAL
-- Execute no Supabase SQL Editor
-- =====================================================

-- Atualizar preços dos módulos (R$ 29,00 por 6 meses)
UPDATE subscription_modules SET 
    price_monthly = 29.00,  -- Renomeando para "preço base" (mas é semestral)
    price_yearly = 29.00    -- Mesmo preço (não tem desconto anual individual)
WHERE id != 'ilimitado';

-- Módulo "ilimitado" vira "Pacote Completo" por R$ 99,00
UPDATE subscription_modules SET
    name = 'Pacote Completo',
    description = 'Libera TODOS os módulos com desconto especial',
    price_monthly = 99.00,
    price_yearly = 99.00,
    features = '["estoque", "qr_servicos", "colaboradores", "ia_ocr", "personalizacao", "locais_global", "corte_inteligente", "clientes_ilimitados", "filmes_ilimitados", "pdfs_ilimitados"]'
WHERE id = 'ilimitado';

-- Adicionar coluna para período de validade (em meses)
ALTER TABLE subscription_modules 
ADD COLUMN IF NOT EXISTS validity_months INTEGER DEFAULT 6;

-- Atualizar todos para 6 meses
UPDATE subscription_modules SET validity_months = 6;

-- Verificar resultado
SELECT id, name, price_monthly as preco, validity_months as meses, description 
FROM subscription_modules 
ORDER BY sort_order;
