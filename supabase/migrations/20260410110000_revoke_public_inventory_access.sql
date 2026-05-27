-- Revoga acesso anonimo amplo ao estoque.
-- A consulta publica por QR agora passa pela Edge Function public-estoque-lookup.

DROP POLICY IF EXISTS "Public read access" ON bobinas;
DROP POLICY IF EXISTS "Public read access" ON retalhos;
DROP POLICY IF EXISTS "Public can read basic bobina info" ON bobinas;
DROP POLICY IF EXISTS "Public can read basic retalho info" ON retalhos;

REVOKE ALL ON TABLE bobinas FROM anon;
REVOKE ALL ON TABLE retalhos FROM anon;
