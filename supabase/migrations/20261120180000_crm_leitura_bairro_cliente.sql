-- Leitura do CRM pelo atendimento: devolve também o bairro e a cidade do PRÓPRIO
-- cliente encontrado pelo telefone (para o atendimento saber se a equipe estará
-- perto dele). Continua sem rua, número, CEP ou dados de outros clientes.
--
-- Só substitui crm_read_proposals; não altera dados. Compatível com a função
-- crm-read antiga e nova (campo novo é opcional).

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
        SELECT client.id, client.nome,
               nullif(left(trim(client.bairro), 80), '') AS bairro,
               nullif(left(trim(client.cidade), 80), '') AS cidade
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
        'clients', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'bairro', bairro, 'cidade', cidade) ORDER BY id DESC), '[]'::jsonb) FROM matched),
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

REVOKE ALL ON FUNCTION public.crm_read_proposals(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_read_proposals(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
