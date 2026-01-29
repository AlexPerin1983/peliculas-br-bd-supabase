-- =====================================================
-- FIX: FORÇAR ATIVAÇÃO DO PACOTE COMPLETO PARA O ADMIN
-- =====================================================

DO $$
DECLARE
    v_org_id UUID;
    v_sub_id UUID;
    v_admin_email TEXT := 'windowfilm.br@gmail.com'; -- Email do admin
BEGIN
    -- 1. Pegar ID da organização e subscription do email específico
    SELECT o.id, s.id INTO v_org_id, v_sub_id
    FROM organizations o
    JOIN profiles p ON o.owner_id = p.id
    JOIN subscriptions s ON s.organization_id = o.id
    WHERE p.email = v_admin_email;

    IF v_sub_id IS NULL THEN
        RAISE NOTICE 'Assinatura não encontrada para o email %', v_admin_email;
        RETURN;
    END IF;

    -- 2. Inserir/Atualizar ativação do Pacote Completo na tabela module_activations
    INSERT INTO module_activations (
        subscription_id,
        module_id,
        status,
        activated_at,
        expires_at,
        payment_method,
        payment_amount,
        billing_cycle
    ) VALUES (
        v_sub_id,
        'pacote_completo',
        'active',
        now(),
        now() + interval '1 year', -- 1 ano de validade
        'manual_fix',
        0,
        'yearly'
    )
    ON CONFLICT (subscription_id, module_id) 
    DO UPDATE SET 
        status = 'active',
        expires_at = now() + interval '1 year';

    -- 3. Atualizar o array active_modules na tabela subscriptions
    -- Remove se já existir para não duplicar, depois adiciona
    UPDATE subscriptions
    SET active_modules = array_append(
        array_remove(active_modules, 'pacote_completo'), 
        'pacote_completo'
    )
    WHERE id = v_sub_id;

    RAISE NOTICE 'SUCESSO: Pacote Completo ativado para % (Org ID: %)', v_admin_email, v_org_id;
END $$;
