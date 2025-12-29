-- =====================================================
-- FIX DEFINITIVO: Corrigir trigger e limpar duplicatas
-- Execute este SQL no Supabase Dashboard
-- =====================================================

-- PASSO 1: Ver estado atual
SELECT 'PROFILES' as tabela, p.email, p.organization_id, o.name as org_name
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id;

SELECT 'ORGANIZATIONS' as tabela, id, name, owner_id 
FROM organizations;

SELECT 'ORGANIZATION_MEMBERS' as tabela, email, role, status, organization_id, user_id
FROM organization_members;

-- =====================================================
-- PASSO 2: Corrigir o colaborador duplicado
-- O alexlacerdaoficial@gmail.com deve pertencer à org do windowfilm.br@gmail.com
-- =====================================================

-- 2.1 Atualizar o organization_id do colaborador para a org correta
UPDATE profiles 
SET organization_id = (
    SELECT organization_id FROM profiles WHERE email = 'windowfilm.br@gmail.com'
)
WHERE email = 'alexlacerdaoficial@gmail.com';

-- 2.2 Deletar a organização duplicada (a que foi criada para o colaborador)
DELETE FROM organizations 
WHERE owner_id = (SELECT id FROM profiles WHERE email = 'alexlacerdaoficial@gmail.com');

-- 2.3 Garantir que existe o organization_member correto
INSERT INTO organization_members (organization_id, user_id, email, role, status, joined_at)
SELECT 
    (SELECT organization_id FROM profiles WHERE email = 'windowfilm.br@gmail.com'),
    p.id,
    p.email,
    'member',
    'active',
    now()
FROM profiles p
WHERE p.email = 'alexlacerdaoficial@gmail.com'
  AND NOT EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.email = 'alexlacerdaoficial@gmail.com' 
        AND om.organization_id = (SELECT organization_id FROM profiles WHERE email = 'windowfilm.br@gmail.com')
  );

-- =====================================================
-- PASSO 3: Recriar o trigger corretamente
-- =====================================================

-- 3.1 Dropar trigger antigo
DROP TRIGGER IF EXISTS on_profile_changes ON profiles;
DROP FUNCTION IF EXISTS handle_profile_changes();

-- 3.2 Criar função corrigida
CREATE OR REPLACE FUNCTION handle_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
    pending_invite RECORD;
    existing_org_id UUID;
BEGIN
    -- CASO 1: INSERT (novo usuário se cadastrando)
    IF TG_OP = 'INSERT' THEN
        -- Verifica se existe convite pendente para este email
        SELECT om.*, o.id as org_id
        INTO pending_invite
        FROM organization_members om
        JOIN organizations o ON om.organization_id = o.id
        WHERE LOWER(om.email) = LOWER(NEW.email)
          AND om.status = 'pending'
          AND om.user_id IS NULL
        LIMIT 1;
        
        IF pending_invite IS NOT NULL THEN
            -- Vincula o convite ao usuário
            UPDATE organization_members
            SET user_id = NEW.id,
                status = 'active',
                joined_at = now()
            WHERE id = pending_invite.id;
            
            -- Atualiza profile com organização e já aprova
            NEW.organization_id := pending_invite.org_id;
            NEW.approved := true;
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- CASO 2: UPDATE (usuário sendo aprovado pelo admin)
    IF TG_OP = 'UPDATE' THEN
        -- Só age se está sendo aprovado agora
        IF NEW.approved = true AND OLD.approved = false THEN
            
            -- PRIMEIRO: Já tem organização? Não faz nada!
            IF NEW.organization_id IS NOT NULL THEN
                RETURN NEW;
            END IF;
            
            -- SEGUNDO: Verifica se tem membro ativo em alguma organização
            SELECT om.organization_id
            INTO existing_org_id
            FROM organization_members om
            WHERE om.user_id = NEW.id
              AND om.status = 'active'
            LIMIT 1;
            
            IF existing_org_id IS NOT NULL THEN
                NEW.organization_id := existing_org_id;
                RETURN NEW;
            END IF;
            
            -- TERCEIRO: Verifica convite pendente por email (case insensitive)
            SELECT om.*, o.id as org_id
            INTO pending_invite
            FROM organization_members om
            JOIN organizations o ON om.organization_id = o.id
            WHERE LOWER(om.email) = LOWER(NEW.email)
              AND (om.status = 'pending' OR om.user_id IS NULL)
            LIMIT 1;
            
            IF pending_invite IS NOT NULL THEN
                -- Vincula o convite
                UPDATE organization_members
                SET user_id = NEW.id,
                    status = 'active',
                    joined_at = now()
                WHERE id = pending_invite.id;
                
                NEW.organization_id := pending_invite.org_id;
                RETURN NEW;
            END IF;
            
            -- QUARTO: É usuário novo SEM convite - cria organização própria
            INSERT INTO organizations (name, owner_id)
            VALUES (COALESCE(NEW.email, 'Minha Empresa'), NEW.id)
            RETURNING id INTO existing_org_id;
            
            NEW.organization_id := existing_org_id;
            
            INSERT INTO organization_members (organization_id, user_id, email, role, status, joined_at)
            VALUES (existing_org_id, NEW.id, NEW.email, 'owner', 'active', now());
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro em handle_profile_changes: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3.3 Recriar trigger
CREATE TRIGGER on_profile_changes
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_profile_changes();

-- =====================================================
-- PASSO 4: Verificar resultado
-- =====================================================
SELECT 'VERIFICACAO' as msg, p.email, p.organization_id, om.role, om.status
FROM profiles p
LEFT JOIN organization_members om ON om.user_id = p.id
WHERE p.approved = true;
