# Documentacao da Aplicacao e Refactor 2026

## Objetivo

Este documento existe para ajudar humanos e outras LLMs a entenderem rapidamente:

- o que a aplicacao faz
- como a arquitetura esta organizada hoje
- quais sao os fluxos principais de negocio
- onde mexer para cada tipo de demanda
- quais areas sao sensiveis e exigem mais cuidado

Ele deve ser lido junto com o `README.md`, mas aqui o foco e operacional e arquitetural.

## Resumo Executivo

O Peliculas BR e um sistema operacional para empresas de peliculas automotivas e residenciais. O produto concentra:

- cadastro e selecao de clientes
- criacao de propostas com multiplas opcoes
- edicao de medidas
- calculo de totais e descontos
- geracao e salvamento de PDF
- agenda de instalacoes
- catalogo de peliculas
- estoque
- fornecedores
- sincronizacao offline-first
- modulos de assinatura

Depois da refatoracao de 2026, a aplicacao deixou de concentrar quase toda a regra no `App.tsx` e passou a distribuir responsabilidades em hooks e componentes mais previsiveis.

## Visao de Produto

### Fluxo principal de uso

O fluxo mais importante da aplicacao e:

1. selecionar ou criar um cliente
2. abrir ou criar uma opcao de proposta
3. adicionar ou editar medidas
4. aplicar pelicula, quantidade, desconto e configuracoes
5. visualizar totais
6. gerar PDF
7. opcionalmente criar ou vincular agendamento
8. opcionalmente acompanhar historico, servico ou estoque

### Modulos funcionais principais

- Clientes
- Propostas
- Medidas
- PDFs
- Agenda
- Peliculas
- Estoque
- Fornecedores
- Assinatura e modulos
- Sync offline-first

## Arquitetura Atual

### Visao geral

Hoje a aplicacao esta organizada em tres blocos principais:

- camada visual
- camada de dominio no frontend
- camada de dados e sincronizacao

### Camada visual

Os componentes mais importantes de composicao sao:

- `App.tsx`
- `src/components/app/AppContentRouter.tsx`
- `src/components/app/AppClientWorkspace.tsx`

Responsabilidade dessa camada:

- compor layout
- escolher tela ou workspace
- conectar hooks de dominio com componentes visuais
- evitar regra de negocio pesada diretamente no JSX principal

### Camada de dominio

Os hooks abaixo sao a espinha dorsal da aplicacao:

- `src/hooks/useAppBootstrap.ts`
- `src/hooks/useClientFlow.ts`
- `src/hooks/useProposalEditor.ts`
- `src/hooks/useMeasurementEditor.ts`
- `src/hooks/useProposalTotals.ts`
- `src/hooks/usePdfActions.ts`
- `src/hooks/useFilmFlow.ts`
- `src/hooks/useSchedulingFlow.ts`

Responsabilidade dessa camada:

- encapsular regra de negocio do frontend
- centralizar efeitos e fluxos de usuario
- reduzir acoplamento com o `App.tsx`
- facilitar testes unitarios e de integracao leve

### Camada de dados

Arquivos principais:

- `services/offlineFirstDb.ts`
- `services/offlineDb.ts`
- `services/supabaseDb.ts`
- `services/syncService.ts`
- `services/sessionScope.ts`

Responsabilidade dessa camada:

- leitura e escrita local
- leitura e escrita remota
- fila de sincronizacao
- retry e observabilidade de falhas
- resolucao de escopo de sessao, organizacao e owner

## Mapa de Responsabilidades

### Onde mexer para cada tipo de tarefa

#### Cliente

Arquivos principais:

- `src/hooks/useClientFlow.ts`
- `components/ClientBar.tsx`
- `components/modals/ClientModal.tsx`

Mexa aqui quando precisar:

- criar, editar, excluir ou fixar clientes
- mudar regras de selecao
- alterar navegacao ligada a cliente

#### Proposta

Arquivos principais:

- `src/hooks/useProposalEditor.ts`
- `components/ProposalOptionsCarousel.tsx`

Mexa aqui quando precisar:

- criar, duplicar, renomear ou excluir opcoes
- mudar autosave
- alterar regra da opcao ativa

#### Medidas

Arquivos principais:

- `src/hooks/useMeasurementEditor.ts`
- `components/MeasurementList.tsx`
- `components/MeasurementGroup.tsx`
- `components/ui/CustomNumpad.tsx`

Mexa aqui quando precisar:

- mudar comportamento do numpad
- editar desconto por item
- duplicar ou excluir medida
- mexer em undo

#### Totais e PDF

Arquivos principais:

- `src/hooks/useProposalTotals.ts`
- `src/hooks/usePdfActions.ts`
- `services/pdfGenerator.ts`

Mexa aqui quando precisar:

- alterar formulas de subtotal, desconto ou total
- mudar nome de arquivo
- ajustar fluxo de geracao e salvamento de PDF
- alterar o conteudo final do PDF

#### Agenda

Arquivos principais:

- `src/hooks/useSchedulingFlow.ts`
- `components/views/AgendaView.tsx`
- `components/modals/AgendamentoModal.tsx`

Mexa aqui quando precisar:

- criar, editar, excluir agendamento
- vincular ou desvincular PDF
- alterar navegacao entre agenda e historico

#### Peliculas

Arquivos principais:

- `src/hooks/useFilmFlow.ts`
- `components/views/FilmListView.tsx`
- `components/modals/FilmModal.tsx`

Mexa aqui quando precisar:

- CRUD de pelicula
- pinagem
- selecao em medidas
- aplicacao em massa

#### Sync e offline

Arquivos principais:

- `services/syncService.ts`
- `services/offlineDb.ts`
- `components/SyncStatusIndicator.tsx`

Mexa aqui quando precisar:

- alterar fila
- mudar retry
- mudar estados pendente, erro e sincronizado
- melhorar feedback visual de sync

## Fluxos Criticos

### 1. Bootstrap inicial

Entrada principal:

- `src/hooks/useAppBootstrap.ts`

Esse fluxo cuida de:

- inicializacao geral do app
- carga de clientes, peliculas, PDFs e agendamentos
- inicializacao do sync
- restauracao segura do estado inicial

Risco:

- se esse hook ganhar dependencia errada, pode disparar recarga em cascata

### 2. Salvar cliente

Entrada principal:

- `src/hooks/useClientFlow.ts`

Esse fluxo cuida de:

- salvar cliente novo ou em edicao
- atualizar lista local
- restaurar cliente selecionado
- navegar para proposta ou agendamento quando necessario

Risco:

- alterar efeitos ou dependencias pode reintroduzir loops de selecao ou recarga

### 3. Gerar PDF

Entradas principais:

- `src/hooks/useProposalTotals.ts`
- `src/hooks/usePdfActions.ts`
- `services/pdfGenerator.ts`

Esse fluxo cuida de:

- validar dados minimos
- calcular totais
- gerar nome de arquivo
- importar gerador de PDF
- salvar localmente e sincronizar depois

Risco:

- muito sensivel a regressao de dados faltantes, import dinamico e estado de loading

### 4. Salvar agendamento

Entrada principal:

- `src/hooks/useSchedulingFlow.ts`

Esse fluxo cuida de:

- criar ou editar agendamento
- vincular agendamento ao PDF quando necessario
- excluir agendamento e limpar referencia ligada

Risco:

- manter consistencia entre agenda e historico

### 5. Sync offline-first

Entradas principais:

- `services/offlineFirstDb.ts`
- `services/syncService.ts`
- `services/supabaseDb.ts`

Esse fluxo cuida de:

- salvar localmente
- registrar item na fila
- reenviar em background
- marcar como sincronizado
- manter erro com retry quando falhar

Risco:

- nunca remover item com erro de forma silenciosa
- evitar divergencia entre operacao online e operacao de sync

## Convencoes do Projeto

### Convencoes arquiteturais

- nova regra de negocio deve preferencialmente nascer em hook ou service, nao direto no `App.tsx`
- componente visual nao deve carregar regra transversal complexa
- fluxo de dados remoto deve passar pelas operacoes canonicas de `supabaseDb.ts`
- leitura e escrita locais devem respeitar a estrategia offline-first atual

### Convencoes de codigo

- preferir TypeScript explicito em fluxos criticos
- preferir nomes de hooks que expressem dominio e nao UI
- manter handlers de UI finos quando possivel
- evitar side effects dispersos em varios componentes para o mesmo fluxo

### Convencoes de manutencao

- se um arquivo crescer demais, separar regra e composicao
- antes de mover arquivos, resolver responsabilidade
- nao recolocar logs excessivos no fluxo principal

## Testes e Qualidade

### Infraestrutura atual

Ja existe base de testes com Vitest e Testing Library.

Arquivos principais:

- `vitest.config.ts`
- `vitest.setup.ts`

Scripts:

- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

### Cobertura atual mais relevante

A suite hoje cobre bem os dominios mais sensiveis:

- cliente
- proposta
- medidas
- totais
- PDF
- agendamento
- sync
- router visual principal
- workspace principal
- footer mobile

### Observacao importante

O percentual total de coverage ainda parece baixo porque a medicao inclui muitas telas antigas e grandes que ainda nao entraram na suite. Isso nao significa que os fluxos refatorados estejam sem protecao.

## Riscos Conhecidos

### Areas sensiveis

- `App.tsx` ainda e um arquivo relevante, mesmo mais leve que antes
- `services/pdfGenerator.ts` ainda e grande e merece atencao especial
- `services/supabaseDb.ts` e `services/offlineDb.ts` concentram muito impacto de persistencia
- telas grandes como `EstoqueView.tsx` ainda nao passaram pelo mesmo nivel de simplificacao

### Riscos nao funcionais

- ainda pode haver textos com encoding antigo em arquivos secundarios
- algumas areas grandes de UI ainda tem baixa cobertura automatizada
- warning de navegacao em teste vem do `jsdom`, nao do app

## Handoff para Outra LLM

Se outra LLM for assumir o projeto, o ideal e ela ler nesta ordem:

1. `README.md`
2. `DOCUMENTACAO_REFACTOR_2026.md`
3. `App.tsx`
4. `src/components/app/AppContentRouter.tsx`
5. `src/components/app/AppClientWorkspace.tsx`
6. hooks de dominio em `src/hooks/`
7. camada de dados em `services/`

### O que a outra LLM deve assumir como verdade

- a estrategia offline-first e parte central do produto
- `supabaseDb.ts` deve continuar sendo a fonte remota canonica
- `syncService.ts` nao deve voltar a apagar erro silenciosamente
- o `App.tsx` deve continuar emagrecendo, nao voltando a centralizar regra

### O que vale investigar antes de grandes mudancas

- se o fluxo toca cliente, proposta, PDF ou sync
- se ja existe hook extraido que deve receber a mudanca
- se existe teste cobrindo o comportamento
- se a mudanca pode quebrar ambiente local com service worker ou import dinamico

## Smoke Test Recomendado

Depois de mudanca relevante, validar:

1. login e carregamento inicial
2. selecionar cliente
3. criar ou editar cliente
4. criar opcao de proposta
5. adicionar ou editar medida
6. gerar PDF
7. abrir historico
8. salvar e excluir agendamento
9. abrir peliculas
10. abrir fornecedores
11. verificar estado de sync

## Proximos Passos Recomendados

### Curto prazo

- ampliar cobertura de componentes grandes
- continuar limpeza de encoding secundario
- melhorar feedback visual de sync

### Medio prazo

- reduzir mais a complexidade residual do `App.tsx`
- simplificar modais e telas grandes
- subir coverage das areas refatoradas e depois adicionar thresholds

### Longo prazo

- consolidar documentacao antiga
- continuar migracao de telas grandes para padrao de dominio mais modular

## Resumo Final

Hoje a aplicacao ja tem base suficiente para handoff produtivo entre pessoas e LLMs, desde que esse documento seja usado como ponto de entrada. O estado atual e muito melhor que o original em organizacao, estabilidade, testabilidade e previsibilidade de manutencao.
