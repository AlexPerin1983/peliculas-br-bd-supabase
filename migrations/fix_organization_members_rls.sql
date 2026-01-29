-- =====================================================
-- FIX COMPLETO: ORGANIZATION_MEMBERS + OWNER
-- Execute no SQL Editor do Supabase
-- =====================================================

-- Este script:
-- 1. Corrige recursão infinita em organization_members
-- 2. Garante que donos de organizações tenham acesso ao convite

-- =====================================================
-- 1. GARANTIR QUE is_admin EXISTS
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_email TEXT;
    user_role TEXT;
BEGIN
    SELECT email INTO user_email 
    FROM auth.users 
    WHERE id = auth.uid();
    
    IF user_email IN ('windowfilm.br@gmail.com', 'windowfilm.app@gmail.com') THEN
        RETURN TRUE;
    END IF;
    
    SELECT role INTO user_role
    FROM profiles
    WHERE id = auth.uid();
    
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 2. CRIAR FUNÇÃO PARA VERIFICAR SE É OWNER
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_organization_owner(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organizations
        WHERE id = org_id AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função para verificar se usuário é owner de QUALQUER organização
CREATE OR REPLACE FUNCTION public.is_any_organization_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organizations
        WHERE owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 3. CORRIGIR POLÍTICAS DE ORGANIZATION_MEMBERS
-- =====================================================

-- Remover TODAS as políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Members can view their organization" ON organization_members;
DROP POLICY IF EXISTS "Owner can manage members" ON organization_members;
DROP POLICY IF EXISTS "Owner can insert members" ON organization_members;
DROP POLICY IF EXISTS "Owner can update members" ON organization_members;
DROP POLICY IF EXISTS "Owner can delete members" ON organization_members;
DROP POLICY IF EXISTS "System can read pending invites" ON organization_members;
DROP POLICY IF EXISTS "System can update invites on user join" ON organization_members;
DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON organization_members;

-- SELECT: membro da org, owner da org, ou admin
CREATE POLICY "organization_members_select_policy" ON organization_members
    FOR SELECT
    USING (
        -- É o próprio membro
        user_id = auth.uid()
        OR
        -- É owner da organização
        public.is_organization_owner(organization_id)
        OR
        -- É admin do sistema
        public.is_admin()
    );

-- INSERT: owner da org ou admin
CREATE POLICY "organization_members_insert_policy" ON organization_members
    FOR INSERT
    WITH CHECK (
        public.is_organization_owner(organization_id)
        OR
        public.is_admin()
    );

-- UPDATE: owner ou admin
CREATE POLICY "organization_members_update_policy" ON organization_members
    FOR UPDATE
    USING (
        public.is_organization_owner(organization_id)
        OR
        public.is_admin()
    );

-- DELETE: owner ou admin
CREATE POLICY "organization_members_delete_policy" ON organization_members
    FOR DELETE
    USING (
        public.is_organization_owner(organization_id)
        OR
        public.is_admin()
    );

-- Habilitar RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CORRIGIR POLÍTICAS DE ORGANIZATION_INVITES
-- =====================================================

DROP POLICY IF EXISTS "organization_invites_select_policy" ON organization_invites;
DROP POLICY IF EXISTS "organization_invites_insert_policy" ON organization_invites;
DROP POLICY IF EXISTS "organization_invites_update_policy" ON organization_invites;
DROP POLICY IF EXISTS "Owners can manage invites" ON organization_invites;
DROP POLICY IF EXISTS "Anyone can read active invites" ON organization_invites;
DROP POLICY IF EXISTS "Public can read active invites" ON organization_invites;
DROP POLICY IF EXISTS "Owners can manage organization invites" ON organization_invites;
DROP POLICY IF EXISTS "Anyone can validate active invite codes" ON organization_invites;

-- SELECT: qualquer um pode ler convites ativos (para resgate)
CREATE POLICY "organization_invites_select_policy" ON organization_invites
    FOR SELECT
    USING (
        -- Convites ativos podem ser lidos por qualquer um (para resgate)
        is_active = true
        OR
        -- Owner da org pode ver todos os convites
        public.is_organization_owner(organization_id)
        OR
        -- Admin pode ver todos
        public.is_admin()
    );

-- INSERT: owner ou admin
CREATE POLICY "organization_invites_insert_policy" ON organization_invites
    FOR INSERT
    WITH CHECK (
        public.is_organization_owner(organization_id)
        OR
        public.is_admin()
    );

-- UPDATE: owner ou admin ou convite ativo (para incrementar contador)
CREATE POLICY "organization_invites_update_policy" ON organization_invites
    FOR UPDATE
    USING (
        public.is_organization_owner(organization_id)
        OR
        public.is_admin()
        OR
        -- Permitir atualização durante resgate de convite
        is_active = true
    );

-- Habilitar RLS
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. SINCRONIZAR OWNERS COM ORGANIZATION_MEMBERS
-- Garante que todo owner de organização também está em organization_members
-- =====================================================

INSERT INTO organization_members (organization_id, user_id, email, role, status, joined_at)
SELECT 
    o.id,
    o.owner_id,
    p.email,
    'owner',
    'active',
    NOW()
FROM organizations o
JOIN profiles p ON p.id = o.owner_id
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = o.id AND om.user_id = o.owner_id
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. VERIFICAÇÃO
-- =====================================================

SELECT 'Políticas organization_members corrigidas!' as status;

-- Ver owners e suas organizações
SELECT 
    o.id as org_id,
    o.name as org_name,
    o.owner_id,
    p.email as owner_email,
    om.role as member_role,
    om.status as member_status
FROM organizations o
JOIN profiles p ON p.id = o.owner_id
LEFT JOIN organization_members om ON om.organization_id = o.id AND om.user_id = o.owner_id;
