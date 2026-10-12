-- WhatsApp conectado: quem a IA do painel separou como fornecedor pode ser salvo na
-- tela de Fornecedores do app (do dono da empresa), sem duplicar o telefone.
--
-- Só acrescenta funções. As do canal são só do servidor (service_role).

-- Telefone no formato que a empresa digita no app: (83) 99999-8888.
CREATE OR REPLACE FUNCTION public.whatsapp_phone_display(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN p_phone ~ '^55[0-9]{10,11}$' THEN '(' || substr(p_phone, 3, 2) || ') ' || substr(p_phone, 5, char_length(p_phone) - 8) || '-' || right(p_phone, 4)
        ELSE '+' || p_phone
    END;
$$;

-- Fornecedores do dono da empresa com estes telefones (com e sem o nono dígito).
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_supplier_phones(p_organization_id uuid, p_phones text[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH wanted AS (
        SELECT DISTINCT phone FROM unnest(coalesce(p_phones, '{}'::text[])) AS phone
        WHERE phone ~ '^[0-9]{12,15}$'
        LIMIT 1000
    ), variants AS (
        SELECT phone, phone AS variant FROM wanted
        UNION SELECT phone, regexp_replace(phone, '^55([0-9]{2})9([0-9]{8})$', '55\1\2') FROM wanted WHERE phone ~ '^55[0-9]{2}9[0-9]{8}$'
        UNION SELECT phone, regexp_replace(phone, '^55([0-9]{2})([0-9]{8})$', '55\19\2') FROM wanted WHERE phone ~ '^55[0-9]{2}[0-9]{8}$'
    ), suppliers AS (
        SELECT supplier.id, supplier.empresa, supplier.criado_em, public.whatsapp_phone_digits(supplier.telefone) AS digits
        FROM public.fornecedores supplier
        JOIN public.organizations organization ON organization.owner_id = supplier.user_id
        WHERE organization.id = p_organization_id
    )
    SELECT coalesce(jsonb_object_agg(match.phone, jsonb_build_object('supplier_id', match.id, 'name', match.empresa)), '{}'::jsonb)
    FROM (
        SELECT DISTINCT ON (variants.phone) variants.phone, suppliers.id, suppliers.empresa
        FROM variants JOIN suppliers ON suppliers.digits = variants.variant
        ORDER BY variants.phone, suppliers.criado_em DESC NULLS LAST
    ) match;
$$;

-- Cadastro simples do fornecedor: nome e telefone; o resto a empresa completa no app.
-- Não duplica: se o telefone já é de um fornecedor, devolve esse fornecedor.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_create_supplier(p_organization_id uuid, p_name text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
    v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 120);
    v_existing jsonb;
    v_id uuid;
BEGIN
    SELECT owner_id INTO v_owner FROM public.organizations WHERE id = p_organization_id;
    IF v_owner IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
    IF p_phone IS NULL OR p_phone !~ '^[0-9]{12,15}$' THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
    IF char_length(v_name) = 0 THEN RAISE EXCEPTION 'Informe o nome do fornecedor'; END IF;

    v_existing := public.whatsapp_bridge_supplier_phones(p_organization_id, ARRAY[p_phone]) -> p_phone;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('supplier_id', v_existing->>'supplier_id', 'name', v_existing->>'name', 'created', false);
    END IF;

    INSERT INTO public.fornecedores (user_id, empresa, telefone, observacao)
    VALUES (v_owner, v_name, public.whatsapp_phone_display(p_phone), 'Cadastrado pelo WhatsApp conectado')
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('supplier_id', v_id, 'name', v_name, 'created', true);
END;
$$;

-- Só o servidor (service_role). O Supabase concede EXECUTE a anon e authenticated
-- por padrão: revogar só de PUBLIC não basta.
REVOKE ALL ON FUNCTION public.whatsapp_bridge_supplier_phones(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_create_supplier(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_supplier_phones(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_create_supplier(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
