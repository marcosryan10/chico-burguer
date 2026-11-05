/** CÓDIGO DO NAVEGADOR: controla o cardápio e o pedido do cliente. Leia junto com docs/02-caminho-do-pedido.md. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s),
    money = (v) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const normal = (v) =>
      v
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase(),
    pad = (n) => String(n).padStart(2, '0');
  let serviceType = 'delivery',
    tableNumber = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem('chico-service') || 'null');
    if (saved?.serviceType === 'dine_in') {
      serviceType = 'dine_in';
      tableNumber =
        Number.isInteger(saved.tableNumber) && saved.tableNumber >= 1 && saved.tableNumber <= 10
          ? saved.tableNumber
          : null;
    }
  } catch {}
  let catalog = [],
    category = 'Lanches',
    cart = {},
    delivery = 500,
    coupon = '',
    quote = null,
    quoteVersion = 0,
    pendingOrder = null,
    stage = 'cart';
  try {
    cart = JSON.parse(localStorage.getItem('chico-cart-v2') || '{}');
  } catch {}
  if (!cart || Array.isArray(cart) || typeof cart !== 'object') cart = {};
  const dineIn = () => serviceType === 'dine_in',
    context = () => ({ serviceType, tableNumber: dineIn() ? tableNumber : null });
  const receiptKey = () => (dineIn() ? `chico-last-order-mesa-${tableNumber}` : 'chico-last-order');
  const tableOptions = () =>
    '<option value="">Selecione sua mesa</option>' +
    Array.from(
      { length: 10 },
      (_, i) =>
        `<option value="${i + 1}" ${tableNumber === i + 1 ? 'selected' : ''}>Mesa ${pad(i + 1)}</option>`,
    ).join('');
  /** Envia requisições ao servidor e transforma respostas em objetos. O navegador não acessa o banco diretamente. */
  async function api(path, data) {
    const r = await fetch('/api/' + path, {
      method: data ? 'POST' : 'GET',
      headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
    let result;
    try {
      result = await r.json();
    } catch {
      throw new Error(
        'O sistema ficou temporariamente indisponível. Tente novamente; seu carrinho foi mantido.',
      );
    }
    if (!r.ok) throw new Error(result.error || 'Não foi possível conectar. Tente novamente.');
    return result;
  }
  const items = () =>
    Object.entries(cart)
      .filter(
        ([id, n]) => catalog.some((p) => p.id === id) && Number.isInteger(n) && n > 0 && n <= 20,
      )
      .map(([id, quantity]) => ({ id, quantity }));
  const subtotal = () =>
    items().reduce((sum, i) => sum + catalog.find((p) => p.id === i.id).price * i.quantity, 0);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<button id="floating-cart" class="floating-cart" data-open-cart hidden><span id="floating-cart-label">Ver carrinho</span><strong id="floating-cart-total"></strong></button><div id="toast" class="order-toast" role="status" aria-live="polite"></div><dialog id="cart-dialog" aria-labelledby="cart-title"><div class="dialog-top"><div><p class="eyebrow" id="cart-context">SEU PEDIDO NO CHICO</p><h2 id="cart-title">Bora matar a fome.</h2></div><button class="icon-button" data-close-cart aria-label="Fechar carrinho">×</button></div><div id="cart-body"></div></dialog>`,
  );
  $('.menu-toolbar').insertAdjacentHTML(
    'beforebegin',
    `<section class="service-selector" aria-labelledby="service-title"><div class="service-heading"><div><p class="eyebrow">COMO VAI SER HOJE?</p><h3 id="service-title">Em casa ou na mesa?</h3></div><div class="service-options" role="group" aria-label="Tipo de pedido"><button type="button" data-service="delivery">Receber em casa</button><button type="button" data-service="dine_in">Estou no estabelecimento</button></div></div><div id="service-details"></div><p id="service-announcement" class="sr-only" aria-live="polite"></p></section><div id="last-order-slot"></div>`,
  );
  let toastTimer;
  function toast(msg) {
    $('#toast').textContent = msg;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2400);
  }
  /** Salva somente o carrinho no navegador e atualiza seus contadores. Isso ainda não cria um pedido no banco. */
  function persist() {
    localStorage.setItem('chico-cart-v2', JSON.stringify(cart));
    const n = items().reduce((s, i) => s + i.quantity, 0);
    $('#cart-count').textContent = n;
    $('#floating-cart').hidden = !n;
    $('#floating-cart-label').textContent =
      (dineIn() ? (tableNumber ? 'Mesa ' + pad(tableNumber) : 'Pedido no salão') : 'Ver carrinho') +
      ' · ' +
      n +
      ' ' +
      (n === 1 ? 'item' : 'itens');
    $('#floating-cart-total').textContent = money(subtotal());
    quote = null;
    pendingOrder = null;
  }
  /** Mostra as opções de salão/delivery e o seletor das 10 mesas, de acordo com o estado atual. */
  function renderService() {
    document.querySelectorAll('[data-service]').forEach((b) => {
      const selected = b.dataset.service === serviceType;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    $('#service-details').innerHTML = dineIn()
      ? `<div class="salon-selection"><label for="table-select">Em qual mesa você está?</label><select id="table-select" data-table aria-label="Sua mesa">${tableOptions()}</select><p>Vamos levar seu pedido até a mesa.<br><strong>Sem taxa de entrega. Pague no caixa após consumir.</strong></p></div>`
      : `<p class="service-note">Receba em casa com entrega de ${money(delivery)}. Pagamento em dinheiro ou cartão na entrega.</p>`;
    $('#cart-context').textContent = dineIn()
      ? 'PEDIDO NO SALÃO' + (tableNumber ? ' · MESA ' + pad(tableNumber) : '')
      : 'SEU PEDIDO NO CHICO';
    renderLastOrder();
  }
  /** Troca a forma de atendimento, guarda a escolha nesta aba e invalida o total anterior para recalculá-lo. */
  function setService(type, number) {
    serviceType = type;
    tableNumber =
      type === 'dine_in' && Number.isInteger(number) && number >= 1 && number <= 10 ? number : null;
    sessionStorage.setItem('chico-service', JSON.stringify(context()));
    persist();
    renderService();
    $('#service-announcement').textContent = dineIn()
      ? tableNumber
        ? 'Pedido no salão, mesa ' + pad(tableNumber) + '. Sem taxa de entrega.'
        : 'Pedido no salão. Selecione sua mesa.'
      : 'Pedido para entrega em casa.';
    if ($('#cart-dialog').open) renderCart();
  }
  /** Filtra o catálogo por categoria e busca. esc() protege os textos inseridos no HTML. */
  function render() {
    const q = normal($('#search').value);
    const visible = catalog.filter(
      (p) => p.category === category && normal(p.name + ' ' + p.description).includes(q),
    );
    $('#menu-items').innerHTML =
      visible
        .map(
          (p) =>
            `<article class="item ${['Tribo de Judá', 'Omelete d’Casa do Chico'].includes(p.name) ? 'featured' : ''}"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="item-buy"><span class="price">${money(p.price)}</span><button class="add-item" data-add="${p.id}" aria-label="Adicionar ${esc(p.name)} ao carrinho">+ <span>Adicionar</span></button></div></article>`,
        )
        .join('') ||
      '<p class="empty">Não encontramos essa opção nesta categoria. Tente outro nome ou categoria.</p>';
    $('#menu-info').textContent =
      category === 'Lanches'
        ? 'Todos os lanches acompanham alface, tomate, milho, ervilha, maionese e batata palha.'
        : category === 'Omeletes'
          ? 'Escolha o recheio do seu omelete.'
          : 'Consulte os sabores disponíveis com a hamburgueria.';
  }
  /** Monta o resumo financeiro. No salão, o frete aparece como sem taxa. */
  function summary(q) {
    return `<div class="totals"><div><span>Subtotal</span><span>${money(q.subtotal)}</span></div>${q.discount ? `<div class="discount"><span>Desconto · ${esc(q.coupon)}</span><span>− ${money(q.discount)}</span></div>` : ''}<div><span>${q.serviceType === 'dine_in' ? 'Consumo no salão' : 'Entrega'}</span><span>${q.serviceType === 'dine_in' ? 'Sem taxa' : money(q.delivery)}</span></div><div class="total"><strong>Total</strong><strong>${money(q.total)}</strong></div></div>`;
  }
  /** Calcula uma prévia visual. O valor definitivo é recalculado e validado no servidor. */
  function localQuote() {
    const sub = subtotal(),
      fee = dineIn() ? 0 : delivery;
    return { subtotal: sub, discount: 0, delivery: fee, total: sub + fee, ...context() };
  }
  function cartRows() {
    return items()
      .map((i) => {
        const p = catalog.find((p) => p.id === i.id);
        return `<div class="cart-row"><div><h3>${esc(p.name)}</h3><p>${money(p.price)} cada</p><button class="remove-item" data-remove="${p.id}">Remover</button></div><div class="cart-row-right"><strong>${money(p.price * i.quantity)}</strong><div class="quantity"><button data-quantity="${p.id}" data-delta="-1" aria-label="Diminuir ${esc(p.name)}">−</button><span>${i.quantity}</span><button data-quantity="${p.id}" data-delta="1" aria-label="Aumentar ${esc(p.name)}" ${i.quantity >= 20 ? 'disabled' : ''}>+</button></div></div></div>`;
      })
      .join('');
  }
  /** Monta os itens e as quantidades do carrinho; solicita uma cotação atualizada ao servidor. */
  function renderCart() {
    stage = 'cart';
    const list = items();
    $('#cart-title').textContent = dineIn()
      ? tableNumber
        ? 'Pedido da mesa ' + pad(tableNumber) + '.'
        : 'Seu pedido no salão.'
      : 'Seu carrinho.';
    $('#cart-body').innerHTML = list.length
      ? `${dineIn() ? `<label class="cart-table-label">Sua mesa<select data-table aria-label="Mesa do pedido">${tableOptions()}</select></label>` : ''}<div>${cartRows()}</div><div id="cart-totals">${summary(localQuote())}</div><p class="small-note">${dineIn() ? 'Pague no caixa após consumir. Vamos levar o pedido até sua mesa.' : 'Pagamento em dinheiro ou cartão na entrega.'}</p><p class="form-error" id="cart-error" role="alert"></p><button class="button wide" id="go-checkout">${dineIn() ? 'Continuar pedido da mesa' : 'Continuar para entrega'} <span>→</span></button><button class="quiet-button wide" data-close-cart>Escolher mais um</button>`
      : '<div class="empty-cart"><span>✳</span><h3>Ainda cabe um Chico aqui.</h3><p>Adicione seus favoritos para começar.</p><button class="button" data-close-cart>Explorar o cardápio ↗</button></div>';
    if (list.length && (!dineIn() || tableNumber)) refreshQuote('cart-totals', 'cart-error');
  }
  /** Consulta POST /api/quote. O contador de versão evita aplicar uma resposta antiga depois de uma mudança. */
  async function refreshQuote(target, error) {
    const version = ++quoteVersion;
    try {
      const q = await api('quote', { items: items(), coupon, ...context() });
      if (version !== quoteVersion) return;
      quote = q;
      if (q.serviceType === 'delivery') delivery = q.delivery;
      const el = document.getElementById(target);
      if (el) el.innerHTML = summary(q);
      const err = document.getElementById(error);
      if (err) err.textContent = '';
      return q;
    } catch (e) {
      if (version !== quoteVersion) return;
      const err = document.getElementById(error);
      if (err) err.textContent = e.message;
      quote = null;
    }
  }
  /** Monta o formulário conforme o atendimento: endereço para delivery ou confirmação da mesa para o salão. */
  function checkout() {
    if (dineIn() && !tableNumber) {
      $('#cart-error').textContent = 'Selecione sua mesa de 01 a 10 para continuar.';
      $('#cart-body [data-table]')?.focus();
      return;
    }
    stage = 'checkout';
    $('#cart-title').textContent = dineIn()
      ? 'Mesa ' + pad(tableNumber) + ', pode pedir.'
      : 'Onde vamos entregar?';
    const identity = `<fieldset><legend>01 / ${dineIn() ? 'Quem está pedindo?' : 'Seus dados'}</legend><label>Seu nome<input name="customer" required minlength="2" maxlength="100" autocomplete="name" placeholder="Como podemos chamar você?"></label>${dineIn() ? '' : `<label>WhatsApp com DDD<input name="phone" type="tel" required minlength="10" maxlength="20" autocomplete="tel" inputmode="tel" placeholder="(82) 99999-9999"></label>`}</fieldset>`;
    const address = dineIn()
      ? `<fieldset class="table-confirmation"><legend>02 / Sua mesa</legend><div class="table-number-card"><span>PEDIDO NO SALÃO</span><strong>Mesa ${pad(tableNumber)}</strong><p>Seu lanche será levado até esta mesa, sem taxa de entrega.</p></div><label class="confirm-table"><input type="checkbox" name="confirmTable" required><span>Confirmo que estou na mesa ${pad(tableNumber)}.</span></label></fieldset>`
      : `<fieldset><legend>02 / Endereço de entrega</legend><label>Rua<input name="street" required minlength="2" maxlength="120" autocomplete="address-line1" placeholder="Nome da rua"></label><div class="form-columns"><label>Número<input name="number" required maxlength="20" placeholder="Ex.: 120 ou S/N"></label><label>Bairro<input name="neighborhood" required minlength="2" maxlength="120" placeholder="Seu bairro"></label></div><label>Referência <span class="optional">opcional</span><input name="reference" maxlength="200" placeholder="Perto de qual lugar? Casa, bloco ou apartamento"></label></fieldset>`;
    const payment = dineIn()
      ? `<fieldset><legend>03 / Pagamento</legend><div class="counter-payment"><strong>No caixa, após consumir</strong><p>Faça seu pedido agora e pague no caixa depois. A confirmação do pagamento é feita pela equipe.</p></div></fieldset>`
      : `<fieldset><legend>03 / Pagamento na entrega</legend><label class="payment-option"><input type="radio" name="payment" value="cash" checked><span><strong>Dinheiro</strong><small>Informe se precisa de troco.</small></span><span class="payment-symbol">R$</span></label><label class="payment-option"><input type="radio" name="payment" value="card"><span><strong>Cartão na entrega</strong><small>Pagamento na maquininha.</small></span><span class="payment-symbol">▤</span></label><label id="change-field">Troco para quanto? <span class="optional">opcional</span><input name="changeFor" type="number" min="0" step="0.01" max="100000" inputmode="decimal" placeholder="Sem troco? Deixe em branco"></label><p class="small-note">O pagamento será recebido na entrega e confirmado pela equipe.</p></fieldset>`;
    $('#cart-body').innerHTML =
      `<button class="back-button" id="back-cart">← Voltar ao carrinho</button><form id="checkout-form">${identity}${address}${payment}<fieldset><legend>04 / Deixe do seu jeito</legend><label>Observações <span class="optional">opcional</span><textarea name="notes" maxlength="500" rows="2" placeholder="Alguma observação para o pedido?"></textarea></label><label>Cupom de desconto<div class="coupon-field"><input id="coupon-input" maxlength="30" placeholder="Digite seu cupom" value="${esc(coupon)}"><button class="outline-button" type="button" id="apply-coupon">Aplicar</button></div></label><p id="coupon-message" class="small-note" aria-live="polite"></p></fieldset><div class="review-items"><h3>Confira seu pedido${dineIn() ? ' · Mesa ' + pad(tableNumber) : ''}</h3>${items()
        .map(
          (i) =>
            `<p><span>${i.quantity}× ${esc(catalog.find((p) => p.id === i.id).name)}</span><b>${money(catalog.find((p) => p.id === i.id).price * i.quantity)}</b></p>`,
        )
        .join(
          '',
        )}</div><div id="checkout-totals">${summary(localQuote())}</div><p class="small-note">${dineIn() ? 'Seu nome e o número da mesa serão usados pela equipe para servir este pedido.' : 'Seus dados serão usados pela hamburgueria para preparar e entregar este pedido.'}</p><p class="form-error" id="checkout-error" role="alert"></p><button class="button wide" id="submit-order" type="submit">${dineIn() ? 'Enviar pedido da mesa' : 'Confirmar pedido'} <span>→</span></button></form>`;
    refreshQuote('checkout-totals', 'checkout-error');
  }
  /** Valida o formulário, envia o pedido e guarda a chave para acompanhar o recibo. A mesma tentativa reutiliza a chave de idempotência. */
  async function sendOrder(form) {
    if (!form.reportValidity()) return;
    const button = $('#submit-order');
    button.disabled = true;
    button.textContent = 'Enviando pedido…';
    $('#checkout-error').textContent = '';
    try {
      const v = Object.fromEntries(new FormData(form));
      if (!quote) await refreshQuote('checkout-totals', 'checkout-error');
      if (!quote) throw new Error('Confira o resumo e tente novamente.');
      const input = {
        items: items(),
        coupon,
        ...context(),
        tableConfirmation: dineIn() && v.confirmTable === 'on' ? tableNumber : null,
        customer: v.customer,
        phone: v.phone || '',
        address: dineIn()
          ? null
          : {
              street: v.street,
              neighborhood: v.neighborhood,
              number: v.number,
              reference: v.reference,
            },
        payment: dineIn() ? 'counter' : v.payment,
        changeFor:
          !dineIn() && v.payment === 'cash' && v.changeFor !== ''
            ? Math.round(Number(v.changeFor) * 100)
            : null,
        notes: v.notes,
        expectedTotal: quote.total,
      };
      const canonical = JSON.stringify(input);
      if (!pendingOrder || pendingOrder.canonical !== canonical) {
        const receiptToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
          x.toString(16).padStart(2, '0'),
        ).join('');
        pendingOrder = {
          canonical,
          payload: { ...input, idempotencyKey: crypto.randomUUID(), receiptToken },
        };
      }
      const q = await api('orders', pendingOrder.payload);
      localStorage.setItem(
        receiptKey(),
        JSON.stringify({ id: q.id, token: pendingOrder.payload.receiptToken }),
      );
      cart = {};
      coupon = '';
      persist();
      renderLastOrder();
      receipt(q);
    } catch (e) {
      $('#checkout-error').textContent = e.message;
      if (e.message.includes('total foi atualizado')) {
        await refreshQuote('checkout-totals', 'checkout-error');
        $('#checkout-error').textContent =
          'O total mudou. Confira o novo valor e confirme novamente.';
      }
      button.disabled = false;
      button.innerHTML =
        (dineIn() ? 'Enviar pedido da mesa' : 'Confirmar pedido') + ' <span>→</span>';
    }
  }
  const statusText = {
    received: 'Recebido pela hamburgueria',
    preparing: 'Em preparo',
    ready: 'Pronto para servir',
    delivering: 'Saiu para entrega',
    completed: 'Entregue',
    cancelled: 'Cancelado',
  };
  /** Exibe o resultado retornado pelo servidor, incluindo número, mesa, andamento e pagamento. */
  function receipt(q) {
    stage = 'receipt';
    const salon = q.serviceType === 'dine_in';
    $('#cart-title').textContent = 'Pedido recebido!';
    $('#cart-body').innerHTML =
      `<div class="receipt-head"><span class="receipt-check">✓</span><p class="eyebrow">PEDIDO #${esc(q.number)}</p><h3>${salon ? 'Já chegou à equipe.' : 'Agora é com o Chico.'}</h3><p>${salon ? 'Seu pedido será levado até a mesa ' + pad(q.tableNumber) + '. Pague no caixa após consumir.' : 'Acompanhe o status abaixo. Se precisar falar com a equipe, informe o número do pedido.'}</p></div>${salon ? `<div class="receipt-table">SALÃO · MESA ${pad(q.tableNumber)}</div>` : ''}<div class="order-status"><span>Status do pedido</span><strong>${salon && q.status === 'completed' ? 'Servido na mesa' : esc(statusText[q.status] || q.status)}</strong></div><div class="review-items">${q.items.map((i) => `<p><span>${i.quantity}× ${esc(i.name)}</span><b>${money(i.price * i.quantity)}</b></p>`).join('')}</div>${summary(q)}<div class="payment-receipt"><strong>${salon ? 'No caixa, após consumir' : q.payment === 'cash' ? 'Dinheiro na entrega' : 'Cartão na entrega'}</strong><p>${q.paymentStatus === 'confirmed' ? 'Pagamento confirmado pela equipe.' : salon ? 'Pagamento pendente. Pague no caixa após consumir.' : 'Pagamento pendente. Será recebido na entrega.'}</p></div><p class="form-error" id="receipt-error" role="alert"></p><button class="outline-button wide" id="refresh-receipt" data-receipt-id="${q.id}">Atualizar status</button><button class="quiet-button wide" data-close-cart>Continuar no site</button>`;
  }
  /** Recupera o acesso ao último recibo deste atendimento. O token não dá acesso a outros pedidos. */
  function renderLastOrder() {
    const slot = $('#last-order-slot');
    slot.innerHTML = '';
    if (localStorage.getItem(receiptKey())) {
      const link = document.createElement('button');
      link.className = 'last-order-link';
      link.textContent =
        'Acompanhar meu último pedido' +
        (dineIn() && tableNumber ? ' · Mesa ' + pad(tableNumber) : '') +
        ' →';
      link.onclick = async () => {
        try {
          const info = JSON.parse(localStorage.getItem(receiptKey()));
          receipt(await api('receipt', info));
          $('#cart-dialog').showModal();
          document.body.classList.add('dialog-open');
        } catch (e) {
          toast(e.message);
        }
      };
      slot.append(link);
    }
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.service) {
      setService(b.dataset.service, tableNumber);
      return;
    }
    if (b.matches('[data-add]')) {
      const id = b.dataset.add;
      if ((cart[id] || 0) >= 20) return toast('Limite de 20 unidades deste item.');
      cart[id] = (cart[id] || 0) + 1;
      persist();
      toast(catalog.find((p) => p.id === id).name + ' no carrinho');
      return;
    }
    if (b.matches('[data-open-cart]')) {
      renderCart();
      $('#cart-dialog').showModal();
      document.body.classList.add('dialog-open');
      return;
    }
    if (b.matches('[data-close-cart]')) {
      $('#cart-dialog').close();
      return;
    }
    if (b.matches('[data-remove]')) {
      delete cart[b.dataset.remove];
      persist();
      renderCart();
      return;
    }
    if (b.matches('[data-quantity]')) {
      const id = b.dataset.quantity;
      cart[id] = Math.min(20, (cart[id] || 0) + Number(b.dataset.delta));
      if (cart[id] <= 0) delete cart[id];
      persist();
      renderCart();
      return;
    }
    if (b.id === 'go-checkout' || b.id === 'back-cart') {
      if (b.id === 'go-checkout') checkout();
      else renderCart();
      $('#cart-dialog').scrollTop = 0;
      return;
    }
    if (b.id === 'apply-coupon') {
      const code = $('#coupon-input').value.trim().toUpperCase();
      b.disabled = true;
      try {
        const q = await api('quote', { items: items(), coupon: code, ...context() });
        coupon = code;
        quote = q;
        $('#checkout-totals').innerHTML = summary(q);
        $('#coupon-message').textContent = code
          ? 'Cupom aplicado. Desconto de ' + money(q.discount) + '.'
          : 'Cupom removido.';
        $('#checkout-error').textContent = '';
        pendingOrder = null;
      } catch (err) {
        $('#coupon-message').textContent = err.message;
        $('#coupon-input').value = coupon;
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (b.id === 'refresh-receipt') {
      try {
        const info = JSON.parse(localStorage.getItem(receiptKey()));
        receipt(await api('receipt', info));
      } catch (err) {
        $('#receipt-error').textContent = err.message;
      }
    }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'checkout-form') {
      e.preventDefault();
      sendOrder(e.target);
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-table]'))
      setService('dine_in', e.target.value ? Number(e.target.value) : null);
    if (e.target.name === 'payment' && $('#change-field'))
      $('#change-field').hidden = e.target.value !== 'cash';
  });
  $('#cart-dialog').addEventListener('close', () => document.body.classList.remove('dialog-open'));
  document.querySelectorAll('[data-category]').forEach((b) =>
    b.addEventListener('click', () => {
      category = b.dataset.category;
      document.querySelectorAll('[data-category]').forEach((t) => {
        t.classList.toggle('selected', t === b);
        t.setAttribute('aria-pressed', String(t === b));
      });
      render();
    }),
  );
  $('#search').addEventListener('input', render);
  $('.original-grid').innerHTML = Array.from(
    { length: 7 },
    (_, i) =>
      `<a href="/assets/menu-${i}.png" target="_blank" rel="noopener" aria-label="Abrir página ${i + 1} do cardápio original"><img src="/assets/menu-${i}.png" alt="Cardápio original, página ${i + 1}" loading="lazy"></a>`,
  ).join('');
  renderService();
  $('#menu-items').innerHTML = '<p class="empty">Carregando o cardápio…</p>';
  api('catalog')
    .then((data) => {
      catalog = data.catalog;
      delivery = data.delivery;
      for (const id of Object.keys(cart))
        if (
          !catalog.find((p) => p.id === id) ||
          !Number.isInteger(cart[id]) ||
          cart[id] < 1 ||
          cart[id] > 20
        )
          delete cart[id];
      render();
      persist();
      renderService();
    })
    .catch(() => {
      $('#menu-items').innerHTML =
        '<p class="empty">Não conseguimos carregar o cardápio. Recarregue a página para tentar novamente.</p>';
    });
})();
