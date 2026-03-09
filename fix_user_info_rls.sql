-- ===============================================
-- CORREÇÃO RLS: Acesso Compartilhado User Info
-- Permite que membros da mesma organização vejam e 
-- editem os dados da empresa (owner)
-- ===============================================

-- 1. Remover políticas antigas
DROP POLICY IF EXISTS "Users can view their own info" ON user_info;
DROP POLICY IF EXISTS "Users can insert their own info" ON user_info;
DROP POLICY IF EXISTS "Users can update their own info" ON user_info;

-- 2. Nova política de LEITURA:
-- Permite ver se for o próprio dono OU se for membro ativo da organização daquele dono
CREATE POLICY "Users and organization members can view info" ON user_info
FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id
        WHERE o.owner_id = user_info.user_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
);

-- 3. Nova política de ATUALIZAÇÃO:
-- Permite editar se for o próprio dono OU se for membro ativo (role admin ou owner)
CREATE POLICY "Users and organization members can update info" ON user_info
FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id
        WHERE o.owner_id = user_info.user_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
);

-- 4. Nova política de INSERÇÃO:
-- Apenas o próprio dono pode inserir no seu ID (normalmente)
-- Mas para facilitar, permitimos também se for membro (caso o dono ainda não tenha row)
CREATE POLICY "Users and organization members can insert info" ON user_info
FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id
        WHERE o.owner_id = user_id -- user_id aqui é o campo send na inserção
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
);
