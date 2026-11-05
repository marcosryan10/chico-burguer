# 3. Rodar no seu computador

## Requisitos

- Node.js 22.13 ou superior, conforme package.json.
- npm, incluído na instalação do Node.
- Terminal aberto na raiz desta pasta.

Confira com `node -v` e `npm -v`.

## 1. Instale as dependências

```powershell
npm ci
```

O comando usa package-lock.json para instalar as versões do projeto. A pasta node_modules será criada no seu computador.

## 2. Gere o primeiro build

```powershell
npm run build
```

Esse passo gera a configuração local em dist/server/wrangler.json. Build não publica o site.

## 3. Crie as tabelas do banco local

Execute os dois comandos abaixo, nesta ordem, apenas na preparação inicial do banco:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cheerful_toro.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_tricky_morlun.sql
```

O primeiro arquivo cria as tabelas. O segundo acrescenta os campos de salão e mesa. Se uma migração já foi aplicada, não execute o mesmo arquivo outra vez. Os dados locais ficam em .wrangler/state e não são o banco publicado da hamburgueria.

## 4. Configure um acesso local para a equipe

```powershell
npm run acesso:local
```

Escolha seu usuário e uma senha de pelo menos 12 caracteres. O script cria .dev.vars com o usuário e uma derivação da senha. A senha original não fica gravada no arquivo. Esse acesso local não muda o login do site publicado.

## 5. Inicie o desenvolvimento

```powershell
npm run dev
```

Abra o endereço Local informado no terminal, normalmente http://localhost:5173. A área da equipe fica em /admin. Mantenha o terminal aberto; Ctrl+C encerra o servidor.

Os scripts ativos do navegador estão em public/. Depois de alterá-los, atualize a página. Para mudanças do HTML, veja app/home-markup.ts.

## Testar o fluxo de negócio

Com o servidor local aberto, use outro terminal:

```powershell
$env:CHICO_TEST_URL = 'http://localhost:5173'
$env:CHICO_TEST_USER = 'seu.usuario.local'
npm run test:pedidos
```

O teste pede a senha local e cria pedidos fictícios. Ele verifica as dez mesas, delivery, pagamento no caixa, validações, idempotência e proteção das rotas. O cenário inicial espera o X-Tudo a R$ 22,00 e o frete a R$ 5,00. Mudanças nesses valores também exigem atualizar as expectativas do teste.

## Erros comuns

| Mensagem ou situação | O que verificar |
| --- | --- |
| Cannot find module | Execute npm ci na pasta do projeto. |
| no such table | Prepare o banco local com as migrações, no mesmo persist-to usado pelo servidor. |
| Acesso da equipe não configurado | Execute npm run acesso:local e reinicie o servidor. |
| Porta ocupada | Encerre o servidor anterior ou use npm run dev -- --port 5174. |
| Já existe .dev.vars | O script não sobrescreve um acesso existente; confira o arquivo que você já criou. |

O README original da infraestrutura está em REFERENCIA-README-ORIGINAL.md.

