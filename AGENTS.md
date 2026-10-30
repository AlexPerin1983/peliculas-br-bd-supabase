# Regras para assistentes de código (Codex, Claude e outros)

Leia este arquivo inteiro antes de mexer no projeto. Ele vale para qualquer assistente.
O dono do projeto não é programador: explique em português simples e peça autorização
nas decisões que afetam usuários, dados ou publicação.

## 1. O que é o projeto

App **Películas BR** (PWA) para instaladores de película: clientes, medidas, orçamentos
em PDF, propostas com link, agenda, estoque, financeiro e módulo automotivo.

- Frontend: React + TypeScript + Vite + Tailwind. Entrada em `App.tsx`; telas em `components/`
  e `src/components/`; regras puras em `src/lib/` (com testes `*.test.ts` ao lado).
- Dados: Supabase (Postgres + Auth + Storage + Edge Functions em `supabase/functions/`).
- Offline-first: Dexie (IndexedDB) em `services/offlineDb.ts`, sincronização em
  `services/syncService.ts` e `services/offlineFirstDb.ts`; acesso remoto em `services/supabaseDb.ts`.
- Hospedagem: Vercel (projeto `peliculas-br-testes`), domínio do app `app.filmstec.shop`.
- Outras referências: `docs/AI_RULES.md`, `docs/DOCUMENTACAO_TECNICA.md`, `DESIGN_SYSTEM_INTERNO.md`.

## 2. Regras de ouro (publicação e produção)

1. **Juntar no `main` publica na hora para todos os usuários.** A Vercel publica o `main`
   automaticamente. Não existe etapa intermediária.
2. **Merge e publicação só com autorização explícita do dono, nesta conversa, para aquele PR.**
   Autorização dada antes não vale para o próximo PR.
3. **Um responsável por vez.** Só um assistente faz merge/publicação em um dado momento; o outro
   apenas abre PR. Combine com o dono quem é o responsável antes de juntar qualquer coisa.
4. Trabalhe sempre em branch própria e abra PR para revisão. Nunca faça commit direto no `main`,
   `push --force`, nem reescreva histórico de branch que outra pessoa usa.
5. Cada PR do GitHub ganha uma pré-visualização da Vercel, mas ela pede login na Vercel e o app
   redireciona para o domínio oficial (`src/lib/canonicalHost.ts`), então não serve para testar no celular.
6. Os arquivos de regras orientam os assistentes, mas **não bloqueiam tecnicamente** uma publicação.

## 3. O ambiente local usa o banco de PRODUÇÃO

- O `.env` local aponta para o Supabase de produção (projeto `avlefzsipbqvollukgyt`).
  `npm run dev` + login no navegador = **mexer em dados reais de clientes**.
- **Não** faça login no app local para testar. Use a sessão de demonstração offline (seção 6).
- Nunca leia, copie ou mostre valores do `.env`, chaves ou tokens.
- Consultas ao banco de produção (`npx supabase db query --linked`) só com autorização do dono,
  que precisa trocar o seletor de permissão do assistente para Manual. Leituras somente leitura;
  qualquer escrita precisa de autorização específica.
- **Não altere dados de outras empresas** (as tabelas são compartilhadas por todos os clientes do app).

## 4. Banco de dados e Edge Functions

- Migrações ficam em `supabase/migrations/`, mas em produção são **aplicadas à mão**, com
  autorização, e **não** ficam registradas em `supabase_migrations.schema_migrations`.
  Não rode `supabase db push`.
- Ordem: aplicar a migração em produção **antes** de juntar o código que depende dela.
- Ao criar função SQL "só do servidor": o Supabase dá EXECUTE para `anon` e `authenticated`
  por padrão. Revogue de `PUBLIC, anon, authenticated` e confira com `has_function_privilege`.
- Edge Functions publicadas à parte (`npx supabase functions deploy <nome> --project-ref avlefzsipbqvollukgyt --use-api`),
  também só com autorização:
  - `gemini-proxy`: manter verificação de JWT (não usar `--no-verify-jwt`). Funcionalidade nova
    de IA exige publicar a função antes do app.
  - `whatsapp-bridge`: publicada com `--no-verify-jwt` (autentica por cabeçalho próprio).

## 5. Funcionalidades fechadas ou escondidas (não abrir sem pedido do dono)

| Funcionalidade | Quem vê hoje | Onde está o controle |
|---|---|---|
| **Automotivo** (orçamento de carros, tabela de preços, observações) | Todas as contas veem a seção em Configurações; a aba no orçamento só aparece para a empresa que liga a chave | `canUseAutomotive` em `src/lib/automotive.ts` + chave em Configurações (`user_info.automotivo`) |
| **WhatsApp conectado** (envio pós-venda, funil, triagem) | Só as empresas do próprio dono com conector ativo | RPC `whatsapp_connection_status()` / `whatsapp_triage_organization()` no banco |

- Nada disso ganha aviso no grupo de WhatsApp dos aplicadores enquanto estiver fechado.
- Avisos no grupo (`docs/novidades/`) só para o que os aplicadores já podem usar. Regras de texto em
  `docs/marketing/BASE_CONTEUDO_FUNCIONALIDADES.md`: sem termos técnicos, sem números sem prova e
  **nunca** o código de liberação do app.

## 6. Como testar

- Tipos: `npx tsc --noEmit -p tsconfig.json` (já existem erros antigos, principalmente em arquivos
  de teste e em cores do `services/pdfGenerator.ts`; compare com o `main` em vez de exigir zero).
- Testes de unidade: `npm test` (Vitest, não usa rede nem banco).
- Testes de tela (Playwright): `npm run test:e2e:iphone`. Sobe o app local na porta 3001.

### Sessão de demonstração offline (para ver telas sem tocar na produção)

- `tests/e2e/helpers/iphoneApp.ts` → `seedOfflineSession(page, ...)`: cria uma sessão falsa,
  deixa o navegador "offline", **bloqueia tudo que não é local nem Supabase**, responde leituras do
  Supabase com dados vazios/falsos e **recusa toda escrita** (devolve a lista do que foi bloqueado;
  confira que ficou vazia ao fim do teste).
- Dados de demonstração: `scripts/marketing-prints/demoData.ts` (`buildDemoData`), gravados no
  IndexedDB por `/offline.html` + `import('/services/offlineDb.ts')`, como em
  `scripts/marketing-prints/capture.marketing.ts` (`npm run prints:marketing`, usa o Edge instalado).
- Limitações: não testa sincronização nem criação de links (o app está offline); a tela de
  Configurações precisa de respostas falsas para `organization_members` e `organizations`, senão a
  seção Equipe quebra; o e-mail da sessão falsa é `iphone.e2e@peliculasbr.test` (para ver a aba
  Automotivo, o teste liga a chave em Configurações ou grava `automotivo: { ativo: true }` no userInfo).
- Atenção: `scripts/marketing-prints/` e a opção `activeModules` do helper **ainda não estão no
  Git** (ver seção 8).

## 7. Testes que já falham no `main` (não são regressão)

Conferido em 26/10/2026 com `npx vitest run components/views/AgendaView.test.tsx src/lib/pwaRecovery.test.ts`:

1. `components/views/AgendaView.test.tsx` › "pede confirmação da bobina antes de concluir um serviço
   com material" — linha 514 espera o campo "bobina utilizada" com valor `8` e recebe vazio.
2. `src/lib/pwaRecovery.test.ts` › "rejects HTML returned in place of JavaScript or CSS" — espera
   `SW_VERSION = 'v2.7.3'`, mas `public/service-worker.js` está em `v2.7.5` (teste desatualizado).

Também pode falhar perto da meia-noite UTC: `ProposalCenterView` ("Próximo contato: amanhã"),
porque depende da data. Na rodada completa de 26/10/2026: 1005 testes passaram e só os 2 acima falharam.

## 8. Em andamento e alterações locais

**Alterações locais ainda não salvas no Git (do dono). Não apague, não reverta e não inclua em PR
sem ele pedir:**

- `package.json` (scripts `prints:marketing` e `pecas:render`), `vite.config.ts` (porta via `PORT`),
  `tests/e2e/helpers/iphoneApp.ts` (opção `activeModules`), `supabase/.temp/cli-latest`.
- Pastas novas: `docs/marketing/`, `docs/novidades/`, `scripts/marketing-pecas/`,
  `scripts/marketing-prints/`, `.claude/`.

**Automotivo** — PRs #82, #83, #85–#87 no `main`; aberto para todas as empresas pela chave em Configurações:

- Regras e preços: `src/lib/automotive.ts` (+ `automotive.test.ts`); tipos em `types.ts`
  (`AutomotiveVehicle`, `AutomotiveSettings`).
- Telas: `components/automotive/` (`VehicleEditorModal.tsx`, `VehicleTopView.tsx`,
  `VehicleCategoryIcon.tsx`, `AutomotiveQuotePanel.tsx`), `components/settings/AutomotiveSettingsPanel.tsx`,
  aba em `src/components/app/AppClientWorkspace.tsx`.
- Totais e PDF: `src/hooks/useProposalTotals.ts`, `services/pdfGenerator.ts`.
- Os carros ficam em `generalDiscount.automotiveVehicles` da opção de proposta.
  `normalizeGeneralDiscount` (`src/hooks/useProposalEditor.ts`) precisa manter esse campo, senão os carros somem.
- Próximas ideias aprovadas pelo dono: nomes próprios para as 4 linhas de película; fotos de vistoria.

## 9. Convenções que já causaram problema

- O CSS global `button, input, textarea, select { font: inherit }` (fora de camada) vence as classes
  de fonte do Tailwind nesses elementos: coloque o texto num `<span>` com as classes ou use `style`.
- Vários arquivos usam fim de linha CRLF; edite sem trocar o formato do arquivo inteiro.
- Textos do app e mensagens para o dono em português do Brasil.
- Fluxos simples: criar o mínimo e deixar completar depois; não fazer a IA procurar ou ligar
  registros sozinha sem pedido.
- Commits e PRs pequenos, com descrição do que o usuário vê de diferente e de como foi testado.

## 10. Trabalho em paralelo (vários assistentes)

- Cada assistente na própria pasta (git worktree) e branch (`claude/...`, `codex/...`).
- Não mexam nos mesmos arquivos ao mesmo tempo; combine com o dono quem cuida de cada tela.
- Antes de começar, rode `git status` e `git fetch`, e parta do `origin/main` atualizado.
