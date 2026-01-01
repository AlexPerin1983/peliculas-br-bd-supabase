-- Migration: Adicionar coluna observacao à tabela locations
-- Esta coluna armazena observações públicas que são compartilhadas com outros aplicadores

-- Adiciona a coluna observacao se não existir
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS observacao TEXT;

-- Comentário para documentação
COMMENT ON COLUMN locations.observacao IS 'Observações públicas compartilhadas com outros aplicadores (acabamento, acesso, estado do vidro, etc.)';
