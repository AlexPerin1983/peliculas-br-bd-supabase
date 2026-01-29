-- =====================================================
-- FIX: CORRIGIR RECURSÃO INFINITA NA POLÍTICA RLS
-- Execute no SQL Editor do Supabase
-- =====================================================

-- O problema: a política de profiles consultava a própria tabela profiles
-- para verificar se o usuário é admin, causando recursão infinita.

-- SOLUÇÃO: Criar função SECURITY DEFINER que pode acessar profiles
-- sem passar pelo RLS

-- =====================================================
-- 1. CRIAR FUNÇÃO PARA VERIFICAR SE USUÁRIO É ADMIN
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
-- 2. REMOVER POLÍTICAS PROBLEMÁTICAS
-- =====================================================

DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- =====================================================
-- 3. CRIAR NOVAS POLÍTICAS USANDO A FUNÇÃO
-- =====================================================

-- Política SELECT: próprio perfil OU admin
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT
    USING (
        auth.uid() = id
        OR
        public.is_admin()
    );

-- Política UPDATE: próprio perfil OU admin
CREATE POLICY "profiles_update_policy" ON profiles
    FOR UPDATE
    USING (
        auth.uid() = id
        OR
        public.is_admin()
    );

-- Política INSERT: qualquer usuário autenticado pode criar seu perfil
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
CREATE POLICY "profiles_insert_policy" ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- =====================================================
-- 4. GARANTIR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. VERIFICAR SE FUNCIONOU
-- =====================================================

-- Testar a função
SELECT public.is_admin() as sou_admin;

-- Ver todos os profiles (deve funcionar agora!)
SELECT id, email, role, approved, created_at FROM profiles ORDER BY created_at DESC;
