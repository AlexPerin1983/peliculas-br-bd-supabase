-- =====================================================
-- Fix D: mover PDFs (base64) do Postgres para o Supabase Storage
-- Adiciona a coluna pdf_path em saved_pdfs e cria o bucket privado "pdfs".
-- A coluna pdf_blob (base64) continua existindo para compatibilidade
-- durante a transição e é esvaziada pela migração de dados.
-- =====================================================

-- 1. Coluna com o caminho do arquivo no Storage (ex: "<owner_id>/<uuid>.pdf")
ALTER TABLE saved_pdfs ADD COLUMN IF NOT EXISTS pdf_path text;

-- 2. Bucket privado para os PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de acesso (RLS em storage.objects)
-- Cada usuário acessa apenas a pasta da sua organização.
-- O prefixo da pasta (primeiro segmento do caminho) é o owner_id da organização;
-- todos os membros da org resolvem para o mesmo owner_id e compartilham a pasta.
DROP POLICY IF EXISTS "pdfs_org_select" ON storage.objects;
DROP POLICY IF EXISTS "pdfs_org_insert" ON storage.objects;
DROP POLICY IF EXISTS "pdfs_org_update" ON storage.objects;
DROP POLICY IF EXISTS "pdfs_org_delete" ON storage.objects;

CREATE POLICY "pdfs_org_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pdfs'
  AND (storage.foldername(name))[1] = (
    SELECT COALESCE(o.owner_id::text, p.id::text)
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "pdfs_org_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pdfs'
  AND (storage.foldername(name))[1] = (
    SELECT COALESCE(o.owner_id::text, p.id::text)
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "pdfs_org_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'pdfs'
  AND (storage.foldername(name))[1] = (
    SELECT COALESCE(o.owner_id::text, p.id::text)
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'pdfs'
  AND (storage.foldername(name))[1] = (
    SELECT COALESCE(o.owner_id::text, p.id::text)
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "pdfs_org_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'pdfs'
  AND (storage.foldername(name))[1] = (
    SELECT COALESCE(o.owner_id::text, p.id::text)
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
  )
);
