-- Follow-up pricing is stored on the proposal, never on a message or link.
ALTER TABLE public.saved_pdfs
    ADD COLUMN follow_up_base_value numeric(14,2),
    ADD COLUMN follow_up_discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (follow_up_discount_percent BETWEEN 0 AND 100),
    ADD COLUMN follow_up_discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (follow_up_discount_amount >= 0),
    ADD COLUMN follow_up_discount_type text NOT NULL DEFAULT 'percentage' CHECK (follow_up_discount_type IN ('percentage', 'fixed')),
    ADD COLUMN follow_up_revision bigint NOT NULL DEFAULT 0;

CREATE TABLE public.proposal_follow_up_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    saved_pdf_id integer NOT NULL REFERENCES public.saved_pdfs(id) ON DELETE CASCADE,
    client_id bigint NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    discount_percent numeric(5,2) NOT NULL,
    discount_amount numeric(14,2) NOT NULL,
    base_value numeric(14,2) NOT NULL,
    value_before numeric(14,2) NOT NULL,
    value_after numeric(14,2) NOT NULL
);
ALTER TABLE public.proposal_follow_up_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY follow_up_history_read ON public.proposal_follow_up_history
    FOR SELECT TO authenticated USING (public.can_access_proposal_client(client_id));
GRANT SELECT ON public.proposal_follow_up_history TO authenticated;

-- The caller prepares a new PDF first. The row lock and snapshot comparison
-- commit its path, price and audit together, or reject a concurrent edit.
CREATE OR REPLACE FUNCTION public.apply_proposal_follow_up(
    p_pdf_id integer, p_discount numeric, p_type text,
    p_expected_snapshot jsonb, p_pdf_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
    v_pdf public.saved_pdfs%ROWTYPE;
    v_base numeric;
    v_amount numeric;
    v_percent numeric;
    v_final numeric;
BEGIN
    SELECT * INTO v_pdf FROM public.saved_pdfs WHERE id = p_pdf_id FOR UPDATE;
    IF auth.uid() IS NULL OR NOT FOUND OR NOT public.can_access_proposal_client(v_pdf.client_id) THEN
        RAISE EXCEPTION 'Proposta indisponível para este usuário';
    END IF;
    IF to_jsonb(v_pdf) IS DISTINCT FROM p_expected_snapshot THEN
        RAISE EXCEPTION 'A proposta mudou em outro aparelho. Reabra a proposta e confira o novo valor.';
    END IF;
    IF p_discount IS NULL OR p_discount::text IN ('NaN', 'Infinity', '-Infinity')
        OR p_discount < 0 OR p_type IS NULL OR p_type NOT IN ('percentage', 'fixed') THEN
        RAISE EXCEPTION 'Desconto inválido';
    END IF;
    v_base := round(COALESCE(v_pdf.follow_up_base_value, v_pdf.total_preco)::numeric, 2);
    IF v_base < 0 OR (p_type = 'percentage' AND p_discount > 100)
        OR (p_type = 'fixed' AND p_discount > v_base) THEN
        RAISE EXCEPTION 'Desconto fora do limite';
    END IF;
    v_amount := round(CASE WHEN p_type = 'percentage' THEN v_base * round(p_discount, 2) / 100 ELSE p_discount END, 2);
    v_final := round(v_base - v_amount, 2);
    v_percent := CASE WHEN p_type = 'percentage' THEN round(p_discount, 2)
        WHEN v_base > 0 THEN round(v_amount / v_base * 100, 2) ELSE 0 END;
    IF p_pdf_path IS NULL OR NOT EXISTS (
        SELECT 1 FROM storage.objects obj WHERE obj.bucket_id = 'pdfs' AND obj.name = p_pdf_path
        AND obj.owner_id = auth.uid()::text
    ) THEN
        RAISE EXCEPTION 'O PDF atualizado precisa estar salvo antes de aplicar o desconto';
    END IF;

    UPDATE public.saved_pdfs SET
        follow_up_base_value = CASE WHEN p_discount > 0 THEN v_base ELSE NULL END,
        follow_up_discount_percent = v_percent,
        follow_up_discount_amount = v_amount,
        follow_up_discount_type = p_type,
        follow_up_revision = follow_up_revision + 1,
        total_preco = v_final, pdf_path = p_pdf_path, pdf_blob = NULL, archived_at = NULL
    WHERE id = p_pdf_id;

    INSERT INTO public.proposal_follow_up_history
        (saved_pdf_id, client_id, created_by, discount_percent, discount_amount, base_value, value_before, value_after)
    VALUES (p_pdf_id, v_pdf.client_id, auth.uid(), v_percent, v_amount, v_base, v_pdf.total_preco, v_final);

    -- Clear legacy link-only prices for this proposal. All old and new links
    -- read the saved proposal; other proposals in a bundle are untouched.
    UPDATE public.proposal_portal_items SET
        condition_original_value = NULL, condition_final_value = NULL,
        condition_discount_amount = NULL, condition_discount_percent = NULL,
        condition_expires_at = NULL, condition_updated_at = now(), condition_updated_by = auth.uid()
    WHERE saved_pdf_id = p_pdf_id;
    UPDATE public.proposal_portals SET last_activity_at = clock_timestamp(), updated_at = now()
    WHERE id IN (SELECT portal_id FROM public.proposal_portal_items WHERE saved_pdf_id = p_pdf_id);

    RETURN (SELECT to_jsonb(pdf) FROM public.saved_pdfs pdf WHERE id = p_pdf_id);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_proposal_follow_up(integer, numeric, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_proposal_follow_up(integer, numeric, text, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
