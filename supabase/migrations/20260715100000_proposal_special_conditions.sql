-- Condicoes comerciais com validade no portal publico de propostas.

ALTER TABLE proposal_portal_items
    ADD COLUMN IF NOT EXISTS condition_original_value numeric,
    ADD COLUMN IF NOT EXISTS condition_final_value numeric,
    ADD COLUMN IF NOT EXISTS condition_discount_amount numeric,
    ADD COLUMN IF NOT EXISTS condition_discount_percent numeric,
    ADD COLUMN IF NOT EXISTS condition_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS condition_updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS condition_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE proposal_portal_messages
    ADD COLUMN IF NOT EXISTS condition_value numeric;

ALTER TABLE proposal_portal_messages
    DROP CONSTRAINT IF EXISTS proposal_portal_messages_kind_check;
ALTER TABLE proposal_portal_messages
    ADD CONSTRAINT proposal_portal_messages_kind_check
    CHECK (kind IN (
        'message', 'approved', 'rejected', 'negotiation',
        'condition_extended', 'condition_updated'
    ));

-- Links existentes passam a usar o prazo do portal como prazo inicial do desconto.
UPDATE proposal_portal_items item
SET
    condition_original_value = GREATEST(
        COALESCE(pdf.subtotal, 0),
        COALESCE(pdf.total_preco, 0) + COALESCE(pdf.general_discount_amount, 0),
        COALESCE(pdf.total_preco, 0)
    ),
    condition_final_value = COALESCE(pdf.total_preco, 0),
    condition_discount_amount = GREATEST(
        0,
        GREATEST(
            COALESCE(pdf.subtotal, 0),
            COALESCE(pdf.total_preco, 0) + COALESCE(pdf.general_discount_amount, 0),
            COALESCE(pdf.total_preco, 0)
        ) - COALESCE(pdf.total_preco, 0)
    ),
    condition_discount_percent = CASE
        WHEN GREATEST(
            COALESCE(pdf.subtotal, 0),
            COALESCE(pdf.total_preco, 0) + COALESCE(pdf.general_discount_amount, 0),
            COALESCE(pdf.total_preco, 0)
        ) > 0 THEN round((
            GREATEST(
                0,
                GREATEST(
                    COALESCE(pdf.subtotal, 0),
                    COALESCE(pdf.total_preco, 0) + COALESCE(pdf.general_discount_amount, 0),
                    COALESCE(pdf.total_preco, 0)
                ) - COALESCE(pdf.total_preco, 0)
            ) / GREATEST(
                COALESCE(pdf.subtotal, 0),
                COALESCE(pdf.total_preco, 0) + COALESCE(pdf.general_discount_amount, 0),
                COALESCE(pdf.total_preco, 0)
            )
        ) * 100, 2)
        ELSE NULL
    END,
    condition_expires_at = portal.expires_at,
    condition_updated_at = now()
FROM proposal_portals portal,
     saved_pdfs pdf
WHERE portal.id = item.portal_id
  AND pdf.id = item.saved_pdf_id
  AND COALESCE(pdf.general_discount_amount, 0) > 0
  AND COALESCE(pdf.general_discount->>'operation', 'discount') = 'discount'
  AND item.condition_expires_at IS NULL;

CREATE OR REPLACE FUNCTION create_proposal_portal(
    p_pdf_ids integer[],
    p_expires_at timestamptz
)
RETURNS TABLE (portal_id uuid, portal_token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_org_id uuid;
    v_client_id integer;
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

    SELECT min(sp.client_id) INTO v_client_id
    FROM saved_pdfs sp
    JOIN profiles owner_profile ON owner_profile.id = sp.user_id
    WHERE sp.id = ANY(p_pdf_ids)
      AND owner_profile.organization_id = v_org_id;

    IF v_client_id IS NULL OR (
        SELECT count(*) FROM saved_pdfs sp
        JOIN profiles owner_profile ON owner_profile.id = sp.user_id
        WHERE sp.id = ANY(p_pdf_ids)
          AND sp.client_id = v_client_id
          AND owner_profile.organization_id = v_org_id
    ) <> cardinality(p_pdf_ids) THEN
        RAISE EXCEPTION 'As propostas precisam pertencer ao mesmo cliente e organizacao';
    END IF;

    INSERT INTO proposal_portals (organization_id, client_id, created_by, expires_at)
    VALUES (v_org_id, v_client_id, auth.uid(), p_expires_at)
    RETURNING * INTO v_portal;

    INSERT INTO proposal_portal_items (
        portal_id,
        saved_pdf_id,
        position,
        condition_original_value,
        condition_final_value,
        condition_discount_amount,
        condition_discount_percent,
        condition_expires_at,
        condition_updated_at
    )
    SELECT
        v_portal.id,
        pdf.id,
        selected.ordinality::integer - 1,
        CASE WHEN discount.has_discount THEN discount.original_value END,
        CASE WHEN discount.has_discount THEN COALESCE(pdf.total_preco, 0) END,
        CASE WHEN discount.has_discount THEN discount.discount_amount END,
        CASE WHEN discount.has_discount AND discount.original_value > 0
            THEN round((discount.discount_amount / discount.original_value) * 100, 2)
        END,
        CASE WHEN discount.has_discount THEN p_expires_at END,
        CASE WHEN discount.has_discount THEN now() END
    FROM unnest(p_pdf_ids) WITH ORDINALITY AS selected(pdf_id, ordinality)
    JOIN saved_pdfs pdf ON pdf.id = selected.pdf_id
    CROSS JOIN LATERAL (
        SELECT
            COALESCE(pdf.general_discount_amount, 0) > 0
                AND COALESCE(pdf.general_discount->>'operation', 'discount') = 'discount' AS has_discount,
            GREATEST(
                COALESCE(pdf.subtotal, 0),
                COALESCE(pdf.total_preco, 0) + COALESCE(pdf.general_discount_amount, 0),
                COALESCE(pdf.total_preco, 0)
            )::numeric AS original_value,
            GREATEST(
                0,
                GREATEST(
                    COALESCE(pdf.subtotal, 0),
                    COALESCE(pdf.total_preco, 0) + COALESCE(pdf.general_discount_amount, 0),
                    COALESCE(pdf.total_preco, 0)
                ) - COALESCE(pdf.total_preco, 0)
            )::numeric AS discount_amount
    ) discount;

    RETURN QUERY SELECT v_portal.id, v_portal.token, v_portal.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION update_proposal_portal_condition(
    p_portal_id uuid,
    p_saved_pdf_id integer,
    p_expires_at timestamptz,
    p_final_value numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_org_id uuid;
    v_item proposal_portal_items%ROWTYPE;
    v_original numeric;
    v_previous_final numeric;
    v_final numeric;
    v_amount numeric;
    v_kind text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;
    IF p_expires_at <= now() THEN
        RAISE EXCEPTION 'Escolha uma validade futura';
    END IF;

    SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();

    SELECT item.* INTO v_item
    FROM proposal_portal_items item
    JOIN proposal_portals portal ON portal.id = item.portal_id
    WHERE item.portal_id = p_portal_id
      AND item.saved_pdf_id = p_saved_pdf_id
      AND portal.organization_id = v_org_id;

    IF v_item.portal_id IS NULL THEN
        RAISE EXCEPTION 'Condicao nao encontrada';
    END IF;

    SELECT
        COALESCE(
            v_item.condition_original_value,
            GREATEST(
                COALESCE(pdf.subtotal, 0),
                COALESCE(pdf.total_preco, 0) + COALESCE(pdf.general_discount_amount, 0),
                COALESCE(pdf.total_preco, 0)
            )
        ),
        COALESCE(v_item.condition_final_value, pdf.total_preco, 0)
    INTO v_original, v_previous_final
    FROM saved_pdfs pdf
    WHERE pdf.id = p_saved_pdf_id;

    v_final := COALESCE(p_final_value, v_previous_final);
    IF v_final < 0 OR v_final > v_original THEN
        RAISE EXCEPTION 'O valor final precisa ficar entre zero e o valor original';
    END IF;

    v_amount := GREATEST(0, v_original - v_final);
    v_kind := CASE
        WHEN p_final_value IS NOT NULL AND p_final_value IS DISTINCT FROM v_previous_final
            THEN 'condition_updated'
        ELSE 'condition_extended'
    END;

    UPDATE proposal_portal_items
    SET
        condition_original_value = v_original,
        condition_final_value = v_final,
        condition_discount_amount = v_amount,
        condition_discount_percent = CASE WHEN v_original > 0 THEN round((v_amount / v_original) * 100, 2) END,
        condition_expires_at = p_expires_at,
        condition_updated_at = now(),
        condition_updated_by = auth.uid()
    WHERE portal_id = p_portal_id
      AND saved_pdf_id = p_saved_pdf_id;

    UPDATE proposal_portals
    SET
        expires_at = GREATEST(expires_at, p_expires_at),
        status = CASE WHEN status = 'expired' THEN 'active' ELSE status END,
        last_activity_at = now(),
        updated_at = now()
    WHERE id = p_portal_id;

    INSERT INTO proposal_portal_messages (
        portal_id,
        saved_pdf_id,
        sender_type,
        kind,
        body,
        condition_value,
        created_by
    ) VALUES (
        p_portal_id,
        p_saved_pdf_id,
        'company',
        v_kind,
        CASE
            WHEN v_kind = 'condition_updated' THEN 'A empresa atualizou a condicao especial.'
            ELSE 'A empresa prorrogou a condicao especial.'
        END,
        v_final,
        auth.uid()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION update_proposal_portal_condition(uuid, integer, timestamptz, numeric) TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'proposal_portal_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE proposal_portal_items;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
