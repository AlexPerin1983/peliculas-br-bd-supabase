-- =====================================================
-- Uso de IA de UMA empresa (ficha do Admin)
-- =====================================================
-- Devolve, por funcionalidade de IA, quantas vezes o usuário usou nas últimas
-- 24 horas (a mesma janela do limite diário do gemini-proxy), em 7 e em 30
-- dias e no total, mais as falhas e os tokens dos últimos 30 dias.
-- Só leitura, carregada sob demanda ao abrir a ficha. Restrita a administradores.
--
-- Aplique manualmente no SQL Editor do Supabase, antes de publicar o app.

DROP FUNCTION IF EXISTS admin_company_ai_usage(UUID);

CREATE OR REPLACE FUNCTION admin_company_ai_usage(p_user_id UUID)
RETURNS TABLE (
    feature     TEXT,
    usos_24h    BIGINT,
    usos_7d     BIGINT,
    usos_30d    BIGINT,
    usos_total  BIGINT,
    falhas_30d  BIGINT,
    tokens_30d  BIGINT,
    ultimo_uso  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem ver o uso de IA';
    END IF;

    RETURN QUERY
    SELECT e.feature,
           COUNT(*) FILTER (WHERE e.created_at >= now() - interval '24 hours'),
           COUNT(*) FILTER (WHERE e.created_at >= now() - interval '7 days'),
           COUNT(*) FILTER (WHERE e.created_at >= now() - interval '30 days'),
           COUNT(*),
           COUNT(*) FILTER (WHERE e.created_at >= now() - interval '30 days' AND NOT e.success),
           COALESCE(SUM(e.total_token_count) FILTER (WHERE e.created_at >= now() - interval '30 days'), 0)::BIGINT,
           MAX(e.created_at)
    FROM ai_usage_events e
    WHERE e.user_id = p_user_id
    GROUP BY e.feature
    ORDER BY 4 DESC, 5 DESC;
END;
$$;

-- O Supabase dá EXECUTE a anon e authenticated por padrão: fica só para quem
-- está logado (a função recusa quem não é administrador).
REVOKE ALL ON FUNCTION admin_company_ai_usage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_company_ai_usage(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
