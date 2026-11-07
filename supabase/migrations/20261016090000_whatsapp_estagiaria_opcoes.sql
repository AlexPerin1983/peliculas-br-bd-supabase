-- Estagiária IA: várias opções (uma película em cada, cada uma com o seu PDF) na mesma página
-- do cliente. A opção nova entra no link que a estagiária já criou para o cliente
-- (p_data.portal_id); apagar uma opção só desliga o link quando era a última.

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
    v_join uuid;
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

    -- Opção nova no link que já existe: só um link que a estagiária criou, desta empresa e deste cliente.
    IF v_pdf_id IS NULL AND coalesce(p_data->>'portal_id', '') ~ '^[0-9a-fA-F-]{36}$' THEN
        SELECT p.* INTO v_portal FROM public.proposal_portals p
        WHERE p.id = (p_data->>'portal_id')::uuid AND p.organization_id = p_organization_id AND p.client_id = p_client_id AND p.status <> 'revoked'
          AND EXISTS (SELECT 1 FROM public.whatsapp_intern_proposals w WHERE w.portal_id = p.id AND w.organization_id = p_organization_id);
        IF v_portal.id IS NULL THEN RAISE EXCEPTION 'O link desta proposta não existe mais: peça a proposta de novo'; END IF;
        v_join := v_portal.id;
    END IF;

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
        INSERT INTO public.whatsapp_intern_proposals (saved_pdf_id, organization_id, client_id, portal_id) VALUES (v_pdf_id, p_organization_id, p_client_id, v_join);
    ELSE
        SELECT * INTO v_tracked FROM public.whatsapp_intern_proposals WHERE saved_pdf_id = v_pdf_id AND organization_id = p_organization_id;
        IF v_tracked.saved_pdf_id IS NULL THEN RAISE EXCEPTION 'Esta proposta não foi criada pela estagiária: mude pelo app'; END IF;
        SELECT status INTO v_status FROM public.saved_pdfs WHERE id = v_pdf_id;
        IF v_status = 'approved' THEN RAISE EXCEPTION 'O cliente já aprovou esta proposta: mudanças só pelo app'; END IF;
        UPDATE public.saved_pdfs SET
            client_name = v_client_name, total_preco = v_total, total_m2 = v_m2, subtotal = (p_data->>'subtotal')::numeric,
            general_discount_amount = coalesce((p_data->>'general_discount_amount')::numeric, 0), general_discount = p_data->'general_discount',
            nome_arquivo = left(coalesce(nullif(btrim(p_data->>'nome_arquivo'), ''), nome_arquivo), 200), measurements = p_data->'measurements',
            proposal_option_name = left(coalesce(nullif(btrim(p_data->>'proposal_option_name'), ''), proposal_option_name), 80),
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
        IF v_join IS NOT NULL THEN
            INSERT INTO public.proposal_portal_items (portal_id, saved_pdf_id, position)
            SELECT v_portal.id, v_pdf_id, coalesce(max(position), -1) + 1 FROM public.proposal_portal_items WHERE portal_id = v_portal.id;
        END IF;
        UPDATE public.proposal_portals SET last_activity_at = now(), updated_at = now(), expires_at = greatest(expires_at, v_expires)
        WHERE id = v_portal.id RETURNING * INTO v_portal;
    END IF;

    RETURN jsonb_build_object(
        'saved_pdf_id', v_pdf_id, 'portal_id', v_portal.id, 'share_code', v_portal.share_code, 'token', v_portal.token,
        'expires_at', v_portal.expires_at, 'client_name', v_client_name, 'owner_id', v_owner, 'created', p_saved_pdf_id IS NULL
    );
END;
$$;

-- Apaga uma proposta (opção) da estagiária. O link só é desligado quando não sobra outra opção nele.
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
    UPDATE public.proposal_portals p SET status = 'revoked', updated_at = now()
    WHERE p.id IN (SELECT portal_id FROM public.proposal_portal_items WHERE saved_pdf_id = p_saved_pdf_id)
      AND NOT EXISTS (SELECT 1 FROM public.proposal_portal_items i WHERE i.portal_id = p.id AND i.saved_pdf_id <> p_saved_pdf_id);
    DELETE FROM public.saved_pdfs WHERE id = p_saved_pdf_id;
    RETURN jsonb_build_object('pdf_path', v_pdf.pdf_path);
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_bridge_intern_proposal_save(uuid, uuid, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_intern_proposal_delete(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_intern_proposal_save(uuid, uuid, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_intern_proposal_delete(uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
