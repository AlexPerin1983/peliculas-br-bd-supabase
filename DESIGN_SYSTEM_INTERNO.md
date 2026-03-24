# Design System Interno

## Objetivo

Este documento formaliza o padrão visual mínimo do aplicativo para evitar retrabalho e manter consistência entre telas novas e refatoradas.

## Princípios

- A identidade principal do app é `azul/slate`, com `verde` reservado para ações de WhatsApp, status positivos e pequenos acentos funcionais.
- Telas de coleção devem parecer parte da mesma família: `toolbar`, `busca`, `ação principal`, `grade/lista`, `estado vazio/loading/erro`.
- Mobile não deve ser uma versão espremida do desktop. Quando necessário, a hierarquia muda.
- Ação destrutiva deve ser rara, explícita e visualmente clara.

## Cores oficiais

- Primária escura: `slate-900`
- Primária hover: `slate-700`
- Destaque azul: `blue-600`
- Superfície clara: `white`
- Superfície neutra: `slate-50` / `slate-100`
- Texto principal: `slate-800`
- Texto secundário: `slate-600`
- Borda padrão: `slate-200`
- Erro/destrutivo: `red-600`
- WhatsApp/positivo: `emerald-500` a `emerald-600`

## Tipografia

- Título de página: `text-3xl font-black tracking-tight`
- Título de card: `text-xl font-black`
- Texto de apoio: `text-sm text-slate-500` ou `text-slate-600`
- Labels de campo: `text-xs font-bold uppercase tracking-[0.08em]`

## Espaçamento

- Raio principal de elementos: `rounded-xl` ou `rounded-2xl`
- Cards principais: `p-5` a `p-6`
- Toolbar de coleção: `gap-3`
- Respiro vertical padrão entre blocos: `space-y-4` ou `space-y-6`

## Componentes base

### Ações

Arquivo: [ActionButton.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\ui\ActionButton.tsx)

- `primary`: ação principal da tela ou modal
- `secondary`: ação neutra destacada
- `ghost`: ação secundária discreta
- `danger`: excluir/confirmação destrutiva

### Toolbar de coleção

Arquivo: [PageCollectionToolbar.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\ui\PageCollectionToolbar.tsx)

Usar quando a tela tiver:
- busca
- botão principal
- alternância `grid/list`

### Alternância de visualização

Arquivo: [ViewModeToggle.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\ui\ViewModeToggle.tsx)

- `grid` e `list` devem ter comportamento realmente diferente
- No mobile, a lista precisa reduzir texto e aumentar leitura linear

### Estados de conteúdo

Arquivo: [ContentState.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\ui\ContentState.tsx)

Usar para:
- vazio
- erro
- loading simplificado

## Padrões de telas

### Telas de coleção

Exemplos:
- [FilmListView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\FilmListView.tsx)
- [FornecedoresView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\FornecedoresView.tsx)
- [PdfHistoryView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\PdfHistoryView.tsx)

Estrutura esperada:
1. container central `max-w-*`
2. `PageCollectionToolbar`
3. estado vazio/loading/erro com `ContentState`
4. conteúdo em `grid` ou `list`

### Modais

- Cabeçalho curto, sem excesso de subtítulo
- Ação primária à direita
- Cancelar como `ghost`
- Excluir como `danger`
- Ao salvar/excluir: botão em loading, sem fechar no meio da operação

### Listas mobile

- Priorizar leitura vertical
- Menos texto visível
- Ícones condensando ações secundárias
- WhatsApp pode permanecer como ação destacada verde
- Se existir menu contextual, evitar duplicar ações na mesma linha

## O que evitar

- `confirm()` e `alert()` nativos
- estados vazios inventados por tela
- botão primário verde fora de contexto de WhatsApp/sucesso
- lista que é só um card grande esticado
- duplicação de ações no mobile

## Próximas telas a alinhar

- [EstoqueView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\EstoqueView.tsx)
- [AgendaView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\AgendaView.tsx)
- [LocationsView.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\views\LocationsView.tsx)
- [AdminUsers.tsx](C:\Users\Alex%20Lacerda\Desktop\App%20testes\Películas%20BR%20BD\components\AdminUsers.tsx)
