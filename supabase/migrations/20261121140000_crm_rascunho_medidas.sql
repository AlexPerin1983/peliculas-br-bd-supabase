-- Atendimento de WhatsApp: ao salvar o cliente, deixar as medidas que ele passou
-- prontas como RASCUNHO na tela de orçamento (uma opção "WhatsApp (rascunho)").
--
-- Regras:
-- - só cria o rascunho se o cliente ainda não tem nenhuma opção de proposta
--   (proposal_option_states); nunca altera o que a equipe já montou;
-- - película: só um nome que exista no catálogo da empresa; senão, a fixada no
--   topo do catálogo; senão, "Nenhuma" (a equipe escolhe);
-- - medidas vêm já limpas pela função crm-read (metros, formato do app "1,20").
--
-- crm_save_client (sem medidas) continua igual; esta é uma função nova.
-- Só a função crm-read (service_role) chama.

CREATE OR REPLACE FUNCTION public.crm_save_client_with_draft(
    p_key_id uuid,
    p_organization_id uuid,
    p_phone text,
    p_name text,
    p_bairro text DEFAULT NULL,
    p_cidade text DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_measurements jsonb DEFAULT NULL,
    p_film text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_client_id integer;
    v_film text;
    v_measurements jsonb;
    v_snapshot jsonb;
    v_base bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
    v_draft text := 'sem_medidas';
BEGIN
    v_result := public.crm_save_client(p_key_id, p_organization_id, p_phone, p_name, p_bairro, p_cidade, p_notes);
    v_client_id := (v_result->>'client_id')::integer;

    IF p_measurements IS NULL OR jsonb_typeof(p_measurements) <> 'array' OR jsonb_array_length(p_measurements) = 0 THEN
        RETURN v_result || jsonb_build_object('draft', v_draft);
    END IF;

    -- A equipe já tem opções para este cliente: não mexe.
    IF EXISTS (SELECT 1 FROM public.proposal_option_states s WHERE s.client_id = v_client_id) THEN
        RETURN v_result || jsonb_build_object('draft', 'ja_existia');
    END IF;

    -- Película do catálogo da empresa (dono e equipe), comparando sem maiúsculas.
    WITH org AS (
        SELECT id, owner_id FROM public.organizations WHERE id = p_organization_id
    ), members AS (
        SELECT owner_id AS user_id FROM org
        UNION SELECT p.id FROM public.profiles p WHERE p.organization_id = p_organization_id
    ), catalog AS (
        SELECT f.nome, f.pinned FROM public.films f JOIN members m ON m.user_id = f.user_id
        WHERE coalesce(trim(f.nome), '') <> ''
    )
    SELECT coalesce(
        (SELECT nome FROM catalog WHERE lower(trim(nome)) = lower(trim(coalesce(p_film, ''))) LIMIT 1),
        (SELECT nome FROM catalog WHERE pinned ORDER BY nome LIMIT 1),
        'Nenhuma'
    ) INTO v_film;

    SELECT jsonb_agg(jsonb_build_object(
        'id', v_base + item.idx,
        'largura', left(item.value->>'largura', 10),
        'altura', left(item.value->>'altura', 10),
        'quantidade', greatest(1, least(50, coalesce((item.value->>'quantidade')::integer, 1))),
        'ambiente', coalesce(nullif(left(btrim(item.value->>'ambiente'), 40), ''), 'Desconhecido'),
        'tipoAplicacao', 'Desconhecido',
        'pelicula', v_film,
        'active', true,
        'discount', jsonb_build_object('value', '0', 'type', 'percentage'),
        'observation', 'Medida aproximada informada pelo cliente no WhatsApp. Conferir antes de enviar.'
    ) ORDER BY item.idx)
    INTO v_measurements
    FROM (
        SELECT value, ordinality AS idx
        FROM jsonb_array_elements(p_measurements) WITH ORDINALITY
        WHERE jsonb_typeof(value) = 'object'
          AND (value->>'largura') ~ '^[0-9]{1,2},[0-9]{2}$'
          AND (value->>'altura') ~ '^[0-9]{1,2},[0-9]{2}$'
        LIMIT 30
    ) item;

    IF v_measurements IS NULL THEN
        RETURN v_result || jsonb_build_object('draft', v_draft);
    END IF;

    v_snapshot := jsonb_build_array(jsonb_build_object(
        'id', v_base,
        'name', 'WhatsApp (rascunho)',
        'measurements', v_measurements,
        'generalDiscount', jsonb_build_object('value', '0', 'type', 'percentage')
    ));

    INSERT INTO public.proposal_option_states (client_id, organization_id, revision, snapshot, updated_at, updated_by, updated_device_id)
    VALUES (v_client_id, p_organization_id, 1, v_snapshot, now(), NULL, 'whatsapp-ia')
    ON CONFLICT (client_id) DO NOTHING;

    IF FOUND THEN
        INSERT INTO public.proposal_option_history (client_id, organization_id, revision, snapshot, created_at, created_by, source_device_id)
        VALUES (v_client_id, p_organization_id, 1, v_snapshot, now(), NULL, 'whatsapp-ia')
        ON CONFLICT (client_id, revision) DO NOTHING;
        v_draft := 'criado';
    ELSE
        v_draft := 'ja_existia';
    END IF;

    RETURN v_result || jsonb_build_object('draft', v_draft, 'film', v_film);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_save_client_with_draft(uuid, uuid, text, text, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_save_client_with_draft(uuid, uuid, text, text, text, text, text, jsonb, text) TO service_role;

-- Conferência depois de aplicar (as duas primeiras devem dar false):
-- SELECT has_function_privilege('anon', 'public.crm_save_client_with_draft(uuid, uuid, text, text, text, text, text, jsonb, text)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.crm_save_client_with_draft(uuid, uuid, text, text, text, text, text, jsonb, text)', 'EXECUTE'),
--        has_function_privilege('service_role', 'public.crm_save_client_with_draft(uuid, uuid, text, text, text, text, text, jsonb, text)', 'EXECUTE');

NOTIFY pgrst, 'reload schema';
