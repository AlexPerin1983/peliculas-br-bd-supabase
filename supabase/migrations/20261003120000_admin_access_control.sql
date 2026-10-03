-- =====================================================
-- Admin: controle de acesso por empresa (liberar, estender, remover)
-- =====================================================
-- 1. admin_users_overview passa a calcular o acesso na hora, pela mesma regra
--    do app (get_subscription_info: última ativação de cada módulo, ativa e
--    não vencida). Antes ele lia subscriptions.active_modules, que fica velho
--    para quem não abre o app, e listava ativações já vencidas como ativas.
--    Novo campo modules_state: situação de cada módulo (ativo, vencido,
--    pagamento pendente, cancelado) para o painel mostrar o que o usuário vê.
-- 2. admin_revoke_module: remove na hora um acesso liberado pelo admin.
--    Acesso pago (AbacatePay) não é mexido por aqui — a cobrança continuaria.

DROP FUNCTION IF EXISTS admin_users_overview();

CREATE OR REPLACE FUNCTION admin_users_overview()
RETURNS TABLE (
    id              UUID,
    email           TEXT,
    role            TEXT,
    created_at      TIMESTAMPTZ,
    organization_id UUID,
    subscription_id UUID,
    empresa         TEXT,
    telefone        TEXT,
    blocked         BOOLEAN,
    active_modules  TEXT[],
    modules_detail  JSONB,
    modules_state   JSONB,
    ever_had_access BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem listar as empresas';
    END IF;

    RETURN QUERY
    WITH latest AS (
        -- Mesma regra do get_subscription_info: vale a ativação mais recente de cada módulo.
        SELECT DISTINCT ON (ma.subscription_id, ma.module_id)
            ma.subscription_id,
            ma.module_id,
            CASE
                WHEN ma.status = 'active'
                     AND ma.expires_at IS NOT NULL
                     AND ma.expires_at <= now()
                THEN 'expired'
                ELSE ma.status
            END AS status,
            ma.expires_at,
            ma.payment_provider,
            ma.payment_reference
        FROM module_activations ma
        ORDER BY
            ma.subscription_id,
            ma.module_id,
            COALESCE(ma.updated_at, ma.created_at, ma.activated_at, now()) DESC,
            COALESCE(ma.expires_at, now()) DESC
    )
    SELECT
        p.id,
        p.email,
        p.role,
        p.created_at,
        org.id AS organization_id,
        s.id   AS subscription_id,
        ui.empresa,
        ui.telefone,
        COALESCE(blk.blocked, false) AS blocked,
        COALESCE(st.active_modules, ARRAY[]::TEXT[]) AS active_modules,
        COALESCE(st.detail, '[]'::jsonb)  AS modules_detail,
        COALESCE(st.state, '[]'::jsonb)   AS modules_state,
        COALESCE(eh.ever, false)          AS ever_had_access
    FROM profiles p
    LEFT JOIN LATERAL (
        SELECT o.id
        FROM organizations o
        WHERE o.id = p.organization_id OR o.owner_id = p.id
        ORDER BY (o.id = p.organization_id) DESC
        LIMIT 1
    ) org ON true
    LEFT JOIN subscriptions s ON s.organization_id = org.id
    LEFT JOIN user_info ui ON ui.user_id = p.id
    LEFT JOIN LATERAL (
        SELECT bool_or(om.status = 'blocked') AS blocked
        FROM organization_members om
        WHERE om.user_id = p.id
    ) blk ON true
    LEFT JOIN LATERAL (
        SELECT
            array_agg(l.module_id ORDER BY l.module_id)
                FILTER (WHERE l.status = 'active') AS active_modules,
            jsonb_agg(jsonb_build_object(
                'module_id',         l.module_id,
                'expires_at',        l.expires_at,
                'status',            l.status,
                'payment_reference', l.payment_reference
            )) FILTER (WHERE l.status = 'active') AS detail,
            jsonb_agg(jsonb_build_object(
                'module_id',         l.module_id,
                'status',            l.status,
                'expires_at',        l.expires_at,
                'payment_provider',  l.payment_provider,
                'payment_reference', l.payment_reference
            ) ORDER BY l.module_id) AS state
        FROM latest l
        WHERE l.subscription_id = s.id
    ) st ON true
    LEFT JOIN LATERAL (
        -- "Já teve acesso" = alguma ativação chegou a valer (checkout pendente não conta).
        SELECT EXISTS (
            SELECT 1 FROM module_activations ma2
            WHERE ma2.subscription_id = s.id AND ma2.activated_at IS NOT NULL
        ) AS ever
    ) eh ON true
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_users_overview() TO authenticated;

-- -----------------------------------------------------
-- admin_revoke_module: tira na hora um acesso liberado pelo admin
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION admin_revoke_module(
    p_subscription_id UUID,
    p_module_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem remover acessos';
    END IF;

    -- Acesso pago segue valendo até cancelar a assinatura; remover só a
    -- cortesia faria a cortesia "cancelada" (mais recente) esconder o pago.
    IF EXISTS (
        SELECT 1 FROM module_activations
        WHERE subscription_id = p_subscription_id
          AND module_id = p_module_id
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
          AND COALESCE(payment_provider, '') <> 'manual'
    ) THEN
        RAISE EXCEPTION 'Este acesso é pago. Cancele a assinatura para removê-lo.';
    END IF;

    UPDATE module_activations
    SET status = 'cancelled',
        expires_at = LEAST(COALESCE(expires_at, now()), now()),
        notes = concat_ws(' | ', NULLIF(notes, ''), 'Removido pelo admin em ' || to_char(now(), 'DD/MM/YYYY')),
        updated_at = now()
    WHERE subscription_id = p_subscription_id
      AND module_id = p_module_id
      AND status = 'active'
      AND payment_provider = 'manual';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    PERFORM refresh_subscription_active_modules(p_subscription_id);

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION admin_revoke_module(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_revoke_module(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
