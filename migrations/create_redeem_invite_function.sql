-- Função para resgatar convite e associar usuário à organização
-- Execute no Supabase SQL Editor

CREATE OR REPLACE FUNCTION redeem_invite(code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite RECORD;
    v_user_id UUID;
    v_user_email TEXT;
    v_result JSON;
BEGIN
    -- Obter o ID do usuário autenticado
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
    END IF;
    
    -- Buscar email do usuário
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;
    
    -- Buscar o convite
    SELECT * INTO v_invite
    FROM organization_invites
    WHERE invite_code = UPPER(code)
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses IS NULL OR current_uses < max_uses);
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Convite inválido ou expirado');
    END IF;
    
    -- Verificar se o usuário já é membro desta organização
    IF EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = v_invite.organization_id 
        AND user_id = v_user_id
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Você já faz parte desta organização');
    END IF;
    
    -- Atualizar o profile do usuário com a organization_id
    UPDATE profiles
    SET organization_id = v_invite.organization_id,
        approved = true
    WHERE id = v_user_id;
    
    -- Adicionar como membro da organização
    INSERT INTO organization_members (organization_id, user_id, email, role, status)
    VALUES (v_invite.organization_id, v_user_id, v_user_email, 'member', 'active')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';
    
    -- Incrementar o uso do convite
    UPDATE organization_invites
    SET current_uses = current_uses + 1
    WHERE id = v_invite.id;
    
    RETURN json_build_object('success', true, 'organization_id', v_invite.organization_id);
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Conceder permissão para executar a função
GRANT EXECUTE ON FUNCTION redeem_invite(TEXT) TO authenticated;

-- Adicionar constraint unique se não existir (para ON CONFLICT funcionar)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'organization_members_org_user_unique'
    ) THEN
        ALTER TABLE organization_members
        ADD CONSTRAINT organization_members_org_user_unique 
        UNIQUE (organization_id, user_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Constraint talvez já exista com outro nome, ignorar
    NULL;
END $$;
