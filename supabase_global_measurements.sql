-- Migration: Global Measurement Sharing
-- Torna locais e medidas visíveis globalmente para leitura
-- Adiciona campos de identificação da empresa criadora

-- 1. Adicionar campos de identificação
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS created_by_company_name text;

ALTER TABLE location_measurements
ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_by_company_name text;

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Usuários podem ver seus próprios locais" ON locations;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias medidas" ON location_measurements;

-- 3. Criar novas políticas de LEITURA GLOBAL
CREATE POLICY "Leitura global de locais"
ON locations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Leitura global de medidas"
ON location_measurements FOR SELECT
TO authenticated
USING (true);

-- 4. Manter políticas de escrita restritas ao dono
-- Insert para locations
DROP POLICY IF EXISTS "Inserir locais" ON locations;
CREATE POLICY "Inserir locais"
ON locations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Update para locations
DROP POLICY IF EXISTS "Atualizar locais" ON locations;
CREATE POLICY "Atualizar locais"
ON locations FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Delete para locations
DROP POLICY IF EXISTS "Excluir locais" ON locations;
CREATE POLICY "Excluir locais"
ON locations FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Insert para location_measurements (via location owner)
DROP POLICY IF EXISTS "Inserir medidas" ON location_measurements;
CREATE POLICY "Inserir medidas"
ON location_measurements FOR INSERT
TO authenticated
WITH CHECK (
  location_id IN (SELECT id FROM locations WHERE user_id = auth.uid())
);

-- Update para location_measurements
DROP POLICY IF EXISTS "Atualizar medidas" ON location_measurements;
CREATE POLICY "Atualizar medidas"
ON location_measurements FOR UPDATE
TO authenticated
USING (
  location_id IN (SELECT id FROM locations WHERE user_id = auth.uid())
);

-- Delete para location_measurements
DROP POLICY IF EXISTS "Excluir medidas" ON location_measurements;
CREATE POLICY "Excluir medidas"
ON location_measurements FOR DELETE
TO authenticated
USING (
  location_id IN (SELECT id FROM locations WHERE user_id = auth.uid())
);

-- 5. Criar índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_locations_cidade ON locations (cidade);
CREATE INDEX IF NOT EXISTS idx_locations_uf ON locations (uf);

-- Comentário: Execute este script no Supabase SQL Editor
