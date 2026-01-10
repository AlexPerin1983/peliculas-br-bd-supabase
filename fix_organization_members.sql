-- Script para corrigir registros de membros de organização
-- Isso insere o registro de membro "owner" para todos os donos de organização
-- que ainda não têm registro na tabela organization_members

-- 1. Inserir o dono da organização como membro com role 'owner'
INSERT INTO organization_members (organization_id, user_id, role, status)
SELECT 
    o.id as organization_id,
    o.owner_id as user_id,
    'owner' as role,
    'active' as status
FROM organizations o
WHERE o.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = o.id 
      AND om.user_id = o.owner_id
  );

-- 2. Atualizar registros existentes para garantir que o dono tenha role 'owner' e status 'active'
UPDATE organization_members 
SET role = 'owner', status = 'active'
WHERE user_id IN (
    SELECT owner_id FROM organizations WHERE owner_id IS NOT NULL
)
AND role != 'owner';

-- 3. Verificar resultado
SELECT 
    om.organization_id,
    om.user_id,
    om.role,
    om.status,
    o.name as organization_name,
    p.email as user_email
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
LEFT JOIN profiles p ON p.id = om.user_id
ORDER BY o.name, om.role;
