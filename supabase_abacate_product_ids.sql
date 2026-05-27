-- Preencha os IDs reais dos produtos recorrentes criados no AbacatePay.
-- Esses produtos devem representar assinatura com renovacao a cada 6 meses.

UPDATE subscription_modules
SET abacate_subscription_product_id = CASE id
    WHEN 'pacote_completo' THEN 'prod_rrPKgSwPjafJAcYNQqerA3sZ'
    WHEN 'estoque' THEN 'prod_2bfYW5A6EhqKsCqdq5AsquED'
    WHEN 'qr_servicos' THEN 'prod_Q1tPd3DqzfEyBbyH6uf36kxL'
    WHEN 'colaboradores' THEN 'prod_XwWRrE1xABnZP0245Dsb2HWW'
    WHEN 'ia_ocr' THEN 'prod_zMbHFb6Aqxac0fb14UJ5JGEH'
    WHEN 'personalizacao' THEN 'prod_tQyNrPdUuHdQYF5NnGShStNs'
    WHEN 'ilimitado' THEN 'prod_JZtzDbk5PeKweRdyR6RSeCLy'
    WHEN 'locais_global' THEN 'prod_S0t1epNYpdBwExXu2xyaAf5m'
    WHEN 'corte_inteligente' THEN 'prod_nUyZY1AdQSNfuntQCNTt6asj'
    ELSE abacate_subscription_product_id
END
WHERE id IN (
    'pacote_completo',
    'estoque',
    'qr_servicos',
    'colaboradores',
    'ia_ocr',
    'personalizacao',
    'ilimitado',
    'locais_global',
    'corte_inteligente'
);

-- Verificacao
SELECT
    id,
    name,
    price_monthly,
    validity_months,
    abacate_subscription_product_id
FROM subscription_modules
ORDER BY sort_order, id;
