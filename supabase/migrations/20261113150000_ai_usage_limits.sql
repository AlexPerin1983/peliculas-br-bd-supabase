-- =====================================================
-- Limite diário de IA por empresa (definido pelo Admin)
-- =====================================================
-- Sem linha aqui, vale o limite padrão do gemini-proxy (200 usos em 24 horas).
-- Com linha, vale o número guardado; 0 corta a IA daquele login.
-- O gemini-proxy lê esta tabela com a chave de serviço; o app só chega a ela
-- pelas duas funções abaixo, restritas a administradores.
--
-- Aplique manualmente no SQL Editor do Supabase, ANTES de publicar o
-- gemini-proxy e o app que dependem dela.

CREATE TABLE IF NOT EXISTS public.ai_usage_limits (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_limit INTEGER NOT NULL CHECK (daily_limit >= 0 AND daily_limit <= 10000),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;
-- Sem políticas: nenhum login lê ou escreve direto na tabela.
REVOKE ALL ON public.ai_usage_limits FROM PUBLIC, anon, authenticated;

-- Limite guardado para um login (NULL = usa o padrão).
CREATE OR REPLACE FUNCTION admin_get_ai_daily_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem ver o limite de IA';
    END IF;

    RETURN (SELECT l.daily_limit FROM ai_usage_limits l WHERE l.user_id = p_user_id);
END;
$$;

-- Define o limite de um login; NULL apaga a linha e volta ao padrão.
CREATE OR REPLACE FUNCTION admin_set_ai_daily_limit(p_user_id UUID, p_daily_limit INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem mudar o limite de IA';
    END IF;

    IF p_daily_limit IS NULL THEN
        DELETE FROM ai_usage_limits WHERE user_id = p_user_id;
        RETURN NULL;
    END IF;

    IF p_daily_limit < 0 OR p_daily_limit > 10000 THEN
        RAISE EXCEPTION 'O limite precisa ficar entre 0 e 10000';
    END IF;

    INSERT INTO ai_usage_limits (user_id, daily_limit, updated_at, updated_by)
    VALUES (p_user_id, p_daily_limit, now(), auth.uid())
    ON CONFLICT (user_id) DO UPDATE
        SET daily_limit = EXCLUDED.daily_limit,
            updated_at  = now(),
            updated_by  = auth.uid();

    RETURN p_daily_limit;
END;
$$;

-- O Supabase dá EXECUTE a anon e authenticated por padrão: ficam só para quem
-- está logado (as funções recusam quem não é administrador).
REVOKE ALL ON FUNCTION admin_get_ai_daily_limit(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_set_ai_daily_limit(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_get_ai_daily_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_ai_daily_limit(UUID, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
