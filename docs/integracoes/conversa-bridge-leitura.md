# Leitura do CRM pelo atendimento de WhatsApp (Conversa Bridge Ai)

Primeira etapa: **somente leitura**. O atendimento (projeto Lovable "Conversa Bridge Ai")
pode consultar:

1. **Propostas** de um cliente pelo telefone.
2. **Agenda** de um intervalo de datas, com os horários livres.

Nesta etapa a integração **não** cria agendamento, **não** altera proposta, **não** envia
mensagem e **não** conta visualização da proposta.

Com uma permissão à parte (`clients:create`), o atendimento também pode **salvar o
cliente** que a IA terminou de qualificar (seção 4b). Ele só cria um cadastro novo:
nunca altera nem apaga cliente existente.

Arquivos:

| O quê | Onde |
|---|---|
| Tabela da chave e consultas no banco | `supabase/migrations/20261120120000_crm_leitura_atendimento.sql` |
| Função publicada | `supabase/functions/crm-read/` (`index.ts`, `crmReadHandler.ts`, `crmReadLogic.ts`) |
| Salvar cliente (permissão, registro e limite) | `supabase/migrations/20261121090000_crm_salvar_cliente.sql` |
| Testes | `src/lib/crmReadLogic.test.ts`, `src/lib/crmReadHandler.test.ts`, `src/lib/crmSaveClient.test.ts` |
| Criar, listar e revogar chave | `scripts/crm-read-key.mjs` |
| Conferência depois de publicar | `scripts/crm-read-smoke.mjs` |

---

## 1. Como a segurança funciona

- **A chave é de uma empresa só.** Cada chave fica na tabela `crm_read_keys`, presa a uma
  `organization_id`. O banco guarda só o SHA-256 da chave, nunca a chave.
- **A empresa vem sempre da chave.** A função descobre a empresa pela chave. Se o pedido
  trouxer `company_id`, `organization_id`, `empresa_id`, `tenant` ou outro campo
  desconhecido, ele é **recusado** (erro 400) antes de qualquer leitura.
- **Mudar o telefone não abre outra empresa.** O telefone só é procurado entre os clientes
  da empresa da chave, com a mesma regra de separação que o app já usa. Telefone de cliente
  de outra empresa responde "não encontrado".
- **Não existe consulta por id de proposta** nesta etapa. Só por telefone, sempre filtrada
  pela empresa.
- **Chave separada da ponte do WhatsApp conectado.** A chave da ponte (`x-bridge-key`) pode
  criar cliente e mexer na fila; esta só lê. Uma não funciona no lugar da outra.
- **Chave revogável e com validade.** Desligar a chave vale na hora, sem publicar nada.
  A chave nasce com validade de 365 dias (dá para mudar).
- **Nada de segredo no navegador nem nos registros.** A chave fica só no servidor do
  atendimento. A função não registra chave, telefone nem resposta; em erro, registra só um
  código (`propostas_failed`, `key_lookup_failed`...).
- **Dados mínimos.** Fica de fora: nome completo (vai só o primeiro nome), telefone,
  endereço (vai só bairro e cidade: do próprio cliente e dos compromissos da agenda), CPF/CNPJ, e-mail, observações, custos,
  arquivo do PDF, link da proposta e mensagens trocadas.
- **Funções só do servidor.** As funções SQL são `SECURITY DEFINER`, com EXECUTE revogado de
  `PUBLIC, anon, authenticated` e liberado só para `service_role`. O app não vê a tabela de
  chaves.

A única escrita é a hora do último uso da chave (`last_used_at`), no máximo uma vez por
hora, para saber se a chave está em uso.

---

## 2. Endereço e autenticação

```
POST https://avlefzsipbqvollukgyt.supabase.co/functions/v1/crm-read
Content-Type: application/json
x-crm-key: <chave de leitura>
```

- A chave tem o formato `pbr_ro_` seguido de 43 caracteres.
- Só `POST`. O corpo pode ter no máximo 4 KB.
- As respostas vêm com `Cache-Control: no-store`.
- Datas e horas vêm no horário de Brasília (`-03:00`).

---

## 3. Consulta de propostas

### Pedido

```json
{ "action": "propostas", "telefone": "5521998765432" }
```

- `telefone`: só os dígitos, com DDD. Com ou sem o 55: até 11 dígitos é tratado como número
  nacional. Procura com e sem o nono dígito.
- **No atendimento, use sempre o número de quem mandou a mensagem no WhatsApp**, nunca um
  número digitado pelo cliente. Assim ninguém consegue pedir a proposta de outra pessoa.

### Resposta (exemplo com dados inventados)

```json
{
  "encontrado": true,
  "clientes": [{ "ref": 101, "primeiro_nome": "Maria", "bairro": "Bessa", "cidade": "João Pessoa" }],
  "propostas": [
    {
      "id": "link:3f6c0d8e-0000-4000-8000-000000000001",
      "tipo": "link",
      "cliente_ref": 101,
      "situacao": "aguardando_resposta",
      "criada_em": "2026-11-18T10:00-03:00",
      "valida_ate": "2026-11-25T10:00-03:00",
      "visualizacoes": 3,
      "ultima_visualizacao_em": "2026-11-19T19:10-03:00",
      "decisao_em": null,
      "opcao_recomendada_id": 502,
      "opcao_escolhida_id": null,
      "prazo_instalacao": null,
      "opcoes": [
        {
          "id": 501,
          "nome": "Opção econômica",
          "versao": 1,
          "situacao_orcamento": "pendente",
          "recomendada": false,
          "escolhida": false,
          "peliculas": ["Fumê G20"],
          "area_m2": 12.5,
          "valor_total": 1500,
          "condicao_especial": null,
          "pagamento": {
            "prazo": "50% na aprovação",
            "origem": "proposta",
            "opcoes": [
              { "forma": "pix", "descricao": "Pix à vista com 5% de desconto", "parcelas": 1, "valor_parcela": 1425, "total": 1425 }
            ]
          },
          "emitida_em": "2026-11-18T09:00-03:00",
          "valida_ate": "2026-11-25T09:00-03:00"
        },
        {
          "id": 502,
          "nome": "Nano cerâmica",
          "versao": 1,
          "situacao_orcamento": "pendente",
          "recomendada": true,
          "escolhida": false,
          "peliculas": ["Nano Cerâmica 35"],
          "area_m2": 12.5,
          "valor_total": 2160,
          "condicao_especial": {
            "valor_original": 2400,
            "valor_final": 2160,
            "desconto_valor": 240,
            "desconto_percentual": 10,
            "valida_ate": "2026-11-22T20:00-03:00"
          },
          "pagamento": {
            "prazo": "Restante na conclusão",
            "origem": "padrao_empresa",
            "opcoes": [
              { "forma": "parcelado_sem_juros", "descricao": "1x sem juros", "parcelas": 1, "valor_parcela": 2160, "total": 2160 },
              { "forma": "parcelado_sem_juros", "descricao": "3x sem juros", "parcelas": 3, "valor_parcela": 720, "total": 2160 }
            ]
          },
          "emitida_em": "2026-11-18T09:00-03:00",
          "valida_ate": "2026-11-25T09:00-03:00"
        }
      ]
    }
  ],
  "avisos": ["O CRM não guarda prazo de instalação: não informe um prazo sem confirmar com a equipe."]
}
```

O texto de `descricao` é o mesmo do link da proposta. O exemplo está resumido: com
"até 3x sem juros", vêm as linhas de 1x, 2x e 3x.

Telefone sem cadastro na empresa:

```json
{ "encontrado": false, "clientes": [], "propostas": [], "avisos": [] }
```

### O que cada campo quer dizer

| Campo | Significado |
|---|---|
| `clientes[].ref` | Número interno do cadastro (não é dado pessoal). Se vier mais de um, há cadastros repetidos com o mesmo telefone (vem um aviso). |
| `clientes[].bairro` / `cidade` | Bairro e cidade do cadastro do próprio cliente (para saber se a equipe estará perto). Vazio quando o cadastro não tem. Nunca rua, número ou CEP. |
| `propostas[].id` | `link:<id>` para proposta enviada por link; `orcamentos:<ref>` para orçamentos que nunca foram enviados por link. |
| `situacao` | `aguardando_resposta`, `em_negociacao` (cliente pediu outro valor), `aprovada`, `recusada`, `vencida`, `perdida` (marcada como perdida pela equipe) ou `sem_link`. |
| `visualizacoes` / `ultima_visualizacao_em` | Quantas vezes o cliente abriu o link e quando foi a última. |
| `opcao_recomendada_id` | Opção com o selo "Recomendada" no link. |
| `opcao_escolhida_id` | Opção que o cliente aprovou. |
| `opcoes[].versao` | 1 = valor original; 2, 3... = valor revisado pela equipe no acompanhamento. |
| `opcoes[].valor_total` | Valor que vale hoje (já com a condição especial, se houver). |
| `condicao_especial` | Desconto combinado no link, com o valor antes e depois e até quando vale. |
| `pagamento.origem` | `proposta` (formas escolhidas nesta proposta), `padrao_empresa` (proposta antiga sem formas próprias: valem as das Configurações) ou `nao_configurado`. |
| `peliculas` | Películas das medidas ativas da opção. |
| `prazo_instalacao` | Sempre `null`: o CRM não guarda esse prazo (o PDF diz "a ser definido em comum acordo"). |

Limites: até 5 cadastros por telefone, os 10 links mais recentes e os 10 orçamentos mais
recentes, mais os orçamentos que estão nesses links. Links revogados não aparecem.

---

## 4. Consulta da agenda

### Pedido

```json
{ "action": "agenda", "de": "2026-11-23", "ate": "2026-11-27" }
```

- Datas no formato `AAAA-MM-DD`, no horário de Brasília. São no máximo 31 dias por consulta.

### Resposta (exemplo com dados inventados)

```json
{
  "fuso": "America/Sao_Paulo",
  "de": "2026-11-23",
  "ate": "2026-11-24",
  "horario_trabalho": { "inicio": "08:00", "fim": "18:00", "dias_semana": [1, 2, 3, 4, 5] },
  "ocupados": [
    { "inicio": "2026-11-23T10:00-03:00", "fim": "2026-11-23T12:00-03:00", "tipo": "instalacao", "situacao": "agendado", "bairro": "Tijuca", "cidade": "Rio de Janeiro" },
    { "inicio": "2026-11-24T09:00-03:00", "fim": "2026-11-24T10:00-03:00", "tipo": "visita_orcamento", "situacao": "agendado", "bairro": "Centro", "cidade": "Niterói" }
  ],
  "livres": [
    { "inicio": "2026-11-23T08:00-03:00", "fim": "2026-11-23T10:00-03:00" },
    { "inicio": "2026-11-23T12:00-03:00", "fim": "2026-11-23T18:00-03:00" },
    { "inicio": "2026-11-24T08:00-03:00", "fim": "2026-11-24T09:00-03:00" },
    { "inicio": "2026-11-24T10:00-03:00", "fim": "2026-11-24T18:00-03:00" }
  ],
  "avisos": ["Horário livre não é reserva: confirme com a equipe antes de prometer um horário ao cliente."]
}
```

- `tipo`: `visita_orcamento` (tipo "consulta" no app), `instalacao`, `variado`, `outro` ou
  `nao_informado` (agendamentos antigos sem tipo).
- `situacao`: `agendado`, `concluido` ou `parcial`. Cancelados e "não compareceu" não aparecem
  e não ocupam horário.
- `livres`: horário de trabalho das Configurações menos os compromissos, só daqui para a
  frente, em janelas de pelo menos 30 minutos. Compromisso sem hora de fim conta 1 hora.
  O cálculo não considera tempo de deslocamento nem a equipe ou o carro disponível.
- Sem horário de trabalho configurado, `horario_trabalho` e `livres` vêm `null`, com um aviso.
- A agenda é a da empresa inteira (dono e equipe). Não vem nome do cliente, título nem
  observações.

---

## 4b. Salvar o cliente qualificado (permissão `clients:create`)

Para quando a IA termina a qualificação e passa para a equipe montar o orçamento. Só
funciona com uma chave que tenha a permissão `clients:create` (seção 6).

### Pedido

```json
{
  "action": "cliente_salvar",
  "telefone": "558398141069",
  "nome": "Roseanny Nascimento✨🌸",
  "bairro": "Bessa",
  "resumo": "2 janelas, 1,73 × 1,25, quer claridade, enviou foto. Anúncio: Conforto sem perder a luz."
}
```

- `telefone` (obrigatório): **o número de quem mandou a mensagem**, nunca um número escrito na
  conversa.
- `nome` (opcional): o nome do WhatsApp ou o que o cliente disse. O CRM tira emojis,
  símbolos e letras "decoradas". Se sobrar pouco (ex.: "♠❤♣♦", "s.a"), o cliente é salvo como
  **"Cliente WhatsApp final 1069"** e a resposta avisa com `nome_provisorio: true`. O
  atendimento deve perguntar o nome **antes** de passar para a equipe.
- `bairro` e `cidade` (opcionais): até 80 caracteres.
- `resumo` (opcional): até 800 caracteres. Vira a observação do cadastro, como
  "Veio do WhatsApp (IA) em 20/11/2026: ...". Não mande fotos, links nem dados de terceiros.

### Rascunho de medidas (opcional)

O pedido pode levar as medidas e a película que a IA levantou:

```json
"medidas": [{ "largura": 5, "altura": 2, "quantidade": 1, "local": "Cortina de vidro" }, { "largura": "3", "altura": "2" }],
"pelicula": "Nano Cerâmica"
```

- As medidas vão em metros ("1,20", 1.2) ou em centímetros (acima de 20 conta como cm: "120" = 1,20 m).
- Cada medida precisa ficar entre 5 cm e 20 m, com no máximo 30 medidas e quantidade de 1 a 50.
- Medida que não se encaixa recusa o pedido inteiro (400).
- O CRM cria uma opção **"WhatsApp (rascunho)"** na tela de orçamento do cliente, com essas medidas
  e a observação *"Medida aproximada informada pelo cliente no WhatsApp. Conferir antes de
  enviar."*.
- Isso só acontece **se o cliente ainda não tem nenhuma opção de proposta**. O que a equipe já
  montou nunca é alterado.
- **Película:** usa o nome enviado só se ele existir no catálogo da empresa. Senão, usa a película
  fixada no topo do catálogo e, se não houver, "Nenhuma".
- A resposta ganha `"rascunho_medidas"`: `"criado"`, `"ja_existia"` ou `"sem_medidas"`.
- Nada é enviado ao cliente: o rascunho é só para a equipe conferir e gerar o orçamento.

### O que o CRM faz

- **Telefone novo na empresa:** cria o cliente com nome, telefone, bairro, cidade e
  observação. O cadastro fica na empresa da chave.
- **Telefone que já existe** (com ou sem o nono dígito): **não cria e não altera nada**.
  Só devolve a referência.
- **Nos dois casos**, manda um aviso para os celulares da empresa que recebem avisos do app:
  - cliente novo: "Novo cliente pronto para orçamento: Roseanny (Bessa), pelo WhatsApp.";
  - cliente que já existia: "Cliente pediu orçamento de novo".

  Tocar no aviso abre a lista de clientes. Se o aviso falhar, o cadastro vale do mesmo jeito.
- **Limite:** no máximo 30 pedidos por hora por chave (erro 429 depois disso). Cada pedido
  fica registrado em `crm_client_saves`.

### Resposta

```json
{ "cliente_ref": 1234, "criado": true, "nome_salvo": "Roseanny Nascimento", "nome_provisorio": false }
```

Cliente que já existia:

```json
{ "cliente_ref": 1234, "criado": false, "nome_salvo": null, "nome_provisorio": false }
```

O nome do cadastro antigo não é devolvido.

---

## 5. Erros

| HTTP | Quando | Corpo |
|---|---|---|
| 400 | Pedido inválido: campo de empresa (`company_id`...), campo desconhecido, ação que não existe, telefone ou datas inválidas | `{ "error": "..." }` com o motivo |
| 401 | Sem chave, chave em formato errado, inexistente, desligada, revogada ou vencida | `{ "error": "Chave de acesso ausente ou inválida." }` (sempre igual) |
| 403 | A chave não tem permissão para essa consulta (ex.: chave só de agenda) | `{ "error": "Esta chave não pode fazer esta consulta." }` |
| 405 | Método diferente de POST | |
| 413 | Corpo maior que 4 KB | |
| 429 | Salvar cliente: limite de 30 por hora atingido | `{ "error": "Limite de cadastros por hora atingido. Tente mais tarde." }` |
| 503 | Banco indisponível | Mensagem genérica, sem detalhes internos |

---

## 6. Chave de leitura: criar, listar, trocar e revogar

Todos os passos abaixo mexem em produção e só acontecem **com autorização do dono**.
O SQL roda pelo SQL Editor do Supabase ou por `npx supabase db query --linked`, com o
seletor de permissão do assistente em Manual.

### Descobrir o id da empresa (somente leitura)

```sql
SELECT id, name FROM public.organizations WHERE name ILIKE '%nome da empresa%';
```

### Criar

```powershell
node scripts/crm-read-key.mjs criar --empresa <id-da-empresa> --rotulo "Conversa Bridge Ai"
```

1. O script copia a chave para a área de transferência. **Ela não aparece na tela.**
2. Cole a chave na hora nos segredos do servidor do atendimento (ver seção 8), com o nome
   `PELICULASBR_CRM_KEY`. Não cole no chat, em e-mail nem em arquivo.
3. Rode o SQL que o script imprimiu. Ele grava só o SHA-256 da chave e devolve o id da chave.
4. Copie qualquer outro texto para limpar a área de transferência.

Opções: `--validade-dias 365` (de 1 a 730) e `--somente propostas` ou `--somente agenda`.

### Listar (não mostra a chave)

```powershell
node scripts/crm-read-key.mjs listar --empresa <id-da-empresa>
```

### Revogar (vale na hora)

```powershell
node scripts/crm-read-key.mjs revogar --id <id-da-chave>
```

### Trocar a chave sem parar o atendimento

1. Crie uma chave nova e troque o segredo no atendimento.
2. Confira que o atendimento continua respondendo.
3. Revogue a chave antiga.

Se a chave vazar (apareceu num print, num chat ou num registro), revogue na hora e crie outra.

---

## 7. Ordem de publicação (cada passo com autorização do dono)

Juntar este PR no `main` não muda nada que os usuários do app veem: não há tela nova.

1. **Conferir as colunas usadas** (somente leitura). Todas devem existir:

   ```sql
   SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND (
         (table_name = 'agendamentos' AND column_name IN ('start', 'end', 'user_id', 'client_id', 'event_type', 'service_status'))
      OR (table_name = 'clients' AND column_name IN ('id', 'nome', 'telefone', 'bairro', 'cidade', 'organization_id', 'user_id'))
      OR (table_name = 'saved_pdfs' AND column_name IN ('client_id', 'date', 'expiration_date', 'status', 'proposal_option_name', 'total_preco', 'total_m2', 'payment_config', 'measurements', 'follow_up_base_value', 'follow_up_discount_percent', 'follow_up_discount_amount', 'follow_up_revision'))
      OR (table_name = 'proposal_portals' AND column_name IN ('highlighted_pdf_id', 'lost_at', 'decision_pdf_id', 'view_count', 'last_viewed_at'))
      OR (table_name = 'proposal_portal_items' AND column_name IN ('condition_original_value', 'condition_final_value', 'condition_discount_amount', 'condition_discount_percent', 'condition_expires_at'))
      OR (table_name = 'user_info' AND column_name IN ('working_hours', 'payment_methods', 'prazo_pagamento', 'proposal_validity_days'))
   ) ORDER BY 1, 2;
   -- E a função de telefone usada pela ponte:
   SELECT to_regprocedure('public.whatsapp_phone_digits(text)');
   ```

2. **Aplicar a migração** `20261120120000_crm_leitura_atendimento.sql` à mão (não usar
   `supabase db push`).
3. **Conferir as permissões** com o `SELECT has_function_privilege(...)` que está no fim da
   migração: tudo precisa dar `false`.
4. **Publicar a função**, sem verificação de JWT (quem chama é o servidor do atendimento):

   ```powershell
   npx supabase functions deploy crm-read --project-ref avlefzsipbqvollukgyt --use-api --no-verify-jwt
   ```

5. **Criar a chave** (seção 6) e colocá-la no atendimento.
6. **Rodar a conferência** (seção 9).

### Salvar cliente (migração `20261121090000_crm_salvar_cliente.sql`)

1. Conferir o nome da regra de permissões da tabela de chaves (somente leitura). Deve existir
   `crm_read_keys_scopes_check`:

   ```sql
   SELECT conname FROM pg_constraint WHERE conrelid = 'public.crm_read_keys'::regclass AND contype = 'c';
   ```

2. Aplicar a migração à mão e conferir as permissões, com o SQL que está no fim dela.
3. Publicar a função `crm-read` de novo (mesmo comando acima).
4. Dar a permissão à chave do atendimento, **só com autorização do dono**:

   ```sql
   UPDATE public.crm_read_keys SET scopes = array_append(scopes, 'clients:create')
    WHERE id = '<id da chave>' AND NOT ('clients:create' = ANY (scopes))
   RETURNING id, scopes;
   ```

   Para tirar a permissão sem desligar a leitura:
   `UPDATE public.crm_read_keys SET scopes = array_remove(scopes, 'clients:create') WHERE id = '<id da chave>';`

---

## 8. O que configurar no projeto Lovable (Conversa Bridge Ai)

Nada disto foi feito ainda. Fica para a próxima etapa, com autorização do dono.

1. **Segredos do servidor** (Lovable Cloud → Secrets), nunca no código nem no navegador:
   - `PELICULASBR_CRM_URL` = `https://avlefzsipbqvollukgyt.supabase.co/functions/v1/crm-read`
   - `PELICULASBR_CRM_KEY` = a chave de leitura
2. **Uma função só do servidor** (ex.: `src/lib/crm.server.ts`) que faz o `POST` com o
   cabeçalho `x-crm-key`. Nunca chamar a partir de componente ou rota do navegador.
3. **Telefone sempre do remetente.** A consulta de propostas usa o número que chegou no
   webhook do WhatsApp, nunca um número escrito na conversa.
4. **Sem registros sensíveis.** Não gravar a chave, o corpo da resposta nem o telefone em
   `console.log` ou nos registros de erro. Se precisar guardar o resultado, guardar só o
   necessário (ex.: `situacao` e `opcao_recomendada_id`).
5. **Tempo limite e falha silenciosa.** Tempo limite de uns 8 segundos. Se a consulta falhar
   (401, 503, tempo esgotado), a IA segue sem os dados e passa para a equipe, sem inventar.
6. **Instruções para a IA**:
   - Usar só o que veio do CRM. Não inventar valor, desconto, prazo de instalação nem
     horário.
   - `prazo_instalacao` nulo: dizer que a equipe confirma o prazo.
   - `livres` não é reserva: oferecer o horário como "posso verificar com a equipe".
   - Proposta `vencida`, `recusada` ou `perdida`: não oferecer o valor antigo como válido;
     passar para a equipe.
   - Com mais de um cadastro (`clientes` com mais de um item), não misturar propostas.
   - Serviço pequeno: avaliar por foto e medida. Visita só para projeto grande ou cliente com
     intenção concreta de fechar.
7. **Uso econômico.** Consultar propostas quando a conversa for sobre orçamento (ex.: no
   início da conversa ou quando o cliente citar a proposta), não a cada mensagem. A agenda
   só quando o assunto for marcar horário.
8. **Salvar cliente (seção 4b):**
   - chamar `cliente_salvar` **uma vez por conversa**, no momento em que a IA termina a
     qualificação e passa para a equipe montar o orçamento. Não salvar quando ela passa para
     a equipe por outro motivo ("quero falar com alguém", CRM fora do ar);
   - se o nome do WhatsApp não servir, a IA pergunta o nome **antes** da mensagem final
     ("Para o especialista já te chamar pelo nome, com quem eu falo?");
   - o resumo leva o que a IA levantou: quantidade, medidas, o que incomoda, se mandou foto,
     o anúncio de origem e a película sugerida. Nada de dados de outras pessoas.

---

## 9. Testes

### Automáticos (sem rede e sem banco)

```powershell
npx vitest run src/lib/crmReadLogic.test.ts src/lib/crmReadHandler.test.ts src/lib/crmSaveClient.test.ts
```

Cobrem:

- **Acesso autorizado:** a chave da empresa A lê as propostas e a agenda da empresa A.
- **Credencial inválida:** sem chave, formato errado, inexistente, revogada ou desligada dá
  401 e nada é lido; chave sem permissão dá 403; banco fora do ar dá 503 sem detalhes.
- **Outra empresa:**
  - a chave da A com o telefone de um cliente da B não encontra nada;
  - `company_id`, `organization_id`, `organizationId` e `empresa_id` são recusados antes de
    ler;
  - a B só vê os próprios dados;
  - a agenda usa sempre a empresa da chave.
- **Dados mínimos:** a resposta não leva nome completo, telefone, CPF, endereço, link,
  arquivo, observações nem orçamento de outro cliente.
- **Agenda:** horários livres, dias fora do expediente, horário que já passou, compromisso
  sem fim e falta de horário de trabalho configurado.
- **Pedidos estranhos:** ação de escrita, JSON quebrado, pedido grande demais; o registro de
  erro não leva chave nem telefone.
- **Salvar cliente:**
  - a chave sem `clients:create` dá 403;
  - o nome sai limpo (emojis, letras decoradas), e só com emoji ou iniciais vira o nome
    provisório;
  - telefone que já existe não cria e não devolve o nome antigo;
  - o limite por hora dá 429;
  - aviso no celular que falhou não desfaz o cadastro;
  - `company_id` é recusado antes de salvar.

### Depois de publicar (com a chave de verdade)

No terminal, sem salvar em arquivo:

```powershell
$env:CRM_READ_URL = 'https://avlefzsipbqvollukgyt.supabase.co/functions/v1/crm-read'
$env:CRM_READ_KEY = Get-Clipboard
$env:CRM_READ_PHONE = '<telefone de um cliente desta empresa com proposta>'
$env:CRM_READ_PHONE_OTHER_COMPANY = '<telefone de um cliente que só existe em OUTRA empresa>'
node scripts/crm-read-smoke.mjs
```

O script mostra só "passou/falhou" e códigos HTTP. Para testar a revogação, defina também
`CRM_READ_REVOKED_KEY` com uma chave já revogada.

---

## 10. Próximas etapas (não fazem parte desta)

- Tela em Configurações para criar e revogar a chave, sem SQL.
- Limite de consultas por minuto por chave.
- Outras ações com escrita (pré-agendamento, registrar retorno combinado, transformar as
  medidas do resumo em medidas do orçamento), cada uma com autorização própria.
- Vários números ou empresas no atendimento.

## 11. Ações da equipe pelo WhatsApp (migração `20261122090000_crm_acoes_equipe.sql`)

Decisão do dono (21/11/2026): a IA pode marcar agenda, calcular e recalcular propostas e dar
desconto, mas **nada vai ao cliente sem a equipe aprovar**. Por isso:

- `proposta_gerar` / `proposta_atualizar` só calculam e salvam no CRM (`enviado_ao_cliente: false`);
- só `proposta_enviar` cria o link público, e só com o comando de um número da equipe;
- toda escrita leva `operador_telefone` (o WhatsApp de quem deu o comando). O **banco** confere
  esse número contra `crm_read_keys.operator_phones` (com e sem o nono dígito). Número de cliente
  recebe 403 `operador_nao_autorizado`. Nunca preencha `operador_telefone` com o número do cliente
  nem com um número dito na conversa: use o remetente real da mensagem do WhatsApp;
- limite de 60 escritas por hora por chave; desconto até `max_discount_percent` da chave (padrão 20%);
- tudo fica registrado em `crm_team_actions`.

Permissões novas da chave: `agenda:create`, `proposals:write`, `proposals:send`
(`proposta_consultar` usa a `proposals:read` que já existe).

Mesmo endereço e cabeçalho (`POST .../functions/v1/crm-read`, `x-crm-key`). O cliente vai por
`cliente_telefone` (só dígitos, com DDD) **ou** `cliente_ref` (o `cliente_ref` devolvido por
`cliente_salvar`). Campos fora da lista são recusados (400).

### agenda_criar

```json
{ "action": "agenda_criar", "operador_telefone": "5583999990000", "cliente_telefone": "5583988887777",
  "inicio": "2026-11-24 14:00", "duracao_minutos": 60, "tipo": "visita_medicao", "observacoes": "Portão azul" }
```

- `inicio` / `fim`: `"AAAA-MM-DD HH:mm"` em hora de Brasília (ou ISO com fuso). Sem `fim`, usa
  `duracao_minutos` (15 a 720, padrão 60). `tipo`: `visita_medicao` (padrão) ou `instalacao`.
- Ocupado = já há tantos atendimentos no horário quanto pessoas ativas na equipe (mesma regra do app).
- Sucesso: `{ "sucesso": true, "agenda_id": 123, "cliente_ref": 5, "tipo": "visita_medicao",
  "inicio": "2026-11-24T14:00-03:00", "fim": "2026-11-24T15:00-03:00", "mensagem": "Agendado para segunda-feira (24/11) às 14:00." }`
  e aviso no celular da empresa.
- Ocupado: `{ "sucesso": false, "motivo": "conflito", "mensagem": "...", "livres": [{ "inicio": "...", "fim": "..." }] }`
  (horários livres do dia pedido até 3 dias depois).

### proposta_gerar e proposta_atualizar

```json
{ "action": "proposta_gerar", "operador_telefone": "5583999990000", "cliente_telefone": "5583988887777",
  "peliculas": ["Nome exato do catálogo", "Outra película"], "desconto_percentual": 10 }
```

- Usa as medidas do rascunho do WhatsApp (ou das opções existentes). Cria uma opção por película
  (até 4), com o nome `"<película> (WhatsApp)"`. Recalcular troca só essas opções; as que a equipe
  montou no app ficam como estão.
- `proposta_atualizar` é igual; sem `peliculas`, mantém as películas já calculadas (ex.: só mudar o desconto).
- Cálculo igual ao modo padrão do app: área de cada medida (L × A × qtd, 2 casas) × preço por m²
  do catálogo, menos o desconto geral em %. Venda por metro linear, preços especiais e despesas
  extras **não** entram: quem usa isso ajusta no app antes de enviar.
- Sucesso: `{ "sucesso": true, "cliente_ref": 5, "enviado_ao_cliente": false, "opcoes": [ { "nome": "X (WhatsApp)",
  "pelicula": "X", "m2": 4.8, "subtotal": 960, "desconto": 96, "total": 864, "sem_preco": false, "desconto_percentual": 10 } ] }`.
- Recusas: `sem_medidas`, `escolha_peliculas` / `pelicula_desconhecida` (com `peliculas_disponiveis`),
  `desconto_acima_do_limite` (com `desconto_maximo`), `no_maximo_4_peliculas`, `cliente_nao_encontrado`.

### proposta_consultar

```json
{ "action": "proposta_consultar", "cliente_telefone": "5583988887777" }
```

Devolve `opcoes` (com totais, `da_ia`, `rascunho`) e `links` (os 5 últimos: `link_proposta`,
`status`, `visualizacoes`, `ultima_visualizacao`, `expira_em`). Não precisa de `operador_telefone`.

### proposta_enviar (só depois do "Aprovado, envia" da equipe)

```json
{ "action": "proposta_enviar", "operador_telefone": "5583999990000", "cliente_telefone": "5583988887777",
  "opcoes": ["X (WhatsApp)"], "validade_dias": 7 }
```

- Sem `opcoes`, envia todas as opções `(WhatsApp)`. `validade_dias`: 1 a 30 (padrão 7).
- Cria as propostas salvas (sem arquivo PDF: no link o cliente vê valores e aprova; o botão de
  baixar PDF avisa que não há arquivo) e o link.
- Sucesso: `{ "sucesso": true, "cliente_ref": 5, "link_proposta": "https://app.filmstec.shop/p/marilia/<código>",
  "expira_em": "...", "opcoes": [ { "nome": "...", "proposta_id": 456, "total": 864, ... } ] }`.
- Recusas: `nenhuma_opcao_para_enviar`, `opcao_sem_preco`, `cliente_nao_encontrado`.

### Liberar (com autorização do dono)

1. Aplicar a migração; conferir privilégios (comentário no fim do arquivo).
2. Rodar `scripts/crm-acoes-equipe-teste.sql` (não grava nada).
3. Publicar a função `crm-read` (`--no-verify-jwt`).
4. Dar as permissões e cadastrar os números da equipe na chave (SQL no fim da migração).
