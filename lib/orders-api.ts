/** CÓDIGO DO SERVIDOR: valida dados, calcula valores e acessa o banco D1. Este arquivo não é entregue como script público ao navegador. */
import { env } from 'cloudflare:workers';
import catalog from '../catalog.json';
import { z } from 'zod';

type Runtime = { DB: D1Database; CHICO_ADMIN_USER?: string; CHICO_ADMIN_PASSWORD_HASH?: string };
const runtime = () => env as unknown as Runtime;
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
class Failure extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (x) => x.toString(16).padStart(2, '0'),
  ).join('');
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
const text = (min = 1, max = 120) => z.string().trim().min(min).max(max);
const cartSchema = z.object({
  items: z
    .array(z.object({ id: text(1, 50), quantity: z.number().int().min(1).max(20) }))
    .min(1)
    .max(48),
  coupon: z.string().trim().max(30).optional().default(''),
  serviceType: z.enum(['delivery', 'dine_in']).optional().default('delivery'),
  tableNumber: z.number().int().min(1).max(10).nullable().optional().default(null),
});
const addressSchema = z.object({
  street: text(2),
  neighborhood: text(2),
  number: text(1, 20),
  reference: text(0, 200),
});
const checkoutSchema = cartSchema
  .extend({
    customer: text(2, 100),
    phone: text(0, 20).optional().default(''),
    address: addressSchema.nullable().optional().default(null),
    payment: z.enum(['cash', 'card', 'counter']),
    tableConfirmation: z.number().int().min(1).max(10).nullable().optional().default(null),
    changeFor: z.number().int().min(0).max(10000000).nullable().optional(),
    notes: text(0, 500).optional().default(''),
    expectedTotal: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
    receiptToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .superRefine((data, ctx) => {
    const fail = (message: string, path: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
    if (data.serviceType === 'dine_in') {
      if (data.tableNumber === null || data.tableConfirmation !== data.tableNumber)
        fail('Confirme a mesa de 01 a 10 antes de enviar.', 'tableConfirmation');
      if (data.payment !== 'counter')
        fail('Pedidos no salão são pagos no caixa após consumir.', 'payment');
    } else {
      if (data.tableNumber !== null || data.tableConfirmation !== null)
        fail('Pedido de delivery não deve ter mesa.', 'tableNumber');
      if (!data.address) fail('Preencha o endereço de entrega.', 'address');
      if (!/^\+?[\d\s()-]+$/.test(data.phone) || data.phone.replace(/\D/g, '').length < 10)
        fail('Preencha o telefone com DDD.', 'phone');
      if (data.payment === 'counter') fail('Escolha dinheiro ou cartão na entrega.', 'payment');
    }
  });
/** Aceita JSON e limita o tamanho do conteúdo recebido antes de validar seus campos. */
async function body(req: Request) {
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    throw new Failure('Formato inválido.', 415);
  const raw = await req.text();
  if (raw.length > 20000) throw new Failure('Pedido muito grande.', 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Failure('Dados inválidos.');
  }
}
/** Confere se uma alteração veio da mesma origem do site. É uma defesa contra requisições indevidas de outros sites. */
function origin(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin)
    throw new Failure('Origem não autorizada.', 403);
}
/** Procura uma sessão válida no banco a partir do token aleatório do cookie. */
async function session(req: Request) {
  const key = req.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)chico_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!key) return false;
  const s = await runtime()
    .DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await hash(key), Date.now())
    .first();
  return !!s;
}
/** Interrompe o acesso protegido quando a sessão da equipe não foi autenticada. */
async function admin(req: Request) {
  if (!(await session(req))) throw new Failure('Entre com usuário e senha para continuar.', 401);
}
/** Lê a configuração salva. Sem um valor cadastrado, o frete padrão é 500 centavos: R$ 5,00. */
async function settings() {
  const rows = await runtime()
    .DB.prepare('SELECT key,value FROM settings')
    .all<{ key: string; value: string }>();
  const all = Object.fromEntries(rows.results.map((r) => [r.key, r.value]));
  return { delivery: all.delivery ? Number(all.delivery) : 500 };
}
/** Confere produtos e quantidades, usa os preços do catálogo do servidor, aplica cupom e calcula o total. */
async function quote(input: z.infer<typeof cartSchema>) {
  if (input.serviceType === 'dine_in' && input.tableNumber === null)
    throw new Failure('Escaneie o QR Code da sua mesa, de 01 a 10.');
  if (input.serviceType === 'delivery' && input.tableNumber !== null)
    throw new Failure('Escolha um pedido de salão para informar a mesa.');
  const seen = new Set<string>();
  let count = 0;
  const items = input.items.map((item) => {
    if (seen.has(item.id)) throw new Failure('Há itens repetidos no carrinho.');
    seen.add(item.id);
    count += item.quantity;
    const product = catalog.find((x) => x.id === item.id);
    if (!product) throw new Failure('Um dos itens não está mais disponível.');
    return { id: product.id, name: product.name, price: product.price, quantity: item.quantity };
  });
  if (count > 100)
    throw new Failure('Para pedidos com mais de 100 itens, entre em contato com a hamburgueria.');
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  let discount = 0;
  let coupon: string | null = null;
  if (input.coupon) {
    coupon = input.coupon.toUpperCase();
    const row = await runtime()
      .DB.prepare('SELECT kind,value FROM coupons WHERE code = ? AND active = 1')
      .bind(coupon)
      .first<{ kind: string; value: number }>();
    if (!row) throw new Failure('Cupom inválido ou desativado.');
    discount = Math.min(
      subtotal,
      row.kind === 'percent' ? Math.floor((subtotal * row.value) / 100) : row.value,
    );
  }
  const config = await settings();
  const delivery = input.serviceType === 'dine_in' ? 0 : config.delivery;
  return {
    items,
    subtotal,
    discount,
    delivery,
    total: subtotal - discount + delivery,
    coupon,
    serviceType: input.serviceType,
    tableNumber: input.tableNumber,
  };
}
/** Define os dados permitidos no recibo. Nome, telefone e endereço não entram nessa resposta pública. */
function publicOrder(row: any) {
  return {
    id: row.id,
    number: row.id.slice(0, 8).toUpperCase(),
    createdAt: row.created_at,
    items: JSON.parse(row.items),
    subtotal: row.subtotal,
    discount: row.discount,
    delivery: row.delivery,
    total: row.total,
    coupon: row.coupon,
    payment: row.payment,
    paymentStatus: row.payment_status,
    status: row.status,
    serviceType: row.service_type || 'delivery',
    tableNumber: row.table_number ?? null,
  };
}
/** Compara a senha recebida com uma derivação PBKDF2. O valor original da senha não é salvo no código. */
async function verifyPassword(password: string) {
  const stored = runtime().CHICO_ADMIN_PASSWORD_HASH;
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
      key,
      256,
    ),
  );
  const actual = Array.from(derived, (x) => x.toString(16).padStart(2, '0')).join('');
  let diff = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++)
    diff |= actual.charCodeAt(i) ^ (expected.charCodeAt(i) || 0);
  return diff === 0;
}
const cookie = (value: string, req: Request, maxAge = 28800) =>
  `chico_session=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
export /** Distribui a requisição entre catálogo, cotação, pedidos, recibos e rotas protegidas da equipe. */
async function handleApi(req: Request) {
  try {
    const path = new URL(req.url).pathname.replace(/^\/api\//, '');
    const method = req.method;
    if (method !== 'GET') origin(req);
    if (path === 'catalog' && method === 'GET')
      return json({
        catalog,
        ...(await settings()),
        payments: ['cash', 'card'],
        tables: 10,
        salonPayment: 'counter',
      });
    if (path === 'quote' && method === 'POST')
      return json(await quote(cartSchema.parse(await body(req))));
    if (path === 'orders' && method === 'POST') {
      const data = checkoutSchema.parse(await body(req));
      const requestHash = await hash(JSON.stringify(data));
      const db = runtime().DB;
      const existing = await db
        .prepare('SELECT * FROM orders WHERE idempotency_key = ?')
        .bind(data.idempotencyKey)
        .first<any>();
      if (existing) {
        if (existing.request_hash !== requestHash)
          throw new Failure('Este pedido já foi enviado com outros dados. Atualize a página.', 409);
        return json(publicOrder(existing));
      }
      const total = await quote(data);
      if (total.total !== data.expectedTotal)
        throw new Failure('O total foi atualizado. Revise o pedido antes de confirmar.', 409);
      if (data.payment === 'cash' && data.changeFor != null && data.changeFor < total.total)
        throw new Failure('O valor para troco deve ser igual ou maior que o total.');
      const id = crypto.randomUUID();
      const now = Date.now();
      try {
        await db
          .prepare(
            'INSERT INTO orders (id,number,created_at,customer,phone,address,items,subtotal,discount,delivery,total,coupon,payment,change_for,payment_status,status,notes,idempotency_key,request_hash,receipt_hash,service_type,table_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            id,
            now,
            now,
            data.customer,
            data.serviceType === 'dine_in' ? '' : data.phone,
            JSON.stringify(data.serviceType === 'dine_in' ? null : data.address),
            JSON.stringify(total.items),
            total.subtotal,
            total.discount,
            total.delivery,
            total.total,
            total.coupon,
            data.payment,
            data.payment === 'cash' ? (data.changeFor ?? null) : null,
            'pending',
            'received',
            data.notes,
            data.idempotencyKey,
            requestHash,
            await hash(data.receiptToken),
            data.serviceType,
            data.tableNumber,
          )
          .run();
      } catch (error) {
        const duplicate = await db
          .prepare('SELECT * FROM orders WHERE idempotency_key = ?')
          .bind(data.idempotencyKey)
          .first<any>();
        if (!duplicate) throw error;
        if (duplicate.request_hash !== requestHash)
          throw new Failure('Este pedido já foi enviado com outros dados.', 409);
        return json(publicOrder(duplicate));
      }
      return json(
        publicOrder(await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first()),
        201,
      );
    }
    if (path === 'receipt' && method === 'POST') {
      const data = z
        .object({ id: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(await body(req));
      const row = await runtime()
        .DB.prepare('SELECT * FROM orders WHERE id = ? AND receipt_hash = ?')
        .bind(data.id, await hash(data.token))
        .first();
      if (!row) throw new Failure('Pedido não encontrado.', 404);
      return json(publicOrder(row));
    }
    if (path === 'admin/login' && method === 'POST') {
      if (!runtime().CHICO_ADMIN_PASSWORD_HASH)
        throw new Failure('O acesso da equipe ainda não foi configurado.', 503);
      const data = z
        .object({ username: text(1, 100), password: z.string().min(1).max(200) })
        .parse(await body(req));
      const db = runtime().DB;
      const ipHash = await hash(req.headers.get('cf-connecting-ip') || 'local');
      const now = Date.now();
      await db
        .prepare('DELETE FROM login_attempts WHERE created_at < ?')
        .bind(now - 900000)
        .run();
      const attempts = await db
        .prepare('SELECT count(*) AS count FROM login_attempts WHERE ip_hash = ?')
        .bind(ipHash)
        .first<{ count: number }>();
      if ((attempts?.count || 0) >= 5)
        throw new Failure('Muitas tentativas. Aguarde 15 minutos e tente novamente.', 429);
      await db
        .prepare('INSERT INTO login_attempts (id,ip_hash,created_at) VALUES (?,?,?)')
        .bind(crypto.randomUUID(), ipHash, now)
        .run();
      const valid = await verifyPassword(data.password);
      if (data.username !== runtime().CHICO_ADMIN_USER || !valid)
        throw new Failure('Usuário ou senha incorretos.', 401);
      const key = token();
      await db.batch([
        db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
        db
          .prepare('INSERT INTO sessions (token_hash,expires_at) VALUES (?,?)')
          .bind(await hash(key), now + 28800000),
        db.prepare('DELETE FROM login_attempts WHERE ip_hash = ?').bind(ipHash),
      ]);
      return json({ authenticated: true }, 200, { 'Set-Cookie': cookie(key, req) });
    }
    if (path === 'admin/session' && method === 'GET') {
      await admin(req);
      return json({ authenticated: true, username: runtime().CHICO_ADMIN_USER });
    }
    if (path === 'admin/logout' && method === 'POST') {
      const key = req.headers.get('cookie')?.match(/(?:^|;\s*)chico_session=([a-f0-9]{64})/)?.[1];
      if (key)
        await runtime()
          .DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
          .bind(await hash(key))
          .run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookie('', req, 0) });
    }
    if (path.startsWith('admin/')) {
      await admin(req);
      const db = runtime().DB;
      if (path === 'admin/orders' && method === 'GET') {
        const rows = await db
          .prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200')
          .all<any>();
        return json({
          orders: rows.results.map((row) => ({
            ...publicOrder(row),
            customer: row.customer,
            phone: row.phone,
            address: JSON.parse(row.address),
            changeFor: row.change_for,
            notes: row.notes,
          })),
          ...(await settings()),
        });
      }
      if (path === 'admin/update-order' && method === 'POST') {
        const data = z
          .object({
            id: z.string().uuid(),
            status: z
              .enum(['received', 'preparing', 'ready', 'delivering', 'completed', 'cancelled'])
              .optional(),
            paymentStatus: z.enum(['pending', 'confirmed']).optional(),
          })
          .refine((v) => v.status || v.paymentStatus)
          .parse(await body(req));
        const existing = await db
          .prepare('SELECT id,service_type FROM orders WHERE id = ?')
          .bind(data.id)
          .first<{ id: string; service_type: string }>();
        if (!existing) throw new Failure('Pedido não encontrado.', 404);
        if (existing.service_type === 'dine_in' && data.status === 'delivering')
          throw new Failure('Pedido de salão deve ser servido na mesa.');
        const operations = [];
        if (data.status)
          operations.push(
            db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(data.status, data.id),
          );
        if (data.paymentStatus)
          operations.push(
            db
              .prepare('UPDATE orders SET payment_status = ? WHERE id = ?')
              .bind(data.paymentStatus, data.id),
          );
        operations.push(
          db
            .prepare('INSERT INTO audit (id,order_id,action,created_at) VALUES (?,?,?,?)')
            .bind(
              crypto.randomUUID(),
              data.id,
              JSON.stringify({
                status: data.status,
                paymentStatus: data.paymentStatus,
                source: 'staff_manual',
              }),
              Date.now(),
            ),
        );
        await db.batch(operations);
        return json({ ok: true });
      }
      if (path === 'admin/coupons' && method === 'GET')
        return json({
          coupons: (await db.prepare('SELECT * FROM coupons ORDER BY code').all()).results,
          ...(await settings()),
        });
      if (path === 'admin/coupons' && method === 'POST') {
        const data = z
          .object({
            code: text(2, 30).regex(/^[A-Za-z0-9_-]+$/),
            kind: z.enum(['percent', 'fixed']),
            value: z.number().int().positive().max(1000000),
            active: z.boolean(),
          })
          .refine(
            (v) => v.kind !== 'percent' || v.value <= 80,
            'O desconto percentual máximo é 80%.',
          )
          .parse(await body(req));
        await db
          .prepare(
            'INSERT INTO coupons (code,kind,value,active) VALUES (?,?,?,?) ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,active=excluded.active',
          )
          .bind(data.code.toUpperCase(), data.kind, data.value, data.active ? 1 : 0)
          .run();
        return json({ ok: true });
      }
      if (path === 'admin/settings' && method === 'POST') {
        const data = z
          .object({ delivery: z.number().int().min(0).max(100000) })
          .parse(await body(req));
        await db
          .prepare(
            "INSERT INTO settings (key,value) VALUES ('delivery',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          )
          .bind(String(data.delivery))
          .run();
        return json({ ok: true });
      }
    }
    return json({ error: 'Página não encontrada.' }, 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        { error: 'Confira os campos preenchidos. ' + (error.issues[0]?.message || '') },
        400,
      );
    if (error instanceof Failure) return json({ error: error.message }, error.status);
    console.error('orders_api_error', error instanceof Error ? error.name : 'unknown');
    return json(
      { error: 'Não foi possível concluir agora. Tente novamente; seu carrinho foi mantido.' },
      500,
    );
  }
}
