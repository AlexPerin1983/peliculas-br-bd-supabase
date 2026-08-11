# Testes gratuitos de iPhone

Esta suíte usa o WebKit do Playwright no Windows com perfis de iPhone Pro Max.
Ela não usa credenciais reais e mantém o aplicativo offline nos testes da área
autenticada, evitando qualquer gravação no Supabase.

## Comandos

```powershell
# Executa os dois tamanhos: iPhone 15 Pro Max e iPhone 11 Pro Max
npm run test:e2e

# Executa apenas o perfil moderno
npm run test:e2e:iphone

# Abre o navegador para acompanhar visualmente
npm run test:e2e:iphone:headed

# Interface interativa para repetir passos e inspecionar falhas
npm run test:e2e:ui
```

Em outro computador, instale o WebKit uma vez:

```powershell
npm install
npm run test:e2e:install
```

Em caso de falha, screenshots, vídeo e trace ficam em `test-results/playwright`.
O relatório HTML pode ser aberto com `npm run test:e2e:report`.

## Limite da simulação

O WebKit reproduz o motor do Safari, touch, densidade, viewport e user agent.
Ele não reproduz perfeitamente a barra nativa, o teclado real, a Dynamic Island,
as safe areas físicas nem o navegador interno do Instagram. Esses pontos ainda
precisam de uma confirmação ocasional feita por um usuário com iPhone.
