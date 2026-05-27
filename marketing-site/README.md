# Filmstec Marketing Site

Estrutura de marketing separada do app principal.

## Objetivo

- usar `www.filmstec.shop` para marketing
- usar `app.filmstec.shop` para o sistema
- manter uma pagina por funcionalidade premium
- levar o lead para o modulo certo no app usando `?tab=account&upgrade=...`

## Como publicar na Vercel

1. Criar um novo projeto na Vercel com **Root Directory** apontando para `marketing-site`.
2. Publicar o projeto como site estatico.
3. Apontar `www.filmstec.shop` para esse projeto.
4. Manter o app atual no projeto principal e depois mover o dominio do sistema para `app.filmstec.shop`.

## Configuracao importante

O arquivo `config.js` controla o destino dos CTAs:

- `appBaseUrl: 'https://app.filmstec.shop'`

## Estrutura

- `index.html`: pagina principal com todos os modulos
- `pacote-completo/`
- `controle-de-estoque/`
- `qr-code-servicos/`
- `gestao-de-equipe/`
- `extracao-com-ia/`
- `marca-propria/`
- `locais-globais-pro/`
- `corte-inteligente/`
- `sem-limites/`

## Proximo passo recomendado

- substituir os placeholders visuais por imagens e videos reais do produto
- conectar `www` no marketing e `app` no sistema
- criar campanhas apontando cada anuncio para a pagina especifica da funcao premium
