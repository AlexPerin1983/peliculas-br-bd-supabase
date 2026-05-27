ALTER TABLE subscription_modules
ADD COLUMN IF NOT EXISTS abacate_subscription_product_id TEXT;

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS abacate_customer_id TEXT;

DO $$
DECLARE
    billing_cycle_constraint TEXT;
BEGIN
    SELECT conname
    INTO billing_cycle_constraint
    FROM pg_constraint
    WHERE conrelid = 'module_activations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%billing_cycle%';

    IF billing_cycle_constraint IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE module_activations DROP CONSTRAINT %I',
            billing_cycle_constraint
        );
    END IF;
END $$;

ALTER TABLE module_activations
ADD CONSTRAINT module_activations_billing_cycle_check
CHECK (billing_cycle IN ('monthly', 'semiannual', 'yearly'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_abacate_customer
    ON subscriptions(abacate_customer_id)
    WHERE abacate_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_modules_abacate_product
    ON subscription_modules(abacate_subscription_product_id)
    WHERE abacate_subscription_product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION refresh_subscription_active_modules(p_subscription_id UUID)
RETURNS VOID AS $$
DECLARE
    v_active_modules TEXT[];
BEGIN
    SELECT COALESCE(
        array_agg(ma_latest.module_id ORDER BY ma_latest.module_id),
        ARRAY[]::TEXT[]
    )
    INTO v_active_modules
    FROM (
        SELECT DISTINCT ON (ma.module_id)
            ma.module_id,
            ma.status,
            ma.expires_at
        FROM module_activations ma
        WHERE ma.subscription_id = p_subscription_id
        ORDER BY
            ma.module_id,
            COALESCE(ma.updated_at, ma.created_at, ma.activated_at, now()) DESC,
            COALESCE(ma.expires_at, now()) DESC
    ) ma_latest
    WHERE ma_latest.status = 'active'
      AND (ma_latest.expires_at IS NULL OR ma_latest.expires_at > now());

    UPDATE subscriptions
    SET active_modules = COALESCE(v_active_modules, ARRAY[]::TEXT[]),
        updated_at = now()
    WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_subscription_info(p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_subscription_id UUID;
    v_limits JSONB;
    v_usage JSONB;
    v_usage_resets_at TIMESTAMPTZ;
    v_trial_ends_at TIMESTAMPTZ;
    v_abacate_customer_id TEXT;
    v_active_modules TEXT[];
    v_modules_detail JSONB;
BEGIN
    SELECT
        s.id,
        s.limits,
        s.usage_current_month,
        s.usage_reset_at,
        s.trial_ends_at,
        s.abacate_customer_id
    INTO
        v_subscription_id,
        v_limits,
        v_usage,
        v_usage_resets_at,
        v_trial_ends_at,
        v_abacate_customer_id
    FROM subscriptions s
    WHERE s.organization_id = p_organization_id;

    IF v_subscription_id IS NULL THEN
        RETURN jsonb_build_object(
            'subscription_id', '',
            'limits', jsonb_build_object(
                'max_clients', 10,
                'max_films', 5,
                'max_pdfs_month', 10,
                'max_agendamentos_month', 5
            ),
            'active_modules', '[]'::jsonb,
            'usage', jsonb_build_object(
                'pdfs_generated', 0,
                'agendamentos_created', 0
            ),
            'usage_resets_at', now(),
            'trial_ends_at', null,
            'abacate_customer_id', null,
            'modules_detail', '[]'::jsonb
        );
    END IF;

    SELECT COALESCE(
        array_agg(ma_latest.module_id ORDER BY ma_latest.module_id),
        ARRAY[]::TEXT[]
    )
    INTO v_active_modules
    FROM (
        SELECT DISTINCT ON (ma.module_id)
            ma.module_id,
            ma.status,
            ma.expires_at
        FROM module_activations ma
        WHERE ma.subscription_id = v_subscription_id
        ORDER BY
            ma.module_id,
            COALESCE(ma.updated_at, ma.created_at, ma.activated_at, now()) DESC,
            COALESCE(ma.expires_at, now()) DESC
    ) ma_latest
    WHERE ma_latest.status = 'active'
      AND (ma_latest.expires_at IS NULL OR ma_latest.expires_at > now());

    UPDATE subscriptions
    SET active_modules = COALESCE(v_active_modules, ARRAY[]::TEXT[]),
        updated_at = now()
    WHERE id = v_subscription_id;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'module_id', ma_latest.module_id,
                'status',
                    CASE
                        WHEN ma_latest.status = 'active'
                             AND ma_latest.expires_at IS NOT NULL
                             AND ma_latest.expires_at <= now()
                        THEN 'expired'
                        ELSE ma_latest.status
                    END,
                'expires_at', ma_latest.expires_at,
                'days_remaining',
                    CASE
                        WHEN ma_latest.expires_at IS NULL THEN NULL
                        ELSE GREATEST(EXTRACT(DAY FROM ma_latest.expires_at - now()), 0)
                    END,
                'cancel_at_period_end', COALESCE(ma_latest.cancel_at_period_end, false),
                'payment_provider', ma_latest.payment_provider,
                'billing_cycle', ma_latest.billing_cycle,
                'is_recurring', COALESCE(ma_latest.is_recurring, false)
            )
            ORDER BY ma_latest.module_id
        ),
        '[]'::jsonb
    )
    INTO v_modules_detail
    FROM (
        SELECT DISTINCT ON (ma.module_id)
            ma.module_id,
            ma.status,
            ma.expires_at,
            ma.cancel_at_period_end,
            ma.payment_provider,
            ma.billing_cycle,
            ma.is_recurring
        FROM module_activations ma
        WHERE ma.subscription_id = v_subscription_id
        ORDER BY
            ma.module_id,
            COALESCE(ma.updated_at, ma.created_at, ma.activated_at, now()) DESC,
            COALESCE(ma.expires_at, now()) DESC
    ) ma_latest;

    RETURN jsonb_build_object(
        'subscription_id', v_subscription_id,
        'limits', v_limits,
        'active_modules', COALESCE(to_jsonb(v_active_modules), '[]'::jsonb),
        'usage', v_usage,
        'usage_resets_at', v_usage_resets_at,
        'trial_ends_at', v_trial_ends_at,
        'abacate_customer_id', v_abacate_customer_id,
        'modules_detail', v_modules_detail
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
