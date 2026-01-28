-- =====================================================
-- ATUALIZAÇÃO DE PREÇOS DOS MÓDULOS - PELÍCULAS BR
-- Todos os módulos: R$ 39,00 por 6 meses
-- Execute no Supabase SQL Editor
-- =====================================================

-- 1. Adicionar coluna de validade em meses (se não existir)
ALTER TABLE subscription_modules 
ADD COLUMN IF NOT EXISTS validity_months INTEGER DEFAULT 6;

-- 2. Atualizar todos os módulos para R$ 39,00 e 6 meses de validade
UPDATE subscription_modules
SET 
    price_monthly = 39.00,
    price_yearly = NULL, -- Não usamos mais anual
    validity_months = 6
WHERE id IN (
    'estoque', 
    'qr_servicos', 
    'colaboradores', 
    'ia_ocr', 
    'personalizacao', 
    'ilimitado', 
    'locais_global', 
    'corte_inteligente'
);

-- 3. Verificar a atualização
SELECT id, name, price_monthly, validity_months, description 
FROM subscription_modules 
ORDER BY sort_order;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- | id               | name                | price_monthly | validity_months |
-- |------------------|---------------------|---------------|-----------------|
-- | estoque          | Controle de Estoque | 39.00         | 6               |
-- | qr_servicos      | QR Code de Serviços | 39.00         | 6               |
-- | colaboradores    | Gestão de Equipe    | 39.00         | 6               |
-- | ia_ocr           | Extração com IA     | 39.00         | 6               |
-- | personalizacao   | Marca Própria       | 39.00         | 6               |
-- | ilimitado        | Sem Limites         | 39.00         | 6               |
-- | locais_global    | Locais Globais PRO  | 39.00         | 6               |
-- | corte_inteligente| Corte Inteligente   | 39.00         | 6               |
-- =====================================================
