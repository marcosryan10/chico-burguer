# 5. Rotas e dados

## Rotas principais

| Método e caminho | Função |
| --- | --- |
| GET /api/catalog | Catálogo, frete e quantidade de mesas. |
| POST /api/quote | Recalcula a cotação com preços do servidor. |
| POST /api/orders | Valida e grava um pedido. |
| POST /api/receipt | Consulta um recibo com ID e token. |
| POST /api/admin/login | Confere o acesso e cria a sessão. |
| GET /api/admin/session | Confere se a sessão da equipe é válida. |
| POST /api/admin/logout | Encerra a sessão. |
| GET /api/admin/orders | Lista os pedidos para a equipe autenticada. |
| POST /api/admin/update-order | Atualiza andamento ou pagamento. |
| GET e POST /api/admin/coupons | Consulta e cadastra/atualiza cupons. |
| POST /api/admin/settings | Salva a taxa de entrega. |

As rotas da equipe verificam a sessão no servidor. Abrir o HTML de /admin não concede acesso aos pedidos.

## Tabelas

| Tabela | O que guarda |
| --- | --- |
| orders | Cliente, endereço quando houver, itens, valores, origem, mesa, andamento e pagamento. |
| sessions | Hash dos tokens de sessão da equipe e validade. |
| login_attempts | Tentativas recentes de acesso para limitar repetição. |
| coupons | Código, tipo, valor e ativação de cada cupom. |
| settings | Configurações, como o frete. |
| audit | Registro das mudanças de andamento/pagamento feitas pela equipe. |

## Nomes usados no código

- delivery: pedido para entrega em casa.
- dine_in: consumo no salão.
- counter: pagamento no caixa após consumir.
- cash/card: dinheiro/cartão na entrega.
- received, preparing, ready, delivering, completed, cancelled: etapas do pedido. Salão não usa delivering.
- pending/confirmed: situação do pagamento, separada do andamento.
- idempotencyKey: identifica uma tentativa de envio.
- receiptToken: permite ao cliente consultar apenas o recibo correspondente.

Valores monetários são inteiros em centavos. Os itens de orders são gravados como JSON com o preço confirmado no momento do pedido. Os dados retornados pelo recibo são limitados por publicOrder().
