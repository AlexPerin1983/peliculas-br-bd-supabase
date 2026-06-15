-- =====================================================
-- Trial automático para novos cadastros
-- =====================================================
-- Quando ligado, todo novo cadastro recebe o Pacote Completo por X dias
-- a partir do cadastro. A revogação é automática no vencimento (cron
-- expire-modules-daily) e o usuário cai no plano grátis.
-- Aplique manualmente no SQL Editor do Supabase.

-- -----------------------------------------------------
-- 1. Config (linha única) controlada pelo Admin
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS signup_trial_config (
    id BOOLEAN PRIMARY KEY DEFAULT true,
    enabled BOOLEAN NOT NULL DEFAULT false,
    trial_days INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID,
    CONSTRAINT signup_trial_config_singleton CHECK (id)
);

INSERT INTO signup_trial_config (id, enabled, trial_days)
VALUES (true, false, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE signup_trial_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read signup trial config" ON signup_trial_config;
CREATE POLICY "Admins can read signup trial config" ON signup_trial_config
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- -----------------------------------------------------
-- 2. Admin lê/grava a config via RPC (centraliza checagem + auditoria)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION set_signup_trial_config(p_enabled BOOLEAN, p_days INTEGER)
RETURNS VOID AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar o trial de cadastro';
    END IF;

    IF p_enabled AND (p_days IS NULL OR p_days < 1) THEN
        RAISE EXCEPTION 'Para ligar o trial, informe um numero de dias valido';
    END IF;

    UPDATE signup_trial_config
    SET enabled = p_enabled,
        trial_days = COALESCE(p_days, 0),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- -----------------------------------------------------
-- 3. Trigger: ao criar uma subscription nova, concede o trial
--    (roda como sistema, sem exigir admin logado)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION grant_signup_trial()
RETURNS TRIGGER AS $$
DECLARE
    v_enabled BOOLEAN;
    v_days INTEGER;
    v_activation_id UUID;
BEGIN
    SELECT enabled, trial_days INTO v_enabled, v_days
    FROM signup_trial_config WHERE id = true;

    IF NOT COALESCE(v_enabled, false) OR COALESCE(v_days, 0) < 1 THEN
        RETURN NEW;
    END IF;

    -- Evita conceder de novo se já houver qualquer ativação para essa assinatura
    IF EXISTS (SELECT 1 FROM module_activations WHERE subscription_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    INSERT INTO module_activations (
        subscription_id, module_id, status, activated_at, expires_at,
        payment_method, payment_amount, payment_reference,
        payment_confirmed_at, payment_provider, is_recurring,
        cancel_at_period_end, billing_cycle
    ) VALUES (
        NEW.id, 'pacote_completo', 'active', now(),
        now() + (v_days || ' days')::interval,
        'manual', 0, 'SIGNUP-TRIAL',
        now(), 'manual', false, false, 'monthly'
    )
    RETURNING id INTO v_activation_id;

    INSERT INTO payment_history (
        subscription_id, module_id, activation_id, amount,
        payment_method, payment_provider, status, confirmed_at, confirmation_notes
    ) VALUES (
        NEW.id, 'pacote_completo', v_activation_id, 0,
        'manual', 'manual', 'confirmed', now(), 'Trial automatico de novo cadastro'
    );

    PERFORM refresh_subscription_active_modules(NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_subscription_created_grant_trial ON subscriptions;
CREATE TRIGGER on_subscription_created_grant_trial
    AFTER INSERT ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION grant_signup_trial();

-- Atualiza o schema cache da API
NOTIFY pgrst, 'reload schema';
