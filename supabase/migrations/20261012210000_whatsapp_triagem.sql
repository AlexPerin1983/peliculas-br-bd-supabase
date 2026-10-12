-- WhatsApp conectado: triagem no app. O painel local manda o que a IA separou nas
-- conversas (cliente novo, fornecedor, amigos e família...) com a chance de acerto;
-- no app a empresa aprova, edita, muda o tipo ou descarta. A decisão volta ao painel.
--
-- Só acrescenta tabela e funções. A tabela não é lida direto pelo app: tudo passa
-- pelas funções, que conferem a empresa do usuário e a conexão ligada. Empresas sem
-- conexão não veem nada novo.

CREATE TABLE IF NOT EXISTS public.whatsapp_contact_suggestions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- Identificação da conversa no painel: telefone (só dígitos) ou identificador oculto.
    contact_key text NOT NULL CHECK (char_length(contact_key) BETWEEN 5 AND 64),
    phone text CHECK (phone IS NULL OR phone ~ '^[0-9]{12,15}$'),
    name text CHECK (name IS NULL OR char_length(name) <= 120),
    category text NOT NULL CHECK (category IN ('novo_cliente', 'agendar', 'orcamento', 'pos_venda', 'fornecedor', 'pessoal', 'nao_cliente')),
    confidence numeric(4, 3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    source text CHECK (source IS NULL OR char_length(source) <= 20),
    -- Últimas mensagens do contato (texto curto), para decidir sem abrir o WhatsApp.
    snippet text CHECK (snippet IS NULL OR char_length(snippet) <= 600),
    last_message_at timestamptz,
    -- pending: espera a empresa; approved/discarded: decidido no app (ou no painel);
    -- auto_approved: o painel salvou sozinho (certeza alta).
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'discarded', 'auto_approved')),
    decided_category text CHECK (decided_category IS NULL OR decided_category IN ('novo_cliente', 'agendar', 'orcamento', 'pos_venda', 'fornecedor', 'pessoal', 'nao_cliente')),
    decided_name text CHECK (decided_name IS NULL OR char_length(decided_name) <= 120),
    client_id integer REFERENCES public.clients(id) ON DELETE SET NULL,
    supplier_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    decided_at timestamptz,
    -- Quando o painel leu a decisão feita no app.
    synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, contact_key)
);

CREATE INDEX IF NOT EXISTS whatsapp_contact_suggestions_org_status_idx
    ON public.whatsapp_contact_suggestions (organization_id, status, last_message_at DESC);

ALTER TABLE public.whatsapp_contact_suggestions ENABLE ROW LEVEL SECURITY;
-- Sem políticas: o app lê e decide pelas funções abaixo.
REVOKE ALL ON public.whatsapp_contact_suggestions FROM anon, authenticated;

-- Empresa do usuário, só se a conexão do WhatsApp estiver ligada para ela.
CREATE OR REPLACE FUNCTION public.whatsapp_triage_organization()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT profile.organization_id
    FROM public.profiles profile
    WHERE profile.id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.whatsapp_connectors connector WHERE connector.organization_id = profile.organization_id AND connector.enabled);
$$;

-- Lista da triagem: o que espera decisão e o que foi feito nos últimos 7 dias.
CREATE OR REPLACE FUNCTION public.whatsapp_triage_list()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_org uuid := public.whatsapp_triage_organization();
BEGIN
    IF auth.uid() IS NULL OR v_org IS NULL THEN RETURN jsonb_build_object('enabled', false); END IF;
    RETURN jsonb_build_object(
        'enabled', true,
        'pending', coalesce((
            SELECT jsonb_agg(row_to_json(item) ORDER BY item.priority, item.last_message_at DESC NULLS LAST)
            FROM (
                SELECT id, phone, name, category, confidence, source, snippet, last_message_at, created_at,
                    CASE WHEN category IN ('novo_cliente', 'agendar', 'orcamento', 'pos_venda') THEN 0 WHEN category = 'fornecedor' THEN 1 ELSE 2 END AS priority
                FROM public.whatsapp_contact_suggestions
                WHERE organization_id = v_org AND status = 'pending'
                LIMIT 300
            ) item
        ), '[]'::jsonb),
        'recent', coalesce((
            SELECT jsonb_agg(row_to_json(item) ORDER BY item.decided_at DESC)
            FROM (
                SELECT id, phone, coalesce(decided_name, name) AS name, coalesce(decided_category, category) AS category, confidence, source, status, decided_at, client_id, supplier_id
                FROM public.whatsapp_contact_suggestions
                WHERE organization_id = v_org AND status IN ('approved', 'auto_approved', 'discarded') AND decided_at > now() - interval '7 days'
                ORDER BY decided_at DESC
                LIMIT 50
            ) item
        ), '[]'::jsonb)
    );
END;
$$;

-- Decisão da empresa no app. Aprovar como cliente ou fornecedor salva no app (sem
-- duplicar o telefone); amigos e família ou "não é cliente" só registram a decisão.
CREATE OR REPLACE FUNCTION public.whatsapp_triage_decide(p_id bigint, p_action text, p_category text DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_org uuid := public.whatsapp_triage_organization();
    v_row public.whatsapp_contact_suggestions%ROWTYPE;
    v_category text;
    v_name text;
    v_saved jsonb;
    v_client integer;
    v_supplier uuid;
BEGIN
    IF auth.uid() IS NULL OR v_org IS NULL THEN RAISE EXCEPTION 'O WhatsApp conectado não está ligado para esta empresa'; END IF;
    SELECT * INTO v_row FROM public.whatsapp_contact_suggestions WHERE id = p_id AND organization_id = v_org FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contato não encontrado'; END IF;
    IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'Este contato já foi revisado'; END IF;

    IF p_action = 'discard' THEN
        UPDATE public.whatsapp_contact_suggestions
        SET status = 'discarded', decided_by = auth.uid(), decided_at = now(), updated_at = now(), synced_at = NULL
        WHERE id = v_row.id;
        RETURN jsonb_build_object('id', v_row.id, 'status', 'discarded');
    END IF;
    IF p_action IS DISTINCT FROM 'approve' THEN RAISE EXCEPTION 'Ação inválida'; END IF;

    v_category := coalesce(nullif(btrim(coalesce(p_category, '')), ''), v_row.category);
    IF v_category NOT IN ('novo_cliente', 'agendar', 'orcamento', 'pos_venda', 'fornecedor', 'pessoal', 'nao_cliente') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
    v_name := left(btrim(regexp_replace(coalesce(nullif(btrim(coalesce(p_name, '')), ''), v_row.name, ''), '\s+', ' ', 'g')), 120);

    IF v_category IN ('novo_cliente', 'agendar', 'orcamento', 'pos_venda') THEN
        IF v_row.phone IS NULL THEN RAISE EXCEPTION 'O WhatsApp não mostrou o número deste contato. Salve o contato no celular e tente de novo.'; END IF;
        v_saved := public.whatsapp_bridge_create_client(v_org, v_name, v_row.phone);
        v_client := (v_saved->>'client_id')::integer;
    ELSIF v_category = 'fornecedor' THEN
        IF v_row.phone IS NULL THEN RAISE EXCEPTION 'O WhatsApp não mostrou o número deste contato. Salve o contato no celular e tente de novo.'; END IF;
        v_saved := public.whatsapp_bridge_create_supplier(v_org, v_name, v_row.phone);
        v_supplier := (v_saved->>'supplier_id')::uuid;
    END IF;

    UPDATE public.whatsapp_contact_suggestions
    SET status = 'approved', decided_category = v_category, decided_name = nullif(v_name, ''),
        client_id = v_client, supplier_id = v_supplier,
        decided_by = auth.uid(), decided_at = now(), updated_at = now(), synced_at = NULL
    WHERE id = v_row.id;
    RETURN jsonb_build_object('id', v_row.id, 'status', 'approved', 'category', v_category,
        'client_id', v_client, 'supplier_id', v_supplier, 'created', coalesce((v_saved->>'created')::boolean, false), 'name', coalesce(v_saved->>'name', v_name));
END;
$$;

-- Painel -> app: grava as sugestões. Só mexe nas que ainda esperam decisão; as que o
-- painel já resolveu (salvou sozinho ou a empresa decidiu no painel) saem da espera.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_triage_upsert(p_organization_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item jsonb;
    v_count integer := 0;
    v_status text;
BEGIN
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 300 THEN RAISE EXCEPTION 'Lista inválida'; END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        v_status := coalesce(v_item->>'status', 'pending');
        IF v_status NOT IN ('pending', 'approved', 'discarded', 'auto_approved') THEN RAISE EXCEPTION 'Situação inválida'; END IF;
        INSERT INTO public.whatsapp_contact_suggestions AS suggestion (
            organization_id, contact_key, phone, name, category, confidence, source, snippet, last_message_at,
            status, decided_category, client_id, supplier_id, decided_at, synced_at
        ) VALUES (
            p_organization_id, v_item->>'contact_key', nullif(v_item->>'phone', ''), nullif(left(v_item->>'name', 120), ''),
            v_item->>'category', (v_item->>'confidence')::numeric, left(v_item->>'source', 20), left(v_item->>'snippet', 600),
            to_timestamp((v_item->>'last_message_at')::double precision),
            v_status,
            CASE WHEN v_status = 'pending' THEN NULL ELSE v_item->>'category' END,
            (SELECT id FROM public.clients WHERE id = (v_item->>'client_id')::integer),
            (SELECT id FROM public.fornecedores WHERE id = (v_item->>'supplier_id')::uuid),
            CASE WHEN v_status = 'pending' THEN NULL ELSE now() END,
            CASE WHEN v_status = 'pending' THEN NULL ELSE now() END
        )
        ON CONFLICT (organization_id, contact_key) DO UPDATE SET
            phone = EXCLUDED.phone, name = EXCLUDED.name, category = EXCLUDED.category, confidence = EXCLUDED.confidence,
            source = EXCLUDED.source, snippet = EXCLUDED.snippet, last_message_at = EXCLUDED.last_message_at,
            status = EXCLUDED.status, decided_category = EXCLUDED.decided_category,
            client_id = EXCLUDED.client_id, supplier_id = EXCLUDED.supplier_id,
            decided_at = EXCLUDED.decided_at, synced_at = EXCLUDED.synced_at, updated_at = now()
        WHERE suggestion.status = 'pending';
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('received', v_count);
END;
$$;

-- App -> painel: decisões feitas no app que o painel ainda não leu.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_triage_decisions(p_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'contact_key', contact_key, 'status', status, 'category', coalesce(decided_category, category),
        'name', decided_name, 'client_id', client_id, 'supplier_id', supplier_id, 'decided_at', decided_at
    ) ORDER BY decided_at), '[]'::jsonb)
    FROM (
        SELECT * FROM public.whatsapp_contact_suggestions
        WHERE organization_id = p_organization_id AND status IN ('approved', 'discarded') AND synced_at IS NULL AND decided_at IS NOT NULL
        ORDER BY decided_at
        LIMIT 100
    ) decided;
$$;

-- O painel confirma que leu as decisões.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_triage_ack(p_organization_id uuid, p_ids bigint[])
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH acked AS (
        UPDATE public.whatsapp_contact_suggestions SET synced_at = now()
        WHERE organization_id = p_organization_id AND id = ANY (coalesce(p_ids, '{}'::bigint[])) AND synced_at IS NULL
        RETURNING id
    )
    SELECT jsonb_build_object('acked', count(*)) FROM acked;
$$;

-- App: só usuários logados (as funções conferem a empresa e a conexão).
REVOKE ALL ON FUNCTION public.whatsapp_triage_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_triage_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.whatsapp_triage_decide(bigint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_triage_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_triage_decide(bigint, text, text, text) TO authenticated;

-- Canal: só o servidor (service_role). O Supabase concede EXECUTE a anon e
-- authenticated por padrão: revogar só de PUBLIC não basta.
REVOKE ALL ON FUNCTION public.whatsapp_bridge_triage_upsert(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_triage_decisions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_triage_ack(uuid, bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_triage_upsert(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_triage_decisions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_triage_ack(uuid, bigint[]) TO service_role;

NOTIFY pgrst, 'reload schema';
