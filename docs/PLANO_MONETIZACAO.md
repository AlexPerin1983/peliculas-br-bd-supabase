# 💎 Plano de Monetização - Películas BR

## Resumo Executivo

**30 Funcionalidades** organizadas em **3 níveis de acesso**:
- 🆓 **GRATUITO** - Funcionalidades básicas com limites
- 💎 **MÓDULOS PRO** - Funcionalidades avançadas individuais (R$ 39,00/6 meses cada)
- 👑 **PLANO COMPLETO** - Tudo liberado com desconto (R$ 199,00/6 meses)

---

## 🆓 PLANO GRATUITO

### Limites
| Recurso | Limite | Renovação |
|---------|--------|-----------|
| 👥 Clientes | 10 cadastros | Fixo |
| 🎬 Películas | 5 cadastros | Fixo |
| 📄 PDFs/Orçamentos | 10/mês | Mensal |
| 📅 Agendamentos | 5/mês | Mensal |

### ✅ Funcionalidades Incluídas (GRÁTIS)

| # | Funcionalidade | Descrição |
|---|----------------|-----------|
| 1 | 📐 **Plano de Corte BÁSICO** | Visualização sem otimização avançada |
| 2 | 📄 **Geração de PDF** | Limitado a 10/mês |
| 3 | 📊 **Múltiplas Opções** | 1 opção por orçamento |
| 4 | 💰 **Descontos** | Por item e geral |
| 5 | 📚 **Histórico** | Últimos 20 orçamentos |
| 6 | 📤 **Compartilhamento** | WhatsApp, E-mail, Download |
| 7 | 👤 **Gestão de Clientes** | Limitado a 10 |
| 8 | 📍 **Busca de CEP** | ViaCEP integrado |
| 9 | 🎨 **Catálogo de Películas** | Limitado a 5 |
| 10 | 📍 **Base Compartilhada** | Apenas visualizar (não adicionar) |
| 11 | 🗓️ **Agenda BÁSICA** | Limitado a 5/mês |
| 12 | 📶 **PWA Offline** | Funciona sem internet |
| 13 | 🔄 **Sincronização** | Multi-dispositivo |
| 14 | ⚙️ **Config. Básicas** | Dados da empresa |

---

## 💎 MÓDULOS PRO (R$ 39,00 cada / 6 meses)

### Módulo 1: 📦 ESTOQUE
**Verificação:** `hasModule('estoque')` / `canUseEstoque`

| Funcionalidade | Disponível no FREE? |
|----------------|---------------------|
| 📦 Aba "Estoque" no menu | ❌ Bloqueada |
| 📦 Cadastro de Bobinas | ❌ Bloqueado |
| 📦 Cadastro de Retalhos | ❌ Bloqueado |
| 🔲 QR Code de Estoque | ❌ Bloqueado |
| 📊 Catálogo Público de Estoque | ❌ Bloqueado |
| 📊 Estatísticas de Estoque | ❌ Bloqueado |

---

### Módulo 2: 🔗 QR CODE DE SERVIÇOS
**Verificação:** `hasModule('qr_servicos')` / `canUseQrServicos`

| Funcionalidade | Disponível no FREE? |
|----------------|---------------------|
| 🔗 Aba "QR Code" no menu | ❌ Bloqueada |
| 🔗 Registro de Serviço | ❌ Bloqueado |
| 🎫 Etiqueta QR para Impressão | ❌ Bloqueado |
| 🌐 Página Pública do Serviço | ❌ Bloqueado |
| 📲 Captação via QR | ❌ Bloqueado |

---

### Módulo 3: 👥 GESTÃO DE EQUIPE
**Verificação:** `hasModule('colaboradores')` / `canUseColaboradores`

| Funcionalidade | Disponível no FREE? |
|----------------|---------------------|
| 👥 Convidar Colaboradores | ❌ Bloqueado |
| 📧 Convites por E-mail | ❌ Bloqueado |
| 🔐 Níveis de Acesso | ❌ Bloqueado |
| 👥 Múltiplos Membros | ❌ Bloqueado |

---

### Módulo 4: 🧠 EXTRAÇÃO COM IA
**Verificação:** `hasModule('ia_ocr')` / `canUseIA`

| Funcionalidade | Disponível no FREE? |
|----------------|---------------------|
| 🤖 Medição por IA | ❌ Bloqueada |
| 📱 Cadastro de Clientes via IA | ❌ Bloqueada |
| 🎬 Cadastro de Películas via IA | ❌ Bloqueada |
| 🔊 Entrada por Voz | ❌ Bloqueada |
| 📸 OCR de Imagens | ❌ Bloqueado |

**Nota:** OCR Local (Tesseract) pode ser liberado no FREE como alternativa limitada.

---

### Módulo 5: 🎨 MARCA PRÓPRIA
**Verificação:** `hasModule('personalizacao')` / `canCustomize`

| Funcionalidade | Disponível no FREE? |
|----------------|---------------------|
| 🖼️ Logo Personalizado | ❌ Bloqueado |
| 🎨 Cores da Marca | ❌ Bloqueado |
| ✍️ Assinatura Digital | ❌ Bloqueada |
| 🔗 Redes Sociais nos PDFs | ❌ Bloqueado |

---

### Módulo 6: ♾️ SEM LIMITES
**Verificação:** `hasModule('ilimitado')` / `isUnlimited`

| Funcionalidade | Limite FREE | Com Módulo |
|----------------|-------------|------------|
| 👥 Clientes | 10 | ♾️ Ilimitado |
| 🎬 Películas | 5 | ♾️ Ilimitado |
| 📄 PDFs/mês | 10 | ♾️ Ilimitado |
| 📅 Agendamentos/mês | 5 | ♾️ Ilimitado |
| 📊 Histórico | 20 últimos | ♾️ Ilimitado |
| 📊 Opções por orçamento | 1 | ♾️ Ilimitado |

---

### Módulo 7: 📍 LOCAIS GLOBAIS PRO
**Verificação:** `hasModule('locais_global')` / `canAddLocais`

| Funcionalidade | Disponível no FREE? |
|----------------|---------------------|
| 👁️ Visualizar Medidas | ✅ Liberado |
| 📍 Adicionar Novos Locais | ❌ Bloqueado |
| ✏️ Editar Medidas Existentes | ❌ Bloqueado |
| 📤 Exportar Medidas | ❌ Bloqueado |

---

### Módulo 8: ✂️ CORTE INTELIGENTE
**Verificação:** `hasModule('corte_inteligente')` / `canUseCorteInteligente`

| Funcionalidade | Disponível no FREE? |
|----------------|---------------------|
| 📐 Plano de Corte Básico | ✅ Liberado |
| 🧠 Otimização Profunda | ❌ Bloqueado |
| 🔄 Rotação Automática | ❌ Bloqueado |
| 📊 Histórico de Versões | ❌ Bloqueado |
| 💰 Cálculo de Custo | ❌ Bloqueado |
| 📊 Estatísticas Avançadas | ❌ Bloqueado |

---

## 👑 PLANO COMPLETO (TUDO LIBERADO)

### Precificação

| Opção | Valor | Economia | Módulos |
|-------|-------|----------|---------|
| **Todos os 8 módulos separados** | R$ 312,00 | - | 8 x R$ 39,00 |
| 👑 **PLANO COMPLETO** | **R$ 199,00** | 36% OFF | Todos os 8 |

### O que inclui

| Módulo | Valor Avulso | No Plano Completo |
|--------|--------------|-------------------|
| 📦 Estoque | R$ 39,00 | ✅ Incluído |
| 🔗 QR Serviços | R$ 39,00 | ✅ Incluído |
| 👥 Equipe | R$ 39,00 | ✅ Incluído |
| 🧠 IA/OCR | R$ 39,00 | ✅ Incluído |
| 🎨 Marca Própria | R$ 39,00 | ✅ Incluído |
| ♾️ Sem Limites | R$ 39,00 | ✅ Incluído |
| 📍 Locais PRO | R$ 39,00 | ✅ Incluído |
| ✂️ Corte Inteligente | R$ 39,00 | ✅ Incluído |
| **TOTAL** | R$ 312,00 | **R$ 199,00** |

---

## 📊 Tabela de Comparação Final

| Funcionalidade | 🆓 FREE | 💎 PRO (Módulo) | 👑 COMPLETO |
|----------------|---------|-----------------|-------------|
| **Clientes** | 10 | ♾️ (ilimitado) | ♾️ |
| **Películas** | 5 | ♾️ (ilimitado) | ♾️ |
| **PDFs/mês** | 10 | ♾️ (ilimitado) | ♾️ |
| **Agendamentos/mês** | 5 | ♾️ (ilimitado) | ♾️ |
| **Plano de Corte** | Básico | ✂️ Avançado | ✅ |
| **PDF Profissional** | ✅ | ✅ | ✅ |
| **Múltiplas Opções** | 1 | ♾️ (ilimitado) | ♾️ |
| **Estoque** | ❌ | 📦 | ✅ |
| **QR Serviços** | ❌ | 🔗 | ✅ |
| **Equipe** | ❌ | 👥 | ✅ |
| **IA/OCR** | ❌ | 🧠 | ✅ |
| **Personalização** | ❌ | 🎨 | ✅ |
| **Locais PRO** | Ver | 📍 | ✅ |
| **PWA Offline** | ✅ | ✅ | ✅ |
| **Sincronização** | ✅ | ✅ | ✅ |
| **PREÇO** | Grátis | R$ 39/módulo | **R$ 199** |
| **Validade** | - | 6 meses | 6 meses |

---

## 🔧 Implementação Técnica

### Hooks de Verificação

```typescript
// SubscriptionContext.tsx
const { 
    hasModule,           // Verificar módulo específico
    isLimitReached,      // Verificar se atingiu limite
    canUseEstoque,       // Atalho para hasModule('estoque')
    canUseQrServicos,    // Atalho para hasModule('qr_servicos')
    canUseColaboradores, // Atalho para hasModule('colaboradores')
    canUseIA,            // Atalho para hasModule('ia_ocr')
    canCustomize,        // Atalho para hasModule('personalizacao')
    canAddLocais,        // Atalho para hasModule('locais_global')
    canUseCorteInteligente, // Atalho para hasModule('corte_inteligente')
    isUnlimited          // Atalho para hasModule('ilimitado')
} = useSubscription();
```

### Padrão de Bloqueio

```typescript
// Bloquear aba no menu
{canUseEstoque && <TabButton tabId="estoque" ... />}

// Bloquear botão com modal de upgrade
<button onClick={() => canUseIA ? processWithAI() : showUpgradeModal('ia_ocr')}>
    {canUseIA ? 'Usar IA' : '🔒 Usar IA (PRO)'}
</button>

// Verificar limite antes de ação
if (isLimitReached('clients', clientCount)) {
    showUpgradeModal('ilimitado');
    return;
}
```

---

## 📈 SQL para Atualizar Plano Completo

```sql
-- Adicionar módulo "plano_completo" com todos os módulos
INSERT INTO subscription_modules (id, name, description, price_monthly, validity_months, icon, features, sort_order) VALUES
('plano_completo', 'Plano Completo', 'Todos os módulos PRO com 36% de desconto', 199.00, 6, 'Crown', 
'["estoque", "qr_servicos", "colaboradores", "ia_ocr", "personalizacao", "ilimitado", "locais_global", "corte_inteligente"]', 0)
ON CONFLICT (id) DO UPDATE SET
    price_monthly = 199.00,
    validity_months = 6,
    features = EXCLUDED.features;
```

---

## 🎯 Próximos Passos

1. [ ] Criar função `activatePlanComplete()` que ativa todos os 8 módulos
2. [ ] Adicionar indicador de limite na tela (ex: "3/10 clientes")
3. [ ] Bloquear abas PRO no Header
4. [ ] Criar modal de upgrade bonito
5. [ ] Adicionar página de planos/preços
6. [ ] Configurar PIX para pagamento

---

> 💡 **Resumo:** Modelo freemium com 14 funcionalidades grátis + 8 módulos pagos de R$ 39,00 cada + plano completo por R$ 199,00 (36% de desconto). Validade de 6 meses para todos os módulos pagos.
