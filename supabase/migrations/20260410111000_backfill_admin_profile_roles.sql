-- Remove dependencia de elevacao por email no frontend.
-- Os administradores conhecidos passam a ser autoridade de banco via profiles.role.

UPDATE profiles
SET role = 'admin'
WHERE lower(email) IN ('windowfilm.br@gmail.com', 'windowfilm.app@gmail.com')
  AND COALESCE(role, '') <> 'admin';
