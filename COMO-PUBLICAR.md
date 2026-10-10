# VitaCursos — Mercado Pago + downloads

## Importante
Este projeto precisa rodar em um servidor Node.js. Publicar apenas os arquivos no Netlify como site estático não executa o `server.js`.

## Publicação simples no Render
1. Crie um serviço Web no Render e conecte este projeto.
2. Build command: `npm install`
3. Start command: `npm start`
4. Crie estas variáveis de ambiente no Render:
   - `MP_ACCESS_TOKEN` = Access Token de TESTE do Mercado Pago
   - `MP_WEBHOOK_SECRET` = deixe vazio por enquanto se ainda não configurou a assinatura do webhook
   - `PUBLIC_BASE_URL` = URL HTTPS do seu serviço no Render
   - `DOWNLOAD_SECRET` = uma senha longa aleatória, por exemplo 32+ caracteres
5. Faça o deploy.

## Segurança
Nunca coloque o Access Token dentro de `app.js`, `index.html` ou outro arquivo público. Não envie o Access Token no chat.

## Fluxo
Produto → Checkout Pro → pagamento → confirmação → download protegido.

O pacote completo é montado no servidor quando o pagamento do pacote é aprovado; não é necessário publicar um ZIP gigante duplicado.
