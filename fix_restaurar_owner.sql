-- =====================================================
-- FIX V4: Restaurar usuário principal como owner da empresa
-- Execute este SQL no Supabase Dashboard
-- =====================================================

-- 1. DIAGNÓSTICO: Ver estado atual do seu perfil
SELECT 
    p.id,
    p.email,
    p.approved,
    p.organization_id,
    o.name as org_name,
    o.owner_id
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.approved = true
ORDER BY p.created_at;

-- 2. DIAGNÓSTICO: Ver se você tem registro em organization_members
SELECT 
    om.*,
    o.name as org_name
FROM organization_members om
LEFT JOIN organizations o ON om.organization_id = o.id
ORDER BY om.invited_at;

-- =====================================================
-- CORREÇÃO: Execute as queries abaixo uma a uma
-- Substitua 'SEU_EMAIL_AQUI' pelo seu email real
-- =====================================================

-- 3. Encontrar seu ID de usuário
SELECT id, email FROM profiles WHERE email = 'SEU_EMAIL_AQUI';

-- 4. Depois de ter o ID, verifique se você tem organização
-- Se não tiver, execute o passo 5

-- 5. CRIAR organização e membro owner para você (só se não existir)
-- Substitua os valores:
-- - 'SEU_USER_ID' pelo ID retornado no passo 3
-- - 'SEU_EMAIL' pelo seu email

/*
DO $$
DECLARE
    new_org_id UUID;
    user_id_var UUID := 'SEU_USER_ID'; -- substitua
    user_email TEXT := 'SEU_EMAIL'; -- substitua
BEGIN
    -- Verifica se já tem organização
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_id_var AND organization_id IS NOT NULL) THEN
        -- Cria organização
        INSERT INTO organizations (name, owner_id)
        VALUES (user_email, user_id_var)
        RETURNING id INTO new_org_id;
        
        -- Atualiza profile
        UPDATE profiles SET organization_id = new_org_id WHERE id = user_id_var;
        
        -- Cria membro owner
        INSERT INTO organization_members (organization_id, user_id, email, role, status, joined_at)
        VALUES (new_org_id, user_id_var, user_email, 'owner', 'active', now());
        
        RAISE NOTICE 'Organização criada: %', new_org_id;
    ELSE
        RAISE NOTICE 'Usuário já tem organização';
    END IF;
END;
$$;
*/

-- 6. Se você já tem organização mas não aparece como owner em organization_members:
/*
INSERT INTO organization_members (organization_id, user_id, email, role, status, joined_at)
SELECT 
    p.organization_id,
    p.id,
    p.email,
    'owner',
    'active',
    now()
FROM profiles p
WHERE p.email = 'SEU_EMAIL'
  AND NOT EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.user_id = p.id AND om.role = 'owner'
  );
*/
