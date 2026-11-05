/** HTML da página inicial. Aqui você altera títulos, textos, links e a estrutura visual. As interações são acrescentadas por public/app.js. */
const paginaInicial = `<header
  ><a class="brand" href="#" aria-label="Chico Burguer início"
    ><span class="logo"><img src="assets/logo.jpg" alt="Chico Burguer" /></span></a
  ><nav aria-label="Principal"
    ><button class="cart-trigger" type="button" data-open-cart aria-label="Abrir carrinho"
      >Carrinho <span id="cart-count">0</span></button
    ><a href="#cardapio">O cardápio</a><a href="#chico">Do nosso jeito</a
    ><a
      class="nav-order"
      href="https://www.instagram.com/chicoburguer.al/"
      target="_blank"
      rel="noopener"
      >Chama o Chico ↗</a
    ></nav
  ></header
>
<main
  ><section class="hero"
    ><div class="hero-copy"
      ><p class="eyebrow"><span></span> HAMBURGUERIA PRA TODA A FAMÍLIA</p
      ><h1>Pra fome<br />de <em>verdade.</em></h1
      ><p class="intro"
        >Tem dia que só um lanche caprichado resolve.<br />Escolhe o seu. O Chico cuida do resto.</p
      ><a class="button" href="#cardapio">Bora escolher o seu <span>↗</span></a
      ><div class="hero-note"
        ><span>✳</span> Do misto quentinho ao Tribo de Judá.<br />Tem um Chico pra cada fome.</div
      ></div
    ><div class="hero-visual"
      ><div class="visual-label">SEM ECONOMIA<br /><b>NO CAPRICHO.</b></div
      ><div class="food-window"
        ><img
          src="/assets/lanche.png"
          alt="Hambúrguer com queijo, bacon e salada — imagem ilustrativa" /></div
      ><div class="stamp">BATEU<br /><b>A FOME?</b><span>CHAMA O CHICO</span></div
      ><span class="visual-caption">PÃO, RECHEIO E CAPRICHO. IMAGEM ILUSTRATIVA.</span></div
    ></section
  >
  <div class="ribbon" aria-hidden="true"
    ><span>LANCHE CAPRICHADO</span><b>✳</b><span>FAMÍLIA REUNIDA</span><b>✳</b
    ><span>ESSE É O CHICO</span><b>✳</b><span>FOME BEM RESOLVIDA</span></div
  >
  <section id="cardapio" class="menu-section"
    ><div class="section-heading"
      ><div
        ><p class="eyebrow">01 / O CARDÁPIO</p><h2>Escolha a sua <em>fome.</em></h2></div
      ><p
        >Dos clássicos aos que não brincam em serviço.<br />Todos os preços, sem precisar dar
        zoom.</p
      ></div
    ><div class="menu-toolbar"
      ><div class="tabs" role="group" aria-label="Categorias"
        ><button class="selected" data-category="Lanches" aria-pressed="true"
          >Lanches <small>36</small></button
        ><button data-category="Omeletes" aria-pressed="false">Omeletes <small>5</small></button
        ><button data-category="Bebidas" aria-pressed="false">Bebidas <small>7</small></button></div
      ><label class="search"
        ><span>⌕</span
        ><input
          id="search"
          type="search"
          placeholder="Qual é a sua vontade?"
          aria-label="Buscar no cardápio" /></label></div
    ><div class="menu-info" id="menu-info"
      >Todos os lanches acompanham alface, tomate, milho, ervilha, maionese e batata palha.</div
    ><div id="menu-items" class="menu-items" aria-live="polite"></div
    ><p class="menu-footnote"
      >Preços conforme o cardápio enviado. Confirme valores e disponibilidade com a hamburgueria.</p
    ><details class="originals"
      ><summary>Prefere o cardápio original? <span>+</span></summary
      ><div class="original-grid"></div></details
  ></section>
  <section id="chico" class="chico-section"
    ><div class="chico-word">É coisa<br />de <em>família.</em><span>✳</span></div
    ><div class="chico-text"
      ><p class="eyebrow">02 / DO NOSSO JEITO</p
      ><h2>Uma fome pequena.<br />Uma fome gigante.<br />Uma mesa inteira.</h2
      ><p
        >Um misto pra matar a vontade. Um X-Tudo pra fechar o dia. Ou um Tribo de Judá pra encarar a
        fome de frente. Por aqui, o cardápio tem espaço pra todo mundo.</p
      ><a href="#cardapio" class="text-link">Encontre seu favorito <span>↗</span></a></div
    ></section
  >
  <section class="contact"
    ><p class="eyebrow">03 / BORA DE CHICO?</p><h2>O próximo lanche<br />já tem <em>nome.</em></h2
    ><p
      >Fale com a gente no Instagram para consultar pedidos,<br />horários e opções de
      atendimento.</p
    ><a
      class="button light"
      href="https://www.instagram.com/chicoburguer.al/"
      target="_blank"
      rel="noopener"
      >Chama no Instagram <span>↗</span></a
    ><a
      class="handle"
      href="https://www.instagram.com/chicoburguer.al/"
      target="_blank"
      rel="noopener"
      >@chicoburguer.al</a
    ></section
  ></main
><footer
  ><strong>CHICO BURGUER</strong><span>Hamburgueria para toda a sua família.</span
  ><a href="/admin">Área da equipe ↗</a><a href="#">Voltar ao topo ↑</a></footer
>
`;
export default paginaInicial;
