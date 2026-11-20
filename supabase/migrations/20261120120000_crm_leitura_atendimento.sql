-- Leitura do CRM pelo atendimento de WhatsApp (Conversa Bridge Ai).
--
-- Somente acrescenta uma tabela e funções; não altera nenhum dado existente.
-- A chave de leitura fica presa a UMA empresa aqui no banco: a função crm-read
-- descobre a empresa pela chave e nunca por um campo enviado por quem chama.
--
-- O que estas funções NÃO devolvem: nome completo, telefone, endereço (só bairro
-- e cidade), CPF/CNPJ, e-mail, observações, custos, arquivo do PDF, link da
-- proposta nem mensagens trocadas.
--
-- Só a função crm-read (service_role) chama estas funções. O app não vê nada.

CREATE TABLE IF NOT EXISTS public.crm_read_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- SHA-256 (hex) da chave. A chave em si nunca fica no banco.
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
    scopes text[] NOT NULL DEFAULT ARRAY['proposals:read', 'agenda:read']::text[]
        CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['proposals:read', 'agenda:read']::text[]),
    enabled boolean NOT NULL DEFAULT true,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS crm_read_keys_organization_idx ON public.crm_read_keys (organization_id);

ALTER TABLE public.crm_read_keys ENABLE ROW LEVEL SECURITY;
-- Sem políticas: ninguém do app lê ou grava as chaves.
REVOKE ALL ON public.crm_read_keys FROM PUBLIC, anon, authenticated;

-- Confere a chave (já em SHA-256) e devolve a empresa e o que ela pode ler.
-- Chave desligada, revogada ou vencida não devolve nada.
-- Anota o último uso no máximo uma vez por hora (só para saber se está em uso).
CREATE OR REPLACE FUNCTION public.crm_read_key_lookup(p_token_hash text)
RETURNS TABLE (key_id uuid, organization_id uuid, scopes text[])
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_key public.crm_read_keys%ROWTYPE;
BEGIN
    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN;
    END IF;

    SELECT * INTO found_key
    FROM public.crm_read_keys k
    WHERE k.token_hash = p_token_hash
      AND k.enabled
      AND k.revoked_at IS NULL
      AND (k.expires_at IS NULL OR k.expires_at > now());

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.crm_read_keys
       SET last_used_at = now()
     WHERE id = found_key.id
       AND (last_used_at IS NULL OR last_used_at < now() - interval '1 hour');

    key_id := found_key.id;
    organization_id := found_key.organization_id;
    scopes := found_key.scopes;
    RETURN NEXT;
END;
$$;

-- Propostas dos clientes da empresa com este telefone (com e sem o nono dígito).
-- p_phone: só dígitos, com o código do país (igual a whatsapp_phone_digits()).
-- Clientes da empresa: os da organização e, nos cadastros antigos sem empresa,
-- os criados pelo dono ou pela equipe (mesma regra da ponte do WhatsApp).
CREATE OR REPLACE FUNCTION public.crm_read_proposals(p_organization_id uuid, p_phone text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH wanted AS (
        SELECT p_phone AS phone WHERE p_phone ~ '^[0-9]{12,15}$'
    ), variants AS (
        SELECT phone AS variant FROM wanted
        UNION SELECT regexp_replace(phone, '^55([0-9]{2})9([0-9]{8})$', '55\1\2') FROM wanted WHERE phone ~ '^55[0-9]{2}9[0-9]{8}$'
        UNION SELECT regexp_replace(phone, '^55([0-9]{2})([0-9]{8})$', '55\19\2') FROM wanted WHERE phone ~ '^55[0-9]{2}[0-9]{8}$'
    ), organization AS (
        SELECT id, owner_id FROM public.organizations WHERE id = p_organization_id
    ), company_users AS (
        SELECT owner_id AS user_id FROM organization
        UNION SELECT member.user_id FROM public.organization_members member, organization
            WHERE member.organization_id = organization.id AND member.status = 'active'
        UNION SELECT profile.id FROM public.profiles profile, organization
            WHERE profile.organization_id = organization.id
    ), matched AS (
        SELECT client.id, client.nome
        FROM public.clients client, organization
        WHERE (
                client.organization_id = organization.id
                OR (client.organization_id IS NULL AND client.user_id IN (SELECT user_id FROM company_users))
              )
          AND public.whatsapp_phone_digits(client.telefone) IN (SELECT variant FROM variants)
        ORDER BY client.id DESC
        LIMIT 5
    ), portals AS (
        SELECT portal.id, portal.client_id, portal.status, portal.created_at, portal.expires_at,
               portal.view_count, portal.last_viewed_at, portal.decision_pdf_id, portal.decision_at,
               portal.lost_at, portal.highlighted_pdf_id
        FROM public.proposal_portals portal
        WHERE portal.organization_id = p_organization_id
          AND portal.client_id IN (SELECT id FROM matched)
          AND portal.status <> 'revoked'
        ORDER BY portal.created_at DESC
        LIMIT 10
    ), items AS (
        SELECT item.portal_id, item.saved_pdf_id, item.position,
               item.condition_original_value, item.condition_final_value,
               item.condition_discount_amount, item.condition_discount_percent, item.condition_expires_at
        FROM public.proposal_portal_items item
        WHERE item.portal_id IN (SELECT id FROM portals)
    ), recent_pdfs AS (
        SELECT pdf.id FROM public.saved_pdfs pdf
        WHERE pdf.client_id IN (SELECT id FROM matched)
        ORDER BY pdf.id DESC
        LIMIT 10
    ), pdfs AS (
        -- Os orçamentos recentes e os que estão nos links. Sempre de um cliente encontrado acima.
        SELECT pdf.id, pdf.client_id, pdf.date, pdf.expiration_date, pdf.status,
               pdf.proposal_option_name, pdf.total_preco, pdf.total_m2, pdf.payment_config,
               pdf.follow_up_base_value, pdf.follow_up_discount_percent, pdf.follow_up_discount_amount,
               pdf.follow_up_revision,
               (
                   SELECT coalesce(jsonb_agg(DISTINCT left(trim(measure->>'pelicula'), 120)), '[]'::jsonb)
                   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(pdf.measurements) = 'array' THEN pdf.measurements ELSE '[]'::jsonb END) measure
                   WHERE jsonb_typeof(measure) = 'object'
                     AND measure->>'active' IS DISTINCT FROM 'false'
                     AND coalesce(trim(measure->>'pelicula'), '') <> ''
               ) AS films
        FROM public.saved_pdfs pdf
        WHERE pdf.client_id IN (SELECT id FROM matched)
          AND (pdf.id IN (SELECT id FROM recent_pdfs) OR pdf.id IN (SELECT saved_pdf_id FROM items))
    ), info AS (
        SELECT ui.payment_methods, ui.prazo_pagamento, ui.proposal_validity_days
        FROM public.user_info ui JOIN organization ON ui.user_id = organization.owner_id
        LIMIT 1
    )
    SELECT jsonb_build_object(
        'clients', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome) ORDER BY id DESC), '[]'::jsonb) FROM matched),
        'portals', (SELECT coalesce(jsonb_agg(to_jsonb(portals) ORDER BY created_at DESC), '[]'::jsonb) FROM portals),
        'items', (SELECT coalesce(jsonb_agg(to_jsonb(items) ORDER BY portal_id, position), '[]'::jsonb) FROM items),
        'pdfs', (SELECT coalesce(jsonb_agg(to_jsonb(pdfs) ORDER BY id DESC), '[]'::jsonb) FROM pdfs),
        'company', (
            SELECT jsonb_build_object(
                'payment_methods', CASE WHEN jsonb_typeof(to_jsonb(payment_methods)) = 'array' THEN to_jsonb(payment_methods) ELSE '[]'::jsonb END,
                'prazo_pagamento', nullif(left(trim(prazo_pagamento), 300), ''),
                'proposal_validity_days', proposal_validity_days
            ) FROM info
        )
    );
$$;

-- Agenda da empresa num intervalo (no máximo 32 dias), com o horário de trabalho
-- para calcular os horários livres. Sem nome do cliente, título nem observações.
CREATE OR REPLACE FUNCTION public.crm_read_agenda(p_organization_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '32 days' THEN
        RAISE EXCEPTION 'Intervalo de datas inválido.';
    END IF;

    WITH organization AS (
        SELECT id, owner_id FROM public.organizations WHERE id = p_organization_id
    ), company_users AS (
        SELECT owner_id AS user_id FROM organization
        UNION SELECT member.user_id FROM public.organization_members member, organization
            WHERE member.organization_id = organization.id AND member.status = 'active'
        UNION SELECT profile.id FROM public.profiles profile, organization
            WHERE profile.organization_id = organization.id
    ), events AS (
        SELECT agenda.start, agenda."end", agenda.event_type, agenda.service_status,
               CASE WHEN client.organization_id = p_organization_id
                      OR (client.organization_id IS NULL AND client.user_id IN (SELECT user_id FROM company_users))
                    THEN nullif(left(trim(client.bairro), 80), '') END AS bairro,
               CASE WHEN client.organization_id = p_organization_id
                      OR (client.organization_id IS NULL AND client.user_id IN (SELECT user_id FROM company_users))
                    THEN nullif(left(trim(client.cidade), 80), '') END AS cidade
        FROM public.agendamentos agenda
        LEFT JOIN public.clients client ON client.id = agenda.client_id
        WHERE agenda.user_id IN (SELECT user_id FROM company_users)
          AND agenda.start IS NOT NULL
          AND agenda.start < p_to
          AND coalesce(agenda."end", agenda.start + interval '1 hour') > p_from
          AND coalesce(agenda.service_status, 'scheduled') NOT IN ('cancelled', 'no_show')
        ORDER BY agenda.start
        LIMIT 500
    ), info AS (
        SELECT ui.working_hours FROM public.user_info ui JOIN organization ON ui.user_id = organization.owner_id LIMIT 1
    )
    SELECT jsonb_build_object(
        'events', (SELECT coalesce(jsonb_agg(to_jsonb(events) ORDER BY start), '[]'::jsonb) FROM events),
        'working_hours', (SELECT CASE WHEN jsonb_typeof(to_jsonb(working_hours)) = 'object' THEN to_jsonb(working_hours) END FROM info)
    ) INTO result;

    RETURN result;
END;
$$;

-- O Supabase concede EXECUTE em funções novas a anon e authenticated por padrão:
-- revogar só de PUBLIC não basta.
REVOKE ALL ON FUNCTION public.crm_read_key_lookup(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_read_proposals(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_read_agenda(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_read_key_lookup(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_read_proposals(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_read_agenda(uuid, timestamptz, timestamptz) TO service_role;

-- Conferência depois de aplicar (todas devem dar false):
-- SELECT has_function_privilege('anon', 'public.crm_read_proposals(uuid, text)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.crm_read_proposals(uuid, text)', 'EXECUTE'),
--        has_function_privilege('anon', 'public.crm_read_agenda(uuid, timestamptz, timestamptz)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.crm_read_agenda(uuid, timestamptz, timestamptz)', 'EXECUTE'),
--        has_function_privilege('anon', 'public.crm_read_key_lookup(text)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.crm_read_key_lookup(text)', 'EXECUTE'),
--        has_table_privilege('anon', 'public.crm_read_keys', 'SELECT'),
--        has_table_privilege('authenticated', 'public.crm_read_keys', 'SELECT');

NOTIFY pgrst, 'reload schema';
