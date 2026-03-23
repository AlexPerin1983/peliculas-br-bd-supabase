<div align="center">
  <img width="120" height="120" alt="Pel?culas BR Logo" src="public/icons/icon-192x192.png" />

  # Pel?culas BR

  **Sistema completo para instaladores e lojas de pel?culas automotivas e residenciais**

  [![Deploy Status](https://img.shields.io/badge/deploy-vercel-black)](https://vercel.com)
  [![Supabase](https://img.shields.io/badge/backend-supabase-3ECF8E)](https://supabase.com)
  [![PWA](https://img.shields.io/badge/PWA-ready-blue)](https://web.dev/progressive-web-apps/)
</div>

---

## Vis?o Geral

O Pel?culas BR ? uma aplica??o operacional focada no dia a dia de instaladores e lojas de pel?culas. O sistema cobre or?amento, medi??es, gera??o de PDF, agenda, estoque, QR Code de servi?o, m?dulos de assinatura e suporte offline.

Depois da refatora??o de 2026, a aplica??o ficou mais modular, com menos l?gica concentrada no `App.tsx`, melhor separa??o de responsabilidades e build mais est?vel para desenvolvimento e produ??o.

---

## Funcionalidades Principais

| Recurso | Descri??o |
|---------|-----------|
| Plano de Corte Inteligente | Otimiza o aproveitamento da bobina e reduz desperd?cio |
| Medi??o com IA | Extrai medidas de fotos, prints e outros insumos |
| Gest?o de Estoque | Controle de bobinas e retalhos com QR Code |
| PDFs Profissionais | Or?amentos com branding, dados t?cnicos e m?ltiplas op??es |
| QR Code de Garantia | Fluxo p?blico de consulta de servi?o |
| Cadastro via IA | Apoio ? cria??o de clientes e medi??es |
| Agenda de Instala??es | Calend?rio integrado com clientes e propostas |
| Gest?o de Equipe | Controle de acesso por colaborador |
| Offline-First | Persist?ncia local com sincroniza??o posterior |

---

## Stack Tecnol?gico

```text
Frontend:  React + TypeScript + Tailwind CSS + Vite
Backend:   Supabase (Auth, Database, Storage, RPC)
Offline:   IndexedDB + Sync Queue + PWA
IA:        Google Gemini / OpenAI / OCR Local
Email:     Resend
```

---

## Instala??o Local

### Pr?-requisitos

- Node.js 18+
- Projeto Supabase configurado
- Chaves de ambiente da aplica??o

### Passos

1. Clone o reposit?rio

```bash
git clone https://github.com/AlexPerin1983/peliculas-br-bd-supabase.git
cd peliculas-br-bd-supabase
```

2. Instale as depend?ncias

```bash
npm install
```

3. Configure as vari?veis de ambiente em `.env.local`

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key
```

4. Inicie o ambiente local

```bash
npm run dev
```

5. Acesse no navegador

```text
http://127.0.0.1:4173
```

Observa??o: no ambiente local, o service worker ? desativado para evitar cache stale durante desenvolvimento.

---

## Estrutura Atual

```text
App.tsx
types.ts
components/
  modals/
  views/
  ui/
contexts/
services/
src/
  components/app/
  hooks/
public/
```

### ?reas importantes

- `services/offlineFirstDb.ts`: fachada principal de dados
- `services/supabaseDb.ts`: opera??es remotas can?nicas
- `services/syncService.ts`: fila e sincroniza??o offline/online
- `services/sessionScope.ts`: escopo de sess?o, organiza??o e owner
- `src/hooks/`: hooks de dom?nio extra?dos da camada principal
- `src/components/app/`: composi??o visual principal da aplica??o

---

## Documenta??o

Os documentos principais do projeto est?o na raiz:

- [DOCUMENTACAO_REFACTOR_2026.md](./DOCUMENTACAO_REFACTOR_2026.md): resumo da arquitetura atual ap?s a refatora??o
- [DOCUMENTACAO_INDEX.md](./DOCUMENTACAO_INDEX.md): ?ndice geral de documenta??o
- [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md): vis?o t?cnica do sistema
- [PRINCIPAIS_FUNCIONALIDADES.md](./PRINCIPAIS_FUNCIONALIDADES.md): vis?o de produto
- [SISTEMA_ASSINATURAS.md](./SISTEMA_ASSINATURAS.md): m?dulos e assinatura
- [DOCUMENTACAO_VENDAS.md](./DOCUMENTACAO_VENDAS.md): material comercial

---

## Arquitetura Atual

Os principais fluxos que sa?ram do `App.tsx` e hoje est?o organizados por dom?nio:

- `useAppBootstrap`
- `useProposalEditor`
- `useMeasurementEditor`
- `useProposalTotals`
- `usePdfActions`
- `useClientFlow`
- `useFilmFlow`
- `useSchedulingFlow`

Isso reduz acoplamento e torna manuten??o, testes e onboarding mais simples.

---

## Build e Valida??o

Build de produ??o:

```bash
npm run build
```

Fluxos recomendados para smoke test:

1. Login e carregamento inicial
2. Sele??o e salvamento de cliente
3. Edi??o de medidas
4. Gera??o de PDF
5. Hist?rico
6. Agenda
7. Pel?culas
8. Fornecedores
9. Estado de sincroniza??o

---

## Deploy

### Vercel

```bash
vercel login
vercel --prod
```

### Vari?veis esperadas

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`

---

## PWA

A aplica??o suporta instala??o como app, mas no ambiente local os recursos de service worker s?o limitados de prop?sito para evitar problemas de cache durante desenvolvimento.

Em produ??o, a experi?ncia PWA volta a funcionar normalmente.

---

## Suporte

Para manuten??o ou evolu??o do projeto:

- consulte a documenta??o da raiz
- priorize os hooks e servi?os j? extra?dos antes de recolocar l?gica no `App.tsx`
- valide os fluxos cr?ticos ap?s qualquer mudan?a estrutural

---

## Licen?a

Projeto propriet?rio. Todos os direitos reservados.
