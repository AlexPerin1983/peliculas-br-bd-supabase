-- =====================================================
-- FIX V3: Corrigir lógica de aprovação para colaboradores convidados
-- Execute este SQL no Supabase Dashboard
-- =====================================================

-- O problema: quando o admin global aprova um usuário que já tem convite pendente,
-- está criando uma nova organização em vez de usar o vínculo do convite.

-- 1. Remover trigger antigo
DROP TRIGGER IF EXISTS on_profile_changes ON profiles;
DROP FUNCTION IF EXISTS handle_profile_changes();

-- 2. Criar função corrigida
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
        WHERE om.email = NEW.email 
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
            
            -- PRIMEIRO: Verifica se já tem organização definida (pode ter sido definida pelo trigger de INSERT)
            IF NEW.organization_id IS NOT NULL THEN
                -- Já tem organização, não faz nada
                RETURN NEW;
            END IF;
            
            -- SEGUNDO: Verifica se existe convite ativo para este usuário
            SELECT om.organization_id
            INTO existing_org_id
            FROM organization_members om
            WHERE om.user_id = NEW.id
              AND om.status = 'active'
            LIMIT 1;
            
            IF existing_org_id IS NOT NULL THEN
                -- Tem convite ativo, usa essa organização
                NEW.organization_id := existing_org_id;
                RETURN NEW;
            END IF;
            
            -- TERCEIRO: Verifica se existe convite pendente por email (caso o INSERT não tenha processado)
            SELECT om.*, o.id as org_id
            INTO pending_invite
            FROM organization_members om
            JOIN organizations o ON om.organization_id = o.id
            WHERE om.email = NEW.email 
              AND om.status = 'pending'
              AND om.user_id IS NULL
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
            
            -- QUARTO: Não tem convite nenhum, é usuário novo independente - cria organização
            INSERT INTO organizations (name, owner_id)
            VALUES (COALESCE(NEW.email, 'Minha Empresa'), NEW.id)
            RETURNING id INTO existing_org_id;
            
            NEW.organization_id := existing_org_id;
            
            -- Cria registro de membro owner
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

-- 3. Recriar trigger
CREATE TRIGGER on_profile_changes
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_profile_changes();

-- 4. Corrigir usuários que já foram afetados (têm organização própria mas também têm convite)
-- Isso identifica duplicatas: usuários que são "owner" de uma org mas também são "member" de outra
SELECT 
    p.id as profile_id,
    p.email,
    p.organization_id as current_org,
    om_owner.organization_id as owner_org,
    om_member.organization_id as member_org
FROM profiles p
LEFT JOIN organization_members om_owner ON om_owner.user_id = p.id AND om_owner.role = 'owner'
LEFT JOIN organization_members om_member ON om_member.user_id = p.id AND om_member.role = 'member'
WHERE om_owner.id IS NOT NULL AND om_member.id IS NOT NULL;

-- Se essa query retornar resultados, são duplicatas que precisam ser corrigidas manualmente.
-- Para cada uma, você deve:
-- 1. Decidir qual organização o usuário deve pertencer
-- 2. Deletar a organização duplicada
-- 3. Atualizar o organization_id no profile
