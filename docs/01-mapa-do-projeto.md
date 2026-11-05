# 1. Mapa do projeto

O projeto combina páginas renderizadas com React/Vinext e interações em JavaScript puro. Por isso o carrinho não está em um componente React: ele está em `public/app.js`.

## O que roda no navegador

- **public/app.js:** monta o catálogo vindo da API, filtra produtos, mantém o carrinho, escolhe salão/delivery, valida o formulário e solicita a criação do pedido.
- **public/admin.js:** monta o login e o painel da equipe. Busca atualizações a cada 8 segundos, detecta novos IDs, mostra avisos e permite mudar andamento/pagamento.
- **public/navigation.js:** mantém os links internos como navegação normal. Âncoras rolam a página; links entre páginas fazem um carregamento completo para inicializar os scripts.
- **public/style.css:** identidade visual, tipografia, seções da landing page e responsividade.
- **public/orders.css:** aparência do carrinho, formulário, filtros, avisos e atendimento no salão.
- **public/assets/:** logo, imagem ilustrativa do lanche e imagens originais dos cardápios.

## A entrada das páginas

- **app/layout.tsx:** estrutura comum: idioma, metadados, arquivos CSS e script de navegação.
- **app/page.tsx:** página inicial. Renderiza o HTML de home-markup e carrega o script do cliente.
- **app/home-markup.ts:** HTML inicial em uma template string. Comece aqui para mudar a comunicação visual.
- **app/admin/page.tsx:** cria a estrutura da área da equipe e carrega admin.js.
- **app/api/[...path]/route.ts:** recebe as URLs /api/* e encaminha GET/POST para handleApi().
- **app/globals.css:** arquivo do starter; o layout desta versão usa os estilos de public/.

## O que roda no servidor

- **lib/orders-api.ts:** recebe JSON, valida com Zod, consulta preços reais do catálogo, calcula totais, autentica a equipe e executa consultas preparadas no D1.
- **catalog.json:** fonte do catálogo. O servidor importa esse arquivo. Os preços são inteiros em centavos.
- **db/orders-schema.ts:** declaração das seis tabelas para gerar migrações com Drizzle.
- **db/schema.ts:** reexporta o schema.
- **db/index.ts:** helper Drizzle do starter. As operações atuais de pedidos usam diretamente DB.prepare() em orders-api.ts.
- **drizzle/:** histórico de mudanças SQL e metadados. O primeiro arquivo cria as tabelas; o segundo acrescenta origem e mesa ao pedido.
- **worker/index.ts:** entrada de produção do Worker. Mantém a integração de execução do framework.

## Configuração e ferramentas

- **package.json:** comandos e dependências. O package-lock.json fixa as versões instaladas.
- **vite.config.ts:** conecta o framework, os bindings locais e a integração de hospedagem.
- **.openai/hosting.json:** declara o projeto Sites e o binding D1 chamado DB.
- **scripts/:** preparação, instalação, execução e ferramentas do starter. O teste de negócio principal está em test-service-types.mjs.
- **vendor/ e scripts/vite/:** integração de infraestrutura. Você não precisa começar seus estudos por esses arquivos.
- **components/, hooks/ e examples/:** recursos que vieram com o starter. Não são o centro da interface atual.

## Estado local e dados permanentes

O carrinho fica no localStorage do navegador. A escolha salão/mesa fica no sessionStorage da aba. O pedido só existe no banco depois que POST /api/orders termina com sucesso.

O banco guarda os pedidos e as sessões da equipe. O cookie de login tem HttpOnly e é conferido no servidor. Esconder um botão no navegador não substitui essa autorização.
