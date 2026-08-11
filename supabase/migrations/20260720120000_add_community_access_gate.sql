-- Etapa de entrada na comunidade para novos cadastros.
-- Quem ja possuia perfil antes desta migracao e liberado automaticamente.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS community_access_granted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.community_access_granted_at IS
    'Data em que o usuario validou o codigo fixado no grupo de aplicadores.';

UPDATE public.profiles
SET community_access_granted_at = COALESCE(community_access_granted_at, now());

CREATE OR REPLACE FUNCTION public.redeem_community_access(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT := COALESCE(auth.jwt() ->> 'email', '');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sessao nao autenticada';
    END IF;

    IF UPPER(TRIM(COALESCE(p_code, ''))) <> 'APLICADOR25' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
    END IF;

    -- O perfil pode ainda nao existir nos primeiros milissegundos do cadastro.
    -- O upsert torna a liberacao segura tambem nesse caso.
    INSERT INTO public.profiles (
        id,
        email,
        community_access_granted_at
    ) VALUES (
        v_user_id,
        v_email,
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET community_access_granted_at = COALESCE(
        public.profiles.community_access_granted_at,
        EXCLUDED.community_access_granted_at
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_community_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_community_access(TEXT) TO authenticated;
