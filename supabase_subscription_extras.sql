-- =====================================================
-- FUNÇÕES ADICIONAIS PARA SISTEMA DE ASSINATURAS
-- Execute após o script principal supabase_subscription.sql
-- =====================================================

-- =====================================================
-- FUNÇÃO: Incrementar uso mensal
-- =====================================================
CREATE OR REPLACE FUNCTION increment_subscription_usage(
    p_organization_id UUID,
    p_field TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Verificar se precisa resetar o contador (novo mês)
    UPDATE subscriptions
    SET 
        usage_current_month = CASE 
            WHEN usage_reset_at <= now() 
            THEN '{"pdfs_generated": 0, "agendamentos_created": 0}'::jsonb
            ELSE usage_current_month
        END,
        usage_reset_at = CASE 
            WHEN usage_reset_at <= now() 
            THEN date_trunc('month', now()) + interval '1 month'
            ELSE usage_reset_at
        END
    WHERE organization_id = p_organization_id;
    
    -- Incrementar o campo específico
    UPDATE subscriptions
    SET usage_current_month = jsonb_set(
        usage_current_month,
        ARRAY[p_field],
        to_jsonb(COALESCE((usage_current_month->>p_field)::integer, 0) + 1)
    ),
    updated_at = now()
    WHERE organization_id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO: Verificar e expirar módulos
-- Rode periodicamente (cron ou manualmente)
-- =====================================================
CREATE OR REPLACE FUNCTION expire_modules()
RETURNS INTEGER AS $$
DECLARE
    v_expired_count INTEGER := 0;
BEGIN
    -- Marcar módulos expirados
    UPDATE module_activations
    SET 
        status = 'expired',
        updated_at = now()
    WHERE 
        status = 'active' 
        AND expires_at IS NOT NULL 
        AND expires_at < now();
    
    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    
    -- Remover módulos expirados do array de ativos
    UPDATE subscriptions s
    SET active_modules = (
        SELECT array_agg(m.module_id)
        FROM module_activations m
        WHERE m.subscription_id = s.id
          AND m.status = 'active'
          AND (m.expires_at IS NULL OR m.expires_at > now())
    ),
    updated_at = now()
    WHERE EXISTS (
        SELECT 1 FROM module_activations ma
        WHERE ma.subscription_id = s.id
          AND ma.status = 'expired'
          AND ma.updated_at > now() - interval '1 minute'
    );
    
    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEW: Resumo de assinaturas (para dashboard admin)
-- =====================================================
CREATE OR REPLACE VIEW subscription_summary AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    p.email as owner_email,
    s.id as subscription_id,
    s.limits,
    s.active_modules,
    s.usage_current_month,
    array_length(s.active_modules, 1) as active_modules_count,
    (
        SELECT SUM(ma.payment_amount)
        FROM module_activations ma
        WHERE ma.subscription_id = s.id
          AND ma.status = 'active'
    ) as monthly_revenue,
    s.created_at as subscription_created_at
FROM organizations o
JOIN profiles p ON p.id = o.owner_id
LEFT JOIN subscriptions s ON s.organization_id = o.id
ORDER BY s.created_at DESC;

-- =====================================================
-- VIEW: Módulos ativos com detalhes
-- =====================================================
CREATE OR REPLACE VIEW active_modules_detail AS
SELECT 
    o.name as organization_name,
    p.email as owner_email,
    sm.name as module_name,
    ma.status,
    ma.activated_at,
    ma.expires_at,
    ma.payment_amount,
    ma.payment_reference,
    EXTRACT(DAY FROM ma.expires_at - now()) as days_remaining
FROM module_activations ma
JOIN subscriptions s ON s.id = ma.subscription_id
JOIN organizations o ON o.id = s.organization_id
JOIN profiles p ON p.id = o.owner_id
JOIN subscription_modules sm ON sm.id = ma.module_id
WHERE ma.status = 'active'
ORDER BY ma.expires_at ASC;

-- =====================================================
-- POLÍTICAS ADICIONAIS PARA ADMIN
-- =====================================================

-- Super admin pode ver todas as subscriptions
CREATE POLICY "Super admin can view all subscriptions" ON subscriptions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'admin'
        )
    );

-- Super admin pode modificar subscriptions
CREATE POLICY "Super admin can modify subscriptions" ON subscriptions
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'admin'
        )
    );

-- Super admin pode gerenciar ativações
CREATE POLICY "Super admin can manage activations" ON module_activations
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'admin'
        )
    );

-- Usuários podem inserir ativações pendentes (solicitar módulos)
CREATE POLICY "Users can request module activation" ON module_activations
    FOR INSERT WITH CHECK (
        subscription_id IN (
            SELECT s.id FROM subscriptions s
            JOIN organizations o ON o.id = s.organization_id
            WHERE o.owner_id = auth.uid()
        )
    );

-- =====================================================
-- GRANT para views
-- =====================================================
-- Note: Views precisam de permissões apropriadas
-- Execute como superuser se necessário

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
-- SELECT * FROM subscription_summary;
-- SELECT * FROM active_modules_detail;
-- SELECT expire_modules();
