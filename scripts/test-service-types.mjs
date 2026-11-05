import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
const base = process.env.CHICO_TEST_URL || 'http://127.0.0.1:4178';
let cookie = '';
const destino = new URL(base);
if (destino.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(destino.hostname))
  throw new Error('Este teste só pode criar pedidos no ambiente local.');
console.log('Ready for local test credentials on stdin (hidden).');
if (process.stdin.isTTY) process.stdin.setRawMode(true);
let raw = '';
const password = await new Promise((resolve) => {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function receive(chunk) {
    raw += chunk;
    if (/[\r\n]/.test(raw)) {
      process.stdin.off('data', receive);
      process.stdin.pause();
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      resolve(raw.trim());
    }
  });
});
async function api(path, data, auth = false, badOrigin = false) {
  const r = await fetch(base + '/api/' + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      Connection: 'close',
      ...(data
        ? { 'Content-Type': 'application/json', Origin: badOrigin ? 'https://invalid.test' : base }
        : {}),
      ...(auth ? { Cookie: cookie } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const value = await r.text();
  assert.match(
    r.headers.get('content-type') || '',
    /application\/json/,
    'Non-JSON response ' + path + ' ' + r.status + ': ' + value.slice(0, 100),
  );
  if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
  return { status: r.status, data: JSON.parse(value) };
}
const item = [{ id: 'lanches-18', quantity: 1 }],
  keys = () => ({ idempotencyKey: randomUUID(), receiptToken: randomBytes(32).toString('hex') });
assert.equal((await api('admin/orders')).status, 401);
assert.equal(
  (await api('admin/login', { username: process.env.CHICO_TEST_USER || 'chico.admin', password }))
    .status,
  200,
);
const legacy = await api('admin/orders', undefined, true);
assert.equal(legacy.status, 200);
for (const order of legacy.data.orders) {
  assert.ok(['delivery', 'dine_in'].includes(order.serviceType));
  if (order.serviceType === 'delivery') assert.equal(order.tableNumber, null);
}
for (let tableNumber = 1; tableNumber <= 10; tableNumber++) {
  const r = await api('quote', { items: item, serviceType: 'dine_in', tableNumber });
  assert.equal(r.status, 200);
  assert.equal(r.data.delivery, 0);
  assert.equal(r.data.total, 2200);
  assert.equal(r.data.tableNumber, tableNumber);
}
for (const tableNumber of [0, 11, null, 1.5])
  assert.equal(
    (await api('quote', { items: item, serviceType: 'dine_in', tableNumber })).status,
    400,
  );
assert.equal((await api('quote', { items: item, tableNumber: 4 })).status, 400);
const oldQuote = await api('quote', { items: item, delivery: 0 });
assert.equal(oldQuote.data.total, 2700);
assert.equal(oldQuote.data.delivery, 500);
assert.equal(oldQuote.data.serviceType, 'delivery');
const dine = {
  items: item,
  serviceType: 'dine_in',
  tableNumber: 4,
  tableConfirmation: 4,
  customer: 'Teste local Mesa 04',
  payment: 'counter',
  expectedTotal: 2200,
  notes: 'Sem cebola · teste local',
  ...keys(),
};
assert.equal((await api('orders', { ...dine, tableConfirmation: 5 })).status, 400);
assert.equal((await api('orders', { ...dine, tableConfirmation: null })).status, 400);
assert.equal((await api('orders', { ...dine, payment: 'cash' })).status, 400);
assert.equal((await api('orders', { ...dine, expectedTotal: 2700 })).status, 409);
const placed = await api('orders', dine);
assert.equal(placed.status, 201);
assert.equal(placed.data.serviceType, 'dine_in');
assert.equal(placed.data.tableNumber, 4);
assert.equal(placed.data.total, 2200);
assert.equal(placed.data.delivery, 0);
assert.equal(placed.data.payment, 'counter');
assert.equal(placed.data.paymentStatus, 'pending');
const repeat = await api('orders', dine);
assert.equal(repeat.status, 200);
assert.equal(repeat.data.id, placed.data.id);
const changed = { ...dine, tableNumber: 5, tableConfirmation: 5 };
assert.equal((await api('orders', changed)).status, 409);
const parallel = {
  ...dine,
  customer: 'Teste concorrente Mesa 10',
  tableNumber: 10,
  tableConfirmation: 10,
  ...keys(),
};
const duplicates = await Promise.all([api('orders', parallel), api('orders', parallel)]);
for (const r of duplicates) assert.ok([200, 201].includes(r.status));
assert.equal(duplicates[0].data.id, duplicates[1].data.id);
const delivery = {
  items: item,
  customer: 'Teste local delivery',
  phone: '82999990000',
  address: {
    street: 'Rua Exemplo',
    number: '120',
    neighborhood: 'Centro',
    reference: 'Dados fictícios',
  },
  payment: 'card',
  expectedTotal: 2700,
  ...keys(),
};
assert.equal((await api('orders', { ...delivery, payment: 'counter' })).status, 400);
assert.equal((await api('orders', { ...delivery, address: null })).status, 400);
const delivered = await api('orders', delivery);
assert.equal(delivered.status, 201);
assert.equal(delivered.data.total, 2700);
assert.equal(delivered.data.delivery, 500);
assert.equal(delivered.data.tableNumber, null);
const list = await api('admin/orders', undefined, true);
const salon = list.data.orders.find((o) => o.id === placed.data.id);
assert.equal(salon.customer, dine.customer);
assert.equal(salon.address, null);
assert.equal(salon.phone, '');
assert.equal(salon.tableNumber, 4);
assert.equal(
  (await api('admin/update-order', { id: placed.data.id, status: 'delivering' }, true)).status,
  400,
);
assert.equal(
  (await api('admin/update-order', { id: placed.data.id, status: 'ready' }, true)).status,
  200,
);
let receipt = await api('receipt', { id: placed.data.id, token: dine.receiptToken });
assert.equal(receipt.data.status, 'ready');
assert.equal(receipt.data.customer, undefined);
assert.equal(
  (await api('admin/update-order', { id: placed.data.id, status: 'completed' }, true)).status,
  200,
);
receipt = await api('receipt', { id: placed.data.id, token: dine.receiptToken });
assert.equal(receipt.data.paymentStatus, 'pending');
assert.equal(
  (await api('admin/update-order', { id: placed.data.id, paymentStatus: 'confirmed' }, true))
    .status,
  200,
);
receipt = await api('receipt', { id: placed.data.id, token: dine.receiptToken });
assert.equal(receipt.data.paymentStatus, 'confirmed');
assert.equal((await api('admin/logout', {}, true)).status, 200);
assert.equal((await api('admin/orders', undefined, true)).status, 401);
// Keep the rejected cross-origin request last: the local emulator can restart its next request.
assert.equal((await api('quote', { items: item }, false, true)).status, 403);
console.log(
  'PASS: 10 mesas, ausência de frete/endereço no salão, pagamento no caixa, confirmação de mesa, delivery com R$5, preços autoritativos, idempotência concorrente, painel protegido e estados de preparo/pagamento.',
);
