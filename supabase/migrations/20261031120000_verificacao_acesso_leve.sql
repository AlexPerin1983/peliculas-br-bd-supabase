-- Verificação de acesso mais leve e índice das medidas por cliente.
--
-- same_organization() roda para cada linha lida em 8 tabelas. A versão anterior
-- fazia duas consultas e gravava um registro de depuração por linha. O resultado
-- continua igual; só deixa de consultar e registrar o que não precisa.

CREATE OR REPLACE FUNCTION public.same_organization(record_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $function$
DECLARE
    current_user_id UUID := auth.uid();
    auth_org_id UUID;
    record_org_id UUID;
BEGIN
    -- O próprio registro não precisa consultar a organização.
    IF record_user_id = current_user_id THEN
        RETURN TRUE;
    END IF;

    SELECT organization_id INTO auth_org_id
    FROM public.profiles
    WHERE id = current_user_id;

    IF auth_org_id IS NOT NULL THEN
        SELECT organization_id INTO record_org_id
        FROM public.profiles
        WHERE id = record_user_id;

        IF record_org_id IS NOT NULL THEN
            RETURN auth_org_id = record_org_id;
        END IF;
    END IF;

    -- Sem organização, só vale o próprio registro.
    RETURN record_user_id = current_user_id;
END;
$function$;

-- Cada salvamento apaga e recria as medidas de um cliente.
CREATE INDEX IF NOT EXISTS idx_proposal_options_client_id
    ON public.proposal_options (client_id);
