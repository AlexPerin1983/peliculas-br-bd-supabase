-- =====================================================
-- Lista de empresas para o Admin — AGREGADA em 1 chamada
-- =====================================================
-- Substitui o carregamento N+1 (que fazia ~4 consultas POR empresa) por uma
-- única função: identidade + organização + módulos ativos + vencimentos +
-- bloqueio + empresa/telefone. Em escala (100+ empresas) isso troca ~400
-- requisições por 1 → muito menos egress (gargalo do projeto) e bem mais rápido.
-- Restrito a administradores.
--
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
    modules_detail  JSONB
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
        COALESCE(md.detail, '[]'::jsonb)          AS modules_detail
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
            'module_id',  ma.module_id,
            'expires_at', ma.expires_at,
            'status',     ma.status
        )) AS detail
        FROM module_activations ma
        WHERE ma.subscription_id = s.id AND ma.status = 'active'
    ) md ON true
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_users_overview() TO authenticated;

NOTIFY pgrst, 'reload schema';
