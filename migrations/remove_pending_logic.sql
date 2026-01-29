-- =====================================================
-- REMOÇÃO DA LÓGICA DE APROVAÇÃO PENDENTE (VERSÃO CORRIGIDA)
-- Execute este SQL no Supabase Dashboard
-- =====================================================

-- 1. Dropar trigger e função antigos primeiro para evitar conflitos durante a atualização
DROP TRIGGER IF EXISTS on_profile_changes ON public.profiles;
DROP FUNCTION IF EXISTS handle_profile_changes();

-- 2. Aprovar todos os usuários que ainda estão pendentes
UPDATE public.profiles 
SET approved = true 
WHERE approved = false;

-- 3. Alterar o padrão da coluna para que novos usuários já nasçam aprovados
ALTER TABLE public.profiles 
ALTER COLUMN approved SET DEFAULT true;

-- 4. Criar a nova função de trigger (mais simples e sem lógica de "aprovado")
CREATE OR REPLACE FUNCTION handle_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
    pending_invite RECORD;
    existing_org_id UUID;
BEGIN
    -- Forçar sempre approved como true
    NEW.approved := true;

    -- CASO 1: INSERT (novo usuário se cadastrando)
    IF TG_OP = 'INSERT' THEN
        -- Verifica se existe convite pendente por email
        SELECT om.*, o.id as org_id
        INTO pending_invite
        FROM public.organization_members om
        JOIN public.organizations o ON om.organization_id = o.id
        WHERE LOWER(om.email) = LOWER(NEW.email)
          AND om.status = 'pending'
          AND om.user_id IS NULL
        LIMIT 1;
        
        IF pending_invite IS NOT NULL THEN
            UPDATE public.organization_members
            SET user_id = NEW.id,
                status = 'active',
                joined_at = now()
            WHERE id = pending_invite.id;
            
            NEW.organization_id := pending_invite.org_id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- CASO 2: UPDATE (quando o usuário salva o perfil pela primeira vez)
    IF TG_OP = 'UPDATE' THEN
        -- Se já tem organização, não faz nada
        IF NEW.organization_id IS NOT NULL THEN
            RETURN NEW;
        END IF;
        
        -- Verifica convite pendente (se não foi capturado no INSERT por algum motivo)
        SELECT om.*, o.id as org_id
        INTO pending_invite
        FROM public.organization_members om
        JOIN public.organizations o ON om.organization_id = o.id
        WHERE LOWER(om.email) = LOWER(NEW.email)
          AND (om.status = 'pending' OR om.user_id IS NULL)
        LIMIT 1;
        
        IF pending_invite IS NOT NULL THEN
            UPDATE public.organization_members
            SET user_id = NEW.id,
                status = 'active',
                joined_at = now()
            WHERE id = pending_invite.id;
            
            NEW.organization_id := pending_invite.org_id;
            RETURN NEW;
        END IF;
        
        -- Se é Owner e não tem org, cria uma
        INSERT INTO public.organizations (name, owner_id)
        VALUES (COALESCE(NEW.email, 'Minha Empresa'), NEW.id)
        RETURNING id INTO existing_org_id;
        
        NEW.organization_id := existing_org_id;
        
        INSERT INTO public.organization_members (organization_id, user_id, email, role, status, joined_at)
        VALUES (existing_org_id, NEW.id, NEW.email, 'owner', 'active', now());
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro em handle_profile_changes: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Criar o trigger novamente
CREATE TRIGGER on_profile_changes
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_profile_changes();

