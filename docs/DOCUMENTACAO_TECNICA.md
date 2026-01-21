# 🛠️ Documentação Técnica Completa - Películas BR

**Última atualização:** Janeiro 2026

Este documento consolida toda a arquitetura técnica, serviços e configurações da aplicação Películas BR.

---

## 📚 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estrutura de Arquivos](#3-estrutura-de-arquivos)
4. [Backend (Supabase)](#4-backend-supabase)
5. [Sistema Offline-First](#5-sistema-offline-first)
6. [Módulos e Funcionalidades](#6-módulos-e-funcionalidades)
7. [Serviços Principais](#7-serviços-principais)
8. [Autenticação e Autorização](#8-autenticação-e-autorização)
9. [Sistema de Organizações e Equipes](#9-sistema-de-organizações-e-equipes)
10. [Sistema de Assinaturas](#10-sistema-de-assinaturas)
11. [PWA e Instalação](#11-pwa-e-instalação)
12. [Guia de Deploy](#12-guia-de-deploy)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (PWA)                           │
│  React 19 + TypeScript + Tailwind CSS                           │
│  Vite Dev Server (porta 3001)                                   │
├─────────────────────────────────────────────────────────────────┤
│                     CAMADA OFFLINE-FIRST                        │
│  offlineFirstDb.ts → offlineDb.ts (IndexedDB) + supabaseDb.ts   │
├─────────────────────────────────────────────────────────────────┤
│                        SUPABASE                                  │
│  Auth │ Database (Postgres) │ Storage │ Edge Functions          │
├─────────────────────────────────────────────────────────────────┤
│                    SERVIÇOS EXTERNOS                             │
│  Resend (Emails) │ Gemini/OpenAI (IA) │ ViaCEP (Endereços)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológico

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 19.x | Framework UI |
| TypeScript | 5.x | Tipagem estática |
| Tailwind CSS | 3.x | Estilização (utility-first) |
| Vite | 6.x | Build tool e dev server |
| jsPDF | - | Geração de PDFs |
| QRCode.js | - | Geração de QR Codes |

### Backend
| Tecnologia | Uso |
|------------|-----|
| Supabase | BaaS (Auth, Database, Storage) |
| PostgreSQL | Banco de dados |
| IndexedDB | Cache offline local |
| Edge Functions (Deno) | Funções serverless |

### Integrações
| Serviço | Uso |
|---------|-----|
| Google Gemini / OpenAI | Extração de medidas via IA |
| Resend | Envio de emails transacionais |
| ViaCEP | Busca de endereço por CEP |
| Tesseract.js | OCR local gratuito |

---

## 3. Estrutura de Arquivos

```
/
├── App.tsx                    # Componente principal (~3000 linhas)
├── types.ts                   # Todas as interfaces TypeScript
├── constants.ts               # Constantes da aplicação
├── 
├── /components/
│   ├── /modals/               # 24 modais (ClientModal, FilmModal, etc.)
│   ├── /views/                # 8 views (EstoqueView, AgendaView, etc.)
│   ├── /ui/                   # 15 componentes UI reutilizáveis
│   ├── /subscription/         # Componentes de assinatura
│   └── /locations/            # Componentes de localizações
│
├── /services/
│   ├── db.ts                  # Re-export do offlineFirstDb
│   ├── offlineFirstDb.ts      # 🔑 Camada principal de dados
│   ├── offlineDb.ts           # IndexedDB para cache offline
│   ├── supabaseDb.ts          # Operações diretas no Supabase
│   ├── syncService.ts         # Sincronização offline ↔ online
│   ├── estoqueDb.ts           # Operações de estoque
│   ├── pdfGenerator.ts        # Geração de PDFs
│   ├── emailHelper.ts         # Envio de emails
│   ├── subscriptionService.ts # Sistema de assinaturas
│   └── inviteService.ts       # Sistema de convites
│
├── /contexts/
│   ├── AuthContext.tsx        # Autenticação e sessão
│   └── SubscriptionContext.tsx # Estado de assinaturas
│
├── /src/
│   ├── /hooks/                # Custom hooks (useNumpad, usePwaUpdate, etc.)
│   ├── /contexts/             # Contextos adicionais (ErrorContext)
│   └── /lib/                  # Utilitários (parsePrint, etc.)
│
├── /public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   └── icons/                 # Ícones do app
│
└── /docs/                     # Documentação adicional
```

---

## 4. Backend (Supabase)

### 4.1 Tabelas Principais

| Tabela | Descrição | RLS |
|--------|-----------|-----|
| `users_info` | Configurações do usuário (empresa, logo, etc.) | Por user_id |
| `clients` | Clientes cadastrados | Por organization_id |
| `proposal_options` | Opções de proposta com medidas | Por client_id |
| `films` | Películas personalizadas | Por organization_id |
| `saved_pdfs` | Histórico de PDFs gerados | Por user_id |
| `agendamentos` | Agendamentos de instalação | Por organization_id |
| `bobinas` | Estoque de bobinas | Por organization_id |
| `retalhos` | Estoque de retalhos | Por organization_id |
| `servicos` | Serviços com QR Code | Por organization_id |
| `organizations` | Organizações/empresas | Própria |
| `organization_members` | Membros da organização | Por organization_id |
| `subscriptions` | Assinaturas ativas | Por organization_id |
| `subscription_modules` | Módulos disponíveis | Público |
| `invites` | Convites pendentes | Por organization_id |

### 4.2 Políticas RLS (Row Level Security)

Todas as tabelas usam RLS para segregar dados:

```sql
-- Exemplo: clientes só visíveis pela organização
CREATE POLICY "clients_org_access" ON clients
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = clients.organization_id
        AND om.user_id = auth.uid()
    )
);
```

### 4.3 Triggers Importantes

- `handle_new_user`: Cria organização automaticamente no registro
- `handle_invite_registration`: Associa usuário à organização via convite
- `expire_modules`: Expira módulos de assinatura vencidos

---

## 5. Sistema Offline-First

A aplicação funciona completamente offline através de uma arquitetura em camadas:

### 5.1 Fluxo de Dados

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│   App.tsx    │───▶│ offlineFirstDb  │───▶│  supabaseDb  │
└──────────────┘    └─────────────────┘    └──────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │   offlineDb     │
                    │   (IndexedDB)   │
                    └─────────────────┘
```

### 5.2 Como Funciona

1. **Leitura**: Tenta Supabase primeiro; se offline, usa cache IndexedDB
2. **Escrita**: Salva em ambos (Supabase + cache); se offline, marca como pendente
3. **Sincronização**: `syncService.ts` sincroniza dados pendentes quando volta online

### 5.3 Indicador de Status

O componente `SyncStatusIndicator.tsx` mostra:
- 🟢 Online e sincronizado
- 🟡 Sincronizando...
- 🔴 Offline (dados salvos localmente)

---

## 6. Módulos e Funcionalidades

### 6.1 Funcionalidades Core (Gratuitas)

| Feature | Arquivo Principal |
|---------|-------------------|
| Cadastro de Clientes | `ClientModal.tsx`, `ClientBar.tsx` |
| Medições e Orçamentos | `MeasurementGroup.tsx`, `MeasurementList.tsx` |
| Catálogo de Películas | `FilmListView.tsx`, `FilmModal.tsx` |
| Geração de PDF | `pdfGenerator.ts` |
| Múltiplas Opções de Proposta | `ProposalOptionsCarousel.tsx` |
| Agenda de Instalações | `AgendaView.tsx` |

### 6.2 Módulos Premium

| Módulo | ID | Arquivos |
|--------|---|----------|
| Gestão de Estoque | `estoque` | `EstoqueView.tsx`, `estoqueDb.ts` |
| QR Code de Serviços | `qr_servicos` | `ServicoQrModal.tsx`, `servicosService.ts` |
| IA/OCR | `ia_ocr` | `useAIProcessing.ts`, AI*Modal.tsx |
| Corte Inteligente | `corte_inteligente` | `CuttingOptimizationPanel.tsx` |
| Gestão de Equipe | `colaboradores` | `TeamManagement.tsx`, `AdminUsers.tsx` |

---

## 7. Serviços Principais

### 7.1 offlineFirstDb.ts

Camada principal de acesso a dados com suporte offline:

```typescript
// Operações disponíveis
getAllClients()
saveClient(client)
deleteClient(id)
getProposalOptions(clientId)
saveProposalOptions(clientId, options)
getAllCustomFilms()
saveCustomFilm(film)
// ... e muitas outras
```

### 7.2 syncService.ts

Gerencia sincronização automática:

```typescript
initSyncService()      // Inicia listeners de conexão
syncPendingData()      // Sincroniza dados pendentes
getConnectionStatus()  // Retorna estado atual
```

### 7.3 pdfGenerator.ts

Gera PDFs profissionais:

```typescript
generatePDF({
    client,
    measurements,
    films,
    userInfo,
    discountValue,
    discountType,
    // ...
})
```

### 7.4 subscriptionService.ts

Gerencia assinaturas e módulos:

```typescript
getSubscription()
hasActiveModule(moduleId)
requestModuleActivation(moduleId, period)
confirmModuleActivation(subscriptionId, moduleId, months)
```

---

## 8. Autenticação e Autorização

### 8.1 Fluxo de Auth

1. Login via email/senha ou Magic Link (Supabase Auth)
2. `AuthContext` mantém estado do usuário
3. `ProtectedRoute` protege rotas que requerem login
4. Token JWT renovado automaticamente

### 8.2 Papéis de Usuário

| Papel | Permissões |
|-------|------------|
| `owner` | Tudo (incluir deletar organização) |
| `admin` | Gerenciar membros, ver preços |
| `member` | Operações básicas |
| `viewer` | Somente visualização |

### 8.3 Verificação no Código

```typescript
const { isAdmin, isOwner, organizationId } = useAuth();

if (isAdmin) {
    // Pode gerenciar membros
}
```

---

## 9. Sistema de Organizações e Equipes

### 9.1 Hierarquia

```
Organização
├── Owner (1)
├── Admins (n)
├── Members (n)
└── Viewers (n)
```

### 9.2 Convite de Membros

1. Owner/Admin gera convite (`inviteService.generateInvite()`)
2. Email enviado com código/link
3. Novo usuário se registra e é associado à organização
4. Trigger `handle_invite_registration` processa automaticamente

---

## 10. Sistema de Assinaturas

Ver documentação completa em `SISTEMA_ASSINATURAS.md`.

### Resumo:

- Módulos ativados individualmente
- Pagamento via PIX
- Status: `pending` → `active` → `expired`
- `FeatureGate` component protege funcionalidades

---

## 11. PWA e Instalação

### 11.1 Configuração

- `manifest.json`: Define nome, ícones, cores
- `sw.js`: Service Worker para cache offline
- `usePwaInstallPrompt`: Hook para prompt de instalação

### 11.2 Cache Strategy

```
Precache: HTML, CSS, JS, fontes
Runtime: API calls com network-first
Offline: Fallback para IndexedDB
```

### 11.3 Atualização

- `usePwaUpdate`: Detecta novas versões
- `UpdateNotification`: Mostra banner de atualização

---

## 12. Guia de Deploy

### 12.1 Variáveis de Ambiente

```env
# .env.local
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
RESEND_API_KEY=re_xxx
VITE_GEMINI_API_KEY=xxx (opcional)
```

### 12.2 Build para Produção

```bash
npm run build
```

### 12.3 Deploy (Vercel)

O repositório está configurado para deploy automático na Vercel:
- Branch `main` → Produção
- Pull Requests → Preview

### 12.4 Workflow de Deploy

Ver `.agent/workflows/deploy-producao.md` para procedimento detalhado.

---

## 📞 Suporte e Contato

Para dúvidas técnicas ou bugs, consulte os arquivos de documentação específicos ou entre em contato com o desenvolvedor.

---

*Documento gerado em Janeiro 2026. Manter atualizado a cada nova feature importante.*
