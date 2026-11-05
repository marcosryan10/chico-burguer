# 4. Exercícios para desenvolver seu raciocínio

Faça uma alteração de cada vez. Antes de mudar, anote o resultado esperado. Depois observe o resultado no navegador e explique por que ele aconteceu.

## Exercício 1 - Troque uma frase

Abra app/home-markup.ts, encontre o título principal e mude uma frase. Atualize a página. Perceba que mudar o texto não exige alterar a API nem o banco.

## Exercício 2 - Mude um preço

No catalog.json, localize um item. Um preço de 2200 significa R$ 22,00. Altere na sua cópia e verifique tanto o cardápio quanto o carrinho.

Pergunta: por que alterar só o texto exibido na tela não deveria mudar o valor cobrado pelo servidor? Procure quote() em lib/orders-api.ts.

## Exercício 3 - Mude uma cor

Em public/style.css, encontre :root e a variável --red. Mude o valor e confira os botões, títulos e destaque de mesa. Observe como uma variável reduz repetições.

## Exercício 4 - Siga um evento de clique

Em public/app.js, encontre document.addEventListener('click'). Localize o caso data-add. Anote quais variáveis mudam e por que persist() é chamada.

## Exercício 5 - Compare salão e delivery

Abra checkout() e procure dineIn(). Identifique os trechos de nome, endereço, confirmação da mesa e pagamento. Depois confira a regra equivalente em checkoutSchema, no servidor.

Pergunta: se alguém remover required pelo inspetor do navegador, qual parte do código ainda impede um pedido inválido?

## Exercício 6 - Acompanhe um aviso

No admin.js, leia loadOrders(), alertNew() e chime(). Entenda o conjunto seenIds. O aviso aparece porque chegou um ID novo, não porque a lista foi redesenhada.

## Exercício 7 - Acrescente uma bebida

Adicione um produto ao catálogo usando um ID único, a categoria Bebidas e um preço em centavos. Confira também o contador da categoria no HTML inicial. Um mesmo recurso pode ter dados e apresentação em arquivos diferentes.

## Próximos passos mais avançados

- Centralizar o número de mesas em uma configuração compartilhada: hoje há limites no navegador, no painel e no schema do servidor.
- Separar as rotas de orders-api.ts em módulos menores sem mudar a autorização.
- Criar testes que não dependam de preços fixos do catálogo.
- Criar contas individuais para atendentes; a versão atual usa o acesso de equipe configurado no ambiente.

Ao mudar estrutura de tabela, gere uma nova migração com npm run db:generate. Migrações já aplicadas são histórico: acrescente uma nova em vez de reescrever as anteriores.
