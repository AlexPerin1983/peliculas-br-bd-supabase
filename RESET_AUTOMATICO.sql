-- ===============================================
-- RESET AUTOMÁTICO - VERSÃO CORRIGIDA
-- ===============================================
-- Execute no Supabase SQL Editor
-- ===============================================

DO $$
DECLARE
    v_user_id UUID := '199d1ab2-e4ca-491f-b704-5c129dbf5dcb';
    v_user_email TEXT := 'windowfilm.br@gmail.com';
    v_org_name TEXT := 'Películas Brasil';
    v_org_id UUID;
BEGIN
    -- ===== PARTE 1: LIMPAR DADOS =====
    RAISE NOTICE 'Limpando dados...';
    
    -- Desabilitar constraints temporariamente
    SET session_replication_role = 'replica';
    
    -- Limpar tabelas (ignorar erros se tabela não existir)
    BEGIN DELETE FROM organization_invites; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM organization_members; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM module_activations; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM payment_history; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM servicos_prestados; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM agendamentos; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM saved_pdfs; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM clients; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM films; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM bobinas; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM consumos; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM retalhos; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM location_measurements; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM locations; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM proposal_options; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM profiles; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM organizations; EXCEPTION WHEN undefined_table THEN NULL; END;
    
    -- Reabilitar constraints
    SET session_replication_role = 'origin';
    
    RAISE NOTICE 'Dados limpos com sucesso!';
    
    -- ===== PARTE 2: RECRIAR ORGANIZAÇÃO =====
    RAISE NOTICE 'Criando organização...';
    
    INSERT INTO organizations (id, name, owner_id)
    VALUES (gen_random_uuid(), v_org_name, v_user_id)
    RETURNING id INTO v_org_id;
    
    RAISE NOTICE 'Organização criada: %', v_org_id;
    
    -- ===== PARTE 3: CRIAR PROFILE DO OWNER =====
    RAISE NOTICE 'Criando profile...';
    
    INSERT INTO profiles (id, email, role, approved, organization_id)
    VALUES (v_user_id, v_user_email, 'admin', true, v_org_id)
    ON CONFLICT (id) DO UPDATE SET 
        organization_id = v_org_id,
        approved = true,
        role = 'admin';
    
    -- ===== PARTE 4: CRIAR REGISTRO DE MEMBRO OWNER =====
    RAISE NOTICE 'Criando membro owner...';
    
    INSERT INTO organization_members (organization_id, user_id, email, role, status)
    VALUES (v_org_id, v_user_id, v_user_email, 'owner', 'active');
    
    RAISE NOTICE '✅ Reset completo! Organization ID: %', v_org_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Erro: %', SQLERRM;
    RAISE;
END $$;

-- ===== VERIFICAÇÃO FINAL =====
SELECT 'organizations' as tabela, COUNT(*) as registros FROM organizations
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'organization_members', COUNT(*) FROM organization_members;
