-- Script para inspecionar o estado da assinatura do usuário admin
-- Substitua o email abaixo se necessário, mas o user informou windowfilm.br@gmail.com

WITH target_user AS (
    SELECT id, email FROM auth.users WHERE email = 'windowfilm.br@gmail.com'
),
target_org AS (
    SELECT o.id, o.name, o.owner_id
    FROM organizations o
    JOIN target_user u ON o.owner_id = u.id
)
SELECT 
    'ORGANIZATION' as type,
    o.name as org_name,
    o.id as org_id,
    u.email as owner_email
FROM target_org o
JOIN target_user u ON o.owner_id = u.id

UNION ALL

SELECT 
    'SUBSCRIPTION' as type,
    'Active Modules: ' || array_to_string(s.active_modules, ', ') as details,
    s.id as sub_id,
    s.organization_id::text
FROM subscriptions s
JOIN target_org o ON s.organization_id = o.id

UNION ALL

SELECT 
    'ACTIVATION' as type,
    ma.module_id || ' (' || ma.status || ') expires: ' || COALESCE(ma.expires_at::text, 'never') as details,
    ma.id as activation_id,
    ma.subscription_id::text
FROM module_activations ma
JOIN subscriptions s ON ma.subscription_id = s.id
JOIN target_org o ON s.organization_id = o.id;
