-- =====================================================
-- FIX: CORRIGIR TODAS AS POLÍTICAS RLS
-- Execute no SQL Editor do Supabase
-- =====================================================

-- Este script corrige a recursão infinita em todas as tabelas
-- e permite que admins gerenciem usuários, organizações e subscriptions

-- =====================================================
-- 1. FUNÇÃO is_admin JÁ EXISTE (do script anterior)
-- Vamos garantir que existe
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_email TEXT;
    user_role TEXT;
BEGIN
    -- Buscar email do usuário atual diretamente do auth.users
    SELECT email INTO user_email 
    FROM auth.users 
    WHERE id = auth.uid();
    
    -- Verificar se é admin por email
    IF user_email IN ('windowfilm.br@gmail.com', 'windowfilm.app@gmail.com') THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar se é admin por role (usando query direta sem RLS)
    SELECT role INTO user_role
    FROM profiles
    WHERE id = auth.uid();
    
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 2. POLÍTICAS PARA TABELA ORGANIZATIONS
-- =====================================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "Organizations are viewable by members" ON organizations;
DROP POLICY IF EXISTS "Organizations can be created by authenticated users" ON organizations;
DROP POLICY IF EXISTS "Organizations can be updated by owner" ON organizations;
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;

-- SELECT: dono da org, membros ou admin
CREATE POLICY "organizations_select_policy" ON organizations
    FOR SELECT
    USING (
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id AND user_id = auth.uid()
        )
        OR
        public.is_admin()
    );

-- INSERT: qualquer usuário autenticado OU admin
CREATE POLICY "organizations_insert_policy" ON organizations
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- UPDATE: dono ou admin
CREATE POLICY "organizations_update_policy" ON organizations
    FOR UPDATE
    USING (
        owner_id = auth.uid()
        OR
        public.is_admin()
    );

-- DELETE: apenas dono ou admin
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;
CREATE POLICY "organizations_delete_policy" ON organizations
    FOR DELETE
    USING (
        owner_id = auth.uid()
        OR
        public.is_admin()
    );

-- =====================================================
-- 3. POLÍTICAS PARA TABELA SUBSCRIPTIONS
-- =====================================================

DROP POLICY IF EXISTS "Subscriptions are viewable by organization members" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_select_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_policy" ON subscriptions;

-- SELECT: membros da org ou admin
CREATE POLICY "subscriptions_select_policy" ON subscriptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = subscriptions.organization_id
            AND o.owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = subscriptions.organization_id
            AND om.user_id = auth.uid()
        )
        OR
        public.is_admin()
    );

-- INSERT: dono da org ou admin
CREATE POLICY "subscriptions_insert_policy" ON subscriptions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_id
            AND (o.owner_id = auth.uid() OR public.is_admin())
        )
        OR
        public.is_admin()
    );

-- UPDATE: dono ou admin
CREATE POLICY "subscriptions_update_policy" ON subscriptions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = subscriptions.organization_id
            AND (o.owner_id = auth.uid() OR public.is_admin())
        )
        OR
        public.is_admin()
    );

-- =====================================================
-- 4. POLÍTICAS PARA TABELA MODULE_ACTIVATIONS
-- =====================================================

DROP POLICY IF EXISTS "module_activations_select_policy" ON module_activations;
DROP POLICY IF EXISTS "module_activations_insert_policy" ON module_activations;
DROP POLICY IF EXISTS "module_activations_update_policy" ON module_activations;

-- SELECT: membros da org ou admin
CREATE POLICY "module_activations_select_policy" ON module_activations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM subscriptions s
            JOIN organizations o ON o.id = s.organization_id
            WHERE s.id = module_activations.subscription_id
            AND o.owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM subscriptions s
            JOIN organization_members om ON om.organization_id = s.organization_id
            WHERE s.id = module_activations.subscription_id
            AND om.user_id = auth.uid()
        )
        OR
        public.is_admin()
    );

-- INSERT: admin pode ativar módulos
CREATE POLICY "module_activations_insert_policy" ON module_activations
    FOR INSERT
    WITH CHECK (
        public.is_admin()
        OR
        EXISTS (
            SELECT 1 FROM subscriptions s
            JOIN organizations o ON o.id = s.organization_id
            WHERE s.id = subscription_id
            AND o.owner_id = auth.uid()
        )
    );

-- UPDATE: admin ou dono
CREATE POLICY "module_activations_update_policy" ON module_activations
    FOR UPDATE
    USING (
        public.is_admin()
        OR
        EXISTS (
            SELECT 1 FROM subscriptions s
            JOIN organizations o ON o.id = s.organization_id
            WHERE s.id = module_activations.subscription_id
            AND o.owner_id = auth.uid()
        )
    );

-- =====================================================
-- 5. GARANTIR RLS HABILITADO
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_activations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. VERIFICAÇÃO
-- =====================================================

SELECT 'Políticas atualizadas com sucesso!' as status;

-- Testar se admin consegue ver tudo
SELECT public.is_admin() as sou_admin;

-- Ver organizações (admin deve ver todas)
SELECT id, name, owner_id FROM organizations LIMIT 5;

-- Ver subscriptions (admin deve ver todas)
SELECT id, organization_id, active_modules FROM subscriptions LIMIT 5;
