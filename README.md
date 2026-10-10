# VitaCursos — loja digital de PDFs

Loja com interface visual estilo e-commerce, usando as 36 capas reais dos PDFs enviados.

## Oferta
- Cursos individuais: de R$ 59,99 por R$ 19,90
- Pacote completo: de R$ 399,90 por R$ 199,90

## Interface
- Banner principal com capas reais
- Categorias visuais
- Cards de produtos com capa, desconto, preço e prévia
- Modal de prévia
- Carrinho lateral
- Checkout
- Layout responsivo para celular e PC

## Download protegido
Os PDFs completos ficam em `private/cursos` e não são publicados como arquivos estáticos. O servidor só libera o download depois de confirmar o pagamento.

## Mercado Pago
1. Instale Node.js 18+.
2. Rode `npm install`.
3. Copie `.env.example` para `.env`.
4. Configure `MERCADOPAGO_ACCESS_TOKEN`, `PUBLIC_BASE_URL` e `DOWNLOAD_SECRET`.
5. Rode `npm start`.
6. Em produção, use HTTPS e uma URL pública para o webhook.

Não coloque suas credenciais do Mercado Pago dentro do HTML/JavaScript nem envie suas chaves aqui no chat.


## Deploy no Render
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: deixe vazio.
- Variáveis: `MERCADOPAGO_ACCESS_TOKEN` (Access Token), `PUBLIC_BASE_URL=https://vitacursos.onrender.com` e `DOWNLOAD_SECRET` (uma chave aleatória longa).
- Não coloque credenciais no GitHub.
