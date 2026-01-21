# 📖 Índice de Documentação - Películas BR

Este documento serve como índice central para toda a documentação do projeto.

**Localização:** Todos os documentos estão na pasta `/docs`

---

## 📋 Documentos Disponíveis

### 🏠 Principal
| Documento | Descrição | Público-Alvo |
|-----------|-----------|--------------|
| [README.md](../README.md) | Visão geral e instalação | Todos |
| [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md) | Arquitetura completa | Desenvolvedores |

### 💼 Negócio e Marketing
| Documento | Descrição | Público-Alvo |
|-----------|-----------|--------------|
| [PRINCIPAIS_FUNCIONALIDADES.md](./PRINCIPAIS_FUNCIONALIDADES.md) | Features para marketing (30 funcionalidades) | Marketing/Vendas |
| [DOCUMENTACAO_VENDAS.md](./DOCUMENTACAO_VENDAS.md) | Material de vendas | Comercial |

### 🔧 Técnico
| Documento | Descrição | Público-Alvo |
|-----------|-----------|--------------|
| [AI_RULES.md](./AI_RULES.md) | Regras de desenvolvimento | Desenvolvedores |
| [SISTEMA_ASSINATURAS.md](./SISTEMA_ASSINATURAS.md) | Sistema de assinaturas | Desenvolvedores |

### 📧 Integrações
| Documento | Descrição | Público-Alvo |
|-----------|-----------|--------------|
| [RESEND_README.md](./RESEND_README.md) | Guia rápido de emails | Desenvolvedores |
| [EMAIL_SERVICE.md](./EMAIL_SERVICE.md) | Serviço de email detalhado | Desenvolvedores |
| [EMAIL_DEPLOY.md](./EMAIL_DEPLOY.md) | Deploy de email | DevOps |

### 🚀 Workflows
| Documento | Descrição |
|-----------|-----------|
| [deploy-producao.md](../.agent/workflows/deploy-producao.md) | Deploy para produção |

---

## 🗂️ Scripts SQL

| Arquivo | Descrição |
|---------|-----------|
| `supabase_migration.sql` | Migração principal de tabelas |
| `supabase_subscription.sql` | Tabelas de assinaturas |
| `supabase_subscription_extras.sql` | Funções extras de assinaturas |
| `fix_organization_members.sql` | Correções de RLS |

---

## 📅 Histórico de Atualizações

| Data | Documento | Alteração |
|------|-----------|-----------|
| Jan 2026 | PRINCIPAIS_FUNCIONALIDADES.md | 🔄 Expandido para 30 features com detalhes |
| Jan 2026 | Todos | 📁 Movidos para pasta /docs |
| Jan 2026 | DOCUMENTACAO_TECNICA.md | ✨ Criado - Arquitetura consolidada |
| Jan 2026 | README.md | 🔄 Reescrito completamente |
| Jan 2026 | AI_RULES.md | 🔄 Atualizado seção de persistência |

---

## ❓ Qual documento devo ler?

| Se você quer... | Leia |
|-----------------|------|
| Instalar e rodar o projeto | [README.md](../README.md) |
| Entender a arquitetura | [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md) |
| Conhecer as funcionalidades | [PRINCIPAIS_FUNCIONALIDADES.md](./PRINCIPAIS_FUNCIONALIDADES.md) |
| Desenvolver novas features | [AI_RULES.md](./AI_RULES.md) |
| Configurar emails | [RESEND_README.md](./RESEND_README.md) |
| Entender o sistema de assinaturas | [SISTEMA_ASSINATURAS.md](./SISTEMA_ASSINATURAS.md) |
| Fazer deploy | [deploy-producao.md](../.agent/workflows/deploy-producao.md) |

---

## 📂 Estrutura da Pasta /docs

```
📂 docs/
├── 📄 DOCUMENTACAO_INDEX.md      ← Este arquivo (índice)
├── 📄 DOCUMENTACAO_TECNICA.md    ← Arquitetura do sistema
├── 📄 PRINCIPAIS_FUNCIONALIDADES.md ← Features (30+ detalhadas)
├── 📄 DOCUMENTACAO_VENDAS.md     ← Material de marketing
├── 📄 SISTEMA_ASSINATURAS.md     ← Sistema de pagamentos
├── 📄 AI_RULES.md                ← Regras de dev
├── 📄 RESEND_README.md           ← Guia de email
├── 📄 EMAIL_SERVICE.md           ← Detalhes do serviço
└── 📄 EMAIL_DEPLOY.md            ← Deploy de email
```

---

*Última atualização: Janeiro 2026*
