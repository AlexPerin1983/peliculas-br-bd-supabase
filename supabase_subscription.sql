-- =====================================================
-- SISTEMA DE ASSINATURAS E MÓDULOS - PELÍCULAS BR
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TABELA DE MÓDULOS DISPONÍVEIS
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_modules (
    id TEXT PRIMARY KEY, -- 'estoque', 'qr_servicos', etc.
    name TEXT NOT NULL,
    description TEXT,
    price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_yearly NUMERIC(10,2), -- Com desconto anual
    validity_months INTEGER DEFAULT 6, -- Período de validade padrão: 6 meses
    icon TEXT, -- Nome do ícone Lucide
    features JSONB, -- Lista de features incluídas
    is_active BOOLEAN DEFAULT true, -- Se o módulo está disponível para compra
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir módulos padrão (Todos R$ 39,00 por 6 meses)
INSERT INTO subscription_modules (id, name, description, price_monthly, price_yearly, validity_months, icon, features, sort_order) VALUES
('estoque', 'Controle de Estoque', 'Gerencie bobinas, retalhos e consumo de películas', 39.00, NULL, 6, 'Package', '["bobinas", "retalhos", "consumos", "qr_estoque"]', 1),
('qr_servicos', 'QR Code de Serviços', 'Gere QR Codes para serviços prestados aos clientes', 39.00, NULL, 6, 'QrCode', '["servicos_prestados", "pagina_publica"]', 2),
('colaboradores', 'Gestão de Equipe', 'Adicione colaboradores e gerencie permissões', 39.00, NULL, 6, 'Users', '["convites", "membros_ilimitados", "permissoes"]', 3),
('ia_ocr', 'Extração com IA', 'Use IA para extrair dados de imagens automaticamente', 39.00, NULL, 6, 'Brain', '["ocr_gemini", "ocr_openai", "ocr_local"]', 4),
('personalizacao', 'Marca Própria', 'Personalize cores, logo e aparência das propostas', 39.00, NULL, 6, 'Palette', '["cores_custom", "logo_custom", "assinatura"]', 5),
('ilimitado', 'Sem Limites', 'Remove todos os limites de clientes, películas e propostas', 39.00, NULL, 6, 'Infinity', '["clientes_ilimitados", "filmes_ilimitados", "pdfs_ilimitados"]', 6),
('locais_global', 'Locais Globais PRO', 'Adicione e edite medidas em locais compartilhados', 39.00, NULL, 6, 'MapPin', '["adicionar_locais", "editar_medidas"]', 7),
('corte_inteligente', 'Corte Inteligente', 'Otimize o corte das bobinas para reduzir desperdício e maximizar aproveitamento', 39.00, NULL, 6, 'Scissors', '["otimizacao_corte", "sugestao_retalhos", "calculo_desperdicio", "plano_corte_visual"]', 8)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    validity_months = EXCLUDED.validity_months,
    icon = EXCLUDED.icon,
    features = EXCLUDED.features,
    sort_order = EXCLUDED.sort_order;

-- =====================================================
-- 2. TABELA DE ASSINATURAS (por organização)
-- =====================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    
    -- Limites do plano gratuito (podem ser ajustados)
    limits JSONB DEFAULT '{
        "max_clients": 10,
        "max_films": 5,
        "max_pdfs_month": 10,
        "max_agendamentos_month": 5
    }',
    
    -- Módulos ativos (array de IDs)
    active_modules TEXT[] DEFAULT '{}',
    
    -- Contadores de uso (resetam mensalmente)
    usage_current_month JSONB DEFAULT '{
        "pdfs_generated": 0,
        "agendamentos_created": 0
    }',
    usage_reset_at TIMESTAMPTZ DEFAULT date_trunc('month', now()) + interval '1 month',
    
    -- Trial
    trial_ends_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);

-- =====================================================
-- 3. TABELA DE ATIVAÇÕES DE MÓDULOS
-- =====================================================
CREATE TABLE IF NOT EXISTS module_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    module_id TEXT REFERENCES subscription_modules(id),
    
    -- Status da ativação
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
    
    -- Período de ativação
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Informações do pagamento
    payment_method TEXT DEFAULT 'pix',
    payment_amount NUMERIC(10,2),
    payment_reference TEXT, -- Código do PIX ou referência
    payment_confirmed_at TIMESTAMPTZ,
    payment_confirmed_by UUID REFERENCES auth.users(id),
    
    -- Recorrência
    is_recurring BOOLEAN DEFAULT false,
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
    
    -- Observações
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(subscription_id, module_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_module_activations_sub ON module_activations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_module_activations_status ON module_activations(status);

-- =====================================================
-- 4. TABELA DE HISTÓRICO DE PAGAMENTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    module_id TEXT REFERENCES subscription_modules(id),
    activation_id UUID REFERENCES module_activations(id),
    
    -- Detalhes do pagamento
    amount NUMERIC(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'pix',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
    
    -- PIX específico
    pix_code TEXT, -- Código copia e cola
    pix_qr_image TEXT, -- Base64 do QR Code
    pix_expiration TIMESTAMPTZ,
    
    -- Confirmação
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES auth.users(id),
    confirmation_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 5. HABILITAR RLS
-- =====================================================
ALTER TABLE subscription_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. POLÍTICAS RLS
-- =====================================================

-- Módulos são públicos para leitura (todos podem ver os preços)
CREATE POLICY "Anyone can view modules" ON subscription_modules
    FOR SELECT USING (true);

-- Apenas super admin pode modificar módulos
CREATE POLICY "Only super admin can modify modules" ON subscription_modules
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

-- Subscriptions - usuários veem sua própria organização
CREATE POLICY "Users can view their subscription" ON subscriptions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Owners podem atualizar (para solicitar módulos)
CREATE POLICY "Owners can request modules" ON subscriptions
    FOR UPDATE USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- Ativações - usuários veem suas ativações
CREATE POLICY "Users can view their activations" ON module_activations
    FOR SELECT USING (
        subscription_id IN (
            SELECT s.id FROM subscriptions s
            JOIN profiles p ON p.organization_id = s.organization_id
            WHERE p.id = auth.uid()
        )
    );

-- Histórico de pagamentos
CREATE POLICY "Users can view their payments" ON payment_history
    FOR SELECT USING (
        subscription_id IN (
            SELECT s.id FROM subscriptions s
            JOIN profiles p ON p.organization_id = s.organization_id
            WHERE p.id = auth.uid()
        )
    );

-- =====================================================
-- 7. FUNÇÃO PARA CRIAR SUBSCRIPTION AUTOMATICAMENTE
-- =====================================================
CREATE OR REPLACE FUNCTION create_subscription_for_organization()
RETURNS TRIGGER AS $$
BEGIN
    -- Cria subscription quando uma organização é criada
    INSERT INTO subscriptions (organization_id)
    VALUES (NEW.id)
    ON CONFLICT (organization_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_organization_created_subscription ON organizations;
CREATE TRIGGER on_organization_created_subscription
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION create_subscription_for_organization();

-- =====================================================
-- 8. FUNÇÃO PARA ATIVAR MÓDULO (chamada pelo admin)
-- =====================================================
CREATE OR REPLACE FUNCTION activate_module(
    p_subscription_id UUID,
    p_module_id TEXT,
    p_months INTEGER DEFAULT 1,
    p_payment_amount NUMERIC DEFAULT NULL,
    p_payment_reference TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_activation_id UUID;
    v_module_price NUMERIC;
BEGIN
    -- Buscar preço do módulo se não informado
    IF p_payment_amount IS NULL THEN
        SELECT price_monthly * p_months INTO v_module_price
        FROM subscription_modules WHERE id = p_module_id;
    ELSE
        v_module_price := p_payment_amount;
    END IF;
    
    -- Inserir ou atualizar ativação
    INSERT INTO module_activations (
        subscription_id,
        module_id,
        status,
        activated_at,
        expires_at,
        payment_method,
        payment_amount,
        payment_reference,
        payment_confirmed_at,
        payment_confirmed_by,
        billing_cycle
    ) VALUES (
        p_subscription_id,
        p_module_id,
        'active',
        now(),
        now() + (p_months || ' months')::interval,
        'pix',
        v_module_price,
        p_payment_reference,
        now(),
        auth.uid(),
        CASE WHEN p_months >= 12 THEN 'yearly' ELSE 'monthly' END
    )
    ON CONFLICT (subscription_id, module_id) DO UPDATE SET
        status = 'active',
        activated_at = now(),
        expires_at = now() + (p_months || ' months')::interval,
        payment_amount = v_module_price,
        payment_reference = p_payment_reference,
        payment_confirmed_at = now(),
        payment_confirmed_by = auth.uid(),
        updated_at = now()
    RETURNING id INTO v_activation_id;
    
    -- Atualizar array de módulos ativos na subscription
    UPDATE subscriptions
    SET active_modules = array_append(
        array_remove(active_modules, p_module_id), -- Remove se existir
        p_module_id -- Adiciona
    ),
    updated_at = now()
    WHERE id = p_subscription_id;
    
    -- Registrar no histórico
    INSERT INTO payment_history (
        subscription_id,
        module_id,
        activation_id,
        amount,
        payment_method,
        status,
        confirmed_at,
        confirmed_by
    ) VALUES (
        p_subscription_id,
        p_module_id,
        v_activation_id,
        v_module_price,
        'pix',
        'confirmed',
        now(),
        auth.uid()
    );
    
    RETURN v_activation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. FUNÇÃO PARA VERIFICAR SE MÓDULO ESTÁ ATIVO
-- =====================================================
CREATE OR REPLACE FUNCTION check_module_active(
    p_organization_id UUID,
    p_module_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_active BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM subscriptions s
        JOIN module_activations ma ON ma.subscription_id = s.id
        WHERE s.organization_id = p_organization_id
          AND ma.module_id = p_module_id
          AND ma.status = 'active'
          AND (ma.expires_at IS NULL OR ma.expires_at > now())
    ) INTO v_is_active;
    
    RETURN COALESCE(v_is_active, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. FUNÇÃO PARA OBTER LIMITES E MÓDULOS
-- =====================================================
CREATE OR REPLACE FUNCTION get_subscription_info(p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'subscription_id', s.id,
        'limits', s.limits,
        'active_modules', s.active_modules,
        'usage', s.usage_current_month,
        'usage_resets_at', s.usage_reset_at,
        'trial_ends_at', s.trial_ends_at,
        'modules_detail', (
            SELECT jsonb_agg(jsonb_build_object(
                'module_id', ma.module_id,
                'status', ma.status,
                'expires_at', ma.expires_at,
                'days_remaining', EXTRACT(DAY FROM ma.expires_at - now())
            ))
            FROM module_activations ma
            WHERE ma.subscription_id = s.id AND ma.status = 'active'
        )
    ) INTO v_result
    FROM subscriptions s
    WHERE s.organization_id = p_organization_id;
    
    RETURN COALESCE(v_result, '{"limits": {"max_clients": 10, "max_films": 5, "max_pdfs_month": 10}, "active_modules": []}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. CRIAR SUBSCRIPTIONS PARA ORGANIZAÇÕES EXISTENTES
-- =====================================================
INSERT INTO subscriptions (organization_id)
SELECT id FROM organizations
WHERE id NOT IN (SELECT organization_id FROM subscriptions WHERE organization_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Após rodar este script, verifique:
-- SELECT * FROM subscription_modules;
-- SELECT * FROM subscriptions;
