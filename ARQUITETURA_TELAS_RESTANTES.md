# Arquitetura Das Telas Restantes

## Objetivo

Registrar onde ainda existe acúmulo de regra e UI misturada, e qual a melhor ordem de ataque para continuar a refatoração sem perder produtividade.

## Prioridade sugerida

1. Estoque
2. Agenda
3. Administração
4. Módulos públicos
5. Locais

## 1. Estoque

Arquivo principal:
- [EstoqueView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\EstoqueView.tsx)

Problemas atuais:
- view muito grande
- regra de dados, QR code, scanner, filtros, formulário e layout no mesmo arquivo
- muitos ícones inline e estados locais agrupados

Extrações recomendadas:
- `useEstoqueData`
- `useEstoqueFilters`
- `useEstoqueQrFlow`
- `EstoqueToolbar`
- `BobinaGrid`
- `RetalhoGrid`
- `EstoqueStatsBar`

## 2. Agenda

Arquivo principal:
- [AgendaView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\AgendaView.tsx)

Meta:
- padronizar toolbar e estados de conteúdo
- separar calendário, lista do dia e ações rápidas
- conectar melhor com `useSchedulingFlow`

## 3. Administração

Arquivo principal:
- [AdminUsers.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\AdminUsers.tsx)

Problemas atuais:
- muitas queries diretas e regras de ativação no mesmo componente
- uso de `alert()`
- mistura de expansão visual com regras de assinatura e organização

Extrações recomendadas:
- `useAdminUsersData`
- `useAdminSubscriptions`
- `AdminUserCard`
- `AdminUserModulesPanel`

## 4. Módulos públicos

Arquivos principais:
- [EstoquePublicoView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\EstoquePublicoView.tsx)
- [ServicoPublicoView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\ServicoPublicoView.tsx)

Meta:
- alinhar visual com a identidade do app, mas com menos densidade operacional
- separar `data fetching`, `header`, `content state` e listagem pública

## 5. Locais

Arquivo principal:
- [LocationsView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\LocationsView.tsx)

Observação:
- hoje é fino, mas depende de [LocationManager](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\locations\LocationManager.tsx)
- vale tratar esse módulo como domínio separado quando entrar em revisão

## Regras para as próximas extrações

- cada tela deve ter no máximo um arquivo principal de composição
- lógica de dados vai para hooks
- padrões visuais devem usar:
  - [ActionButton.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\ui\ActionButton.tsx)
  - [PageCollectionToolbar.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\ui\PageCollectionToolbar.tsx)
  - [ContentState.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\ui\ContentState.tsx)
  - [ViewModeToggle.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\ui\ViewModeToggle.tsx)

## Próximo ciclo recomendado

### Ciclo 1

- extrair `EstoqueView`
- padronizar toolbar/estado vazio/ações

### Ciclo 2

- refatorar `AdminUsers`
- remover `alert()` e queries acopladas à view

### Ciclo 3

- alinhar `Agenda`
- revisar módulos públicos
