-- =====================================================
-- FUNÇÃO SIMPLIFICADA PARA ATIVAR MÓDULOS MANUALMENTE
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- Função para ativar módulo pelo email do usuário
CREATE OR REPLACE FUNCTION activate_module_for_user(
    p_user_email TEXT,
    p_module_id TEXT,
    p_months INTEGER DEFAULT 1
)
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_sub_id UUID;
    v_module_price NUMERIC;
BEGIN
    -- Buscar usuário pelo email
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = p_user_email;
    
    IF v_user_id IS NULL THEN
        RETURN 'ERRO: Usuário não encontrado com email: ' || p_user_email;
    END IF;
    
    -- Buscar organização do usuário
    SELECT organization_id INTO v_org_id 
    FROM profiles 
    WHERE id = v_user_id;
    
    IF v_org_id IS NULL THEN
        -- Tentar via organizations.owner_id
        SELECT id INTO v_org_id 
        FROM organizations 
        WHERE owner_id = v_user_id LIMIT 1;
    END IF;
    
    IF v_org_id IS NULL THEN
        RETURN 'ERRO: Organização não encontrada para o usuário';
    END IF;
    
    -- Buscar subscription
    SELECT id INTO v_sub_id 
    FROM subscriptions 
    WHERE organization_id = v_org_id;
    
    IF v_sub_id IS NULL THEN
        -- Criar subscription se não existir
        INSERT INTO subscriptions (organization_id) 
        VALUES (v_org_id) 
        RETURNING id INTO v_sub_id;
    END IF;
    
    -- Buscar preço do módulo
    SELECT price_monthly INTO v_module_price 
    FROM subscription_modules 
    WHERE id = p_module_id;
    
    IF v_module_price IS NULL THEN
        RETURN 'ERRO: Módulo não encontrado: ' || p_module_id;
    END IF;
    
    -- Ativar módulo
    PERFORM activate_module(v_sub_id, p_module_id, p_months, v_module_price * p_months, 'MANUAL');
    
    RETURN 'SUCESSO! Módulo ' || p_module_id || ' ativado por ' || p_months || ' mês(es) para ' || p_user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMO USAR:
-- =====================================================
-- Exemplo: Ativar 'estoque' por 1 mês para um cliente
-- SELECT activate_module_for_user('email@docliente.com', 'estoque', 1);

-- Exemplo: Ativar 'estoque' por 12 meses (anual)
-- SELECT activate_module_for_user('email@docliente.com', 'estoque', 12);

-- MÓDULOS DISPONÍVEIS:
-- 'estoque'           - Controle de Estoque (R$ 29.90/mês)
-- 'qr_servicos'       - QR Code Serviços (R$ 19.90/mês)
-- 'colaboradores'     - Gestão de Equipe (R$ 39.90/mês)
-- 'ia_ocr'            - Extração com IA (R$ 24.90/mês)
-- 'personalizacao'    - Marca Própria (R$ 14.90/mês)
-- 'ilimitado'         - Sem Limites (R$ 49.90/mês)
-- 'locais_global'     - Locais PRO (R$ 9.90/mês)
-- 'corte_inteligente' - Corte Inteligente (R$ 34.90/mês)
