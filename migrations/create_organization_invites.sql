-- =====================================================
-- Migration: Criar Sistema de Convites por Organização
-- Descrição: Tabela para códigos de convite que permitem
--            cadastro automático de colaboradores
-- Data: 2026-01-09
-- =====================================================

-- Criar tabela para armazenar códigos de convite
CREATE TABLE IF NOT EXISTS organization_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invite_code text UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz,  -- Opcional: data de expiração
    is_active boolean DEFAULT true,
    max_uses integer,  -- Opcional: limite de usos
    current_uses integer DEFAULT 0,
    created_by uuid REFERENCES auth.users(id),
    CONSTRAINT valid_invite_code CHECK (length(invite_code) >= 8)
);

-- Índices para melhorar performance
CREATE INDEX idx_invite_code ON organization_invites(invite_code) WHERE is_active = true;
CREATE INDEX idx_organization_invites ON organization_invites(organization_id);
CREATE INDEX idx_active_invites ON organization_invites(is_active, expires_at);

-- Comentário na tabela
COMMENT ON TABLE organization_invites IS 'Códigos de convite para cadastro automático de colaboradores nas organizações';
COMMENT ON COLUMN organization_invites.invite_code IS 'Código único de 8 caracteres alfanuméricos';
COMMENT ON COLUMN organization_invites.max_uses IS 'Limite máximo de usos (NULL = ilimitado)';
COMMENT ON COLUMN organization_invites.current_uses IS 'Contador de quantas vezes o código foi usado';

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Habilitar RLS na tabela
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Policy 1: Donos podem gerenciar convites da própria organização
-- Policy 1: Donos podem gerenciar convites da própria organização
CREATE POLICY "Owners can manage organization invites"
    ON organization_invites
    FOR ALL
    USING (
        organization_id IN (
            SELECT id 
            FROM organizations
            WHERE owner_id = auth.uid()
        )
    );

-- Policy 2: Qualquer pessoa pode validar códigos ativos (necessário para cadastro público)
CREATE POLICY "Anyone can validate active invite codes"
    ON organization_invites
    FOR SELECT
    USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- =====================================================
-- Função para incrementar contador de usos
-- =====================================================

CREATE OR REPLACE FUNCTION increment_invite_usage(p_invite_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE organization_invites
    SET current_uses = current_uses + 1
    WHERE invite_code = upper(p_invite_code)
        AND is_active = true;
END;
$$;

COMMENT ON FUNCTION increment_invite_usage IS 'Incrementa o contador de usos de um código de convite';

-- =====================================================
-- Trigger para processar convite durante cadastro
-- =====================================================

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
    
    -- Se encontrou convite válido, criar perfil associado
    IF v_organization_id IS NOT NULL THEN
        -- Tenta inserir com role 'user' (assumindo que existe coluna role)
        -- Se não existir role, remova a coluna do INSERT abaixo
        INSERT INTO profiles (id, organization_id, role, approved)
        VALUES (NEW.id, v_organization_id, 'user', true)
        ON CONFLICT (id) DO UPDATE
        SET organization_id = v_organization_id,
            approved = true;
            
        -- Log para debug
        RAISE NOTICE 'Usuário % associado à organização % via convite %', 
            NEW.id, v_organization_id, v_invite_code;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION process_invite_code_on_signup IS 'Processa código de convite durante cadastro de novo usuário';

-- Criar trigger que executa após inserção de novo usuário
DROP TRIGGER IF EXISTS on_auth_user_created_process_invite ON auth.users;
CREATE TRIGGER on_auth_user_created_process_invite
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION process_invite_code_on_signup();

-- =====================================================
-- Dados de Exemplo (Comentado - descomentar se necessário)
-- =====================================================

-- INSERT INTO organization_invites (organization_id, invite_code, created_by)
-- SELECT 
--     id,
--     'DEMO' || substring(md5(random()::text) from 1 for 4),
--     (SELECT id FROM profiles WHERE organization_id = organizations.id AND is_owner = true LIMIT 1)
-- FROM organizations
-- LIMIT 1;
