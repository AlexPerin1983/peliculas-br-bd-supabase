# 📦 Sistema de Assinaturas e Módulos - Películas BR

## Visão Geral

O sistema de assinaturas permite controlar o acesso a funcionalidades premium da aplicação de forma modular. Cada módulo pode ser ativado/desativado independentemente, com pagamento via PIX.

---

## 🏗️ Arquitetura

### Componentes Principais

```
├── supabase_subscription.sql      # Script principal do banco
├── supabase_subscription_extras.sql   # Funções extras
├── services/
│   └── subscriptionService.ts     # Serviço de API
├── contexts/
│   └── SubscriptionContext.tsx    # Context React
└── components/subscription/
    ├── index.ts                   # Exportações
    ├── SubscriptionComponents.tsx # Componentes UI
    └── SubscriptionPage.tsx       # Página de gestão
```

---

## 📊 Tabelas do Banco de Dados

### subscription_modules
Módulos disponíveis para compra:
- `id`: Identificador único (ex: 'estoque', 'qr_servicos')
- `name`: Nome exibido
- `description`: Descrição
- `price_monthly`: Preço mensal
- `price_yearly`: Preço anual (com desconto)
- `features`: Array de features incluídas

### subscriptions
Uma por organização:
- `organization_id`: Referência à organização
- `limits`: Limites do plano gratuito (JSON)
- `active_modules`: Array de módulos ativos
- `usage_current_month`: Contadores de uso

### module_activations
Registro de cada ativação:
- `subscription_id`: Referência à assinatura
- `module_id`: Qual módulo
- `status`: 'pending', 'active', 'expired', 'cancelled'
- `expires_at`: Data de expiração
- `payment_amount`: Valor pago

### payment_history
Histórico de pagamentos para auditoria.

---

## 🎮 Módulos Disponíveis

| ID | Nome | Preço/mês | O que inclui |
|----|------|-----------|--------------|
| `estoque` | Controle de Estoque | R$ 29,90 | Bobinas, retalhos, consumos |
| `qr_servicos` | QR Code Serviços | R$ 19,90 | Página pública do serviço |
| `colaboradores` | Gestão de Equipe | R$ 39,90 | Convites, membros ilimitados |
| `ia_ocr` | Extração com IA | R$ 24,90 | OCR Gemini/OpenAI |
| `personalizacao` | Marca Própria | R$ 14,90 | Cores, logo customizados |
| `ilimitado` | Sem Limites | R$ 49,90 | Remove todos os limites |
| `locais_global` | Locais PRO | R$ 9,90 | Adicionar/editar locais globais |
| `corte_inteligente` | Corte Inteligente | R$ 34,90 | Otimização de corte, redução desperdício |

---

## 🔧 Como Usar no Código

### 1. Adicionar Provider no App

```tsx
// App.tsx ou index.tsx
import { SubscriptionProvider } from './contexts/SubscriptionContext';

function App() {
    return (
        <SubscriptionProvider>
            {/* Sua aplicação */}
        </SubscriptionProvider>
    );
}
```

### 2. Verificar Acesso a Módulo

```tsx
import { useSubscription } from './contexts/SubscriptionContext';

function MinhaFuncionalidade() {
    const { canUseEstoque, hasModule } = useSubscription();
    
    // Verificação direta
    if (!canUseEstoque) {
        return <UpgradePrompt module="estoque" />;
    }
    
    // Ou verificação genérica
    if (!hasModule('qr_servicos')) {
        return <UpgradePrompt module="qr_servicos" />;
    }
    
    return <ConteudoReal />;
}
```

### 3. Usar FeatureGate (Recomendado)

```tsx
import { FeatureGate } from './components/subscription';

function EstoquePage() {
    return (
        <FeatureGate moduleId="estoque">
            {/* Conteúdo só aparece se módulo estiver ativo */}
            <ListaDeBobinas />
            <ListaDeRetalhos />
        </FeatureGate>
    );
}
```

### 4. Verificar Limites

```tsx
import { useSubscription } from './contexts/SubscriptionContext';
import { LimitWarning } from './components/subscription';

function ListaClientes({ clientes }) {
    const { isLimitReached, getRemainingQuota } = useSubscription();
    
    const limitReached = isLimitReached('clients', clientes.length);
    const remaining = getRemainingQuota('clients', clientes.length);
    
    return (
        <div>
            <LimitWarning 
                resource="clients" 
                currentCount={clientes.length}
                onUpgradeClick={() => navigate('/assinatura')}
            />
            
            {limitReached && (
                <p>Você atingiu o limite! Ative "Sem Limites" para adicionar mais.</p>
            )}
            
            <button disabled={limitReached}>
                Adicionar Cliente ({remaining} restantes)
            </button>
        </div>
    );
}
```

### 5. Incrementar Uso (PDFs/Agendamentos)

```tsx
import { incrementUsage } from './services/subscriptionService';

async function gerarPDF() {
    // ... gerar PDF ...
    
    // Incrementar contador
    await incrementUsage('pdfs');
}

async function criarAgendamento() {
    // ... criar agendamento ...
    
    await incrementUsage('agendamentos');
}
```

---

## 🔐 Fluxo de Ativação de Módulo

1. **Usuário solicita** → `requestModuleActivation(moduleId, 'monthly')`
2. **Status fica 'pending'** → Aguardando pagamento
3. **Admin confirma PIX** → `confirmModuleActivation(subscriptionId, moduleId, months)`
4. **Módulo ativado** → Array `active_modules` atualizado

### Confirmar Ativação (Admin)

```tsx
import { confirmModuleActivation, getPendingActivations } from './services/subscriptionService';

// Listar pendentes
const pendentes = await getPendingActivations();

// Aprovar um
await confirmModuleActivation(
    pendentes[0].subscription_id,
    pendentes[0].module_id,
    1, // meses
    'PIX-123456' // referência do pagamento
);
```

---

## 📱 Página de Assinatura

```tsx
import { SubscriptionPage } from './components/subscription';

// Na navegação do app
case 'assinatura':
    return <SubscriptionPage userInfo={userInfo} />;
```

---

## 🗄️ Instalação no Supabase

1. Acesse o SQL Editor do Supabase
2. Execute `supabase_subscription.sql` (script principal)
3. Execute `supabase_subscription_extras.sql` (funções extras)
4. Verifique: `SELECT * FROM subscription_modules;`

---

## ⚙️ Configurar Chave PIX

A chave PIX para recebimento é buscada automaticamente das configurações do usuário:

```typescript
const pixKey = userInfo?.payment_methods?.find(p => p.tipo === 'pix')?.chave_pix;
```

Configure em: **Configurações → Formas de Pagamento → PIX**

---

## 📈 Monitoramento (Admin)

### Ver resumo de assinaturas:
```sql
SELECT * FROM subscription_summary;
```

### Ver módulos ativos próximos de expirar:
```sql
SELECT * FROM active_modules_detail WHERE days_remaining < 7;
```

### Expirar módulos manualmente:
```sql
SELECT expire_modules();
```

---

## 🔄 Manutenção

### Resetar contadores mensais
Os contadores de uso são resetados automaticamente quando `usage_reset_at` passa.

### Expirar módulos pendentes
Configure um cron job ou rode manualmente:
```sql
SELECT expire_modules();
```

---

## 💡 Dicas

1. **Cache**: O `subscriptionService` usa cache de 5 minutos. Use `refresh()` para forçar atualização.

2. **Performance**: Use `<FeatureGate>` em vez de verificações manuais - já inclui loading state.

3. **Fallback**: Sempre tenha um comportamento para usuários sem o módulo:
   ```tsx
   <FeatureGate moduleId="ia_ocr" fallback={<ExtratorManual />}>
       <ExtratorComIA />
   </FeatureGate>
   ```

4. **Limites flexíveis**: Os limites do plano gratuito podem ser ajustados no banco sem mudar código.

---

## 📞 Suporte

Para dúvidas sobre implementação ou modificações no sistema de assinaturas, consulte a documentação interna ou entre em contato com o desenvolvedor.
