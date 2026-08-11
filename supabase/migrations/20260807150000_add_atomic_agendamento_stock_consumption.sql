-- Baixa de estoque vinculada a conclusao do atendimento.
-- A RPC abaixo mantem status, historico e saldo na mesma transacao e usa o
-- proprio agendamento como trava de idempotencia para retries/duplo clique.

ALTER TABLE public.consumos
    ADD COLUMN IF NOT EXISTS agendamento_id bigint,
    ADD COLUMN IF NOT EXISTS source_key text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.consumos'::regclass
          AND conname = 'consumos_agendamento_id_fkey'
    ) THEN
        ALTER TABLE public.consumos
            ADD CONSTRAINT consumos_agendamento_id_fkey
            FOREIGN KEY (agendamento_id)
            REFERENCES public.agendamentos(id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.consumos'::regclass
          AND conname = 'consumos_metros_consumidos_positive'
    ) THEN
        ALTER TABLE public.consumos
            ADD CONSTRAINT consumos_metros_consumidos_positive
            CHECK (metros_consumidos > 0) NOT VALID;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_consumos_agendamento_id
    ON public.consumos (agendamento_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_consumos_source_key
    ON public.consumos (source_key)
    WHERE source_key IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.bobinas'::regclass
          AND conname = 'bobinas_remaining_stock_nonnegative'
    ) THEN
        ALTER TABLE public.bobinas
            ADD CONSTRAINT bobinas_remaining_stock_nonnegative
            CHECK (comprimento_restante_m >= 0) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.bobinas'::regclass
          AND conname = 'bobinas_active_requires_remaining_stock'
    ) THEN
        ALTER TABLE public.bobinas
            ADD CONSTRAINT bobinas_active_requires_remaining_stock
            CHECK (status <> 'ativa' OR comprimento_restante_m > 0) NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS stock_status text,
    ADD COLUMN IF NOT EXISTS stock_consumed_at timestamptz,
    ADD COLUMN IF NOT EXISTS stock_source_pdf_ids bigint[],
    ADD COLUMN IF NOT EXISTS stock_consumption_snapshot jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.agendamentos'::regclass
          AND conname = 'agendamentos_stock_status_valid'
    ) THEN
        ALTER TABLE public.agendamentos
            ADD CONSTRAINT agendamentos_stock_status_valid
            CHECK (
                stock_status IS NULL
                OR stock_status IN ('pending', 'confirmed', 'not_required')
            ) NOT VALID;
    END IF;
END;
$$;

-- Toda insercao de consumo de bobina usa um UPDATE condicional unico. Assim,
-- duas transacoes concorrentes nunca conseguem consumir o mesmo saldo e uma
-- falha do trigger desfaz tambem o INSERT do historico.
CREATE OR REPLACE FUNCTION public.atualizar_estoque_bobina()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    updated_bobina_id bigint;
BEGIN
    IF NEW.metros_consumidos IS NULL OR NEW.metros_consumidos <= 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'A quantidade consumida deve ser maior que zero.';
    END IF;

    IF NEW.bobina_id IS NOT NULL THEN
        UPDATE public.bobinas
        SET comprimento_restante_m = comprimento_restante_m - NEW.metros_consumidos,
            data_ultima_atualizacao = now(),
            status = CASE
                WHEN comprimento_restante_m - NEW.metros_consumidos = 0 THEN 'finalizada'
                ELSE status
            END
        WHERE id = NEW.bobina_id
          AND status = 'ativa'
          AND comprimento_restante_m >= NEW.metros_consumidos
        RETURNING id INTO updated_bobina_id;

        IF updated_bobina_id IS NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = format(
                    'A bobina %s nao esta ativa ou nao possui saldo suficiente.',
                    NEW.bobina_id
                );
        END IF;
    END IF;

    -- Mantem o comportamento historico para consumos manuais de retalho.
    IF NEW.retalho_id IS NOT NULL THEN
        UPDATE public.retalhos
        SET status = 'usado',
            data_utilizacao = now()
        WHERE id = NEW.retalho_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_agendamento_with_stock(
    p_agendamento_id bigint,
    p_final_value numeric,
    p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    appointment public.agendamentos%ROWTYPE;
    bobina_row public.bobinas%ROWTYPE;
    line jsonb;
    required record;
    expected_film text;
    source_key_prefix text;
    source_pdf_ids bigint[] := ARRAY[]::bigint[];
    line_source_key text;
    line_type text;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Usuario nao autenticado.';
    END IF;

    IF p_agendamento_id IS NULL OR p_agendamento_id <= 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'Agendamento invalido.';
    END IF;

    IF p_final_value IS NOT NULL AND p_final_value < 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'O valor final nao pode ser negativo.';
    END IF;

    -- SECURITY INVOKER faz este SELECT respeitar os grants e as politicas RLS.
    -- FOR UPDATE serializa tentativas concorrentes para o mesmo atendimento.
    SELECT *
    INTO appointment
    FROM public.agendamentos
    WHERE id = p_agendamento_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Agendamento nao encontrado ou sem permissao de acesso.';
    END IF;

    IF appointment.stock_status = 'confirmed' THEN
        RETURN jsonb_build_object(
            'agendamento_id', appointment.id,
            'stock_status', appointment.stock_status,
            'stock_consumed_at', appointment.stock_consumed_at,
            'stock_source_pdf_ids', appointment.stock_source_pdf_ids,
            'stock_consumption_snapshot', appointment.stock_consumption_snapshot,
            'already_confirmed', true
        );
    END IF;

    IF p_lines IS NULL
       OR jsonb_typeof(p_lines) <> 'array'
       OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'Informe ao menos uma linha de consumo.';
    END IF;

    source_key_prefix := format('agenda:%s:', p_agendamento_id);

    -- Primeira passagem: valida o JSON antes de realizar qualquer escrita.
    FOR line IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        IF jsonb_typeof(line) <> 'object' THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'Cada linha de consumo deve ser um objeto.';
        END IF;

        IF jsonb_typeof(line -> 'bobina_id') IS DISTINCT FROM 'number'
           OR (line ->> 'bobina_id') !~ '^[1-9][0-9]*$' THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'A linha de consumo possui uma bobina invalida.';
        END IF;

        IF jsonb_typeof(line -> 'metros_consumidos') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'A quantidade consumida deve ser maior que zero.';
        END IF;

        IF (line ->> 'metros_consumidos')::numeric <= 0 THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'A quantidade consumida deve ser maior que zero.';
        END IF;

        IF jsonb_typeof(line -> 'source_key') IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'A linha de consumo nao possui uma chave de origem.';
        END IF;

        line_source_key := btrim(line ->> 'source_key');
        IF position(source_key_prefix IN line_source_key) <> 1
           OR length(line_source_key) <= length(source_key_prefix) THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = format('A chave de origem deve iniciar com %s', source_key_prefix);
        END IF;

        IF line ? 'film_id' THEN
            IF jsonb_typeof(line -> 'film_id') <> 'string'
               OR btrim(line ->> 'film_id') = '' THEN
                RAISE EXCEPTION USING
                    ERRCODE = '22023',
                    MESSAGE = 'A pelicula informada na linha e invalida.';
            END IF;
        END IF;

        IF line ? 'pdf_id' AND (
            jsonb_typeof(line -> 'pdf_id') <> 'number'
            OR (line ->> 'pdf_id') !~ '^[1-9][0-9]*$'
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'O PDF informado na linha e invalido.';
        END IF;

        IF line ? 'largura_corte_cm' THEN
            IF jsonb_typeof(line -> 'largura_corte_cm') <> 'number'
               OR (line ->> 'largura_corte_cm') IS NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = '22023',
                    MESSAGE = 'A largura do corte e invalida.';
            END IF;

            IF (line ->> 'largura_corte_cm')::numeric < 0 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '22023',
                    MESSAGE = 'A largura do corte e invalida.';
            END IF;
        END IF;

        IF line ? 'comprimento_corte_cm' THEN
            IF jsonb_typeof(line -> 'comprimento_corte_cm') <> 'number'
               OR (line ->> 'comprimento_corte_cm') IS NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = '22023',
                    MESSAGE = 'O comprimento do corte e invalido.';
            END IF;

            IF (line ->> 'comprimento_corte_cm')::numeric < 0 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '22023',
                    MESSAGE = 'O comprimento do corte e invalido.';
            END IF;
        END IF;

        IF line ? 'area_m2' THEN
            IF jsonb_typeof(line -> 'area_m2') <> 'number'
               OR (line ->> 'area_m2') IS NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = '22023',
                    MESSAGE = 'A area consumida e invalida.';
            END IF;

            IF (line ->> 'area_m2')::numeric < 0 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '22023',
                    MESSAGE = 'A area consumida e invalida.';
            END IF;
        END IF;

        IF line ? 'tipo' THEN
            line_type := line ->> 'tipo';
            IF jsonb_typeof(line -> 'tipo') <> 'string'
               OR line_type NOT IN ('corte', 'perda', 'amostra', 'descarte') THEN
                RAISE EXCEPTION USING
                    ERRCODE = '22023',
                    MESSAGE = 'O tipo de consumo informado e invalido.';
            END IF;
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_lines) AS item
        GROUP BY btrim(item ->> 'source_key')
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'As chaves de origem das linhas de consumo devem ser unicas.';
    END IF;

    -- Trava as bobinas em ordem deterministica e valida o total agregado de
    -- cada uma antes dos INSERTs, evitando deadlock e baixa parcial.
    FOR required IN
        SELECT
            (item ->> 'bobina_id')::bigint AS bobina_id,
            sum((item ->> 'metros_consumidos')::numeric) AS total_metros
        FROM jsonb_array_elements(p_lines) AS item
        GROUP BY (item ->> 'bobina_id')::bigint
        ORDER BY (item ->> 'bobina_id')::bigint
    LOOP
        SELECT *
        INTO bobina_row
        FROM public.bobinas
        WHERE id = required.bobina_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE = '42501',
                MESSAGE = format(
                    'Bobina %s nao encontrada ou sem permissao de acesso.',
                    required.bobina_id
                );
        END IF;

        IF bobina_row.status <> 'ativa' THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = format('A bobina %s nao esta ativa.', required.bobina_id);
        END IF;

        IF bobina_row.comprimento_restante_m < required.total_metros THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = format(
                    'Saldo insuficiente na bobina %s: disponivel %s m, solicitado %s m.',
                    required.bobina_id,
                    bobina_row.comprimento_restante_m,
                    required.total_metros
                );
        END IF;

        FOR expected_film IN
            SELECT DISTINCT btrim(item ->> 'film_id')
            FROM jsonb_array_elements(p_lines) AS item
            WHERE (item ->> 'bobina_id')::bigint = required.bobina_id
              AND item ? 'film_id'
            ORDER BY btrim(item ->> 'film_id')
        LOOP
            IF regexp_replace(
                translate(
                    lower(btrim(bobina_row.film_id)),
                    'áàâãäéèêëíìîïóòôõöúùûüç',
                    'aaaaaeeeeiiiiooooouuuuc'
                ),
                '[[:space:]]+',
                ' ',
                'g'
            ) <> regexp_replace(
                translate(
                    lower(btrim(expected_film)),
                    'áàâãäéèêëíìîïóòôõöúùûüç',
                    'aaaaaeeeeiiiiooooouuuuc'
                ),
                '[[:space:]]+',
                ' ',
                'g'
            ) THEN
                RAISE EXCEPTION USING
                    ERRCODE = '22023',
                    MESSAGE = format(
                        'A bobina %s pertence a pelicula %s, nao a %s.',
                        required.bobina_id,
                        bobina_row.film_id,
                        expected_film
                    );
            END IF;
        END LOOP;
    END LOOP;

    FOR line IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO public.consumos (
            user_id,
            bobina_id,
            client_id,
            client_name,
            pdf_id,
            agendamento_id,
            source_key,
            metros_consumidos,
            largura_corte_cm,
            comprimento_corte_cm,
            area_m2,
            tipo,
            observacao
        )
        VALUES (
            current_user_id,
            (line ->> 'bobina_id')::bigint,
            appointment.client_id,
            appointment.client_name,
            COALESCE(
                CASE WHEN line ? 'pdf_id' THEN (line ->> 'pdf_id')::bigint END,
                appointment.pdf_id::bigint
            ),
            appointment.id,
            btrim(line ->> 'source_key'),
            (line ->> 'metros_consumidos')::numeric,
            CASE WHEN line ? 'largura_corte_cm' THEN (line ->> 'largura_corte_cm')::numeric END,
            CASE WHEN line ? 'comprimento_corte_cm' THEN (line ->> 'comprimento_corte_cm')::numeric END,
            CASE WHEN line ? 'area_m2' THEN (line ->> 'area_m2')::numeric END,
            COALESCE(NULLIF(line ->> 'tipo', ''), 'corte'),
            NULLIF(btrim(line ->> 'observacao'), '')
        );
    END LOOP;

    SELECT COALESCE(array_agg(pdf_id ORDER BY pdf_id), ARRAY[]::bigint[])
    INTO source_pdf_ids
    FROM (
        SELECT DISTINCT (item ->> 'pdf_id')::bigint AS pdf_id
        FROM jsonb_array_elements(p_lines) AS item
        WHERE item ? 'pdf_id'

        UNION

        SELECT unnest(COALESCE(appointment.pdf_ids, ARRAY[]::integer[]))::bigint

        UNION

        SELECT appointment.pdf_id::bigint
        WHERE appointment.pdf_id IS NOT NULL

        UNION

        -- Continuacoes nao religam o orcamento comercial, mas carregam esta
        -- fotografia para calcular e auditar o material do servico original.
        SELECT unnest(COALESCE(appointment.stock_source_pdf_ids, ARRAY[]::bigint[]))
    ) AS source_pdfs
    WHERE pdf_id IS NOT NULL;

    UPDATE public.agendamentos
    SET service_status = 'completed',
        valor_final = CASE
            WHEN p_final_value IS NULL THEN valor_final
            ELSE p_final_value
        END,
        stock_status = 'confirmed',
        stock_consumed_at = now(),
        stock_source_pdf_ids = source_pdf_ids,
        stock_consumption_snapshot = p_lines
    WHERE id = appointment.id
    RETURNING * INTO appointment;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Nao foi possivel concluir o agendamento.';
    END IF;

    RETURN jsonb_build_object(
        'agendamento_id', appointment.id,
        'stock_status', appointment.stock_status,
        'stock_consumed_at', appointment.stock_consumed_at,
        'stock_source_pdf_ids', appointment.stock_source_pdf_ids,
        'stock_consumption_snapshot', appointment.stock_consumption_snapshot,
        'already_confirmed', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_agendamento_with_stock(bigint, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_agendamento_with_stock(bigint, numeric, jsonb) TO authenticated;

COMMENT ON FUNCTION public.complete_agendamento_with_stock(bigint, numeric, jsonb) IS
    'Conclui um atendimento e registra a baixa de bobinas de forma atomica e idempotente.';

NOTIFY pgrst, 'reload schema';
