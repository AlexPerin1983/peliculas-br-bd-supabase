-- =====================================================
-- STRIPE BILLING PARA ASSINATURAS AUTOMATICAS
-- =====================================================

ALTER TABLE subscription_modules
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_monthly_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_yearly_id TEXT;

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE module_activations
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'manual'
    CHECK (payment_provider IN ('manual', 'stripe', 'abacatepay')),
ADD COLUMN IF NOT EXISTS external_checkout_session_id TEXT,
ADD COLUMN IF NOT EXISTS external_customer_id TEXT,
ADD COLUMN IF NOT EXISTS external_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS external_invoice_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
    ON subscriptions(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_module_activations_external_subscription
    ON module_activations(external_subscription_id)
    WHERE external_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_module_activations_external_checkout
    ON module_activations(external_checkout_session_id)
    WHERE external_checkout_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    error_message TEXT,
    payload JSONB,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(provider, event_id)
);

ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view billing webhook events" ON billing_webhook_events;
CREATE POLICY "Admins can view billing webhook events" ON billing_webhook_events
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'admin'
        )
    );

CREATE OR REPLACE FUNCTION refresh_subscription_active_modules(p_subscription_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE subscriptions
    SET active_modules = COALESCE(
        (
            SELECT array_agg(DISTINCT ma.module_id ORDER BY ma.module_id)
            FROM module_activations ma
            WHERE ma.subscription_id = p_subscription_id
              AND ma.status = 'active'
              AND (ma.expires_at IS NULL OR ma.expires_at > now())
        ),
        ARRAY[]::TEXT[]
    ),
    updated_at = now()
    WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
        'stripe_customer_id', s.stripe_customer_id,
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

    RETURN COALESCE(
        v_result,
        '{
            "limits": {
                "max_clients": 10,
                "max_films": 5,
                "max_pdfs_month": 10,
                "max_agendamentos_month": 5
            },
            "active_modules": [],
            "stripe_customer_id": null
        }'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO subscription_modules (
    id,
    name,
    description,
    price_monthly,
    price_yearly,
    validity_months,
    icon,
    features,
    is_active,
    sort_order
) VALUES (
    'pacote_completo',
    'Pacote Completo',
    'Libera todos os modulos premium em uma unica assinatura.',
    149.00,
    NULL,
    6,
    'Crown',
    '["estoque", "qr_servicos", "colaboradores", "ia_ocr", "personalizacao", "ilimitado", "locais_global", "corte_inteligente"]'::jsonb,
    true,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;
