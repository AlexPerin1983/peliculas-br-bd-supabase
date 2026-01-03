-- =====================================================
-- VERIFICAR E LIBERAR ACESSO ADMIN PARA VER TODOS USUÁRIOS
-- Execute no Supabase SQL Editor
-- =====================================================

-- 1. Verificar quantos usuários existem no auth.users
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- 2. Verificar quantos perfis existem
SELECT COUNT(*) as total_profiles FROM profiles;

-- 3. Ver todos os usuários do auth.users
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
ORDER BY created_at DESC;

-- =====================================================
-- CRIAR VIEW PARA ADMIN VER TODOS OS USUÁRIOS
-- =====================================================

-- Criar view que combina auth.users com profiles
CREATE OR REPLACE VIEW admin_users_view AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    p.approved,
    p.role,
    o.id as organization_id,
    o.name as organization_name,
    s.id as subscription_id,
    s.active_modules
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN organizations o ON (o.owner_id = u.id OR p.organization_id = o.id)
LEFT JOIN subscriptions s ON s.organization_id = o.id
ORDER BY u.created_at DESC;

-- Dar permissão para ler a view
GRANT SELECT ON admin_users_view TO authenticated;

-- =====================================================
-- AJUSTAR POLÍTICA RLS PARA ADMIN VER TODOS OS PERFIS
-- =====================================================

-- Permitir que admins vejam todos os perfis
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
CREATE POLICY "Admin can view all profiles" ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- CRIAR FUNÇÃO PARA SINCRONIZAR AUTH.USERS COM PROFILES
-- =====================================================

-- Garante que todos os usuários de auth.users tenham um perfil
CREATE OR REPLACE FUNCTION sync_auth_users_to_profiles()
RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER := 0;
BEGIN
    INSERT INTO profiles (id, email, role, approved, created_at)
    SELECT 
        u.id,
        u.email,
        'user',
        false,
        u.created_at
    FROM auth.users u
    WHERE NOT EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = u.id
    );
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar sincronização
SELECT sync_auth_users_to_profiles() as profiles_criados;

-- Verificar resultado final
SELECT 
    p.id,
    p.email,
    p.role,
    p.approved,
    p.created_at
FROM profiles p
ORDER BY p.created_at DESC;
