-- =====================================================
-- CORRIGIR RLS PARA ADMIN VER TODOS OS PERFIS
-- Execute no Supabase SQL Editor
-- =====================================================

-- 1. Verificar políticas atuais na tabela profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- 2. Remover políticas antigas que podem estar conflitando
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;

-- 3. Criar novas políticas corretas

-- Política: Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Política: Admins podem ver TODOS os perfis
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política: Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Política: Admins podem atualizar qualquer perfil
CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- 4. Verificar se o usuário admin tem role = 'admin'
SELECT id, email, role FROM profiles WHERE email = 'windowfilm.br@gmail.com';

-- 5. Se não tiver role admin, atualizar
UPDATE profiles SET role = 'admin' WHERE email = 'windowfilm.br@gmail.com';

-- 6. Testar - deve retornar todos os perfis agora
SELECT COUNT(*) as total_profiles FROM profiles;
