-- =====================================================
-- FIX: ACESSO DE COLABORADORES E HERANÇA DE MÓDULOS
-- Data: 2026-01-29
-- =====================================================

-- Este script resolve dois problemas:
-- 1. Permite que colaboradores (membros) herdem os módulos da empresa (acesso de leitura em subscriptions/modules)
-- 2. Mantém o acesso limitado (apenas leitura) para configurações sensíveis

-- =====================================================
-- 1. CORRIGIR POLÍTICAS DE SUBSCRIPTIONS
-- =====================================================

DROP POLICY IF EXISTS "Subscriptions are viewable by organization members" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_select_policy" ON subscriptions;

-- NOVA POLÍTICA: Membros podem VER a subscription da sua organização
-- Isso permite que a aplicação saiba quais módulos estão ativos para aquele usuário
CREATE POLICY "subscriptions_select_policy" ON subscriptions
    FOR SELECT
    USING (
        -- O usuário é dono da organização
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = subscriptions.organization_id
            AND o.owner_id = auth.uid()
        )
        OR
        -- OU o usuário é membro da organização
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = subscriptions.organization_id
            AND om.user_id = auth.uid()
        )
        OR
        -- OU é admin
        public.is_admin()
    );

-- INSERT/UPDATE/DELETE continuam restritos apenas a DONOS e ADMINS (mantendo acesso limitado)
-- (As políticas de insert/update já existentes no fix_all_rls_policies.sql garantem isso, 
-- mas vamos reforçar aqui caso não tenham sido rodadas)

DROP POLICY IF EXISTS "subscriptions_insert_policy" ON subscriptions;
CREATE POLICY "subscriptions_insert_policy" ON subscriptions
    FOR INSERT
    WITH CHECK (
        -- Apenas dono ou admin pode criar subscription
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_id
            AND (o.owner_id = auth.uid() OR public.is_admin())
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "subscriptions_update_policy" ON subscriptions;
CREATE POLICY "subscriptions_update_policy" ON subscriptions
    FOR UPDATE
    USING (
        -- Apenas dono ou admin pode alterar subscription
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = subscriptions.organization_id
            AND (o.owner_id = auth.uid() OR public.is_admin())
        )
        OR public.is_admin()
    );

-- =====================================================
-- 2. CORRIGIR POLÍTICAS DE MODULE_ACTIVATIONS
-- =====================================================

DROP POLICY IF EXISTS "module_activations_select_policy" ON module_activations;

-- NOVA POLÍTICA: Membros podem VER as ativações de módulos
CREATE POLICY "module_activations_select_policy" ON module_activations
    FOR SELECT
    USING (
        -- Via Subscription -> Organization -> Owner
        EXISTS (
            SELECT 1 FROM subscriptions s
            JOIN organizations o ON o.id = s.organization_id
            WHERE s.id = module_activations.subscription_id
            AND o.owner_id = auth.uid()
        )
        OR
        -- Via Subscription -> Organization -> Member
        EXISTS (
            SELECT 1 FROM subscriptions s
            JOIN organization_members om ON om.organization_id = s.organization_id
            WHERE s.id = module_activations.subscription_id
            AND om.user_id = auth.uid()
        )
        OR
        public.is_admin()
    );

-- INSERT/UPDATE continuam restritos (Admin/Owner)
DROP POLICY IF EXISTS "module_activations_insert_policy" ON module_activations;
CREATE POLICY "module_activations_insert_policy" ON module_activations
    FOR INSERT
    WITH CHECK (
        public.is_admin()
        OR
        EXISTS (
            SELECT 1 FROM subscriptions s
            JOIN organizations o ON o.id = s.organization_id
            WHERE s.id = subscription_id
            AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "module_activations_update_policy" ON module_activations;
CREATE POLICY "module_activations_update_policy" ON module_activations
    FOR UPDATE
    USING (
        public.is_admin()
        OR
        EXISTS (
            SELECT 1 FROM subscriptions s
            JOIN organizations o ON o.id = s.organization_id
            WHERE s.id = module_activations.subscription_id
            AND o.owner_id = auth.uid()
        )
    );

-- =====================================================
-- 3. GARANTIR QUE O USUÁRIO TENHA ORGANIZATION_ID NO PERFIL
-- =====================================================

-- Função para atualizar o profile quando entrar na organização
CREATE OR REPLACE FUNCTION sync_profile_organization()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o usuário não tem organização definida, define esta
    UPDATE profiles
    SET organization_id = NEW.organization_id,
        approved = true
    WHERE id = NEW.user_id 
    AND (organization_id IS NULL OR organization_id = NEW.organization_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar a função
DROP TRIGGER IF EXISTS on_member_joined_sync_profile ON organization_members;
CREATE TRIGGER on_member_joined_sync_profile
    AFTER INSERT OR UPDATE ON organization_members
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION sync_profile_organization();

-- =====================================================
-- 4. VERIFICAÇÃO
-- =====================================================

SELECT 'Políticas de acesso, herança de módulos e sync de perfil atualizadas!' as status;
