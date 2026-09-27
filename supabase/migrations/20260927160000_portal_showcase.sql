-- Página do cliente mais convincente: nota e depoimentos do Google, fotos de
-- trabalhos (vitrine da empresa) e a opção recomendada em cada link.

-- Vitrine da empresa (fica na linha do dono, como a marca).
ALTER TABLE public.user_info ADD COLUMN IF NOT EXISTS portal_showcase jsonb;

-- Opção destacada como "Recomendada" no link.
ALTER TABLE public.proposal_portals ADD COLUMN IF NOT EXISTS highlighted_pdf_id integer;

-- Fotos de trabalhos: bucket público (são para mostrar ao cliente), até 5 MB, só imagens.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('portfolio', 'portfolio', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Cada empresa grava apenas na sua pasta (primeiro segmento = owner da organização),
-- como no bucket de PDFs.
DROP POLICY IF EXISTS "portfolio_org_select" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_org_insert" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_org_update" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_org_delete" ON storage.objects;

CREATE POLICY "portfolio_org_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'portfolio'
  AND (storage.foldername(name))[1] = (
    SELECT COALESCE(o.owner_id::text, p.id::text)
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "portfolio_org_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'portfolio'
  AND (storage.foldername(name))[1] = (
    SELECT COALESCE(o.owner_id::text, p.id::text)
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "portfolio_org_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'portfolio'
  AND (storage.foldername(name))[1] = (
    SELECT COALESCE(o.owner_id::text, p.id::text)
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "portfolio_org_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'portfolio'
  AND (storage.foldername(name))[1] = (
    SELECT COALESCE(o.owner_id::text, p.id::text)
    FROM profiles p
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
  )
);
