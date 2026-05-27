-- ============================================
-- TABELA: standalone_expenses
-- Despesas avulsas sem obrigar cliente, proposta ou servico
-- ============================================

CREATE TABLE IF NOT EXISTS standalone_expenses (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    expense_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    category TEXT NOT NULL DEFAULT 'other',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    payment_method TEXT,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    proposal_id INTEGER REFERENCES saved_pdfs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_standalone_expenses_user_id ON standalone_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_standalone_expenses_organization_id ON standalone_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_standalone_expenses_expense_date ON standalone_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_standalone_expenses_category ON standalone_expenses(category);
CREATE INDEX IF NOT EXISTS idx_standalone_expenses_client_id ON standalone_expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_standalone_expenses_proposal_id ON standalone_expenses(proposal_id);

ALTER TABLE standalone_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "standalone_expenses_org_select" ON standalone_expenses;
DROP POLICY IF EXISTS "standalone_expenses_org_insert" ON standalone_expenses;
DROP POLICY IF EXISTS "standalone_expenses_org_update" ON standalone_expenses;
DROP POLICY IF EXISTS "standalone_expenses_org_delete" ON standalone_expenses;

CREATE POLICY "standalone_expenses_org_select" ON standalone_expenses
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "standalone_expenses_org_insert" ON standalone_expenses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "standalone_expenses_org_update" ON standalone_expenses
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

CREATE POLICY "standalone_expenses_org_delete" ON standalone_expenses
    FOR DELETE
    USING (
        auth.uid() = user_id
        OR organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION update_standalone_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_standalone_expenses_updated_at ON standalone_expenses;
CREATE TRIGGER trigger_standalone_expenses_updated_at
    BEFORE UPDATE ON standalone_expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_standalone_expenses_updated_at();
