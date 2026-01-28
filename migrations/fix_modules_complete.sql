-- Migração: Corrigir módulos e preços
-- Data: 2026-01-28
-- Autor: Sistema

-- 1. Inserir módulo pacote_completo (se não existir)
INSERT INTO subscription_modules (id, name, description, price_monthly, validity_months, features, is_active, sort_order)
VALUES (
    'pacote_completo',
    'Pacote Completo',
    'Todos os módulos liberados por 6 meses com desconto especial',
    149.00,
    6,
    '["Todos os 8 módulos disponíveis", "Desconto especial de 52%", "Suporte prioritário", "Sem limites de uso"]',
    true,
    99  -- Ordenação no final
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    is_active = EXCLUDED.is_active;

-- 2. Atualizar preços de todos os módulos para R$ 39
UPDATE subscription_modules
SET price_monthly = 39.00, validity_months = 6
WHERE id IN (
    'estoque', 
    'qr_servicos', 
    'colaboradores', 
    'ia_ocr', 
    'personalizacao', 
    'locais_global', 
    'corte_inteligente',
    'ilimitado'
);

-- 3. Atualizar nomes e descrições mais atraentes
UPDATE subscription_modules SET 
    name = 'Controle de Estoque',
    description = 'Gerencie bobinas, reduza o consumo de películas',
    sort_order = 1
WHERE id = 'estoque';

UPDATE subscription_modules SET 
    name = 'QR Code de Serviços',
    description = 'Gere QR Codes para serviços prestados aos clientes',
    sort_order = 2
WHERE id = 'qr_servicos';

UPDATE subscription_modules SET 
    name = 'Gestão de Equipe',
    description = 'Adicione colaboradores e gerencie permissões',
    sort_order = 3
WHERE id = 'colaboradores';

UPDATE subscription_modules SET 
    name = 'Extração com IA',
    description = 'Use IA para extrair dados de imagens automaticamente',
    sort_order = 4
WHERE id = 'ia_ocr';

UPDATE subscription_modules SET 
    name = 'Marca Própria',
    description = 'Personalize cores, logo e aparência das propostas',
    sort_order = 5
WHERE id = 'personalizacao';

UPDATE subscription_modules SET 
    name = 'Locais Globais PRO',
    description = 'Adicione e edite modelos em locais compartilhados',
    sort_order = 6
WHERE id = 'locais_global';

UPDATE subscription_modules SET 
    name = 'Corte Inteligente',
    description = 'Otimize o corte das bobinas para reduzir desperdício e maximizar aproveitamento',
    sort_order = 7
WHERE id = 'corte_inteligente';

UPDATE subscription_modules SET 
    name = 'Sem Limites',
    description = 'Clientes/películas/PDFs ilimitados',
    sort_order = 8
WHERE id = 'ilimitado';

-- 4. Verificar resultado
SELECT id, name, price_monthly, sort_order, is_active 
FROM subscription_modules 
ORDER BY sort_order;
