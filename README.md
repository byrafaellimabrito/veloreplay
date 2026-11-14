# Vélore Pay — Câmbio via PIX

Site de cotação e calculadora de câmbio: o cliente paga no PIX e recebe em **Dólar (USD)** ou **Guarani (PYG)**.

## Funcionalidades
- Cotação ao vivo (AwesomeAPI, com fallback na open.er-api) com **spread configurável** por moeda, atualizada a cada 60s
- Modo **manual** de cotação (você define o valor do dia)
- Calculadora em dois sentidos: **"Quero pagar"** (digita R$) e **"Quero receber"** (digita US$ ou Gs.)
- Guarani em múltiplos de 50.000 (notas de 50 mil e 100 mil), com arredondamento automático
- Taxa de serviço por faixa + taxa de entrega opcional; tabela de taxas exibida no site
- Retirada (pontos configuráveis) ou entrega com endereço
- Pedido enviado pelo **WhatsApp** com mensagem pronta (nome, moeda, cotação, taxas, total no PIX); segundo WhatsApp opcional
- Layout responsivo preto e dourado, botão flutuante de WhatsApp

## Configuração
Tudo fica em **`config.js`**: WhatsApp, horários, aviso do topo, modo de cotação, spread, cotação manual, faixas de taxa, taxa de entrega e pontos de retirada.

## Publicação
Site 100% estático (HTML/CSS/JS, sem build).
- **Vercel**: importe o repositório → Framework "Other" → Deploy.
- **GitHub Pages**: Settings → Pages → Branch `main` / root.

## Painel administrativo (`/admin.html`)
Login com e-mail e senha (Supabase Auth). Só e-mails cadastrados na tabela `admins` conseguem alterar algo.
- **Cotação do dia**: preço do dólar (R$ por US$ 1) e guarani (Gs. por R$ 1), modo manual ou automático (mercado − margem)
- Taxas de serviço por faixa, taxa de entrega, WhatsApp, aviso do topo, pontos de retirada e horários
- Histórico das cotações (quem mudou e quando)

O site público lê a configuração do banco a cada carregamento e a cada 60s. Se o banco estiver fora do ar, usa os valores do `config.js`.

**Banco:** projeto Supabase `velore-pay` — tabelas `settings` (leitura pública, escrita só admin), `admins`, `rate_history`.
Para adicionar outro administrador: `insert into admins(email) values ('email@exemplo.com');`
