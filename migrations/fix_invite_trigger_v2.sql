-- =====================================================
-- CORREÇÃO: Trigger de Processamento de Convites
-- =====================================================

-- 1. Recriar a função com melhor tratamento de erros e campos obrigatórios
CREATE OR REPLACE FUNCTION process_invite_code_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_organization_id uuid;
    v_invite_code text;
BEGIN
    -- Extrair código de convite do metadata do usuário
    v_invite_code := NEW.raw_user_meta_data->>'invite_code';
    
    -- Se não há código de convite, retornar sem processar
    IF v_invite_code IS NULL OR v_invite_code = '' THEN
        RETURN NEW;
    END IF;
    
    -- Buscar convite válido e ativo
    SELECT organization_id INTO v_organization_id
    FROM organization_invites
    WHERE invite_code = upper(v_invite_code)
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND (max_uses IS NULL OR current_uses < max_uses)
    LIMIT 1;
    
    -- Se encontrou convite válido, criar/atualizar perfil
    IF v_organization_id IS NOT NULL THEN
        BEGIN
            -- Tenta inserir ou atualizar o perfil
            -- ADICIONADO: Campo email que estava faltando
            INSERT INTO profiles (id, organization_id, role, approved, email)
            VALUES (NEW.id, v_organization_id, 'user', true, NEW.email)
            ON CONFLICT (id) DO UPDATE
            SET organization_id = v_organization_id,
                approved = true;
                
            -- Incrementar contador de usos
            UPDATE organization_invites
            SET current_uses = current_uses + 1
            WHERE invite_code = upper(v_invite_code);
            
        EXCEPTION WHEN OTHERS THEN
            -- Logar erro mas permitir que o usuário seja criado (sem vínculo por enquanto)
            -- Ou levantar exceção se quiser bloquear o cadastro
            RAISE WARNING 'Erro ao vincular usuário via convite: %', SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. Garantir que o trigger está aplicado
DROP TRIGGER IF EXISTS on_auth_user_created_process_invite ON auth.users;
CREATE TRIGGER on_auth_user_created_process_invite
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION process_invite_code_on_signup();
