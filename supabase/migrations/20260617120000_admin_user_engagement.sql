-- =====================================================
-- Ranking de engajamento de usuários (painel Admin)
-- =====================================================
-- Agrega, por usuário, o volume real de uso da ferramenta:
--   orçamentos (saved_pdfs), clientes, agendamentos, serviços,
--   faturamento (soma dos orçamentos) e a última atividade.
--
-- Tudo é calculado no banco (SECURITY DEFINER) e devolvido já
-- agregado, então o egress é mínimo — só uma linha por usuário.
-- Restrito a administradores.
--
-- Aplique manualmente no SQL Editor do Supabase.

-- Necessário porque a assinatura de retorno mudou (inclui empresa/telefone).
DROP FUNCTION IF EXISTS admin_user_engagement();

CREATE OR REPLACE FUNCTION admin_user_engagement()
RETURNS TABLE (
    user_id          UUID,
    email            TEXT,
    empresa          TEXT,
    telefone         TEXT,
    created_at       TIMESTAMPTZ,
    orcamentos       BIGINT,
    clientes         BIGINT,
    agendamentos     BIGINT,
    servicos         BIGINT,
    faturamento      NUMERIC,
    ultima_atividade TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
-- Evita ambiguidade entre as colunas de saída (user_id, email, ...) e as
-- colunas de mesmo nome das tabelas internas: prefere sempre a coluna.
#variable_conflict use_column
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem ver o engajamento';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.email,
        ui.empresa,
        ui.telefone,
        p.created_at,
        COALESCE(pdf.cnt, 0)          AS orcamentos,
        COALESCE(cl.cnt, 0)           AS clientes,
        COALESCE(ag.cnt, 0)           AS agendamentos,
        COALESCE(sv.cnt, 0)           AS servicos,
        COALESCE(pdf.faturamento, 0)  AS faturamento,
        GREATEST(pdf.ultima, sv.ultima) AS ultima_atividade
    FROM profiles p
    LEFT JOIN (
        SELECT user_id,
               COUNT(*)                       AS cnt,
               SUM(COALESCE(total_preco, 0))  AS faturamento,
               MAX(date::timestamptz)         AS ultima
        FROM saved_pdfs
        GROUP BY user_id
    ) pdf ON pdf.user_id = p.id
    LEFT JOIN (
        SELECT user_id, COUNT(*) AS cnt
        FROM clients
        GROUP BY user_id
    ) cl ON cl.user_id = p.id
    LEFT JOIN (
        SELECT user_id, COUNT(*) AS cnt
        FROM agendamentos
        GROUP BY user_id
    ) ag ON ag.user_id = p.id
    LEFT JOIN (
        SELECT user_id,
               COUNT(*)                       AS cnt,
               MAX(data_servico::timestamptz) AS ultima
        FROM servicos_prestados
        GROUP BY user_id
    ) sv ON sv.user_id = p.id
    LEFT JOIN user_info ui ON ui.user_id = p.id
    WHERE p.role <> 'admin'
    ORDER BY orcamentos DESC, clientes DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_user_engagement() TO authenticated;

NOTIFY pgrst, 'reload schema';
