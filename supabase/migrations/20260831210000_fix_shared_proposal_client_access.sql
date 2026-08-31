-- Corrige somente a autorização das medidas de clientes compartilhados.
-- Não altera nem remove clientes, opções, medidas, PDFs ou histórico.
-- Clientes antigos podem ter organization_id vazio mesmo quando seus autores
-- são colaboradores da mesma empresa. O snapshot canônico, quando disponível,
-- tem precedência sobre o vínculo atual do autor para evitar acesso cruzado
-- caso esse autor tenha mudado de empresa.
CREATE OR REPLACE FUNCTION public.can_access_proposal_client(target_client_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.clients client
        LEFT JOIN public.profiles current_profile
          ON current_profile.id = auth.uid()
        WHERE client.id = target_client_id
          AND (
              client.user_id = auth.uid()
              OR (
                  client.organization_id IS NOT NULL
                  AND client.organization_id = current_profile.organization_id
              )
              OR EXISTS (
                  SELECT 1
                  FROM public.organizations organization
                  JOIN public.organization_members member
                    ON member.organization_id = organization.id
                  WHERE organization.owner_id = client.user_id
                    AND member.user_id = auth.uid()
                    AND member.status = 'active'
              )
              OR (
                  client.organization_id IS NULL
                  AND current_profile.organization_id IS NOT NULL
                  AND current_profile.organization_id = COALESCE(
                      (
                          SELECT state.organization_id
                          FROM public.proposal_option_states state
                          WHERE state.client_id = client.id
                      ),
                      (
                          SELECT creator_profile.organization_id
                          FROM public.profiles creator_profile
                          WHERE creator_profile.id = client.user_id
                      )
                  )
                  AND EXISTS (
                      SELECT 1
                      FROM public.organizations shared_organization
                      WHERE shared_organization.id = current_profile.organization_id
                        AND (
                            shared_organization.owner_id = auth.uid()
                            OR EXISTS (
                                SELECT 1
                                FROM public.organization_members active_member
                                WHERE active_member.organization_id = shared_organization.id
                                  AND active_member.user_id = auth.uid()
                                  AND active_member.status = 'active'
                            )
                        )
                  )
              )
          )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_proposal_client(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_proposal_client(bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';
