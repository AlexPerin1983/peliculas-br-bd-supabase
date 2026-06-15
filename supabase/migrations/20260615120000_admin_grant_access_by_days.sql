-- =====================================================
-- Liberação de acesso por X DIAS no painel Admin
-- (trial / promoção) + revogação automática via pg_cron
-- =====================================================
-- Aplique manualmente no SQL Editor do Supabase.
-- Independente do AbacatePay: payment_provider='manual', sem cobrança.

-- -----------------------------------------------------
-- 1a. activate_module: novo parâmetro opcional p_days
--     (NULL = comportamento atual por meses; retrocompatível)
--
-- Importante: a versão anterior tinha 5 parâmetros. Adicionar p_days
-- cria uma SOBRECARGA nova em vez de substituir, e o PostgREST não
-- consegue resolver a chamada. Por isso removemos a versão antiga de 5
-- args primeiro (a de 6 args cobre os dois chamadores: a chamada por
-- meses simplesmente não passa p_days e usa o default NULL).
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS activate_module(UUID, TEXT, INTEGER, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION activate_module(
    p_subscription_id UUID,
    p_module_id TEXT,
    p_months INTEGER DEFAULT 1,
    p_payment_amount NUMERIC DEFAULT NULL,
    p_payment_reference TEXT DEFAULT NULL,
    p_days INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_activation_id UUID;
    v_module_price NUMERIC;
    v_current_expires_at TIMESTAMPTZ;
    v_new_expires_at TIMESTAMPTZ;
    v_billing_cycle TEXT;
    v_duration INTERVAL;
    v_total_days INTEGER;
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem ativar modulos manualmente';
    END IF;

    -- Define a duração: dias têm prioridade quando informado
    IF p_days IS NOT NULL THEN
        IF p_days < 1 THEN
            RAISE EXCEPTION 'Periodo de ativacao invalido (dias): %', p_days;
        END IF;
        v_duration := (p_days || ' days')::interval;
        v_total_days := p_days;
    ELSE
        IF p_months IS NULL OR p_months < 1 THEN
            RAISE EXCEPTION 'Periodo de ativacao invalido (meses): %', p_months;
        END IF;
        v_duration := (p_months || ' months')::interval;
        v_total_days := p_months * 30;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM subscriptions WHERE id = p_subscription_id
    ) THEN
        RAISE EXCEPTION 'Assinatura nao encontrada: %', p_subscription_id;
    END IF;

    IF p_payment_amount IS NULL THEN
        SELECT price_monthly * GREATEST(COALESCE(p_months, 1), 1)
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
        GREATEST(COALESCE(v_current_expires_at, now()), now()) + v_duration;

    v_billing_cycle :=
        CASE
            WHEN v_total_days >= 360 THEN 'yearly'
            WHEN v_total_days >= 180 THEN 'semiannual'
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

-- -----------------------------------------------------
-- 1b. admin_grant_full_access_all: libera o Pacote Completo
--     para TODAS as organizações por X dias (campanha/trial)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION admin_grant_full_access_all(
    p_days INTEGER,
    p_payment_reference TEXT DEFAULT 'ADMIN-PROMO'
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_sub RECORD;
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem liberar acesso em massa';
    END IF;

    IF p_days IS NULL OR p_days < 1 THEN
        RAISE EXCEPTION 'Periodo invalido (dias): %', p_days;
    END IF;

    FOR v_sub IN SELECT id FROM subscriptions LOOP
        PERFORM activate_module(
            p_subscription_id => v_sub.id,
            p_module_id       => 'pacote_completo',
            p_months          => NULL,
            p_payment_amount  => 0,
            p_payment_reference => p_payment_reference,
            p_days            => p_days
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- -----------------------------------------------------
-- 1c. Revogação automática diária (pg_cron)
--     expire_modules() marca expirados e limpa active_modules
-- -----------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-modules-daily') THEN
        PERFORM cron.unschedule('expire-modules-daily');
    END IF;
END;
$$;

-- Roda todo dia às 03:00 (UTC)
SELECT cron.schedule(
    'expire-modules-daily',
    '0 3 * * *',
    $$SELECT expire_modules();$$
);

-- -----------------------------------------------------
-- Recarrega o schema cache do PostgREST para que a API
-- enxergue a nova assinatura de activate_module imediatamente.
-- -----------------------------------------------------
NOTIFY pgrst, 'reload schema';
