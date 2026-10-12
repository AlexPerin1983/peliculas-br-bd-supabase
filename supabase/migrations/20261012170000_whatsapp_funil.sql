-- Funil de vendas do WhatsApp conectado: lembretes de proposta na mesma fila,
-- ajustes por empresa e cadastro simples de quem chama no WhatsApp.
--
-- Só acrescenta colunas e funções. Empresas sem conexão ligada continuam sem
-- nada novo. As funções do canal são só do servidor (service_role).

ALTER TABLE public.whatsapp_connectors ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.whatsapp_outbox
    ADD COLUMN IF NOT EXISTS portal_id uuid REFERENCES public.proposal_portals(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS step text;

-- Lembrete de proposta: tipo novo na fila. O índice de "um pedido em aberto por
-- cliente e tipo" continua valendo: um cliente não recebe dois lembretes de uma vez.
ALTER TABLE public.whatsapp_outbox DROP CONSTRAINT IF EXISTS whatsapp_outbox_kind_check;
ALTER TABLE public.whatsapp_outbox ADD CONSTRAINT whatsapp_outbox_kind_check
    CHECK (kind IN ('review_request', 'referral_request', 'proposal_follow_up'));
ALTER TABLE public.whatsapp_outbox DROP CONSTRAINT IF EXISTS whatsapp_outbox_follow_up_check;
ALTER TABLE public.whatsapp_outbox ADD CONSTRAINT whatsapp_outbox_follow_up_check
    CHECK (kind <> 'proposal_follow_up' OR (portal_id IS NOT NULL AND step IN ('not_opened', 'hot', 'value', 'expiring', 'expired', 'close')));

-- A fila do canal passa a informar a proposta e a etapa do lembrete.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_pending(p_organization_id uuid, p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(jsonb_agg(item ORDER BY created_at), '[]'::jsonb)
    FROM (
        SELECT outbox.created_at, jsonb_build_object(
            'id', outbox.id,
            'client_id', outbox.client_id,
            'client_name', client.nome,
            'kind', outbox.kind,
            'portal_id', outbox.portal_id,
            'step', outbox.step,
            'phone', outbox.phone,
            'message', outbox.message,
            'status', outbox.status,
            'created_at', outbox.created_at,
            'updated_at', outbox.updated_at,
            'requested_by', requester.email
        ) AS item
        FROM public.whatsapp_outbox outbox
        JOIN public.clients client ON client.id = outbox.client_id
        LEFT JOIN auth.users requester ON requester.id = outbox.created_by
        WHERE outbox.organization_id = p_organization_id
          AND outbox.status IN ('pending', 'sending')
        ORDER BY outbox.created_at
        LIMIT least(greatest(coalesce(p_limit, 100), 1), 200)
    ) rows;
$$;

-- Resultado do canal. "sent" registra no lugar certo: pós-venda na ficha do cliente,
-- lembrete de proposta no histórico de acompanhamento (como o botão do app).
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_report(
    p_organization_id uuid,
    p_id bigint,
    p_status text,
    p_error text DEFAULT NULL,
    p_provider_message_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.whatsapp_outbox%ROWTYPE;
    v_follow_up bigint;
BEGIN
    SELECT * INTO v_row FROM public.whatsapp_outbox
    WHERE id = p_id AND organization_id = p_organization_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

    IF p_status = 'sent' THEN
        IF v_row.status = 'sent' THEN
            RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status);
        END IF;
        IF v_row.status <> 'sending' THEN RAISE EXCEPTION 'Este pedido não estava em envio'; END IF;
        IF v_row.kind = 'proposal_follow_up' THEN
            INSERT INTO public.proposal_portal_follow_ups (portal_id, kind, step, channel, note, created_by)
            VALUES (v_row.portal_id, 'contact', v_row.step, 'whatsapp', 'Enviado pelo WhatsApp conectado', v_row.created_by);
        ELSE
            INSERT INTO public.client_follow_ups (client_id, agendamento_id, kind, channel, note, created_by)
            VALUES (v_row.client_id, v_row.agendamento_id, v_row.kind, 'whatsapp', 'Enviado pelo WhatsApp conectado', v_row.created_by)
            RETURNING id INTO v_follow_up;
        END IF;
        UPDATE public.whatsapp_outbox SET status = 'sent', sent_at = now(), updated_at = now(), error = NULL,
            provider_message_id = left(p_provider_message_id, 200), client_follow_up_id = v_follow_up
        WHERE id = v_row.id;
    ELSIF p_status = 'failed' THEN
        IF v_row.status <> 'sending' THEN RAISE EXCEPTION 'Este pedido não estava em envio'; END IF;
        UPDATE public.whatsapp_outbox SET status = 'failed', updated_at = now(), error = left(coalesce(p_error, 'Falha no envio'), 500)
        WHERE id = v_row.id;
    ELSIF p_status = 'pending' THEN
        IF v_row.status <> 'sending' THEN RAISE EXCEPTION 'Este pedido não estava em envio'; END IF;
        UPDATE public.whatsapp_outbox SET status = 'pending', updated_at = now(), error = left(p_error, 500)
        WHERE id = v_row.id;
    ELSIF p_status = 'canceled' THEN
        IF v_row.status NOT IN ('pending', 'sending') THEN RAISE EXCEPTION 'Este pedido já foi encerrado'; END IF;
        UPDATE public.whatsapp_outbox SET status = 'canceled', updated_at = now(), error = left(p_error, 500)
        WHERE id = v_row.id;
    ELSE
        RAISE EXCEPTION 'Situação inválida';
    END IF;

    SELECT * INTO v_row FROM public.whatsapp_outbox WHERE id = p_id;
    RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status);
END;
$$;

-- Lembrete de proposta pedido pelo painel (na hora certa, aprovado ou automático).
-- O número vem do cadastro do cliente; a proposta precisa ser da empresa.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_enqueue_follow_up(
    p_organization_id uuid,
    p_portal_id uuid,
    p_step text,
    p_message text,
    p_created_by uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_portal public.proposal_portals%ROWTYPE;
    v_phone text;
    v_message text := btrim(coalesce(p_message, ''));
    v_row public.whatsapp_outbox%ROWTYPE;
BEGIN
    SELECT * INTO v_portal FROM public.proposal_portals WHERE id = p_portal_id AND organization_id = p_organization_id;
    IF NOT FOUND OR v_portal.status IN ('revoked', 'approved', 'rejected') OR v_portal.lost_at IS NOT NULL THEN
        RAISE EXCEPTION 'Esta proposta não está mais em acompanhamento';
    END IF;
    IF p_step IS NULL OR p_step NOT IN ('not_opened', 'hot', 'value', 'expiring', 'expired', 'close') THEN
        RAISE EXCEPTION 'Etapa inválida';
    END IF;
    IF char_length(v_message) = 0 OR char_length(v_message) > 4000 THEN
        RAISE EXCEPTION 'Mensagem inválida';
    END IF;
    SELECT public.whatsapp_phone_digits(telefone) INTO v_phone FROM public.clients WHERE id = v_portal.client_id;
    IF v_phone IS NULL THEN RAISE EXCEPTION 'Cadastre um telefone válido para este cliente'; END IF;

    INSERT INTO public.whatsapp_outbox (organization_id, client_id, kind, portal_id, step, phone, message, created_by)
    VALUES (p_organization_id, v_portal.client_id, 'proposal_follow_up', v_portal.id, p_step, v_phone, v_message, p_created_by)
    ON CONFLICT (client_id, kind) WHERE status IN ('pending', 'sending') DO NOTHING
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        SELECT * INTO v_row FROM public.whatsapp_outbox
        WHERE client_id = v_portal.client_id AND kind = 'proposal_follow_up' AND status IN ('pending', 'sending');
        RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', true);
    END IF;
    RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', false);
END;
$$;

-- Clientes da empresa com estes telefones (para separar "Novos contatos").
-- Considera o número com e sem o nono dígito.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_client_phones(p_organization_id uuid, p_phones text[])
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
    ), organization AS (
        SELECT id, owner_id FROM public.organizations WHERE id = p_organization_id
    ), company_users AS (
        SELECT owner_id AS user_id FROM organization
        UNION SELECT member.user_id FROM public.organization_members member, organization
            WHERE member.organization_id = organization.id AND member.status = 'active'
        UNION SELECT profile.id FROM public.profiles profile, organization
            WHERE profile.organization_id = organization.id
    ), company_clients AS (
        -- Mesma ideia de can_access_proposal_client: clientes da empresa e, nos
        -- cadastros antigos sem empresa, os criados pelo dono ou pela equipe.
        SELECT client.id, client.nome, public.whatsapp_phone_digits(client.telefone) AS digits
        FROM public.clients client, organization
        WHERE client.organization_id = organization.id
           OR (client.organization_id IS NULL AND client.user_id IN (SELECT user_id FROM company_users))
    )
    SELECT coalesce(jsonb_object_agg(match.phone, jsonb_build_object('client_id', match.id, 'name', match.nome)), '{}'::jsonb)
    FROM (
        SELECT DISTINCT ON (variants.phone) variants.phone, company_clients.id, company_clients.nome
        FROM variants JOIN company_clients ON company_clients.digits = variants.variant
        ORDER BY variants.phone, company_clients.id DESC
    ) match;
$$;

-- Cadastro simples de quem chamou no WhatsApp: nome e telefone; o resto a empresa
-- completa no app. Não duplica: se o telefone já é de um cliente, devolve esse cliente.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_create_client(p_organization_id uuid, p_name text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner uuid;
    v_name text := left(btrim(coalesce(p_name, '')), 120);
    v_existing jsonb;
    v_display text;
    v_id integer;
BEGIN
    SELECT owner_id INTO v_owner FROM public.organizations WHERE id = p_organization_id;
    IF v_owner IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
    IF p_phone IS NULL OR p_phone !~ '^[0-9]{12,15}$' THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
    IF char_length(v_name) = 0 THEN RAISE EXCEPTION 'Informe o nome do cliente'; END IF;

    v_existing := public.whatsapp_bridge_client_phones(p_organization_id, ARRAY[p_phone]) -> p_phone;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('client_id', (v_existing->>'client_id')::integer, 'name', v_existing->>'name', 'created', false);
    END IF;

    -- Mesmo formato que a empresa digita no app: (83) 99999-8888.
    v_display := CASE
        WHEN p_phone ~ '^55[0-9]{10,11}$' THEN '(' || substr(p_phone, 3, 2) || ') ' || substr(p_phone, 5, char_length(p_phone) - 8) || '-' || right(p_phone, 4)
        ELSE '+' || p_phone
    END;
    INSERT INTO public.clients (user_id, organization_id, nome, telefone, last_updated)
    VALUES (v_owner, p_organization_id, v_name, v_display, now())
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('client_id', v_id, 'name', v_name, 'created', true);
END;
$$;

-- Só o servidor (service_role). O Supabase concede EXECUTE a anon e authenticated
-- por padrão: revogar só de PUBLIC não basta.
REVOKE ALL ON FUNCTION public.whatsapp_bridge_pending(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_report(uuid, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_enqueue_follow_up(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_client_phones(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_create_client(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_pending(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_report(uuid, bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_enqueue_follow_up(uuid, uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_client_phones(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_create_client(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
