-- =====================================================
-- admin_users_overview — expõe dados para classificar a SITUAÇÃO da empresa
-- =====================================================
-- Acrescenta dois sinais usados pela lista do Admin para separar claramente
-- assinante (pago) de cortesia (grant do admin) e detectar quem terminou o teste:
--
--   • modules_detail[].payment_reference  → grants do admin usam "ADMIN-*"
--     (PROMO/MANUAL/TRIAL); qualquer outra referência = pagamento real (AbacatePay).
--   • ever_had_access (BOOLEAN)           → já existiu QUALQUER module_activation
--     para a assinatura (mesmo expirada). Com active_modules vazio + este flag,
--     a empresa "terminou o teste".
--
-- Mudança 100% aditiva e compatível: o frontend trata os campos como opcionais.
-- Aplique manualmente no SQL Editor do Supabase.

DROP FUNCTION IF EXISTS admin_users_overview();

CREATE OR REPLACE FUNCTION admin_users_overview()
RETURNS TABLE (
    id              UUID,
    email           TEXT,
    role            TEXT,
    created_at      TIMESTAMPTZ,
    organization_id UUID,
    empresa         TEXT,
    telefone        TEXT,
    blocked         BOOLEAN,
    active_modules  TEXT[],
    modules_detail  JSONB,
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
    SELECT
        p.id,
        p.email,
        p.role,
        p.created_at,
        org.id AS organization_id,
        ui.empresa,
        ui.telefone,
        COALESCE(blk.blocked, false)              AS blocked,
        COALESCE(s.active_modules, ARRAY[]::TEXT[]) AS active_modules,
        COALESCE(md.detail, '[]'::jsonb)          AS modules_detail,
        COALESCE(eh.ever, false)                  AS ever_had_access
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
        SELECT jsonb_agg(jsonb_build_object(
            'module_id',         ma.module_id,
            'expires_at',        ma.expires_at,
            'status',            ma.status,
            'payment_reference', ma.payment_reference
        )) AS detail
        FROM module_activations ma
        WHERE ma.subscription_id = s.id AND ma.status = 'active'
    ) md ON true
    LEFT JOIN LATERAL (
        SELECT EXISTS (
            SELECT 1 FROM module_activations ma2 WHERE ma2.subscription_id = s.id
        ) AS ever
    ) eh ON true
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_users_overview() TO authenticated;

NOTIFY pgrst, 'reload schema';
