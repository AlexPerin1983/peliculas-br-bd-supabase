# Guia de Manutencao por Arquivo

## Objetivo

Este documento complementa a documentacao arquitetural principal com uma visao mais pratica:

- quais arquivos sao mais importantes
- o que cada um controla
- quando mexer
- o que evitar
- riscos especificos por arquivo

Use este guia quando a tarefa for operacional e voce precisar decidir rapidamente onde implementar uma mudanca.

## Ordem de leitura recomendada

Se a pessoa ou a LLM chegou agora no projeto, a melhor ordem e:

1. `README.md`
2. `DOCUMENTACAO_REFACTOR_2026.md`
3. `GUIA_MANUTENCAO_POR_ARQUIVO.md`
4. arquivos do dominio da tarefa

## Arquivos de Entrada Principal

### `App.tsx`

Responsabilidade:

- composicao principal do app autenticado
- integracao entre hooks de dominio
- coordenacao geral de estado de tela e modais principais

Mexer aqui quando:

- a mudanca envolve varios dominios ao mesmo tempo
- for necessario conectar um novo hook ou uma nova area visual
- existir um bug de integracao entre cliente, proposta, medidas, PDF ou agenda

Evite:

- colocar regra pesada de negocio diretamente no componente
- adicionar `useEffect` com dependencias amplas sem necessidade
- reintroduzir logica que ja foi extraida para hook

Riscos:

- ordem de inicializacao de hooks e callbacks
- dependencias de efeitos causando loop ou recarga

### `index.tsx`

Responsabilidade:

- bootstrap React
- providers globais
- escolha da experiencia inicial

Mexer aqui quando:

- mudar providers globais
- mudar fluxo de entrada entre app, convite e paginas publicas

Evite:

- adicionar comportamento de dominio aqui

## Composicao Visual Principal

### `src/components/app/AppContentRouter.tsx`

Responsabilidade:

- decidir qual tela principal renderizar a partir da aba ativa

Mexer aqui quando:

- adicionar nova aba
- reorganizar navegacao visual principal

Evite:

- colocar logica de negocio da tela aqui

### `src/components/app/AppClientWorkspace.tsx`

Responsabilidade:

- montar a area principal de trabalho do cliente
- integrar `ClientBar`, carrossel de propostas, lista de medidas, resumo, corte e rodape mobile

Mexer aqui quando:

- alterar layout principal do workspace
- reorganizar experiencia mobile e desktop

Evite:

- transferir regra de dominio para o JSX do workspace

## Hooks de Dominio

### `src/hooks/useAppBootstrap.ts`

Responsabilidade:

- carregamento inicial de dados essenciais
- restauracao de contexto inicial
- inicializacao do sync

Mexer aqui quando:

- mudar sequencia de boot
- alterar preload de clientes, peliculas, PDFs ou agendamentos

Evite:

- dependencia de efeito em estado que muda durante uso normal

Risco:

- recarga em cascata
- loop de bootstrap

### `src/hooks/useClientFlow.ts`

Responsabilidade:

- criar, editar, excluir, fixar e selecionar clientes
- lidar com navegacao ligada a cliente

Mexer aqui quando:

- alterar formulario ou fluxo de cliente
- ajustar comportamento pos-salvamento

Evite:

- salvar cliente em mais de um lugar fora daqui

Risco:

- reintroduzir oscilacao de cliente selecionado

### `src/hooks/useProposalEditor.ts`

Responsabilidade:

- opcoes de proposta
- autosave
- adicao, duplicacao, renomeacao e exclusao de opcoes
- estado de medidas ligado a proposta ativa

Mexer aqui quando:

- alterar comportamento de proposta
- mexer na opcao ativa
- mudar autosave

Evite:

- espalhar regra de opcao ativa em componentes visuais

### `src/hooks/useMeasurementEditor.ts`

Responsabilidade:

- numpad
- edicao de medidas
- duplicacao, exclusao, undo
- desconto por item

Mexer aqui quando:

- alterar fluxo do numpad
- mudar logica de edicao ou exclusao de medida

Evite:

- duplicar regra do numpad em componente visual

### `src/hooks/useProposalTotals.ts`

Responsabilidade:

- subtotal
- desconto geral
- total final
- dados sinteticos para PDF e UI

Mexer aqui quando:

- mudar formula comercial
- adicionar novo componente de custo

Evite:

- recalcular total manualmente em outros componentes

### `src/hooks/usePdfActions.ts`

Responsabilidade:

- gerar, salvar e baixar PDF
- validar dados minimos
- controlar estados de loading e erro do fluxo

Mexer aqui quando:

- mudar a UX da geracao de PDF
- alterar nome de arquivo
- alterar regra antes de gerar ou salvar

Evite:

- chamar gerador de PDF bruto diretamente de componente visual

Risco:

- import dinamico
- estado preso em loading

### `src/hooks/useFilmFlow.ts`

Responsabilidade:

- CRUD de peliculas
- fixacao
- selecao e aplicacao nas medidas

Mexer aqui quando:

- alterar catalogo de peliculas
- mudar comportamento de aplicar pelicula

### `src/hooks/useSchedulingFlow.ts`

Responsabilidade:

- criar, editar e excluir agendamento
- vincular PDF
- navegar para historico quando necessario

Mexer aqui quando:

- mudar experiencia de agenda
- mexer na relacao entre PDF e agendamento

Risco:

- quebrar consistencia entre historico e agenda

## Camada de Dados

### `services/sessionScope.ts`

Responsabilidade:

- fonte central de usuario, organizacao, owner e escopo efetivo

Mexer aqui quando:

- ajustar regras de escopo de dados
- alterar comportamento multiempresa

Evite:

- voltar a resolver organizacao e owner em varios arquivos separados

### `services/offlineFirstDb.ts`

Responsabilidade:

- fachada principal de persistencia
- decidir caminho local ou remoto

Mexer aqui quando:

- criar nova operacao de dominio com suporte offline-first

### `services/offlineDb.ts`

Responsabilidade:

- persistencia local
- estrutura do IndexedDB
- fila de sync local

Mexer aqui quando:

- adicionar campo persistido localmente
- evoluir a fila de sync

Risco:

- migracoes e compatibilidade com dados locais existentes

### `services/supabaseDb.ts`

Responsabilidade:

- operacoes remotas canonicas

Mexer aqui quando:

- nova operacao remota
- ajuste de payload para Supabase

Evite:

- recriar payload remoto diretamente em hooks ou no `syncService.ts`

### `services/syncService.ts`

Responsabilidade:

- processar fila
- marcar erro, retry e sincronizado
- coordenar reenvio

Mexer aqui quando:

- alterar politica de retry
- melhorar observabilidade do sync

Evite:

- remover item com erro silenciosamente

## Componentes de UI com Maior Impacto

### `components/ClientBar.tsx`

Responsabilidade:

- cabecalho do cliente selecionado
- acessos rapidos de cliente

Mexer aqui quando:

- alterar exibicao do cliente
- mudar acoes do topo do workspace

### `components/ProposalOptionsCarousel.tsx`

Responsabilidade:

- trocar, adicionar, renomear e remover opcoes de proposta na UI

Mexer aqui quando:

- mudar UX de opcoes

### `components/MeasurementList.tsx`

Responsabilidade:

- renderizar lista de medidas e suas acoes

Mexer aqui quando:

- alterar layout ou interacao das medidas

### `components/MobileFooter.tsx`

Responsabilidade:

- acoes principais no mobile

Mexer aqui quando:

- ajustar ergonomia ou acessos principais mobile

### `components/SyncStatusIndicator.tsx`

Responsabilidade:

- mostrar estado de sync para usuario

Mexer aqui quando:

- melhorar clareza de pendencias, erro e retry

## Telas Grandes que Merecem Cuidado

### `components/views/EstoqueView.tsx`

Arquivo grande e sensivel.

Mexa com cuidado quando:

- alterar regras de estoque, bobinas ou retalhos

Recomendacao:

- se a mudanca for grande, extrair nova camada de dominio antes

### `components/views/UserSettingsView.tsx`

Arquivo grande e com varias configuracoes.

Mexa com cuidado quando:

- alterar configuracoes da empresa, branding, IA ou conta

### `services/pdfGenerator.ts`

Arquivo grande e central para entrega do produto.

Mexa com cuidado quando:

- alterar layout do PDF
- mudar campos obrigatorios
- mexer em importacao de bibliotecas de captura e geracao

## Regras Praticas de Manutencao

### Se a tarefa for...

#### "bug no cliente"

Comece por:

- `src/hooks/useClientFlow.ts`
- `components/ClientBar.tsx`
- `components/modals/ClientModal.tsx`

#### "bug em medida ou numpad"

Comece por:

- `src/hooks/useMeasurementEditor.ts`
- `components/MeasurementList.tsx`
- `components/ui/CustomNumpad.tsx`

#### "bug no PDF"

Comece por:

- `src/hooks/usePdfActions.ts`
- `src/hooks/useProposalTotals.ts`
- `services/pdfGenerator.ts`

#### "bug em agenda"

Comece por:

- `src/hooks/useSchedulingFlow.ts`
- `components/modals/AgendamentoModal.tsx`
- `components/views/AgendaView.tsx`

#### "bug de sync ou offline"

Comece por:

- `services/syncService.ts`
- `services/offlineFirstDb.ts`
- `services/offlineDb.ts`
- `components/SyncStatusIndicator.tsx`

## Checklists Rapidos

### Antes de alterar um fluxo critico

- identificar o hook dono do fluxo
- verificar se ja existe teste cobrindo o comportamento
- ver se a mudanca toca offline, PDF ou agenda
- validar se nao existe efeito duplicado no `App.tsx`

### Depois da mudanca

- rodar `npm run test`
- rodar `npm run build`
- validar smoke test do fluxo afetado

## Resumo Final

Se houver duvida sobre onde implementar algo, siga esta regra:

- regra de negocio vai para hook ou service
- composicao vai para componente
- persistencia remota passa por `supabaseDb.ts`
- persistencia offline respeita a cadeia `offlineFirstDb.ts` -> `offlineDb.ts` -> `syncService.ts`

Esse padrao e o que mais protege o projeto contra regressao e desorganizacao.
