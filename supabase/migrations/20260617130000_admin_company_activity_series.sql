-- =====================================================
-- Série mensal de atividade de UMA empresa (detalhe do Admin)
-- =====================================================
-- Devolve os últimos 12 meses de orçamentos + faturamento de um usuário,
-- com meses vazios preenchidos com zero (para o mini-gráfico de tendência
-- no painel lateral). Carregada sob demanda → egress mínimo.
-- Restrito a administradores.
--
-- Aplique manualmente no SQL Editor do Supabase.

DROP FUNCTION IF EXISTS admin_company_activity_series(UUID);

CREATE OR REPLACE FUNCTION admin_company_activity_series(p_user_id UUID)
RETURNS TABLE (
    mes         DATE,
    orcamentos  BIGINT,
    faturamento NUMERIC
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
        RAISE EXCEPTION 'Apenas administradores podem ver o detalhe da empresa';
    END IF;

    RETURN QUERY
    WITH meses AS (
        SELECT generate_series(
            date_trunc('month', now()) - interval '11 months',
            date_trunc('month', now()),
            interval '1 month'
        )::date AS mes
    ),
    dados AS (
        SELECT date_trunc('month', date::timestamptz)::date AS mes,
               COUNT(*)                      AS orcamentos,
               SUM(COALESCE(total_preco, 0)) AS faturamento
        FROM saved_pdfs
        WHERE user_id = p_user_id
        GROUP BY 1
    )
    SELECT m.mes,
           COALESCE(d.orcamentos, 0),
           COALESCE(d.faturamento, 0)
    FROM meses m
    LEFT JOIN dados d ON d.mes = m.mes
    ORDER BY m.mes;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_company_activity_series(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
