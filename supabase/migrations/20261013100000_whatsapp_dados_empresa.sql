-- WhatsApp conectado: dados da empresa para a IA do painel local. A ponte devolve o
-- que o app já tem organizado (catálogo de películas com preço de venda, mão de obra
-- e garantias; formas de pagamento ativas; validade da proposta; horário; contatos e
-- nota do Google) para as sugestões de resposta usarem como verdade.
--
-- Só leitura, só para a ponte (service_role). Nunca devolve custo de compra (preço
-- por metro linear), chave PIX, chaves de IA, CPF/CNPJ, equipe nem dados de clientes.

CREATE OR REPLACE FUNCTION public.whatsapp_bridge_company_profile(p_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH org AS (
        SELECT o.id, o.owner_id FROM public.organizations o WHERE o.id = p_organization_id
    ), info AS (
        SELECT ui.* FROM public.user_info ui JOIN org ON ui.user_id = org.owner_id LIMIT 1
    ), members AS (
        -- O catálogo é da empresa: películas do dono e de quem é da mesma organização.
        SELECT org.owner_id AS user_id FROM org
        UNION
        SELECT p.id FROM public.profiles p WHERE p.organization_id = p_organization_id
    ), catalog AS (
        SELECT DISTINCT ON (lower(f.nome)) f.*
        FROM public.films f JOIN members m ON m.user_id = f.user_id
        WHERE coalesce(trim(f.nome), '') <> ''
        ORDER BY lower(f.nome), f.pinned DESC NULLS LAST, f.created_at DESC
    )
    SELECT jsonb_strip_nulls(jsonb_build_object(
        'empresa', (SELECT nullif(trim(empresa), '') FROM info),
        'telefone', (SELECT nullif(trim(telefone), '') FROM info),
        'email', (SELECT nullif(trim(email), '') FROM info),
        'endereco', (SELECT nullif(trim(endereco), '') FROM info),
        'site', (SELECT nullif(trim(site), '') FROM info),
        'redes', (
            SELECT jsonb_object_agg(link.key, link.value)
            FROM info, jsonb_each_text(CASE WHEN jsonb_typeof(info.social_links) = 'object' THEN info.social_links ELSE '{}'::jsonb END) link
            WHERE link.key IN ('instagram', 'facebook', 'tiktok', 'youtube', 'googleReviews') AND link.value ~ '^https?://'
        ),
        'horario', (SELECT working_hours FROM info WHERE jsonb_typeof(working_hours) = 'object'),
        'validade_proposta_dias', (SELECT proposal_validity_days FROM info),
        'prazo_pagamento', (SELECT nullif(left(trim(prazo_pagamento), 300), '') FROM info),
        'pagamento', (
            SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'tipo', method->>'tipo',
                'parcelas_max', method->'parcelas_max',
                'juros_mes', method->'juros',
                'desconto_percentual', method->'porcentagem',
                'texto', nullif(left(trim(method->>'texto'), 300), '')
            )))
            FROM info, jsonb_array_elements(CASE WHEN jsonb_typeof(info.payment_methods) = 'array' THEN info.payment_methods ELSE '[]'::jsonb END) method
            WHERE jsonb_typeof(method) = 'object' AND coalesce((method->>'ativo')::boolean, false)
        ),
        'google', (
            SELECT jsonb_strip_nulls(jsonb_build_object('nota', portal_showcase->'googleRating', 'avaliacoes', portal_showcase->'googleReviewCount'))
            FROM info WHERE jsonb_typeof(portal_showcase) = 'object'
        ),
        -- Depoimentos sem o nome de quem escreveu.
        'depoimentos', (
            SELECT jsonb_agg(left(trim(item->>'text'), 300))
            FROM (
                SELECT item FROM info, jsonb_array_elements(CASE WHEN jsonb_typeof(info.portal_showcase->'testimonials') = 'array' THEN info.portal_showcase->'testimonials' ELSE '[]'::jsonb END) item
                WHERE coalesce(trim(item->>'text'), '') <> '' LIMIT 3
            ) chosen
        ),
        'peliculas', (
            SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'nome', left(c.nome, 120),
                'preco_m2', c.preco,
                'mao_de_obra_m2', c.mao_de_obra,
                'garantia_fabricante_anos', c.garantia_fabricante,
                'garantia_instalacao', c.garantia_mao_de_obra,
                'garantia_instalacao_unidade', CASE WHEN c.garantia_mao_de_obra IS NULL THEN NULL ELSE coalesce(c.garantia_mao_de_obra_unidade, 'dias') END,
                'uv', c.uv, 'ir', c.ir, 'vtl', c.vtl, 'tser', c.tser, 'espessura', c.espessura,
                'destaque', CASE WHEN c.pinned THEN true END
            )) ORDER BY c.pinned DESC NULLS LAST, c.nome)
            FROM (SELECT * FROM catalog ORDER BY pinned DESC NULLS LAST, nome LIMIT 80) c
        )
    ));
$$;

REVOKE EXECUTE ON FUNCTION public.whatsapp_bridge_company_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_bridge_company_profile(uuid) TO service_role;
