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
    v_current_expires_at TIMESTAMPTZ;
    v_new_expires_at TIMESTAMPTZ;
    v_billing_cycle TEXT;
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem ativar modulos manualmente';
    END IF;

    IF p_months IS NULL OR p_months < 1 THEN
        RAISE EXCEPTION 'Periodo de ativacao invalido: %', p_months;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM subscriptions WHERE id = p_subscription_id
    ) THEN
        RAISE EXCEPTION 'Assinatura nao encontrada: %', p_subscription_id;
    END IF;

    IF p_payment_amount IS NULL THEN
        SELECT price_monthly * p_months
        INTO v_module_price
        FROM subscription_modules
        WHERE id = p_module_id;
    ELSE
        v_module_price := p_payment_amount;
    END IF;

    IF v_module_price IS NULL THEN
        RAISE EXCEPTION 'Modulo nao encontrado: %', p_module_id;
    END IF;

    SELECT ma.expires_at
    INTO v_current_expires_at
    FROM module_activations ma
    WHERE ma.subscription_id = p_subscription_id
      AND ma.module_id = p_module_id
      AND ma.status = 'active'
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
    ORDER BY
        ma.expires_at DESC NULLS LAST,
        COALESCE(ma.updated_at, ma.created_at, ma.activated_at) DESC
    LIMIT 1;

    v_new_expires_at :=
        GREATEST(COALESCE(v_current_expires_at, now()), now())
        + (p_months || ' months')::interval;

    v_billing_cycle :=
        CASE
            WHEN p_months >= 12 THEN 'yearly'
            WHEN p_months >= 6 THEN 'semiannual'
            ELSE 'monthly'
        END;

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
        payment_provider,
        is_recurring,
        cancel_at_period_end,
        billing_cycle
    ) VALUES (
        p_subscription_id,
        p_module_id,
        'active',
        now(),
        v_new_expires_at,
        'manual',
        v_module_price,
        COALESCE(p_payment_reference, 'ADMIN-MANUAL'),
        now(),
        auth.uid(),
        'manual',
        false,
        false,
        v_billing_cycle
    )
    RETURNING id INTO v_activation_id;

    INSERT INTO payment_history (
        subscription_id,
        module_id,
        activation_id,
        amount,
        payment_method,
        payment_provider,
        status,
        confirmed_at,
        confirmed_by,
        confirmation_notes
    ) VALUES (
        p_subscription_id,
        p_module_id,
        v_activation_id,
        v_module_price,
        'manual',
        'manual',
        'confirmed',
        now(),
        auth.uid(),
        'Liberado manualmente pelo painel admin'
    );

    PERFORM refresh_subscription_active_modules(p_subscription_id);

    RETURN v_activation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
