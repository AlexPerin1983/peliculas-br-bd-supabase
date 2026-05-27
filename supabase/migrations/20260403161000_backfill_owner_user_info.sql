INSERT INTO user_info (
    id,
    user_id,
    nome,
    empresa,
    telefone,
    email,
    endereco,
    cpf_cnpj,
    cores,
    payment_methods,
    proposal_validity_days,
    prazo_pagamento,
    working_hours,
    employees,
    ai_config,
    social_links
)
SELECT
    om.user_id::text,
    om.user_id,
    COALESCE(
        NULLIF(u.raw_user_meta_data->>'full_name', ''),
        NULLIF(u.raw_user_meta_data->>'name', ''),
        INITCAP(REGEXP_REPLACE(SPLIT_PART(p.email, '@', 1), '[._-]+', ' ', 'g'))
    ) AS nome,
    o.name AS empresa,
    '' AS telefone,
    p.email,
    '' AS endereco,
    '' AS cpf_cnpj,
    '{"primaria":"#364562","secundaria":"#937e44"}'::jsonb AS cores,
    '[
      {"tipo":"pix","ativo":true,"chave_pix":"","tipo_chave_pix":"email","nome_responsavel_pix":""},
      {"tipo":"boleto","ativo":false},
      {"tipo":"parcelado_sem_juros","ativo":true,"parcelas_max":1},
      {"tipo":"adiantamento","ativo":false,"porcentagem":30},
      {"tipo":"observacao","ativo":false,"texto":""}
    ]'::jsonb AS payment_methods,
    7 AS proposal_validity_days,
    'Pagamento devido na conclusao do servico.' AS prazo_pagamento,
    '{"start":"08:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb AS working_hours,
    jsonb_build_array(
        jsonb_build_object(
            'id', 1,
            'nome', COALESCE(
                NULLIF(u.raw_user_meta_data->>'full_name', ''),
                NULLIF(u.raw_user_meta_data->>'name', ''),
                INITCAP(REGEXP_REPLACE(SPLIT_PART(p.email, '@', 1), '[._-]+', ' ', 'g'))
            )
        )
    ) AS employees,
    '{"provider":"gemini","apiKey":""}'::jsonb AS ai_config,
    '{}'::jsonb AS social_links
FROM organization_members om
JOIN profiles p
    ON p.id = om.user_id
JOIN organizations o
    ON o.id = om.organization_id
LEFT JOIN auth.users u
    ON u.id = om.user_id
LEFT JOIN user_info ui
    ON ui.user_id = om.user_id
WHERE om.role = 'owner'
  AND om.status = 'active'
  AND om.user_id IS NOT NULL
  AND ui.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
