# Vélore Pay — Câmbio via PIX

Site de cotação e calculadora de câmbio: o cliente paga no PIX e recebe em **Dólar (USD)** ou **Guarani (PYG)**.

## Como funciona
- O cliente abre o link, digita quanto vai enviar no PIX (R$) e vê na hora quanto recebe em **dólar** e em **guarani**.
- Conversão direta pela cotação do dia: dólar = R$ por US$ 1; guarani = Gs. por R$ 1.
- Botão "Fazer pedido no WhatsApp" abre a conversa com nome, valor do PIX, moeda e cotação.
- O site busca a cotação no banco a cada 30 segundos e quando a aba volta a ficar visível.
- **Cotação manual ou automática** (escolha no painel). Na automática, o site consulta o mercado (AwesomeAPI; reserva: ExchangeRate-API) e aplica a margem da casa: dólar = mercado × (1 + margem); guarani = mercado × (1 − margem). Se as duas fontes falharem, usa a cotação manual.

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
