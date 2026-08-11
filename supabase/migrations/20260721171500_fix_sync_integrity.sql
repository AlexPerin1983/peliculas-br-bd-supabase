-- Remove limites artificiais de precisão dos campos numéricos de películas.
-- A conversão apenas amplia a capacidade e preserva os valores existentes.
DO $$
DECLARE
    column_record record;
BEGIN
    FOR column_record IN
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'films'
          AND data_type = 'numeric'
          AND numeric_precision IS NOT NULL
    LOOP
        EXECUTE format(
            'ALTER TABLE public.films ALTER COLUMN %I TYPE numeric USING %I::numeric',
            column_record.column_name,
            column_record.column_name
        );
    END LOOP;
END;
$$;

-- O aplicativo usa uma única linha de user_info, pertencente ao owner, como
-- configuração compartilhada da empresa. Membros ativos precisam conseguir
-- sincronizar essa linha sem receber erro de RLS.
CREATE OR REPLACE FUNCTION public.can_access_company_user_info(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT
        auth.uid() = target_user_id
        OR EXISTS (
            SELECT 1
            FROM public.organizations organization
            JOIN public.organization_members member
              ON member.organization_id = organization.id
            WHERE organization.owner_id = target_user_id
              AND member.user_id = auth.uid()
              AND member.status = 'active'
        );
$$;

REVOKE ALL ON FUNCTION public.can_access_company_user_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_company_user_info(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view their own info" ON public.user_info;
DROP POLICY IF EXISTS "Users can insert their own info" ON public.user_info;
DROP POLICY IF EXISTS "Users can update their own info" ON public.user_info;
DROP POLICY IF EXISTS "Users and organization members can view info" ON public.user_info;
DROP POLICY IF EXISTS "Users and organization members can insert info" ON public.user_info;
DROP POLICY IF EXISTS "Users and organization members can update info" ON public.user_info;
DROP POLICY IF EXISTS user_info_company_select ON public.user_info;
DROP POLICY IF EXISTS user_info_company_insert ON public.user_info;
DROP POLICY IF EXISTS user_info_company_update ON public.user_info;

CREATE POLICY user_info_company_select
ON public.user_info
FOR SELECT
TO authenticated
USING (public.can_access_company_user_info(user_id));

CREATE POLICY user_info_company_insert
ON public.user_info
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_company_user_info(user_id));

CREATE POLICY user_info_company_update
ON public.user_info
FOR UPDATE
TO authenticated
USING (public.can_access_company_user_info(user_id))
WITH CHECK (public.can_access_company_user_info(user_id));

ALTER TABLE public.user_info ENABLE ROW LEVEL SECURITY;

COMMENT ON FUNCTION public.can_access_company_user_info(uuid) IS
'Autoriza o owner ou um membro ativo da mesma empresa a acessar a configuração compartilhada.';

NOTIFY pgrst, 'reload schema';
