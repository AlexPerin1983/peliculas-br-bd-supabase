ALTER TABLE module_activations
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ;

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
            SELECT jsonb_agg(
                jsonb_build_object(
                    'module_id', ma.module_id,
                    'status', ma.status,
                    'expires_at', ma.expires_at,
                    'days_remaining', EXTRACT(DAY FROM ma.expires_at - now()),
                    'cancel_at_period_end', COALESCE(ma.cancel_at_period_end, false),
                    'payment_provider', ma.payment_provider,
                    'billing_cycle', ma.billing_cycle
                )
                ORDER BY ma.module_id
            )
            FROM module_activations ma
            WHERE ma.subscription_id = s.id
              AND ma.status = 'active'
              AND (ma.expires_at IS NULL OR ma.expires_at > now())
        )
    ) INTO v_result
    FROM subscriptions s
    WHERE s.organization_id = p_organization_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
