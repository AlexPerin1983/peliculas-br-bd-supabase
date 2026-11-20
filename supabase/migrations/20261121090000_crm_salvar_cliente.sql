-- Atendimento de WhatsApp (Conversa Bridge Ai): salvar no CRM o cliente que a IA
-- terminou de qualificar ("pronto para orçamento").
--
-- O que muda:
-- - crm_read_keys aceita a permissão 'clients:create' (dada à mão, por chave);
-- - crm_client_saves registra cada pedido de salvar (auditoria e limite por hora);
-- - crm_save_client() cria o cliente só se o telefone ainda não existir na empresa.
--   Cliente que já existe NÃO é alterado.
--
-- Não altera nem apaga dados existentes. Só a função crm-read (service_role) chama.

ALTER TABLE public.crm_read_keys DROP CONSTRAINT IF EXISTS crm_read_keys_scopes_check;
ALTER TABLE public.crm_read_keys ADD CONSTRAINT crm_read_keys_scopes_check
    CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['proposals:read', 'agenda:read', 'clients:create']::text[]);

CREATE TABLE IF NOT EXISTS public.crm_client_saves (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key_id uuid NOT NULL REFERENCES public.crm_read_keys(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id integer REFERENCES public.clients(id) ON DELETE SET NULL,
    created boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_client_saves_key_time_idx ON public.crm_client_saves (key_id, created_at DESC);

ALTER TABLE public.crm_client_saves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_client_saves FROM PUBLIC, anon, authenticated;

-- p_phone: só dígitos com o código do país. p_name já limpo pela função crm-read.
-- Devolve { client_id, name, created } ou erro (texto já escrito para quem lê).
CREATE OR REPLACE FUNCTION public.crm_save_client(
    p_key_id uuid,
    p_organization_id uuid,
    p_phone text,
    p_name text,
    p_bairro text DEFAULT NULL,
    p_cidade text DEFAULT NULL,
    p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
    v_name text := left(btrim(coalesce(p_name, '')), 120);
    v_bairro text := nullif(left(btrim(coalesce(p_bairro, '')), 80), '');
    v_cidade text := nullif(left(btrim(coalesce(p_cidade, '')), 80), '');
    v_notes text := nullif(left(btrim(coalesce(p_notes, '')), 1000), '');
    v_existing jsonb;
    v_display text;
    v_id integer;
BEGIN
    -- A chave precisa ser da mesma empresa e continuar valendo.
    PERFORM 1 FROM public.crm_read_keys k
     WHERE k.id = p_key_id AND k.organization_id = p_organization_id
       AND k.enabled AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > now())
       AND 'clients:create' = ANY (k.scopes);
    IF NOT FOUND THEN RAISE EXCEPTION 'Chave sem permissão para salvar cliente.'; END IF;

    SELECT owner_id INTO v_owner FROM public.organizations WHERE id = p_organization_id;
    IF v_owner IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;
    IF p_phone IS NULL OR p_phone !~ '^[0-9]{12,15}$' THEN RAISE EXCEPTION 'Telefone inválido.'; END IF;
    IF char_length(v_name) = 0 THEN RAISE EXCEPTION 'Informe o nome do cliente.'; END IF;

    -- Limite por chave: se a chave vazar, não dá para encher o CRM.
    IF (SELECT count(*) FROM public.crm_client_saves s
         WHERE s.key_id = p_key_id AND s.created_at > now() - interval '1 hour') >= 30 THEN
        RAISE EXCEPTION 'Limite de cadastros por hora atingido. Tente mais tarde.';
    END IF;

    -- Mesmo telefone (com e sem o nono dígito) já cadastrado na empresa: não cria nem altera.
    v_existing := public.whatsapp_bridge_client_phones(p_organization_id, ARRAY[p_phone]) -> p_phone;
    IF v_existing IS NOT NULL THEN
        v_id := (v_existing->>'client_id')::integer;
        INSERT INTO public.crm_client_saves (key_id, organization_id, client_id, created)
        VALUES (p_key_id, p_organization_id, v_id, false);
        RETURN jsonb_build_object('client_id', v_id, 'name', v_existing->>'name', 'created', false);
    END IF;

    -- Mesmo formato que a empresa digita no app: (83) 99999-8888.
    v_display := CASE
        WHEN p_phone ~ '^55[0-9]{10,11}$' THEN '(' || substr(p_phone, 3, 2) || ') ' || substr(p_phone, 5, char_length(p_phone) - 8) || '-' || right(p_phone, 4)
        ELSE '+' || p_phone
    END;

    INSERT INTO public.clients (user_id, organization_id, nome, telefone, bairro, cidade, notes, last_updated)
    VALUES (v_owner, p_organization_id, v_name, v_display, v_bairro, v_cidade, v_notes, now())
    RETURNING id INTO v_id;

    INSERT INTO public.crm_client_saves (key_id, organization_id, client_id, created)
    VALUES (p_key_id, p_organization_id, v_id, true);

    RETURN jsonb_build_object('client_id', v_id, 'name', v_name, 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_save_client(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_save_client(uuid, uuid, text, text, text, text, text) TO service_role;

-- Conferência depois de aplicar (as duas primeiras devem dar false):
-- SELECT has_function_privilege('anon', 'public.crm_save_client(uuid, uuid, text, text, text, text, text)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.crm_save_client(uuid, uuid, text, text, text, text, text)', 'EXECUTE'),
--        has_function_privilege('service_role', 'public.crm_save_client(uuid, uuid, text, text, text, text, text)', 'EXECUTE');
--
-- Dar a permissão à chave do atendimento (passo à parte, com autorização do dono):
-- UPDATE public.crm_read_keys SET scopes = array_append(scopes, 'clients:create')
--  WHERE id = '<id da chave>' AND NOT ('clients:create' = ANY (scopes));

NOTIFY pgrst, 'reload schema';
