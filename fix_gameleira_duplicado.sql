-- =====================================================
-- SCRIPT SIMPLES: Deletar duplicado específico
-- Caso: "Gameleira" com IDs 4 e 5 (mesmo CEP 58056170)
-- =====================================================

-- 1. Verificar as medidas de cada um
SELECT 
    l.id,
    l.name,
    l.cep,
    (SELECT COUNT(*) FROM location_measurements lm WHERE lm.location_id = l.id) as medidas_count
FROM locations l
WHERE l.id IN (4, 5);

-- 2. Se o ID 5 não tem medidas ou menos medidas que o 4, deletar o 5
-- Primeiro, transferir quaisquer medidas do 5 para o 4
UPDATE location_measurements 
SET location_id = 4 
WHERE location_id = 5;

-- 3. Deletar o registro duplicado (ID 5)
DELETE FROM locations WHERE id = 5;

-- 4. Verificar resultado
SELECT * FROM locations WHERE cep = '58056170';
