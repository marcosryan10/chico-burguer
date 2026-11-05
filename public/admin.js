/** CÓDIGO DO NAVEGADOR: interface da equipe. A autorização real fica em lib/orders-api.ts. */
(() => {
  'use strict';
  const root = document.querySelector('#admin-root'),
    $ = (s) => document.querySelector(s);
  const money = (v) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    pad = (n) => String(n).padStart(2, '0');
  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const states = {
    received: 'Recebido',
    preparing: 'Em preparo',
    ready: 'Pronto para servir',
    delivering: 'Saiu para entrega',
    completed: 'Entregue / servido',
    cancelled: 'Cancelado',
  };
  const salon = (o) => o.serviceType === 'dine_in',
    originLabel = (o) => (salon(o) ? 'Mesa ' + pad(o.tableNumber) : 'Delivery');
  const paymentLabel = (o) =>
    salon(o)
      ? 'No caixa, após consumir'
      : o.payment === 'cash'
        ? 'Dinheiro na entrega'
        : 'Cartão na entrega';
  let orders = [],
    coupons = [],
    delivery = 500,
    view = 'orders',
    filter = 'all',
    serviceFilter = 'all',
    tableFilter = '',
    query = '',
    authenticated = false,
    timer,
    busy = false,
    seenIds = null,
    unseen = [],
    soundOn = false,
    audioContext;
  /** Usa as rotas protegidas da equipe. O cookie de sessão é enviado pelo navegador; ele não fica disponível ao JavaScript. */
  async function api(path, data) {
    const r = await fetch('/api/admin/' + path, {
      method: data ? 'POST' : 'GET',
      headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
    let result;
    try {
      result = await r.json();
    } catch {
      throw new Error('O sistema ficou temporariamente indisponível. Tente novamente.');
    }
    if (r.status === 401 && path !== 'login') {
      authenticated = false;
      login();
      throw new Error('Sua sessão expirou. Entre novamente.');
    }
    if (!r.ok) throw new Error(result.error || 'Não foi possível conectar.');
    return result;
  }
  /** Monta a tela de entrada. A senha será conferida no servidor, nunca nesta função. */
  function login() {
    clearInterval(timer);
    seenIds = null;
    unseen = [];
    $('#logout').hidden = true;
    root.innerHTML = `<div class="login-box"><p class="eyebrow">ÁREA DA EQUIPE</p><h1>O balcão<br>do Chico.</h1><p>Entre para acompanhar os pedidos do salão e do delivery, com os pagamentos reunidos no mesmo painel.</p><form id="login-form"><label>Usuário<input name="username" required autocomplete="username" maxlength="100" autocapitalize="none" spellcheck="false" autofocus></label><label>Senha<input name="password" type="password" required autocomplete="current-password" maxlength="200"></label><p class="form-error" id="login-error" role="alert"></p><button class="button wide" type="submit">Entrar no painel <span>→</span></button></form><p>Acesso reservado ao dono e aos atendentes autorizados.</p></div>`;
  }
  /** Prepara o painel e agenda a atualização a cada 8 segundos. Esse é um polling, não uma conexão WebSocket. */
  function shell() {
    authenticated = true;
    $('#logout').hidden = false;
    root.innerHTML = `<div class="admin-heading"><div><p class="eyebrow">ÁREA DA EQUIPE</p><h1>Pedidos no balcão.</h1></div><div class="admin-tools"><button class="outline-button" id="sound-toggle" aria-pressed="${soundOn}">${soundOn ? 'Som de pedidos: ligado' : 'Ativar som de pedidos'}</button><button class="outline-button" id="refresh-orders">Atualizar ↻</button></div></div><div id="new-order-alert" class="new-order-alert" role="status" aria-live="polite" hidden></div><div class="admin-nav"><button class="selected" data-admin-view="orders">Pedidos</button><button data-admin-view="settings">Entrega e cupons</button></div><p class="form-error" id="admin-error" role="alert"></p><p class="small-note" id="update-note" aria-live="polite">Atualização automática a cada 8 segundos.</p><div id="admin-content"></div>`;
    showOrders();
    clearInterval(timer);
    timer = setInterval(() => {
      if (authenticated && !busy) loadOrders(false);
    }, 8000);
  }
  function time(t) {
    return new Date(t).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  /** Toca um aviso curto apenas se o atendente tiver ativado o som por meio do botão. */
  function chime() {
    if (!soundOn || !audioContext) return;
    audioContext
      .resume()
      .then(() => {
        const start = audioContext.currentTime;
        [659.25, 880].forEach((frequency, i) => {
          const oscillator = audioContext.createOscillator(),
            gain = audioContext.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start + i * 0.15);
          gain.gain.linearRampToValueAtTime(0.08, start + i * 0.15 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.15 + 0.25);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start(start + i * 0.15);
          oscillator.stop(start + i * 0.15 + 0.28);
        });
      })
      .catch(() => {});
  }
  /** Mostra pedidos cujos IDs ainda não haviam aparecido para esta sessão do painel. */
  function alertNew(newOrders) {
    if (!newOrders.length) return;
    for (const order of newOrders) if (!unseen.some((o) => o.id === order.id)) unseen.push(order);
    const banner = $('#new-order-alert');
    if (!banner) return;
    banner.hidden = false;
    banner.innerHTML = `<div><strong>${unseen.length === 1 ? 'Novo pedido · ' + esc(originLabel(unseen[0])) : unseen.length + ' novos pedidos'}</strong><p>${unseen.length === 1 ? esc(unseen[0].customer) + ' · #' + esc(unseen[0].number) : esc([...new Set(unseen.map(originLabel))].join(' · '))}</p></div><div><button class="outline-button" id="show-new-orders">Ver pedidos</button><button class="icon-button" id="dismiss-order-alert" aria-label="Fechar aviso de novos pedidos">×</button></div>`;
    chime();
  }
  /** Monta os filtros de origem, mesa e andamento, mantendo as escolhas feitas pelo atendente. */
  function showOrders() {
    view = 'orders';
    const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
    $('#admin-content').innerHTML =
      `<div class="admin-stats"><div class="admin-stat">PEDIDOS EM ANDAMENTO<strong>${active.length}</strong></div><div class="admin-stat">AGUARDANDO PAGAMENTO<strong>${orders.filter((o) => o.paymentStatus === 'pending' && o.status !== 'cancelled').length}</strong></div><div class="admin-stat">PAGAMENTOS CONFIRMADOS<strong>${money(orders.filter((o) => o.paymentStatus === 'confirmed' && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0))}</strong></div></div><div class="service-filters" role="group" aria-label="Origem dos pedidos"><button data-service-filter="all" class="${serviceFilter === 'all' ? 'selected' : ''}" aria-pressed="${serviceFilter === 'all'}">Todos</button><button data-service-filter="dine_in" class="${serviceFilter === 'dine_in' ? 'selected' : ''}" aria-pressed="${serviceFilter === 'dine_in'}">Salão</button><button data-service-filter="delivery" class="${serviceFilter === 'delivery' ? 'selected' : ''}" aria-pressed="${serviceFilter === 'delivery'}">Delivery</button></div><div class="admin-filters"><input id="order-search" type="search" aria-label="Buscar pedido" placeholder="Nome, mesa, telefone ou número do pedido" value="${esc(query)}"><select id="table-filter" aria-label="Filtrar mesa" ${serviceFilter === 'delivery' ? 'hidden' : ''}><option value="">Todas as mesas</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${tableFilter === String(i + 1) ? 'selected' : ''}>Mesa ${pad(i + 1)}</option>`).join('')}</select><select id="order-filter" aria-label="Filtrar status"><option value="all">Todos os status</option>${Object.entries(
        states,
      )
        .filter(([key]) => serviceFilter !== 'dine_in' || key !== 'delivering')
        .map(
          ([key, name]) =>
            `<option value="${key}" ${filter === key ? 'selected' : ''}>${serviceFilter === 'dine_in' && key === 'completed' ? 'Servido na mesa' : name}</option>`,
        )
        .join(
          '',
        )}</select></div><div id="table-balance"></div><div id="orders-list"></div><p class="small-note">Exibindo os 200 pedidos mais recentes. Pedidos do salão não têm taxa de entrega. Cada pagamento é confirmado individualmente.</p>`;
    renderOrders();
  }
  /** Renderiza os pedidos visíveis e o saldo pendente da mesa selecionada. Os pagamentos continuam individuais. */
  function renderOrders() {
    const list = orders.filter(
      (o) =>
        (serviceFilter === 'all' || o.serviceType === serviceFilter) &&
        (!tableFilter || (salon(o) && o.tableNumber === Number(tableFilter))) &&
        (filter === 'all' || o.status === filter) &&
        (!query ||
          [o.customer, o.phone, o.number, originLabel(o)].some((v) =>
            String(v || '')
              .toLowerCase()
              .includes(query.toLowerCase()),
          )),
    );
    if (tableFilter) {
      const pending = orders.filter(
        (o) =>
          salon(o) &&
          o.tableNumber === Number(tableFilter) &&
          o.status !== 'cancelled' &&
          o.paymentStatus === 'pending',
      );
      $('#table-balance').innerHTML =
        `<div class="table-balance"><strong>Mesa ${pad(tableFilter)}</strong><span>${pending.length} ${pending.length === 1 ? 'pedido pendente' : 'pedidos pendentes'} de pagamento · <b>${money(pending.reduce((s, o) => s + o.total, 0))}</b></span></div>`;
    } else $('#table-balance').innerHTML = '';
    $('#orders-list').innerHTML = list.length
      ? list
          .map(
            (o) =>
              `<article class="admin-order ${salon(o) ? 'salon-order' : ''}" data-order-id="${o.id}"><header><div><span class="order-origin ${salon(o) ? 'salon' : ''}">${salon(o) ? 'SALÃO · MESA ' + pad(o.tableNumber) : 'DELIVERY'}</span><h2>#${esc(o.number)} · ${esc(o.customer)}</h2><div class="order-time">${time(o.createdAt)}${o.phone ? ' · ' + esc(o.phone) : ''}</div></div><span class="status-tag ${o.paymentStatus === 'confirmed' ? 'confirmed' : ''}">${o.paymentStatus === 'confirmed' ? 'Pagamento confirmado' : 'Pagamento pendente'}</span></header><div class="admin-order-content"><div>${salon(o) ? `<h3>Servir no estabelecimento</h3><p><strong class="admin-table-number">Mesa ${pad(o.tableNumber)}</strong><br>Levar o pedido até a mesa quando estiver pronto.</p>` : `<h3>Endereço de entrega</h3><p><strong>${esc(o.address?.street)}, ${esc(o.address?.number)}</strong><br>${esc(o.address?.neighborhood)}${o.address?.reference ? '<br>Referência: ' + esc(o.address.reference) : ''}</p>`}${o.notes ? '<h3>Observações</h3><p>' + esc(o.notes) + '</p>' : ''}<h3>Pagamento</h3><p>${paymentLabel(o)}${o.payment === 'cash' ? (o.changeFor != null ? '<br>Troco para ' + money(o.changeFor) + ' · devolver ' + money(o.changeFor - o.total) : '<br>Sem troco solicitado') : ''}</p></div><div><h3>Itens do pedido</h3><ul class="order-products">${o.items.map((i) => `<li><span>${i.quantity}× ${esc(i.name)}</span><b>${money(i.quantity * i.price)}</b></li>`).join('')}</ul><p>Subtotal: ${money(o.subtotal)}<br>${salon(o) ? 'Consumo no salão: sem taxa' : 'Entrega: ' + money(o.delivery)}${o.discount ? '<br>Desconto: − ' + money(o.discount) + ' (' + esc(o.coupon) + ')' : ''}</p></div></div><div class="admin-order-actions"><label>Andamento<select data-order-status="${o.id}" aria-label="Status do pedido ${esc(o.number)}">${Object.entries(
                states,
              )
                .filter(([key]) => !salon(o) || key !== 'delivering')
                .map(
                  ([key, label]) =>
                    `<option value="${key}" ${key === o.status ? 'selected' : ''}>${key === 'completed' ? (salon(o) ? 'Servido na mesa' : 'Entregue') : label}</option>`,
                )
                .join(
                  '',
                )}</select></label><button class="outline-button" data-payment="${o.id}" data-next="${o.paymentStatus === 'confirmed' ? 'pending' : 'confirmed'}">${o.paymentStatus === 'confirmed' ? 'Desfazer confirmação' : salon(o) ? 'Confirmar pagamento no caixa' : 'Confirmar recebimento'}</button><strong>${money(o.total)}</strong></div><p class="small-note">${salon(o) ? 'Pagar no caixa após consumir. Marque como pago somente após receber o valor.' : 'Pagamento atualizado manualmente pela equipe. Não há cobrança online.'}</p></article>`,
          )
          .join('')
      : '<div class="admin-empty">Nenhum pedido para este filtro.</div>';
  }
  /** Busca os 200 pedidos mais recentes e identifica os novos. Evita refazer o formulário enquanto alguém usa os filtros. */
  async function loadOrders(repaint = true) {
    try {
      const r = await api('orders');
      const incoming = r.orders;
      if (seenIds) alertNew(incoming.filter((o) => !seenIds.has(o.id)));
      seenIds = new Set(incoming.map((o) => o.id));
      orders = incoming;
      delivery = r.delivery;
      if (view === 'orders') {
        const focus = document.activeElement;
        if (repaint || !focus?.closest('.admin-order-actions,.admin-filters')) showOrders();
      }
      $('#update-note').textContent =
        'Atualizado às ' +
        new Date().toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        }) +
        ' · atualização automática a cada 8 segundos.';
      $('#admin-error').textContent = '';
    } catch (e) {
      if ($('#admin-error')) $('#admin-error').textContent = e.message;
    }
  }
  /** Monta as configurações de taxa de entrega e cupons; os valores são persistidos no servidor. */
  async function showSettings() {
    view = 'settings';
    const r = await api('coupons');
    coupons = r.coupons;
    delivery = r.delivery;
    $('#admin-content').innerHTML =
      `<div class="admin-settings"><section class="settings-card"><h2>Entrega e salão</h2><form id="delivery-form"><label>Taxa fixa de entrega (R$)<input name="delivery" type="number" min="0" max="1000" step="0.01" required value="${(delivery / 100).toFixed(2)}"></label><button class="button" type="submit">Salvar taxa</button><p class="small-note" id="delivery-result" aria-live="polite"></p></form><p class="small-note"><strong>Delivery:</strong> dinheiro e cartão na entrega.<br><strong>Salão:</strong> mesas de 01 a 10, sem taxa de entrega. Pagamento no caixa, após consumir.</p></section><section class="settings-card"><h2>Cupons de desconto</h2><p class="small-note">Nenhum cupom é ativado automaticamente. Cadastre somente as promoções autorizadas pela hamburgueria. O desconto se aplica aos itens.</p><form id="coupon-form"><label>Código<input name="code" required minlength="2" maxlength="30" pattern="[A-Za-z0-9_-]+" placeholder="Ex.: um código da sua campanha" autocapitalize="characters"></label><div class="form-columns"><label>Tipo<select name="kind"><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></label><label>Desconto<input name="value" type="number" required min="0.01" max="10000" step="0.01" placeholder="Valor do desconto"></label></div><p class="form-error" id="coupon-error" role="alert"></p><button class="button" type="submit">Cadastrar cupom <span>+</span></button></form><div id="coupons-list">${couponRows()}</div></section></div>`;
  }
  /** Cria a lista de cupons e os botões de ativar/desativar. */
  function couponRows() {
    return coupons.length
      ? coupons
          .map(
            (c) =>
              `<div class="coupon-row"><div><strong>${esc(c.code)}</strong><small>${c.kind === 'percent' ? c.value + '%' : money(c.value)} · ${c.active ? 'Ativo' : 'Desativado'}</small></div><button class="outline-button" data-toggle-coupon="${esc(c.code)}">${c.active ? 'Desativar' : 'Ativar'}</button></div>`,
          )
          .join('')
      : '<p class="small-note">Nenhum cupom cadastrado.</p>';
  }
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!['login-form', 'delivery-form', 'coupon-form'].includes(form.id)) return;
    e.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    const v = Object.fromEntries(new FormData(form));
    try {
      if (form.id === 'login-form') {
        await api('login', v);
        shell();
        await loadOrders();
      }
      if (form.id === 'delivery-form') {
        await api('settings', { delivery: Math.round(Number(v.delivery) * 100) });
        $('#delivery-result').textContent =
          'Taxa de entrega salva. Pedidos de salão continuam sem taxa.';
      }
      if (form.id === 'coupon-form') {
        await api('coupons', {
          code: v.code,
          kind: v.kind,
          value: v.kind === 'fixed' ? Math.round(Number(v.value) * 100) : Number(v.value),
          active: true,
        });
        await showSettings();
      }
    } catch (err) {
      const error =
        form.id === 'login-form'
          ? $('#login-error')
          : form.id === 'coupon-form'
            ? $('#coupon-error')
            : $('#delivery-result');
      if (error) error.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.id === 'logout') {
        await api('logout', {});
        authenticated = false;
        orders = [];
        login();
      }
      if (b.id === 'refresh-orders') {
        b.disabled = true;
        await loadOrders();
        if (view === 'settings') await showSettings();
        b.disabled = false;
      }
      if (b.id === 'sound-toggle') {
        if (!soundOn) {
          audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
          await audioContext.resume();
        }
        soundOn = !soundOn;
        b.setAttribute('aria-pressed', String(soundOn));
        b.textContent = soundOn ? 'Som de pedidos: ligado' : 'Ativar som de pedidos';
        if (soundOn) chime();
      }
      if (b.id === 'dismiss-order-alert') {
        unseen = [];
        $('#new-order-alert').hidden = true;
      }
      if (b.id === 'show-new-orders') {
        const onlySalon = unseen.length && unseen.every(salon);
        serviceFilter = onlySalon ? 'dine_in' : 'all';
        const tables = [...new Set(unseen.filter(salon).map((o) => o.tableNumber))];
        tableFilter = onlySalon && tables.length === 1 ? String(tables[0]) : '';
        filter = 'all';
        query = '';
        view = 'orders';
        document
          .querySelectorAll('[data-admin-view]')
          .forEach((t) => t.classList.toggle('selected', t.dataset.adminView === 'orders'));
        showOrders();
        $('#orders-list').scrollIntoView({ block: 'start', behavior: 'smooth' });
        unseen = [];
        $('#new-order-alert').hidden = true;
      }
      if (b.dataset.serviceFilter) {
        serviceFilter = b.dataset.serviceFilter;
        if (serviceFilter === 'delivery') tableFilter = '';
        if (serviceFilter === 'dine_in' && filter === 'delivering') filter = 'all';
        showOrders();
      }
      if (b.dataset.adminView) {
        document
          .querySelectorAll('[data-admin-view]')
          .forEach((t) => t.classList.toggle('selected', t === b));
        if (b.dataset.adminView === 'orders') {
          showOrders();
          await loadOrders();
        } else await showSettings();
      }
      if (b.dataset.payment) {
        const order = orders.find((o) => o.id === b.dataset.payment),
          next = b.dataset.next;
        const dialog = document.createElement('dialog');
        dialog.className = 'confirm-payment';
        dialog.innerHTML = `<h2>${next === 'confirmed' ? 'Confirmar recebimento?' : 'Desfazer confirmação?'}</h2><p class="small-note">${esc(originLabel(order))} · Pedido #${esc(order.number)}<br>${esc(order.customer)} · Total: ${money(order.total)}<br>${paymentLabel(order)}<br>${next === 'confirmed' ? 'Confirme somente depois de receber o pagamento.' : 'O pagamento voltará para pendente.'}</p><form method="dialog"><button class="quiet-button" value="cancel">Cancelar</button><button class="button" value="confirm">${next === 'confirmed' ? 'Pagamento recebido' : 'Voltar para pendente'}</button></form>`;
        document.body.append(dialog);
        dialog.showModal();
        dialog.addEventListener(
          'close',
          async () => {
            if (dialog.returnValue === 'confirm') {
              busy = true;
              try {
                await api('update-order', { id: order.id, paymentStatus: next });
                await loadOrders();
              } catch (err) {
                $('#admin-error').textContent = err.message;
              } finally {
                busy = false;
              }
            }
            dialog.remove();
          },
          { once: true },
        );
      }
      if (b.dataset.toggleCoupon) {
        b.disabled = true;
        const c = coupons.find((x) => x.code === b.dataset.toggleCoupon);
        await api('coupons', { code: c.code, kind: c.kind, value: c.value, active: !c.active });
        await showSettings();
      }
    } catch (err) {
      if ($('#admin-error')) $('#admin-error').textContent = err.message;
      b.disabled = false;
    }
  });
  document.addEventListener('change', async (e) => {
    if (e.target.id === 'order-filter') {
      filter = e.target.value;
      renderOrders();
    }
    if (e.target.id === 'table-filter') {
      tableFilter = e.target.value;
      if (tableFilter) serviceFilter = 'dine_in';
      showOrders();
    }
    if (e.target.dataset.orderStatus) {
      busy = true;
      e.target.disabled = true;
      try {
        await api('update-order', { id: e.target.dataset.orderStatus, status: e.target.value });
        await loadOrders();
      } catch (err) {
        $('#admin-error').textContent = err.message;
        e.target.disabled = false;
      } finally {
        busy = false;
      }
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'order-search') {
      query = e.target.value;
      renderOrders();
    }
  });
  api('session')
    .then(() => {
      shell();
      loadOrders();
    })
    .catch(() => {
      login();
    });
})();
