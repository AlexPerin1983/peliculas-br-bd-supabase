-- WhatsApp conectado: conexão por empresa e fila de envios do pós-venda.
--
-- Somente acrescenta tabelas e funções; não altera nem lê de forma diferente
-- nenhum dado existente. Empresas sem conexão ligada não veem nada novo no app:
-- o botão depende de whatsapp_connection_status(), que só responde "ligado"
-- para a própria empresa quando ela tem uma conexão ativa.
--
-- O canal diz como a mensagem sai: 'local_panel' (painel no computador da
-- empresa, autenticado por uma chave) ou 'cloud_api' (API oficial do WhatsApp,
-- no futuro). A fila e o registro no pós-venda são os mesmos para os dois.

CREATE TABLE IF NOT EXISTS public.whatsapp_connectors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    channel text NOT NULL DEFAULT 'local_panel' CHECK (channel IN ('local_panel', 'cloud_api')),
    -- SHA-256 (hex) da chave do painel. A chave em si nunca fica no banco.
    token_hash text UNIQUE CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$'),
    label text,
    enabled boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz
);

-- Uma conexão ativa por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connectors_one_enabled_per_org
    ON public.whatsapp_connectors (organization_id) WHERE enabled;

ALTER TABLE public.whatsapp_connectors ENABLE ROW LEVEL SECURITY;
-- Sem políticas: o app não lê a conexão diretamente (nem a chave).
REVOKE ALL ON public.whatsapp_connectors FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id integer NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    agendamento_id integer REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('review_request', 'referral_request')),
    -- Destino gravado no pedido: só dígitos, com o código do país.
    phone text NOT NULL CHECK (phone ~ '^[0-9]{12,15}$'),
    message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
    -- pending: aguardando o envio; sending: o canal está enviando; sent/failed:
    -- resultado informado pelo canal; canceled: descartado.
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'canceled')),
    error text,
    provider_message_id text,
    client_follow_up_id bigint REFERENCES public.client_follow_ups(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS whatsapp_outbox_org_status_idx
    ON public.whatsapp_outbox (organization_id, status, created_at);
-- Um pedido em aberto por cliente e tipo: tocar duas vezes não duplica o envio.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_outbox_one_open_per_client_kind
    ON public.whatsapp_outbox (client_id, kind) WHERE status IN ('pending', 'sending');

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

-- Cada empresa só lê a própria fila. Gravações passam pelas funções abaixo.
DROP POLICY IF EXISTS whatsapp_outbox_company_read ON public.whatsapp_outbox;
CREATE POLICY whatsapp_outbox_company_read ON public.whatsapp_outbox
FOR SELECT TO authenticated
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

REVOKE ALL ON public.whatsapp_outbox FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_outbox TO authenticated;

-- Mesmo número que o app usa no link do WhatsApp, sem confundir o DDD 55 (RS)
-- com o código do Brasil: até 11 dígitos é número nacional e recebe o 55.
CREATE OR REPLACE FUNCTION public.whatsapp_phone_digits(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN digits ~ '^[0-9]{10,11}$' THEN '55' || digits
        WHEN digits ~ '^[0-9]{12,15}$' THEN digits
        ELSE NULL
    END
    FROM (SELECT ltrim(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '0') AS digits) phone;
$$;

-- O app pergunta só quando a tela de pós-venda abre.
CREATE OR REPLACE FUNCTION public.whatsapp_connection_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT CASE WHEN connector.id IS NULL THEN jsonb_build_object('enabled', false)
        ELSE jsonb_build_object('enabled', true, 'channel', connector.channel, 'last_seen_at', connector.last_seen_at)
    END
    FROM (SELECT 1) one
    LEFT JOIN public.profiles profile ON profile.id = auth.uid()
    LEFT JOIN public.whatsapp_connectors connector
      ON connector.organization_id = profile.organization_id
     AND connector.enabled;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_connection_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_connection_status() TO authenticated;

-- Coloca um pedido de avaliação ou de indicação na fila da empresa.
-- O número vem do cadastro do cliente, não do aparelho.
CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_message(
    p_client_id integer,
    p_kind text,
    p_message text,
    p_agendamento_id integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_org uuid;
    v_phone text;
    v_message text := btrim(coalesce(p_message, ''));
    v_agendamento integer;
    v_row public.whatsapp_outbox%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR p_client_id IS NULL OR NOT public.can_access_proposal_client(p_client_id) THEN
        RAISE EXCEPTION 'Cliente indisponível para este usuário';
    END IF;
    SELECT organization_id INTO v_org FROM public.profiles WHERE id = auth.uid();
    IF v_org IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.whatsapp_connectors WHERE organization_id = v_org AND enabled
    ) THEN
        RAISE EXCEPTION 'O WhatsApp conectado não está ligado para esta empresa';
    END IF;
    IF p_kind IS NULL OR p_kind NOT IN ('review_request', 'referral_request') THEN
        RAISE EXCEPTION 'Tipo de pedido inválido';
    END IF;
    IF char_length(v_message) = 0 OR char_length(v_message) > 4000 THEN
        RAISE EXCEPTION 'Escreva a mensagem (até 4.000 caracteres)';
    END IF;

    SELECT public.whatsapp_phone_digits(telefone) INTO v_phone FROM public.clients WHERE id = p_client_id;
    IF v_phone IS NULL THEN
        RAISE EXCEPTION 'Cadastre um telefone válido para este cliente';
    END IF;

    -- Só guarda o atendimento se ele for deste cliente.
    SELECT id INTO v_agendamento FROM public.agendamentos
    WHERE id = p_agendamento_id AND client_id = p_client_id;

    INSERT INTO public.whatsapp_outbox (organization_id, client_id, agendamento_id, kind, phone, message, created_by)
    VALUES (v_org, p_client_id, v_agendamento, p_kind, v_phone, v_message, auth.uid())
    ON CONFLICT (client_id, kind) WHERE status IN ('pending', 'sending') DO NOTHING
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        SELECT * INTO v_row FROM public.whatsapp_outbox
        WHERE client_id = p_client_id AND kind = p_kind AND status IN ('pending', 'sending');
        RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', true);
    END IF;
    RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_whatsapp_message(integer, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_whatsapp_message(integer, text, text, integer) TO authenticated;

-- Funções do canal (chamadas só pela função whatsapp-bridge com a chave
-- de serviço, depois de conferir a chave do painel).

CREATE OR REPLACE FUNCTION public.whatsapp_bridge_touch(p_connector_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    UPDATE public.whatsapp_connectors connector SET last_seen_at = now()
    WHERE connector.id = p_connector_id AND connector.enabled;
    SELECT jsonb_build_object(
        'organization_name', organization.name,
        'channel', connector.channel,
        'pending', (SELECT count(*) FROM public.whatsapp_outbox outbox
                    WHERE outbox.organization_id = connector.organization_id AND outbox.status IN ('pending', 'sending'))
    ) INTO v_result
    FROM public.whatsapp_connectors connector
    JOIN public.organizations organization ON organization.id = connector.organization_id
    WHERE connector.id = p_connector_id AND connector.enabled;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Conexão desligada'; END IF;
    RETURN v_result;
END;
$$;

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

-- Reserva o pedido logo antes do envio, para não sair duas vezes.
CREATE OR REPLACE FUNCTION public.whatsapp_bridge_claim(p_organization_id uuid, p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    UPDATE public.whatsapp_outbox SET status = 'sending', error = NULL, updated_at = now()
    WHERE id = p_id AND organization_id = p_organization_id AND status = 'pending'
    RETURNING jsonb_build_object('id', id, 'phone', phone, 'message', message, 'kind', kind) INTO v_result;
    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Este pedido não está mais aguardando envio';
    END IF;
    RETURN v_result;
END;
$$;

-- Resultado do canal. "sent" registra o pedido no pós-venda do cliente, como
-- o botão do app faz; "pending" devolve à fila um envio que não chegou a sair.
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
        INSERT INTO public.client_follow_ups (client_id, agendamento_id, kind, channel, note, created_by)
        VALUES (v_row.client_id, v_row.agendamento_id, v_row.kind, 'whatsapp', 'Enviado pelo WhatsApp conectado', v_row.created_by)
        RETURNING id INTO v_follow_up;
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

REVOKE ALL ON FUNCTION public.whatsapp_bridge_touch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_pending(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_claim(uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_bridge_report(uuid, bigint, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_touch(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_pending(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_claim(uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_report(uuid, bigint, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
