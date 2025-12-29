-- =====================================================
-- RECONSTRUÇÃO COMPLETA - ORDEM CORRIGIDA
-- Cole este SQL inteiro no Supabase SQL Editor e clique Run
-- =====================================================

-- Passo 1: PRIMEIRO remover referências de profiles
UPDATE profiles SET organization_id = NULL;

-- Passo 2: DEPOIS limpar organization_members
DELETE FROM organization_members;

-- Passo 3: SÓ ENTÃO deletar organizations
DELETE FROM organizations;

-- Passo 4: Criar organização para o admin principal
INSERT INTO organizations (id, name, owner_id)
SELECT 
    gen_random_uuid(),
    p.email,
    p.id
FROM profiles p 
WHERE p.email = 'windowfilm.br@gmail.com';

-- Passo 5: Atualizar profile do admin com organization_id
UPDATE profiles 
SET organization_id = (SELECT id FROM organizations LIMIT 1)
WHERE email = 'windowfilm.br@gmail.com';

-- Passo 6: Criar registro de membro owner para o admin
INSERT INTO organization_members (organization_id, user_id, email, role, status, joined_at)
SELECT 
    p.organization_id,
    p.id,
    p.email,
    'owner',
    'active',
    now()
FROM profiles p 
WHERE p.email = 'windowfilm.br@gmail.com';

-- Passo 7: Convidar o colaborador (se existir profile)
INSERT INTO organization_members (organization_id, user_id, email, role, status, joined_at)
SELECT 
    (SELECT organization_id FROM profiles WHERE email = 'windowfilm.br@gmail.com'),
    p.id,
    p.email,
    'member',
    'active',
    now()
FROM profiles p 
WHERE p.email = 'alexlacerdaoficial@gmail.com';

-- Passo 8: Atualizar organization_id do colaborador (se existir)
UPDATE profiles 
SET organization_id = (SELECT organization_id FROM profiles WHERE email = 'windowfilm.br@gmail.com'),
    approved = true
WHERE email = 'alexlacerdaoficial@gmail.com';

-- Verificação final
SELECT 'ORGANIZATIONS' as tabela, id, name, owner_id FROM organizations;
SELECT 'PROFILES' as tabela, id, email, approved, organization_id FROM profiles;
SELECT 'MEMBERS' as tabela, email, role, status, user_id FROM organization_members;
