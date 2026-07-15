-- Entregas push nativas para condicoes especiais proximas do vencimento.

CREATE TABLE IF NOT EXISTS public.proposal_condition_push_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id uuid NOT NULL REFERENCES public.proposal_portals(id) ON DELETE CASCADE,
    saved_pdf_id integer NOT NULL REFERENCES public.saved_pdfs(id) ON DELETE CASCADE,
    subscription_id uuid NOT NULL REFERENCES public.agenda_push_subscriptions(id) ON DELETE CASCADE,
    condition_expires_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message text,
    sent_at timestamptz,
    failed_at timestamptz,
    receipt_token uuid NOT NULL DEFAULT gen_random_uuid(),
    push_received_at timestamptz,
    notification_shown_at timestamptz,
    notification_clicked_at timestamptz,
    receipt_error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (portal_id, saved_pdf_id, subscription_id, condition_expires_at)
);

CREATE INDEX IF NOT EXISTS idx_proposal_condition_push_deliveries_subscription
    ON public.proposal_condition_push_deliveries(subscription_id);

CREATE INDEX IF NOT EXISTS idx_proposal_condition_push_deliveries_condition
    ON public.proposal_condition_push_deliveries(condition_expires_at, status);

ALTER TABLE public.proposal_condition_push_deliveries ENABLE ROW LEVEL SECURITY;

-- A tabela e operada apenas pelas Edge Functions com service role.
REVOKE ALL ON TABLE public.proposal_condition_push_deliveries FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
