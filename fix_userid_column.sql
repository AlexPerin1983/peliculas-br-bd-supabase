-- Adiciona a coluna 'user_id' na tabela 'location_measurements' se ela não existir
-- Isso é importante para saber QUEM cadastrou a medida
ALTER TABLE location_measurements 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Garante que a coluna observation também esteja lá (caso o script anterior não tenha rodado)
ALTER TABLE location_measurements 
ADD COLUMN IF NOT EXISTS observation TEXT;

-- Atualiza o cache do esquema
NOTIFY pgrst, 'reload config';
