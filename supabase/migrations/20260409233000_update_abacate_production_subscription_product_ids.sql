-- Atualiza os IDs recorrentes de producao do AbacatePay para os produtos
-- criados com cycle = SEMIANNUALLY. Sem isso, /v2/subscriptions/create
-- rejeita o checkout com "Subscription checkout only accepts products with cycle defined".

UPDATE subscription_modules
SET abacate_subscription_product_id = CASE id
    WHEN 'pacote_completo' THEN 'prod_MAqbktMQUkkBxD1Kx0TRyQT0'
    WHEN 'estoque' THEN 'prod_BgkWFzLFaaz3yAHjtyegnAxu'
    WHEN 'qr_servicos' THEN 'prod_a41xKWjZBqQNbQezMq4BKr1e'
    WHEN 'colaboradores' THEN 'prod_3GtbmfGEE2T24bC5um4QU3ga'
    WHEN 'ia_ocr' THEN 'prod_B6YQQWpHCQTMAMULQbaAQKKw'
    WHEN 'personalizacao' THEN 'prod_d2Q6UQmDuu4xEKRRkWuJzKK4'
    WHEN 'locais_global' THEN 'prod_w32uHTA5DQ3PgHrRQBPkgsH0'
    WHEN 'corte_inteligente' THEN 'prod_K6qUFqk0ReENFfHtpcdJt6m6'
    WHEN 'ilimitado' THEN 'prod_gMcdswNPsxf2e2pbm41rDe0D'
    ELSE abacate_subscription_product_id
END
WHERE id IN (
    'pacote_completo',
    'estoque',
    'qr_servicos',
    'colaboradores',
    'ia_ocr',
    'personalizacao',
    'locais_global',
    'corte_inteligente',
    'ilimitado'
);
