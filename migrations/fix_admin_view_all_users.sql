-- =====================================================
-- FIX: ADMIN VER TODOS OS USUÁRIOS
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1. VERIFICAR A SITUAÇÃO ATUAL
-- =====================================================

-- Ver quantos usuários existem no auth.users vs profiles
SELECT 
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM profiles) as total_profiles;

-- Ver usuários que estão no auth.users mas NÃO têm profile
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = u.id
)
ORDER BY u.created_at DESC;

-- =====================================================
-- 2. SINCRONIZAR AUTH.USERS COM PROFILES
-- Cria profile para usuários que não têm
-- =====================================================

INSERT INTO profiles (id, email, role, approved, created_at)
SELECT 
    u.id,
    u.email,
    'user',
    false,  -- Novos usuários começam como não aprovados
    COALESCE(u.created_at, NOW())
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. AJUSTAR POLÍTICAS RLS PARA ADMIN VER TODOS
-- =====================================================

-- Remover políticas antigas que podem conflitar
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;

-- Criar política que permite:
-- 1. Usuário ver seu próprio perfil
-- 2. Admin (por email ou role) ver TODOS os perfis
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT
    USING (
        -- Usuário pode ver seu próprio perfil
        auth.uid() = id
        OR
        -- Admin por role pode ver todos
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        -- Admin por email pode ver todos (emails específicos)
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() 
            AND email IN ('windowfilm.br@gmail.com', 'windowfilm.app@gmail.com')
        )
    );

-- Política para UPDATE - apenas admin ou próprio usuário
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "profiles_update_policy" ON profiles
    FOR UPDATE
    USING (
        auth.uid() = id
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() 
            AND email IN ('windowfilm.br@gmail.com', 'windowfilm.app@gmail.com')
        )
    );

-- =====================================================
-- 4. CRIAR TRIGGER PARA SINCRONIZAÇÃO AUTOMÁTICA
-- Quando um novo usuário é criado no auth.users,
-- cria automaticamente um profile
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, approved, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        'user',
        false,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 5. VERIFICAR RESULTADO FINAL
-- =====================================================

-- Agora deve mostrar TODOS os usuários
SELECT 
    p.id,
    p.email,
    p.role,
    p.approved,
    p.created_at,
    CASE 
        WHEN p.email IN ('windowfilm.br@gmail.com', 'windowfilm.app@gmail.com') THEN 'ADMIN (email)'
        WHEN p.role = 'admin' THEN 'ADMIN (role)'
        ELSE 'USER'
    END as tipo_usuario
FROM profiles p
ORDER BY p.created_at DESC;

-- Verificar se sincronização funcionou
SELECT 
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM auth.users) - (SELECT COUNT(*) FROM profiles) as faltando_sincronizar;
