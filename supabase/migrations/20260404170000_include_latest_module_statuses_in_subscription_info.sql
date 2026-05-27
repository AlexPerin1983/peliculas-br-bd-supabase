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
                    'module_id', ma_latest.module_id,
                    'status', ma_latest.status,
                    'expires_at', ma_latest.expires_at,
                    'days_remaining',
                        CASE
                            WHEN ma_latest.expires_at IS NULL THEN NULL
                            ELSE GREATEST(EXTRACT(DAY FROM ma_latest.expires_at - now()), 0)
                        END,
                    'cancel_at_period_end', COALESCE(ma_latest.cancel_at_period_end, false),
                    'payment_provider', ma_latest.payment_provider,
                    'billing_cycle', ma_latest.billing_cycle
                )
                ORDER BY ma_latest.module_id
            )
            FROM (
                SELECT DISTINCT ON (ma.module_id)
                    ma.module_id,
                    ma.status,
                    ma.expires_at,
                    ma.cancel_at_period_end,
                    ma.payment_provider,
                    ma.billing_cycle
                FROM module_activations ma
                WHERE ma.subscription_id = s.id
                ORDER BY
                    ma.module_id,
                    COALESCE(ma.updated_at, ma.created_at, ma.activated_at, now()) DESC,
                    COALESCE(ma.expires_at, now()) DESC
            ) ma_latest
        )
    ) INTO v_result
    FROM subscriptions s
    WHERE s.organization_id = p_organization_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
