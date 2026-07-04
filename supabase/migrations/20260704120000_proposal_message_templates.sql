-- Modelos de mensagem da proposta, compartilhados globalmente pela organizacao.
-- Antes ficavam so no localStorage (por navegador); agora sao editaveis,
-- renomeaveis e criaveis, valendo para todos os clientes/colaboradores da empresa.

CREATE TABLE IF NOT EXISTS proposal_message_templates (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_message_templates_user_id ON proposal_message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_proposal_message_templates_organization_id ON proposal_message_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposal_message_templates_sort ON proposal_message_templates(organization_id, sort_order);

ALTER TABLE proposal_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposal_message_templates_org_select" ON proposal_message_templates;
DROP POLICY IF EXISTS "proposal_message_templates_org_insert" ON proposal_message_templates;
DROP POLICY IF EXISTS "proposal_message_templates_org_update" ON proposal_message_templates;
DROP POLICY IF EXISTS "proposal_message_templates_org_delete" ON proposal_message_templates;

-- Leitura/edicao valem para toda a organizacao (modelos sao globais da empresa).
CREATE POLICY "proposal_message_templates_org_select" ON proposal_message_templates
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "proposal_message_templates_org_insert" ON proposal_message_templates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proposal_message_templates_org_update" ON proposal_message_templates
    FOR UPDATE
    USING (
        auth.uid() = user_id
        OR organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        OR organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "proposal_message_templates_org_delete" ON proposal_message_templates
    FOR DELETE
    USING (
        auth.uid() = user_id
        OR organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION update_proposal_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_proposal_message_templates_updated_at ON proposal_message_templates;
CREATE TRIGGER trigger_proposal_message_templates_updated_at
    BEFORE UPDATE ON proposal_message_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_proposal_message_templates_updated_at();
