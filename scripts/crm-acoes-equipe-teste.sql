-- Teste das ações da equipe (migração 20261122090000) no banco, SEM gravar nada:
-- tudo roda numa transação e termina com RAISE EXCEPTION (que desfaz tudo) trazendo
-- o resultado na mensagem. Rodar só depois de aplicar a migração, com autorização:
--   npx supabase db query --remote=avlefzsipbqvollukgyt --yes -f scripts/crm-acoes-equipe-teste.sql
-- Telefones fictícios (83 90000-...), nenhum cliente real é tocado.
BEGIN;
DO $t$
DECLARE
  k uuid := '7aaacbf5-0908-4d01-870c-e8cdbc9130d0';
  o uuid := '27efa8c5-edd2-4ad1-9392-12d687b9b472';
  team text := '5583900000001';
  cli text := '5583900009999';
  film text; r jsonb; out jsonb := '{}'; s timestamptz; s_portal uuid;
BEGIN
  UPDATE crm_read_keys
     SET scopes = (SELECT array_agg(DISTINCT x) FROM unnest(scopes || ARRAY['agenda:create','proposals:write','proposals:send']) x),
         operator_phones = ARRAY['83900000001']
   WHERE id = k;
  SELECT nome INTO film FROM crm_company_films(o) WHERE coalesce(preco, 0) > 0 ORDER BY pinned DESC LIMIT 1;
  out := out || jsonb_build_object('film', film, 'nono_digito_igual', crm_phone_key('83 9 0000-0001') = crm_phone_key('558300000001'));
  r := crm_save_client_with_draft(k, o, cli, 'Teste Rollback', 'Bessa', 'João Pessoa', 'teste',
         '[{"largura":"1,20","altura":"2,00","quantidade":2,"ambiente":"Sala"}]'::jsonb, film);
  out := out || jsonb_build_object('save', r);
  BEGIN
    PERFORM crm_proposal_generate(k, o, '5583911112222', cli, NULL, ARRAY[film], 10);
    out := out || '{"operador_errado":"PASSOU (ERRO!)"}';
  EXCEPTION WHEN others THEN out := out || jsonb_build_object('operador_errado', SQLERRM);
  END;
  out := out || jsonb_build_object('desconto_alto', crm_proposal_generate(k, o, team, cli, NULL, ARRAY[film], 50));
  out := out || jsonb_build_object('pelicula_x', crm_proposal_generate(k, o, team, cli, NULL, ARRAY['Pelicula Inexistente'], 0) - 'disponiveis');
  out := out || jsonb_build_object('gerar', crm_proposal_generate(k, o, team, cli, NULL, ARRAY[film], 10));
  out := out || jsonb_build_object('atualizar', crm_proposal_generate(k, o, team, cli, NULL, NULL, 5));
  out := out || jsonb_build_object('status', crm_proposal_status(o, cli, NULL));
  -- Fila "Enviar pela IA": simula o dono logado no app pedindo o envio de um link.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT owner_id FROM organizations WHERE id = o), 'role', 'authenticated')::text, true);
  out := out || jsonb_build_object('app_ve_botao', crm_ai_send_available());
  INSERT INTO proposal_portals (organization_id, client_id, created_by, expires_at)
  VALUES (o, (out->'save'->>'client_id')::integer, (SELECT owner_id FROM organizations WHERE id = o), now() + interval '7 days')
  RETURNING id INTO s_portal;
  out := out || jsonb_build_object('pedido', crm_ai_send_request(s_portal, 'Segue o orçamento: link'));
  out := out || jsonb_build_object('pedido_de_novo', crm_ai_send_request(s_portal, 'Mensagem trocada'));
  r := crm_ai_send_pending(k, o);
  out := out || jsonb_build_object('pendentes', jsonb_array_length(r), 'mensagem_da_fila', r->0->>'mensagem');
  out := out || jsonb_build_object('confirmar', crm_ai_send_confirm(k, o, (r->0->>'envio_id')::bigint, true, NULL));
  out := out || jsonb_build_object('confirmar_de_novo', crm_ai_send_confirm(k, o, (r->0->>'envio_id')::bigint, true, NULL));
  out := out || jsonb_build_object('situacao_no_app', crm_ai_send_status(s_portal)->>'status');
  PERFORM set_config('request.jwt.claims', '', true);
  s := date_trunc('day', now()) + interval '200 days';
  out := out || jsonb_build_object('agenda_longe', crm_agenda_create(k, o, team, cli, NULL, s, s + interval '1 hour', 'consulta', NULL));
  s := date_trunc('hour', now()) + interval '30 days 3 hours';
  out := out || jsonb_build_object('agenda1', crm_agenda_create(k, o, team, cli, NULL, s, s + interval '1 hour', 'visita_medicao', 'teste'));
  out := out || jsonb_build_object('agenda2', crm_agenda_create(k, o, team, cli, NULL, s, s + interval '1 hour', 'instalacao', NULL));
  out := out || jsonb_build_object('agenda3', crm_agenda_create(k, o, team, cli, NULL, s, s + interval '1 hour', 'instalacao', NULL));
  out := out || jsonb_build_object('equipe_ativa', (SELECT count(*) FROM organization_members WHERE organization_id = o AND status = 'active'));
  out := out || jsonb_build_object('outra_empresa', (SELECT crm_proposal_status(id, cli, NULL) FROM organizations WHERE id <> o LIMIT 1));
  out := out || jsonb_build_object('acoes_registradas', (SELECT count(*) FROM crm_team_actions WHERE key_id = k));
  RAISE EXCEPTION 'RESULTADO %', out;
END $t$;
ROLLBACK;
