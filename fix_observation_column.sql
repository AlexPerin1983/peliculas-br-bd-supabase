-- Adiciona a coluna 'observation' na tabela 'location_measurements' se ela não existir
ALTER TABLE location_measurements 
ADD COLUMN IF NOT EXISTS observation TEXT;

-- Atualiza o cache do esquema para garantir que a API reconheça a nova coluna imediatamente
NOTIFY pgrst, 'reload config';
