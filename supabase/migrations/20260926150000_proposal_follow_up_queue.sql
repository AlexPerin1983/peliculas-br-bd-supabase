-- Acompanhamento das propostas enviadas por link ("Para acompanhar hoje").
-- "Perdida" é interno da empresa: não muda o que o cliente vê nem impede que ele
-- aprove depois. O histórico de contatos alimenta a linha do tempo da proposta.

ALTER TABLE proposal_portals
    ADD COLUMN IF NOT EXISTS lost_at timestamptz,
    ADD COLUMN IF NOT EXISTS lost_reason text;

CREATE TABLE IF NOT EXISTS proposal_portal_follow_ups (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    portal_id uuid NOT NULL REFERENCES proposal_portals(id) ON DELETE CASCADE,
    -- contact: a empresa falou com o cliente; lost/reopened: marcou ou desfez "perdida".
    kind text NOT NULL CHECK (kind IN ('contact', 'lost', 'reopened')),
    -- Qual passo da cadência (lembrete, reforço de valor, vencimento...).
    step text,
    channel text CHECK (channel IS NULL OR channel IN ('whatsapp', 'call', 'other')),
    reason text,
    note text,
    created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_portal_follow_ups_portal_idx
    ON proposal_portal_follow_ups (portal_id, created_at);

ALTER TABLE proposal_portal_follow_ups ENABLE ROW LEVEL SECURITY;

-- Mesma regra dos itens do link: só a organização dona do link lê e registra.
DROP POLICY IF EXISTS proposal_portal_follow_ups_company_read ON proposal_portal_follow_ups;
CREATE POLICY proposal_portal_follow_ups_company_read ON proposal_portal_follow_ups
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM proposal_portals p
        WHERE p.id = portal_id
          AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS proposal_portal_follow_ups_company_insert ON proposal_portal_follow_ups;
CREATE POLICY proposal_portal_follow_ups_company_insert ON proposal_portal_follow_ups
FOR INSERT TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
        SELECT 1 FROM proposal_portals p
        WHERE p.id = portal_id
          AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
);

GRANT SELECT, INSERT ON proposal_portal_follow_ups TO authenticated;
