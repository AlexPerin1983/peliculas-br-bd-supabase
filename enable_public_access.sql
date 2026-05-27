-- Script legado inseguro descontinuado.
-- A consulta publica de estoque agora deve acontecer apenas via Edge Function
-- "public-estoque-lookup", que retorna um payload reduzido e auditavel.

DROP POLICY IF EXISTS "Public read access" ON bobinas;
DROP POLICY IF EXISTS "Public read access" ON retalhos;
DROP POLICY IF EXISTS "Public can read basic bobina info" ON bobinas;
DROP POLICY IF EXISTS "Public can read basic retalho info" ON retalhos;

REVOKE ALL ON TABLE bobinas FROM anon;
REVOKE ALL ON TABLE retalhos FROM anon;
