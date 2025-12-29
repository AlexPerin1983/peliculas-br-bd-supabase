-- =====================================================
-- CORREÇÃO DEFINITIVA: Sistema de Convites para Colaboradores
-- Execute este SQL no Supabase Dashboard (SQL Editor)
-- Data: 2025-12-28
-- =====================================================

-- =====================================================
-- PASSO 1: DIAGNÓSTICO - Ver estado atual
-- =====================================================

SELECT '=== DIAGNÓSTICO INICIAL ===' as info;

SELECT 'PROFILES' as tabela, p.id, p.email, p.approved, p.organization_id, o.name as org_name
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id;

SELECT 'ORGANIZATIONS' as tabela, id, name, owner_id 
FROM organizations;

SELECT 'ORGANIZATION_MEMBERS' as tabela, id, email, role, status, organization_id, user_id
FROM organization_members;

-- =====================================================
-- PASSO 2: GARANTIR QUE O OWNER TEM REGISTRO EM ORGANIZATION_MEMBERS
-- (Este é o problema mais comum - owner não consegue convidar porque não está na tabela)
-- =====================================================

-- Inserir owner em organization_members se não existir
INSERT INTO organization_members (organization_id, user_id, email, role, status, joined_at)
SELECT 
    o.id as organization_id,
    o.owner_id as user_id,
    p.email,
    'owner' as role,
    'active' as status,
    COALESCE(o.created_at, now()) as joined_at
FROM organizations o
JOIN profiles p ON p.id = o.owner_id
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = o.id 
      AND om.user_id = o.owner_id
);

SELECT '=== OWNERS ADICIONADOS EM ORGANIZATION_MEMBERS ===' as info;

-- =====================================================
-- PASSO 3: RECRIAR TRIGGER CORRETAMENTE
-- =====================================================

-- Dropar triggers e funções antigas
DROP TRIGGER IF EXISTS on_profile_changes ON profiles;
DROP TRIGGER IF EXISTS on_user_approved ON profiles;
DROP TRIGGER IF EXISTS on_user_created_check_invite ON profiles;
DROP FUNCTION IF EXISTS handle_profile_changes();
DROP FUNCTION IF EXISTS create_organization_for_user();
DROP FUNCTION IF EXISTS link_invited_user_to_organization();

-- Criar função única e definitiva
CREATE OR REPLACE FUNCTION handle_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
    pending_invite RECORD;
    existing_org_id UUID;
BEGIN
    -- ==========================================
    -- CASO 1: INSERT (novo usuário se cadastrando)
    -- ==========================================
    IF TG_OP = 'INSERT' THEN
        -- Verifica se existe convite pendente para este email (case insensitive)
        SELECT om.*, org.id as org_id
        INTO pending_invite
        FROM organization_members om
        JOIN organizations org ON om.organization_id = org.id
        WHERE LOWER(TRIM(om.email)) = LOWER(TRIM(NEW.email))
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
            
            -- Atualiza profile com organização e já aprova automaticamente
            NEW.organization_id := pending_invite.org_id;
            NEW.approved := true;
            
            RAISE NOTICE 'Usuário % vinculado à organização % via convite', NEW.email, pending_invite.org_id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- ==========================================
    -- CASO 2: UPDATE (usuário sendo aprovado pelo admin)
    -- ==========================================
    IF TG_OP = 'UPDATE' THEN
        -- Só age se está sendo aprovado agora (transição de false para true)
        IF NEW.approved = true AND (OLD.approved = false OR OLD.approved IS NULL) THEN
            
            -- PRIMEIRO: Já tem organização definida? Não faz nada!
            IF NEW.organization_id IS NOT NULL THEN
                RETURN NEW;
            END IF;
            
            -- SEGUNDO: Verifica se já é membro ativo em alguma organização
            SELECT om.organization_id
            INTO existing_org_id
            FROM organization_members om
            WHERE om.user_id = NEW.id
              AND om.status = 'active'
            LIMIT 1;
            
            IF existing_org_id IS NOT NULL THEN
                NEW.organization_id := existing_org_id;
                RAISE NOTICE 'Usuário % já é membro da organização %', NEW.email, existing_org_id;
                RETURN NEW;
            END IF;
            
            -- TERCEIRO: Verifica convite pendente por email (case insensitive)
            SELECT om.*, org.id as org_id
            INTO pending_invite
            FROM organization_members om
            JOIN organizations org ON om.organization_id = org.id
            WHERE LOWER(TRIM(om.email)) = LOWER(TRIM(NEW.email))
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
                RAISE NOTICE 'Usuário % vinculado à organização % na aprovação', NEW.email, pending_invite.org_id;
                RETURN NEW;
            END IF;
            
            -- QUARTO: É usuário novo SEM convite - cria organização própria
            INSERT INTO organizations (name, owner_id)
            VALUES (COALESCE(NEW.email, 'Minha Empresa'), NEW.id)
            RETURNING id INTO existing_org_id;
            
            NEW.organization_id := existing_org_id;
            
            -- Cria registro de membro owner
            INSERT INTO organization_members (organization_id, user_id, email, role, status, joined_at)
            VALUES (existing_org_id, NEW.id, NEW.email, 'owner', 'active', now());
            
            RAISE NOTICE 'Nova organização % criada para usuário %', existing_org_id, NEW.email;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro em handle_profile_changes: % - %', SQLSTATE, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger BEFORE para poder modificar NEW
CREATE TRIGGER on_profile_changes
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_profile_changes();

SELECT '=== TRIGGER RECRIADO ===' as info;

-- =====================================================
-- PASSO 4: VERIFICAR/CORRIGIR RLS POLICIES
-- =====================================================

-- Garantir que RLS policies estão corretas para organization_members
DROP POLICY IF EXISTS "Owners can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Owners can invite members" ON organization_members;
DROP POLICY IF EXISTS "Owners can update member status" ON organization_members;
DROP POLICY IF EXISTS "Owners can remove members" ON organization_members;
DROP POLICY IF EXISTS "Members can view their organization" ON organization_members;

-- SELECT: Owners veem membros da sua org, membros veem a própria entrada
CREATE POLICY "Members can view their organization"
    ON organization_members FOR SELECT
    USING (
        -- É membro da organização
        organization_id IN (
            SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
        )
        -- OU é o próprio email (para verificar convites pendentes)
        OR LOWER(email) = LOWER((SELECT email FROM profiles WHERE id = auth.uid()))
    );

-- INSERT: Somente owners podem convidar
CREATE POLICY "Owners can invite members"
    ON organization_members FOR INSERT
    WITH CHECK (
        -- Verifica se o usuário é owner da organização
        organization_id IN (
            SELECT o.id FROM organizations o WHERE o.owner_id = auth.uid()
        )
        OR
        organization_id IN (
            SELECT om.organization_id FROM organization_members om 
            WHERE om.user_id = auth.uid() AND om.role = 'owner'
        )
    );

-- UPDATE: Owners podem atualizar status de membros
CREATE POLICY "Owners can update member status"
    ON organization_members FOR UPDATE
    USING (
        organization_id IN (
            SELECT o.id FROM organizations o WHERE o.owner_id = auth.uid()
        )
        OR
        organization_id IN (
            SELECT om.organization_id FROM organization_members om 
            WHERE om.user_id = auth.uid() AND om.role = 'owner'
        )
    );

-- DELETE: Owners podem remover membros
CREATE POLICY "Owners can remove members"
    ON organization_members FOR DELETE
    USING (
        organization_id IN (
            SELECT o.id FROM organizations o WHERE o.owner_id = auth.uid()
        )
        OR
        organization_id IN (
            SELECT om.organization_id FROM organization_members om 
            WHERE om.user_id = auth.uid() AND om.role = 'owner'
        )
    );

SELECT '=== RLS POLICIES ATUALIZADAS ===' as info;

-- =====================================================
-- PASSO 5: VERIFICAÇÃO FINAL
-- =====================================================

SELECT '=== VERIFICAÇÃO FINAL ===' as info;

SELECT 'PROFILES' as tabela, p.email, p.approved, p.organization_id
FROM profiles p
ORDER BY p.created_at;

SELECT 'ORGANIZATION_MEMBERS' as tabela, om.email, om.role, om.status, om.user_id IS NOT NULL as has_user
FROM organization_members om
ORDER BY om.invited_at;

SELECT 'INTEGRIDADE' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = o.id AND om.role = 'owner'))
        THEN 'ERRO: Existem organizações sem owner em organization_members'
        ELSE 'OK: Todas organizações têm owner'
    END as resultado;

SELECT '=== FIM DO SCRIPT ===' as info;
