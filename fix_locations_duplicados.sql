-- =====================================================
-- SCRIPT: Limpar locais duplicados por CEP
-- Mantém apenas o registro com mais medidas ou o mais antigo
-- =====================================================

-- 1. Primeiro, vamos ver quais CEPs têm duplicados
SELECT cep, COUNT(*) as total, array_agg(id ORDER BY id) as ids
FROM locations
WHERE cep IS NOT NULL AND cep != ''
GROUP BY cep
HAVING COUNT(*) > 1;

-- 2. Ver detalhes dos duplicados com contagem de medidas
SELECT 
    l.id,
    l.name,
    l.cep,
    l.cidade,
    l.uf,
    l.bairro,
    l.created_at,
    l.created_by_company_name,
    (SELECT COUNT(*) FROM location_measurements lm WHERE lm.location_id = l.id) as medidas_count
FROM locations l
WHERE l.cep IN (
    SELECT cep FROM locations 
    WHERE cep IS NOT NULL AND cep != ''
    GROUP BY cep HAVING COUNT(*) > 1
)
ORDER BY l.cep, medidas_count DESC, l.id;

-- 3. ANTES DE EXECUTAR, FAÇA BACKUP!
-- Criar tabela de backup
CREATE TABLE IF NOT EXISTS locations_backup AS SELECT * FROM locations;
CREATE TABLE IF NOT EXISTS location_measurements_backup AS SELECT * FROM location_measurements;

-- 4. Para cada CEP duplicado, manter apenas o que tem mais medidas (ou mais antigo)
-- Primeiro, transferir medidas dos registros que serão deletados para o que será mantido

-- Identificar o registro a manter para cada CEP duplicado (o com mais medidas ou mais antigo)
WITH ranked_locations AS (
    SELECT 
        l.id,
        l.cep,
        l.name,
        (SELECT COUNT(*) FROM location_measurements lm WHERE lm.location_id = l.id) as medidas_count,
        ROW_NUMBER() OVER (
            PARTITION BY l.cep 
            ORDER BY (SELECT COUNT(*) FROM location_measurements lm WHERE lm.location_id = l.id) DESC, l.id ASC
        ) as rn
    FROM locations l
    WHERE l.cep IN (
        SELECT cep FROM locations 
        WHERE cep IS NOT NULL AND cep != ''
        GROUP BY cep HAVING COUNT(*) > 1
    )
),
to_keep AS (
    SELECT id, cep FROM ranked_locations WHERE rn = 1
),
to_delete AS (
    SELECT rl.id, rl.cep, tk.id as keep_id
    FROM ranked_locations rl
    JOIN to_keep tk ON rl.cep = tk.cep
    WHERE rl.rn > 1
)
-- Mostrar o que será feito (executar primeiro para revisar)
SELECT 
    td.id as id_deletar,
    td.cep,
    td.keep_id as id_manter,
    (SELECT name FROM locations WHERE id = td.id) as nome_deletar,
    (SELECT name FROM locations WHERE id = td.keep_id) as nome_manter
FROM to_delete td;

-- 5. EXECUTAR A LIMPEZA (depois de revisar acima)
-- Transferir medidas para o registro que será mantido
/*
WITH ranked_locations AS (
    SELECT 
        l.id,
        l.cep,
        (SELECT COUNT(*) FROM location_measurements lm WHERE lm.location_id = l.id) as medidas_count,
        ROW_NUMBER() OVER (
            PARTITION BY l.cep 
            ORDER BY (SELECT COUNT(*) FROM location_measurements lm WHERE lm.location_id = l.id) DESC, l.id ASC
        ) as rn
    FROM locations l
    WHERE l.cep IN (
        SELECT cep FROM locations 
        WHERE cep IS NOT NULL AND cep != ''
        GROUP BY cep HAVING COUNT(*) > 1
    )
),
to_keep AS (
    SELECT id, cep FROM ranked_locations WHERE rn = 1
),
to_delete AS (
    SELECT rl.id, rl.cep, tk.id as keep_id
    FROM ranked_locations rl
    JOIN to_keep tk ON rl.cep = tk.cep
    WHERE rl.rn > 1
)
UPDATE location_measurements 
SET location_id = (
    SELECT keep_id FROM to_delete WHERE to_delete.id = location_measurements.location_id
)
WHERE location_id IN (SELECT id FROM to_delete);
*/

-- 6. Deletar os registros duplicados (após transferir medidas)
/*
WITH ranked_locations AS (
    SELECT 
        l.id,
        l.cep,
        ROW_NUMBER() OVER (
            PARTITION BY l.cep 
            ORDER BY (SELECT COUNT(*) FROM location_measurements lm WHERE lm.location_id = l.id) DESC, l.id ASC
        ) as rn
    FROM locations l
    WHERE l.cep IN (
        SELECT cep FROM locations 
        WHERE cep IS NOT NULL AND cep != ''
        GROUP BY cep HAVING COUNT(*) > 1
    )
)
DELETE FROM locations 
WHERE id IN (SELECT id FROM ranked_locations WHERE rn > 1);
*/

-- 7. Verificar resultado final
SELECT cep, COUNT(*) as total
FROM locations
WHERE cep IS NOT NULL AND cep != ''
GROUP BY cep
HAVING COUNT(*) > 1;
-- Se retornar 0 linhas, não há mais duplicados!
