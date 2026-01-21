<div align="center">
<img width="120" height="120" alt="Películas BR Logo" src="public/icons/icon-192x192.png" />

# 🎬 Películas BR

**Sistema completo para instaladores e lojas de películas automotivas e residenciais**

[![Deploy Status](https://img.shields.io/badge/deploy-vercel-black)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/backend-supabase-3ECF8E)](https://supabase.com)
[![PWA](https://img.shields.io/badge/PWA-ready-blue)](https://web.dev/progressive-web-apps/)

</div>

---

## 🚀 Funcionalidades Principais

| Feature | Descrição |
|---------|-----------|
| 📐 **Plano de Corte Inteligente** | Algoritmo que otimiza o aproveitamento da bobina, reduzindo desperdício em até 30% |
| 🤖 **Medição com IA** | Extraia medidas de fotos, prints de WhatsApp ou áudio |
| 📦 **Gestão de Estoque** | Controle de bobinas e retalhos com QR Code |
| 📄 **PDFs Profissionais** | Orçamentos premium com logo, dados técnicos e múltiplas opções |
| 🔲 **QR Code de Garantia** | Etiqueta digital com dados da instalação para o cliente |
| 📱 **Cadastro via IA** | Fotografe um cartão de visita e cadastre automaticamente |
| 🗓️ **Agenda de Instalações** | Calendário integrado com clientes e orçamentos |
| 👥 **Gestão de Equipe** | Controle de acesso por colaborador |
| 📶 **Funciona Offline** | PWA que sincroniza automaticamente |

---

## 🛠️ Stack Tecnológico

```
Frontend:  React 19 + TypeScript + Tailwind CSS + Vite
Backend:   Supabase (Auth, Database, Storage, Edge Functions)
Offline:   IndexedDB + Service Worker (PWA)
IA:        Google Gemini / OpenAI / OCR Local (Tesseract.js)
Email:     Resend
```

---

## 📦 Instalação Local

### Pré-requisitos

- Node.js 18+ 
- Conta no [Supabase](https://supabase.com)
- (Opcional) API Key do [Gemini](https://ai.google.dev/) ou [OpenAI](https://openai.com/)

### Passos

1. **Clone o repositório**
   ```bash
   git clone https://github.com/AlexPerin1983/peliculas-br-bd-supabase.git
   cd peliculas-br-bd-supabase
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   
   Crie o arquivo `.env.local` na raiz:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...seu-anon-key...
   ```

4. **Execute o projeto**
   ```bash
   npm run dev
   ```

5. **Acesse no navegador**
   ```
   http://localhost:3001
   ```

---

## 📁 Estrutura do Projeto

```
├── App.tsx                 # Componente principal
├── types.ts                # Interfaces TypeScript
├── /components/            # Componentes React
│   ├── /modals/            # Modais (24 arquivos)
│   ├── /views/             # Views/páginas (8 arquivos)
│   └── /ui/                # Componentes reutilizáveis
├── /services/              # Serviços de dados
│   ├── offlineFirstDb.ts   # Camada offline-first
│   ├── supabaseDb.ts       # Operações Supabase
│   └── syncService.ts      # Sincronização
├── /contexts/              # React Contexts
└── /public/                # Assets estáticos
```

---

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| [DOCUMENTACAO_TECNICA.md](./docs/DOCUMENTACAO_TECNICA.md) | Arquitetura completa do sistema |
| [PRINCIPAIS_FUNCIONALIDADES.md](./docs/PRINCIPAIS_FUNCIONALIDADES.md) | Features detalhadas |
| [SISTEMA_ASSINATURAS.md](./docs/SISTEMA_ASSINATURAS.md) | Sistema de módulos e pagamentos |
| [AI_RULES.md](./docs/AI_RULES.md) | Regras de desenvolvimento |
| [DOCUMENTACAO_VENDAS.md](./docs/DOCUMENTACAO_VENDAS.md) | Material de marketing |

---

## 🔐 Configuração do Supabase

### Tabelas Necessárias

Execute os scripts SQL na seguinte ordem:

1. `supabase_migration.sql` - Tabelas base
2. `supabase_subscription.sql` - Sistema de assinaturas
3. `fix_organization_members.sql` - Correções de RLS

### Políticas RLS

Todas as tabelas usam Row Level Security para isolar dados por organização.

---

## 📱 PWA (Progressive Web App)

A aplicação pode ser instalada como app no celular:

1. Acesse a URL no navegador mobile
2. Toque em "Adicionar à tela inicial"
3. Use como app nativo (funciona offline!)

---

## 🚀 Deploy

### Vercel (Recomendado)

```bash
# Login
vercel login

# Deploy
vercel --prod
```

### Variáveis no Vercel

Configure as seguintes variáveis de ambiente:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RESEND_API_KEY` (para emails)

---

## 🧪 Modo OCR Local (Gratuito)

O app suporta **dois modos de extração de dados**:

### 1. Modo Gemini/OpenAI (Pago)
- Usa API de IA para extração inteligente
- Suporta imagem, texto e áudio
- Melhor precisão e contexto semântico

### 2. Modo OCR Local (100% Gratuito)
- Roda **inteiramente no navegador** usando [Tesseract.js](https://tesseract.projectnaptha.com/)
- **Zero custo** - nenhuma chamada de API externa
- **Privacidade total** - nenhum dado enviado para servidor

> ⚠️ **Nota**: O primeiro OCR local pode levar 5-15 segundos para carregar os dados de idioma (~3MB).

---

## 📞 Suporte

Para dúvidas ou problemas:
- Abra uma [Issue](https://github.com/AlexPerin1983/peliculas-br-bd-supabase/issues)
- Consulte a [Documentação Técnica](./DOCUMENTACAO_TECNICA.md)

---

## 📄 Licença

Este projeto é proprietário. Todos os direitos reservados.

---

<div align="center">
<strong>Desenvolvido com ❤️ para o mercado de películas</strong>
</div>
