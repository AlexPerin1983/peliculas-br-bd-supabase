-- ===============================================
-- SCRIPT DE RESET COMPLETO DO BANCO DE DADOS
-- ===============================================
-- ATENÇÃO: Este script vai APAGAR TODOS OS DADOS!
-- Use com cuidado. Só execute após confirmar que quer limpar tudo.
-- Execute no Supabase SQL Editor
-- ===============================================

-- ===== PARTE 1: LIMPAR DADOS DAS TABELAS =====
-- (mantém a estrutura, só apaga os registros)

-- Tabelas de convites e membros
TRUNCATE TABLE organization_invites CASCADE;
TRUNCATE TABLE organization_members CASCADE;

-- Tabelas de assinaturas
TRUNCATE TABLE subscription_modules CASCADE;
TRUNCATE TABLE module_activations CASCADE;
TRUNCATE TABLE payment_history CASCADE;

-- Tabelas de negócio
TRUNCATE TABLE servicos_prestados CASCADE;
TRUNCATE TABLE agendamentos CASCADE;
TRUNCATE TABLE saved_pdfs CASCADE;
TRUNCATE TABLE clients CASCADE;
TRUNCATE TABLE films CASCADE;
TRUNCATE TABLE bobinas CASCADE;
TRUNCATE TABLE consumos CASCADE;
TRUNCATE TABLE retalhos CASCADE;
TRUNCATE TABLE locations CASCADE;
TRUNCATE TABLE location_measurements CASCADE;
TRUNCATE TABLE proposal_options CASCADE;

-- Tabelas de perfis e organizações
-- NOTA: Vamos limpar profiles mas manter o auth.users intacto
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE organizations CASCADE;

-- ===== PARTE 2: VERIFICAR AUTH.USERS =====
-- Liste os usuários que existem para escolher quem será o owner
SELECT id, email, created_at FROM auth.users ORDER BY created_at;

-- ===== PARTE 3: RECRIAR ORGANIZAÇÃO E OWNER =====
-- IMPORTANTE: Substitua os valores abaixo pelos corretos!
-- Copie o ID do seu usuário admin da listagem acima

-- Primeiro, insira sua organização
INSERT INTO organizations (id, name, owner_id)
VALUES (
    gen_random_uuid(),  -- Gera novo ID
    'Películas Brasil', -- Nome da sua empresa
    '199d1ab2-e4ca-491f-b704-5c129dbf5dcb'  -- SEU USER_ID (do auth.users)
)
RETURNING id, name, owner_id;

-- Agora copie o ID da organização retornado acima e use-o aqui:
-- (Execute este bloco DEPOIS de rodar o INSERT acima e pegar o ID)

/*
-- Após conseguir o organization_id, execute:

UPDATE profiles 
SET organization_id = 'COLE_ORGANIZATION_ID_AQUI', approved = true
WHERE id = '199d1ab2-e4ca-491f-b704-5c129dbf5dcb';

INSERT INTO organization_members (organization_id, user_id, email, role, status)
VALUES (
    'COLE_ORGANIZATION_ID_AQUI',
    '199d1ab2-e4ca-491f-b704-5c129dbf5dcb',
    'windowfilm.br@gmail.com',
    'owner',
    'active'
);

-- Ativar módulos básicos para o owner
INSERT INTO module_activations (user_id, subscription_module_id, is_active, activated_at)
SELECT 
    '199d1ab2-e4ca-491f-b704-5c129dbf5dcb',
    id,
    true,
    NOW()
FROM subscription_modules 
WHERE is_base = true
ON CONFLICT DO NOTHING;

*/

-- ===== VERIFICAÇÃO FINAL =====
SELECT 'organizations' as tabela, COUNT(*) as registros FROM organizations
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'films', COUNT(*) FROM films;
