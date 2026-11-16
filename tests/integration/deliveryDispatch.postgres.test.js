/* Isolated PostgreSQL only. See dispatch-postgres.md for setup. */
jest.mock('../../config/prisma', () => ({}));
jest.mock('../../services/ProviderCredentialService', () => ({ resolve: jest.fn() }));
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const credentials = require('../../services/ProviderCredentialService');
const DeliveryDispatchService = require('../../services/delivery/DeliveryDispatchService');
const { getAdapter } = require('../../services/delivery/adapters');
const enabled = !!process.env.DISPATCH_TEST_DATABASE_URL;
(enabled ? describe : describe.skip)('delivery dispatch real PostgreSQL', () => {
  let db, sql, svc, adapter, spy;
  const root = path.resolve(__dirname, '../..');
  const secret = 'dispatch-pg-secret';
  const webhook = (status, eventId = status, externalId = 'dispatch-1', orderService) => {
    const body = { event_id: eventId, dispatch_id: externalId, status };
    const rawBody = Buffer.from(JSON.stringify(body));
    return svc.handleWebhook({
      provider: 'mock',
      storeId: 3,
      body,
      rawBody,
      headers: {
        'x-delivery-signature': crypto.createHmac('sha256', secret).update(rawBody).digest('hex'),
      },
      orderService,
    });
  };
  beforeAll(async () => {
    const url = new URL(process.env.DISPATCH_TEST_DATABASE_URL);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.pathname !== '/wemarket_dispatch_test'
    )
      throw new Error('Requires isolated local wemarket_dispatch_test database');
    const { PrismaClient, Prisma } = require(path.join(root, '.tmp/dispatch-client'));
    sql = new Client({ connectionString: url.href });
    await sql.connect();
    // Dedicated fixture database: generate scalar columns for the real Prisma client.
    for (const e of Prisma.dmmf.datamodel.enums) {
      await sql.query(
        `DO $$ BEGIN CREATE TYPE public."${e.name}" AS ENUM (${e.values.map((v) => `'${v.name}'`).join(',')}); EXCEPTION WHEN duplicate_object THEN NULL; END $$`
      );
    }
    const types = {
      Int: 'integer',
      BigInt: 'bigint',
      String: 'text',
      Boolean: 'boolean',
      DateTime: 'timestamp(3)',
      Float: 'double precision',
      Decimal: 'numeric',
      Json: 'jsonb',
      Bytes: 'bytea',
    };
    for (const name of ['orders', 'stores', 'store_order_channels']) {
      const m = Prisma.dmmf.datamodel.models.find((m) => m.name === name);
      const cols = m.fields
        .filter((f) => f.kind !== 'object')
        .map(
          (f) =>
            `"${f.name}" ${f.kind === 'enum' ? `public."${f.type}"` : types[f.type]}${f.isList ? '[]' : ''}${f.isId ? ' PRIMARY KEY' : ''}`
        );
      await sql.query(`CREATE TABLE IF NOT EXISTS public.${name} (${cols.join(',')})`);
    }
    await sql.query(
      'DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;'
    );
    const exists = await sql.query(
      "SELECT to_regclass('public.delivery_dispatches') AS table_name"
    );
    if (!exists.rows[0].table_name) {
      await sql.query(
        fs.readFileSync(
          path.join(root, 'prisma/migrations/20261104010000_delivery_dispatches/migration.sql'),
          'utf8'
        )
      );
      await sql.query(
        fs.readFileSync(
          path.join(root, 'prisma/migrations/20261109010000_delivery_dispatch_claim/migration.sql'),
          'utf8'
        )
      );
    }
    db = new PrismaClient({ datasources: { db: { url: url.href } } });
    adapter = getAdapter('mock');
  }, 30000);
  beforeEach(async () => {
    await sql.query(
      'TRUNCATE public.delivery_webhook_events, public.delivery_dispatches, public.orders, public.stores, public.store_order_channels RESTART IDENTITY CASCADE'
    );
    await sql.query(
      "INSERT INTO public.stores(id,name) VALUES(3,'fixture'); INSERT INTO public.orders(id,store_id,order_number,order_type,status) VALUES(11,3,'D-11','delivery','ready'); INSERT INTO public.store_order_channels(id,store_id,dine_in_enabled,takeout_enabled,delivery_enabled,hide_exact_address,delivery_fulfillment,delivery_area_mode,delivery_radius_km,delivery_areas,min_order_amount,delivery_fee,delivery_est_minutes,agency_provider,agency_auto_dispatch,updated_at) VALUES(1,3,true,true,true,false,'agency','radius',3,'[]',0,0,40,'mock',false,NOW())"
    );
    credentials.resolve.mockResolvedValue({ values: { api_key: 'x', api_secret: secret } });
    svc = new DeliveryDispatchService(null, db);
    spy = jest.spyOn(adapter, 'requestDispatch');
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (db) await db.$disconnect();
    if (sql) await sql.end();
  });
  const seed = (status = 'requested', external_id = 'dispatch-1') =>
    db.delivery_dispatches.create({
      data: { order_id: 11, store_id: 3, provider: 'mock', status, external_id },
    });
  test('concurrent requests call provider once, with committed claim and no open order lock', async () => {
    spy.mockImplementation(async ({ idempotencyKey }) => {
      expect(idempotencyKey).toMatch(/^delivery-dispatch:\d+$/);
      expect(await db.delivery_dispatches.count()).toBe(1);
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='500ms'");
        await tx.$queryRaw`SELECT id FROM public.orders WHERE id = 11 FOR UPDATE`;
      });
      return { externalId: 'dispatch-1', status: 'requested' };
    });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => svc.request(11)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  test('unknown provider result survives service restart and blocks resend/cancel', async () => {
    spy.mockRejectedValue(new Error('timeout after acceptance'));
    await expect(svc.request(11)).rejects.toMatchObject({ statusCode: 502 });
    svc = new DeliveryDispatchService(null, db);
    await expect(svc.request(11)).rejects.toMatchObject({ statusCode: 409 });
    await expect(svc.cancel(11)).rejects.toMatchObject({ statusCode: 409 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await db.delivery_dispatches.findFirst()).request_state).toBe('unknown');
  });
  test('order write failure rolls back dispatch and inbox; identical event can retry', async () => {
    await seed();
    await sql.query(
      "ALTER TABLE public.orders ADD CONSTRAINT test_reject_delivery CHECK (delivery_status IS DISTINCT FROM 'delivered')"
    );
    try {
      await expect(webhook('delivered', 'retry')).rejects.toThrow();
    } finally {
      await sql.query('ALTER TABLE public.orders DROP CONSTRAINT test_reject_delivery');
    }
    expect(await db.delivery_webhook_events.count()).toBe(0);
    expect((await db.delivery_dispatches.findFirst()).status).toBe('requested');
    await expect(webhook('delivered', 'retry')).resolves.toEqual({ handled: true });
    expect((await db.orders.findUnique({ where: { id: 11 } })).status).toBe('completed');
  });
  test('concurrent identical webhook is applied once', async () => {
    await seed();
    const results = await Promise.all(Array.from({ length: 6 }, () => webhook('assigned', 'same')));
    expect(results.filter((r) => r.duplicate)).toHaveLength(5);
    expect(await db.delivery_webhook_events.count()).toBe(1);
  });
  test.each(['canceled', 'failed', 'assigned'])(
    'delivered cannot be undone by %s',
    async (status) => {
      await seed();
      await webhook('delivered');
      await webhook(status);
      expect((await db.delivery_dispatches.findFirst()).status).toBe('delivered');
      expect((await db.orders.findUnique({ where: { id: 11 } })).delivery_status).toBe('delivered');
    }
  );
  test('old dispatch webhook cannot affect a newer dispatch/order', async () => {
    await seed('canceled');
    await seed('picked_up', 'dispatch-2');
    await db.orders.update({ where: { id: 11 }, data: { delivery_status: 'delivering' } });
    await webhook('delivered', 'old');
    expect((await db.orders.findUnique({ where: { id: 11 } })).delivery_status).toBe('delivering');
    expect((await db.delivery_dispatches.findFirst({ orderBy: { id: 'asc' } })).status).toBe(
      'canceled'
    );
  });
  test('post-commit order effects failure is visible and same event retries effects', async () => {
    await seed();
    const orderService = {
      applyCommittedDeliveryEffects: jest
        .fn()
        .mockRejectedValueOnce(new Error('effects unavailable'))
        .mockResolvedValue({}),
    };
    await expect(webhook('delivered', 'effects', 'dispatch-1', orderService)).rejects.toThrow(
      'effects unavailable'
    );
    expect((await db.orders.findUnique({ where: { id: 11 } })).delivery_status).toBe('delivered');
    await expect(webhook('delivered', 'effects', 'dispatch-1', orderService)).resolves.toEqual({
      handled: false,
      duplicate: true,
    });
    expect(orderService.applyCommittedDeliveryEffects).toHaveBeenCalledTimes(2);
    expect((await db.delivery_webhook_events.findFirst()).effect_completed_at).not.toBeNull();
  });
  test('fresh process recovers expired pending effects without another webhook', async () => {
    await seed();
    const failedService = { applyCommittedDeliveryEffects: jest.fn().mockRejectedValue(new Error('crash')) };
    await expect(webhook('delivered', 'restart', 'dispatch-1', failedService)).rejects.toThrow('crash');
    await db.delivery_webhook_events.updateMany({ data: { effect_lease_until: new Date(0) } });
    const recovered = { applyCommittedDeliveryEffects: jest.fn().mockResolvedValue() };
    const fresh = new DeliveryDispatchService(null, db);
    await expect(fresh.recoverPendingEffects(recovered)).resolves.toEqual({ attempted: 1, failed: 0 });
    expect(recovered.applyCommittedDeliveryEffects).toHaveBeenCalledWith(11, 'completed');
    expect((await db.delivery_webhook_events.findFirst()).effect_completed_at).not.toBeNull();
    await expect(fresh.recoverPendingEffects(recovered)).resolves.toEqual({ attempted: 0, failed: 0 });
  });
});
