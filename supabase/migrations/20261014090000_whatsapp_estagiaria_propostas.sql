-- WhatsApp conectado: a Estagiária IA do painel local cadastra o cliente, cria a proposta
-- no app (o PDF é gerado pelo painel com o mesmo gerador do app) e o link da página do
-- cliente. Ela só altera ou apaga as propostas que ela mesma criou, listadas em
-- whatsapp_intern_proposals. Tudo só para a ponte (service_role); quem decide enviar ao
-- cliente é a equipe, no grupo da estagiária.

CREATE TABLE IF NOT EXISTS public.whatsapp_intern_proposals (
    saved_pdf_id integer PRIMARY KEY REFERENCES public.saved_pdfs(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id integer NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    portal_id uuid REFERENCES public.proposal_portals(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_intern_proposals_org_idx ON public.whatsapp_intern_proposals (organization_id, created_at DESC);
-- Sem políticas: só a ponte (service_role) lê e escreve.
ALTER TABLE public.whatsapp_intern_proposals ENABLE ROW LEVEL SECURITY;

-- Cliente da empresa? (dono ou alguém da mesma organização)
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_intern_client_ok(p_organization_id uuid, p_client_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = p_client_id
          AND (c.organization_id = p_organization_id
               OR c.user_id = (SELECT owner_id FROM public.organizations WHERE id = p_organization_id)
               OR c.user_id IN (SELECT p.id FROM public.profiles p WHERE p.organization_id = p_organization_id))
    );
$$;

-- Validade da proposta como no app: 7, 15, 30 ou 60 dias (padrão 30).
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_intern_validity_days(p_days integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_days IS NULL OR p_days <= 0 THEN 30
        WHEN p_days >= 60 THEN 60
        WHEN p_days >= 30 THEN 30
        WHEN p_days >= 15 THEN 15
        ELSE 7
    END;
$$;

-- O que o painel precisa para montar a proposta e o PDF igual ao app: dados da empresa
-- (os mesmos que o app põe no PDF), catálogo com preço de venda (nunca o custo) e o
-- cliente do telefone, com as propostas dele. Nada disso vai para a IA além do catálogo.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_intern_context(p_organization_id uuid, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
    v_client_id integer;
BEGIN
    SELECT owner_id INTO v_owner FROM public.organizations WHERE id = p_organization_id;
    IF v_owner IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
    IF p_phone IS NOT NULL AND p_phone ~ '^[0-9]{12,15}$' THEN
        v_client_id := (public.whatsapp_bridge_client_phones(p_organization_id, ARRAY[p_phone]) -> p_phone ->> 'client_id')::integer;
    END IF;

    RETURN jsonb_build_object(
        'owner_id', v_owner,
        'company', (
            SELECT jsonb_build_object(
                'nome', ui.nome, 'empresa', ui.empresa, 'telefone', ui.telefone, 'email', ui.email, 'endereco', ui.endereco,
                'cpf_cnpj', ui.cpf_cnpj, 'site', ui.site, 'logo', ui.logo, 'assinatura', ui.assinatura, 'cores', ui.cores,
                'payment_methods', ui.payment_methods, 'proposal_validity_days', public.whatsapp_bridge_intern_validity_days(ui.proposal_validity_days),
                'prazo_pagamento', ui.prazo_pagamento, 'social_links', ui.social_links, 'hide_measurements_in_pdf', ui.hide_measurements_in_pdf,
                'termo_responsabilidade', ui.termo_responsabilidade, 'incluir_termo_responsabilidade_padrao', ui.incluir_termo_responsabilidade_padrao
            )
            FROM public.user_info ui WHERE ui.user_id = v_owner LIMIT 1
        ),
        'films', (
            WITH members AS (
                SELECT v_owner AS user_id
                UNION
                SELECT p.id FROM public.profiles p WHERE p.organization_id = p_organization_id
            ), catalog AS (
                SELECT DISTINCT ON (lower(f.nome)) f.*
                FROM public.films f JOIN members m ON m.user_id = f.user_id
                WHERE coalesce(trim(f.nome), '') <> ''
                ORDER BY lower(f.nome), f.pinned DESC NULLS LAST, f.created_at DESC
            )
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'nome', c.nome, 'preco', c.preco, 'preco_venda_metro_linear', c.preco_venda_metro_linear, 'mao_de_obra', c.mao_de_obra,
                'garantia_fabricante', c.garantia_fabricante, 'garantia_mao_de_obra', c.garantia_mao_de_obra,
                'garantia_mao_de_obra_unidade', c.garantia_mao_de_obra_unidade, 'uv', c.uv, 'ir', c.ir, 'vtl', c.vtl,
                'espessura', c.espessura, 'tser', c.tser, 'custom_fields', c.custom_fields, 'pinned', c.pinned
            ) ORDER BY c.pinned DESC NULLS LAST, c.nome), '[]'::jsonb)
            FROM catalog c
        ),
        'client', (
            SELECT jsonb_build_object(
                'id', c.id, 'nome', c.nome, 'telefone', c.telefone, 'email', c.email, 'cpf_cnpj', c.cpf_cnpj, 'cep', c.cep,
                'logradouro', c.logradouro, 'numero', c.numero, 'complemento', c.complemento, 'bairro', c.bairro, 'cidade', c.cidade, 'uf', c.uf,
                'proposals', (
                    SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'id', sp.id, 'date', sp.date, 'total_preco', sp.total_preco, 'status', sp.status, 'option', sp.proposal_option_name,
                        'by_intern', EXISTS (SELECT 1 FROM public.whatsapp_intern_proposals wip WHERE wip.saved_pdf_id = sp.id)
                    ) ORDER BY sp.date DESC), '[]'::jsonb)
                    FROM (SELECT * FROM public.saved_pdfs WHERE client_id = c.id ORDER BY date DESC LIMIT 10) sp
                )
            )
            FROM public.clients c WHERE c.id = v_client_id
        )
    );
END;
$$;

-- Cadastra o cliente (ou acha pelo telefone) e completa o que estiver vazio. Nunca troca o
-- que a empresa já digitou no app.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_intern_client_save(p_organization_id uuid, p_phone text, p_name text, p_fields jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client jsonb;
    v_id integer;
    v_fields jsonb := CASE WHEN jsonb_typeof(p_fields) = 'object' THEN p_fields ELSE '{}'::jsonb END;
BEGIN
    v_client := public.whatsapp_bridge_create_client(p_organization_id, p_name, p_phone);
    v_id := (v_client->>'client_id')::integer;
    UPDATE public.clients SET
        email = coalesce(nullif(btrim(email), ''), nullif(left(btrim(v_fields->>'email'), 120), '')),
        cep = coalesce(nullif(btrim(cep), ''), nullif(left(regexp_replace(coalesce(v_fields->>'cep', ''), '[^0-9-]', '', 'g'), 9), '')),
        logradouro = coalesce(nullif(btrim(logradouro), ''), nullif(left(btrim(v_fields->>'logradouro'), 160), '')),
        numero = coalesce(nullif(btrim(numero), ''), nullif(left(btrim(v_fields->>'numero'), 20), '')),
        complemento = coalesce(nullif(btrim(complemento), ''), nullif(left(btrim(v_fields->>'complemento'), 80), '')),
        bairro = coalesce(nullif(btrim(bairro), ''), nullif(left(btrim(v_fields->>'bairro'), 80), '')),
        cidade = coalesce(nullif(btrim(cidade), ''), nullif(left(btrim(v_fields->>'cidade'), 80), '')),
        uf = coalesce(nullif(btrim(uf), ''), nullif(upper(left(btrim(v_fields->>'uf'), 2)), '')),
        last_updated = now()
    WHERE id = v_id;
    RETURN v_client;
END;
$$;

-- Cria ou atualiza a proposta da estagiária e o link da página do cliente.
-- p_data: total_preco, total_m2, subtotal, general_discount_amount, general_discount,
-- measurements, nome_arquivo, proposal_option_name, payment_config.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_intern_proposal_save(
    p_organization_id uuid, p_created_by uuid, p_client_id integer, p_saved_pdf_id integer, p_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
    v_validity integer;
    v_client_name text;
    v_pdf_id integer := p_saved_pdf_id;
    v_status text;
    v_expires timestamptz;
    v_portal public.proposal_portals%ROWTYPE;
    v_tracked public.whatsapp_intern_proposals%ROWTYPE;
    v_total numeric := (p_data->>'total_preco')::numeric;
    v_m2 numeric := (p_data->>'total_m2')::numeric;
BEGIN
    SELECT owner_id INTO v_owner FROM public.organizations WHERE id = p_organization_id;
    IF v_owner IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
    IF NOT public.whatsapp_bridge_intern_client_ok(p_organization_id, p_client_id) THEN RAISE EXCEPTION 'Cliente não encontrado nesta empresa'; END IF;
    IF v_total IS NULL OR v_total < 0 OR v_total > 10000000 OR v_m2 IS NULL OR v_m2 < 0 OR v_m2 > 100000 THEN RAISE EXCEPTION 'Valores da proposta inválidos'; END IF;
    IF jsonb_typeof(p_data->'measurements') <> 'array' OR jsonb_array_length(p_data->'measurements') = 0 OR jsonb_array_length(p_data->'measurements') > 200 THEN
        RAISE EXCEPTION 'A proposta precisa de pelo menos uma medida';
    END IF;
    IF p_created_by IS NULL THEN p_created_by := v_owner; END IF;
    SELECT nome INTO v_client_name FROM public.clients WHERE id = p_client_id;
    SELECT public.whatsapp_bridge_intern_validity_days(proposal_validity_days) INTO v_validity FROM public.user_info WHERE user_id = v_owner LIMIT 1;
    v_validity := coalesce(v_validity, 30);
    v_expires := now() + make_interval(days => v_validity);

    IF v_pdf_id IS NULL THEN
        INSERT INTO public.saved_pdfs (
            user_id, client_id, client_name, date, expiration_date, total_preco, total_m2, subtotal, general_discount_amount,
            general_discount, nome_arquivo, measurements, status, proposal_option_name, payment_config
        ) VALUES (
            v_owner, p_client_id, v_client_name, now(), v_expires, v_total, v_m2, (p_data->>'subtotal')::numeric,
            coalesce((p_data->>'general_discount_amount')::numeric, 0), p_data->'general_discount',
            left(coalesce(nullif(btrim(p_data->>'nome_arquivo'), ''), 'Orçamento'), 200), p_data->'measurements', 'pending',
            left(coalesce(nullif(btrim(p_data->>'proposal_option_name'), ''), 'Opção 1'), 80),
            CASE WHEN jsonb_typeof(p_data->'payment_config') = 'object' THEN p_data->'payment_config' END
        ) RETURNING id INTO v_pdf_id;
        INSERT INTO public.whatsapp_intern_proposals (saved_pdf_id, organization_id, client_id) VALUES (v_pdf_id, p_organization_id, p_client_id);
    ELSE
        SELECT * INTO v_tracked FROM public.whatsapp_intern_proposals WHERE saved_pdf_id = v_pdf_id AND organization_id = p_organization_id;
        IF v_tracked.saved_pdf_id IS NULL THEN RAISE EXCEPTION 'Esta proposta não foi criada pela estagiária: mude pelo app'; END IF;
        SELECT status INTO v_status FROM public.saved_pdfs WHERE id = v_pdf_id;
        IF v_status = 'approved' THEN RAISE EXCEPTION 'O cliente já aprovou esta proposta: mudanças só pelo app'; END IF;
        UPDATE public.saved_pdfs SET
            client_name = v_client_name, total_preco = v_total, total_m2 = v_m2, subtotal = (p_data->>'subtotal')::numeric,
            general_discount_amount = coalesce((p_data->>'general_discount_amount')::numeric, 0), general_discount = p_data->'general_discount',
            nome_arquivo = left(coalesce(nullif(btrim(p_data->>'nome_arquivo'), ''), nome_arquivo), 200), measurements = p_data->'measurements',
            payment_config = CASE WHEN jsonb_typeof(p_data->'payment_config') = 'object' THEN p_data->'payment_config' ELSE payment_config END,
            expiration_date = greatest(expiration_date, v_expires), status = 'pending',
            follow_up_revision = coalesce(follow_up_revision, 0) + 1
        WHERE id = v_pdf_id;
        UPDATE public.whatsapp_intern_proposals SET updated_at = now() WHERE saved_pdf_id = v_pdf_id;
        SELECT * INTO v_portal FROM public.proposal_portals WHERE id = v_tracked.portal_id AND status <> 'revoked';
    END IF;

    -- Link da página do cliente: o mesmo da proposta, mesmo depois das correções.
    IF v_portal.id IS NULL THEN
        INSERT INTO public.proposal_portals (organization_id, client_id, created_by, expires_at)
        VALUES (p_organization_id, p_client_id, p_created_by, v_expires)
        RETURNING * INTO v_portal;
        INSERT INTO public.proposal_portal_items (portal_id, saved_pdf_id, position) VALUES (v_portal.id, v_pdf_id, 0);
        UPDATE public.whatsapp_intern_proposals SET portal_id = v_portal.id WHERE saved_pdf_id = v_pdf_id;
    ELSE
        UPDATE public.proposal_portals SET last_activity_at = now(), updated_at = now(), expires_at = greatest(expires_at, v_expires)
        WHERE id = v_portal.id RETURNING * INTO v_portal;
    END IF;

    RETURN jsonb_build_object(
        'saved_pdf_id', v_pdf_id, 'portal_id', v_portal.id, 'share_code', v_portal.share_code, 'token', v_portal.token,
        'expires_at', v_portal.expires_at, 'client_name', v_client_name, 'owner_id', v_owner, 'created', p_saved_pdf_id IS NULL
    );
END;
$$;

-- Arquivo do PDF (já no Storage, na pasta do dono) da proposta da estagiária.
-- Devolve o caminho do arquivo anterior, para a ponte apagar.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_intern_proposal_pdf(p_organization_id uuid, p_saved_pdf_id integer, p_pdf_path text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
    v_old text;
BEGIN
    SELECT owner_id INTO v_owner FROM public.organizations WHERE id = p_organization_id;
    IF NOT EXISTS (SELECT 1 FROM public.whatsapp_intern_proposals WHERE saved_pdf_id = p_saved_pdf_id AND organization_id = p_organization_id) THEN
        RAISE EXCEPTION 'Esta proposta não foi criada pela estagiária';
    END IF;
    IF p_pdf_path IS NULL OR p_pdf_path !~ ('^' || v_owner::text || '/[0-9a-f-]{36}\.pdf$') THEN RAISE EXCEPTION 'Arquivo inválido'; END IF;
    SELECT pdf_path INTO v_old FROM public.saved_pdfs WHERE id = p_saved_pdf_id;
    UPDATE public.saved_pdfs SET pdf_path = p_pdf_path, pdf_blob = NULL, archived_at = NULL WHERE id = p_saved_pdf_id;
    UPDATE public.proposal_portals SET last_activity_at = now() WHERE id IN (SELECT portal_id FROM public.proposal_portal_items WHERE saved_pdf_id = p_saved_pdf_id);
    RETURN jsonb_build_object('old_path', v_old);
END;
$$;

-- Apaga a proposta da estagiária (e desliga o link). Proposta aprovada ou já na agenda
-- fica: essa só pelo app. Devolve o caminho do PDF, para a ponte apagar.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_intern_proposal_delete(p_organization_id uuid, p_saved_pdf_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pdf public.saved_pdfs%ROWTYPE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.whatsapp_intern_proposals WHERE saved_pdf_id = p_saved_pdf_id AND organization_id = p_organization_id) THEN
        RAISE EXCEPTION 'Esta proposta não foi criada pela estagiária: apague pelo app';
    END IF;
    SELECT * INTO v_pdf FROM public.saved_pdfs WHERE id = p_saved_pdf_id;
    IF v_pdf.status = 'approved' THEN RAISE EXCEPTION 'O cliente já aprovou esta proposta: só pelo app'; END IF;
    IF v_pdf.agendamento_id IS NOT NULL OR EXISTS (
        SELECT 1 FROM public.agendamentos a WHERE a.pdf_id = p_saved_pdf_id OR p_saved_pdf_id = ANY(coalesce(a.pdf_ids, ARRAY[]::integer[]))
    ) THEN
        RAISE EXCEPTION 'Esta proposta está na agenda: só pelo app';
    END IF;
    UPDATE public.proposal_portals SET status = 'revoked', updated_at = now()
    WHERE id IN (SELECT portal_id FROM public.proposal_portal_items WHERE saved_pdf_id = p_saved_pdf_id);
    DELETE FROM public.saved_pdfs WHERE id = p_saved_pdf_id;
    RETURN jsonb_build_object('pdf_path', v_pdf.pdf_path);
END;
$$;

-- Só o servidor (service_role). O Supabase concede EXECUTE a anon e authenticated por
-- padrão: revogar só de PUBLIC não basta.
REVOKE ALL ON FUNCTION public.whatsapp_bridge_intern_client_ok(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_intern_validity_days(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_intern_context(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_intern_client_save(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_intern_proposal_save(uuid, uuid, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_intern_proposal_pdf(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_intern_proposal_delete(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_intern_client_ok(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_intern_validity_days(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_intern_context(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_intern_client_save(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_intern_proposal_save(uuid, uuid, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_intern_proposal_pdf(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_intern_proposal_delete(uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
