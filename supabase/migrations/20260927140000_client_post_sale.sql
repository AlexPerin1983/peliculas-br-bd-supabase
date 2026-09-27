-- Pós-venda na ficha do cliente: pedidos de avaliação no Google e de indicação,
-- para não repetir o pedido e mostrar na linha do tempo.
CREATE TABLE IF NOT EXISTS public.client_follow_ups (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id integer NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    agendamento_id integer REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('review_request', 'referral_request')),
    channel text CHECK (channel IS NULL OR channel IN ('whatsapp', 'other')),
    note text,
    created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_follow_ups_client_idx ON public.client_follow_ups (client_id, created_at);

ALTER TABLE public.client_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_follow_ups_read ON public.client_follow_ups;
CREATE POLICY client_follow_ups_read ON public.client_follow_ups
    FOR SELECT TO authenticated USING (public.can_access_proposal_client(client_id));

DROP POLICY IF EXISTS client_follow_ups_insert ON public.client_follow_ups;
CREATE POLICY client_follow_ups_insert ON public.client_follow_ups
    FOR INSERT TO authenticated WITH CHECK (public.can_access_proposal_client(client_id) AND created_by = auth.uid());

GRANT SELECT, INSERT ON public.client_follow_ups TO authenticated;
