-- Atualiza um link de proposta já enviado, mantendo o mesmo endereço e a conversa:
-- troca as propostas mostradas (ex.: versão nova do orçamento) e a validade.
-- Mesmas checagens do create_proposal_portal: só propostas da organização e do
-- mesmo cliente do link. Links aprovados, recusados ou encerrados não mudam.

CREATE OR REPLACE FUNCTION refresh_proposal_portal(
    p_portal_id uuid,
    p_pdf_ids integer[],
    p_expires_at timestamptz
)
RETURNS TABLE (portal_id uuid, portal_token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
DECLARE
    v_org_id uuid;
    v_portal proposal_portals%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF p_pdf_ids IS NULL OR cardinality(p_pdf_ids) = 0 THEN
        RAISE EXCEPTION 'Selecione pelo menos uma proposta';
    END IF;

    IF p_expires_at <= now() THEN
        RAISE EXCEPTION 'A validade precisa estar no futuro';
    END IF;

    SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Organizacao nao encontrada';
    END IF;

    SELECT * INTO v_portal
    FROM proposal_portals
    WHERE id = p_portal_id
      AND organization_id = v_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Link nao encontrado';
    END IF;

    IF v_portal.status IN ('approved', 'rejected', 'revoked') THEN
        RAISE EXCEPTION 'Este link ja foi respondido ou encerrado. Crie um link novo.';
    END IF;

    IF (
        SELECT count(*) FROM saved_pdfs sp
        JOIN profiles owner_profile ON owner_profile.id = sp.user_id
        WHERE sp.id = ANY(p_pdf_ids)
          AND sp.client_id = v_portal.client_id
          AND owner_profile.organization_id = v_org_id
    ) <> cardinality(p_pdf_ids) THEN
        RAISE EXCEPTION 'As propostas precisam pertencer ao mesmo cliente do link';
    END IF;

    DELETE FROM proposal_portal_items WHERE proposal_portal_items.portal_id = v_portal.id;

    INSERT INTO proposal_portal_items (portal_id, saved_pdf_id, position)
    SELECT v_portal.id, pdf_id, ordinality::integer - 1
    FROM unnest(p_pdf_ids) WITH ORDINALITY AS selected(pdf_id, ordinality);

    UPDATE proposal_portals
    SET expires_at = p_expires_at,
        status = 'active',
        updated_at = now(),
        last_activity_at = now()
    WHERE id = v_portal.id
    RETURNING * INTO v_portal;

    RETURN QUERY SELECT v_portal.id, v_portal.token, v_portal.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION refresh_proposal_portal(uuid, integer[], timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refresh_proposal_portal(uuid, integer[], timestamptz) TO authenticated;
