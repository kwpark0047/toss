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
  const webhook = (
    status,
    eventId = status,
    externalId = 'dispatch-1',
    orderService,
    extra = {}
  ) => {
    const body = { event_id: eventId, dispatch_id: externalId, status, ...extra };
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
    for (const name of ['orders', 'stores', 'store_order_channels', 'order_items', 'payments']) {
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
    // Orders use DMMF scalar fixture above; replay the real additive migration
    // against old-shaped order columns to exercise its actual SQL too.
    await sql.query(
      'ALTER TABLE public.orders DROP COLUMN delivery_road_address, DROP COLUMN delivery_address_detail'
    );
    await sql.query(
      fs.readFileSync(
        path.join(root, 'prisma/migrations/20261116010000_barogo_order_details/migration.sql'),
        'utf8'
      )
    );
    db = new PrismaClient({ datasources: { db: { url: url.href } } });
    adapter = getAdapter('mock');
  }, 30000);
  beforeEach(async () => {
    await sql.query(
      'TRUNCATE public.order_items, public.payments, public.delivery_webhook_events, public.delivery_dispatches, public.orders, public.stores, public.store_order_channels RESTART IDENTITY CASCADE'
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
  test('Barogo invalid preflight does not claim or call transport', async () => {
    const { createBarogoStagingAdapter } = require('../../services/delivery/barogoAdapter');
    await db.store_order_channels.update({
      where: { store_id: 3 },
      data: { agency_provider: 'barogo' },
    });
    const transport = jest.fn();
    credentials.resolve.mockResolvedValue({
      values: { api_key: 'test-key', order_agency_id: 'wemarket', order_agency_store_id: 'shop-3' },
    });
    svc = new DeliveryDispatchService(null, db, () => createBarogoStagingAdapter({ transport }));
    await expect(svc.request(11)).rejects.toMatchObject({ statusCode: 400 });
    expect(await db.delivery_dispatches.count()).toBe(0);
    expect(transport).not.toHaveBeenCalled();
  });
  test('offline Barogo adapter connects paid persisted order details and authenticated early callback', async () => {
    const { createBarogoStagingAdapter } = require('../../services/delivery/barogoAdapter');
    await db.store_order_channels.update({
      where: { store_id: 3 },
      data: { agency_provider: 'barogo' },
    });
    await db.orders.update({
      where: { id: 11 },
      data: {
        payment_status: 'paid',
        total_amount: 13000,
        delivery_fee: 3000,
        customer_phone: '01000000000',
        delivery_road_address: '서울 강남구 시험로 1',
        delivery_address_detail: '101호',
      },
    });
    await db.order_items.create({
      data: {
        id: 1,
        order_id: 11,
        product_name: '시험 상품',
        price: 12000,
        subtotal: 12000,
        quantity: 1,
      },
    });
    await db.payments.create({
      data: { id: 1, order_id: 11, store_id: 3, status: 'DONE', amount: 13000 },
    });
    const creds = {
      values: {
        api_key: 'test-key',
        order_agency_id: 'wemarket',
        order_agency_store_id: 'shop-3',
        callback_header: 'x-test-auth',
        callback_token: 'offline-token-1234567890',
      },
    };
    credentials.resolve.mockResolvedValue(creds);
    let callbackBody;
    const transport = jest.fn(async (_url, options) => {
      const request = JSON.parse(options.body);
      expect(request).toMatchObject({
        dropAddressDetail: '101호',
        totalPayPrice: 15000,
        actualPayPrice: 13000,
      });
      callbackBody = {
        orderAgencyId: 'wemarket',
        orderAgencyStoreId: 'shop-3',
        orderAgencyOrderId: request.orderAgencyOrderId,
        deliveryStatus: 'PICKUP_FINISHED',
        changedAt: 1800000000000,
      };
      const webhookArgs = {
        provider: 'barogo',
        storeId: 3,
        body: callbackBody,
        callbackKind: 'delivery',
        headers: { 'x-test-auth': creds.values.callback_token },
      };
      await expect(svc.handleWebhook({ ...webhookArgs, headers: {} })).rejects.toMatchObject({
        statusCode: 401,
      });
      await svc.handleWebhook(webhookArgs);
      return {
        ok: true,
        json: async () => ({
          statusCode: 200,
          data: {
            isSuccess: true,
            order: { orderAgencyOrderId: request.orderAgencyOrderId, status: 'CREATED' },
          },
        }),
      };
    });
    const staging = createBarogoStagingAdapter({ transport, now: () => 1800000000000 });
    svc = new DeliveryDispatchService(null, db, () => staging);
    expect(await svc.request(11)).toMatchObject({
      status: 'picked_up',
      request_state: 'confirmed',
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(
      await svc.handleWebhook({
        provider: 'barogo',
        storeId: 3,
        body: callbackBody,
        callbackKind: 'delivery',
        headers: { 'x-test-auth': creds.values.callback_token },
      })
    ).toMatchObject({ duplicate: true });
  });
  test('timestamped unassignment allows reassignment but ignores delayed callbacks and terminal regression', async () => {
    const row = await seed('assigned');
    await db.delivery_dispatches.update({
      where: { id: row.id },
      data: { provider_changed_at: 100n, rider_name: 'old', rider_phone: '01000000000' },
    });
    jest.spyOn(adapter, 'parseWebhook').mockImplementation(({ body }) => ({
      eventId: body.event_id,
      externalId: body.dispatch_id,
      status: body.status,
      changedAt: body.changedAt,
      reassignment: body.reassignment,
      riderPhone: body.riderPhone,
    }));
    await webhook('requested', 'unassign', 'dispatch-1', undefined, {
      changedAt: 200,
      reassignment: true,
    });
    expect(await db.delivery_dispatches.findUnique({ where: { id: row.id } })).toMatchObject({
      status: 'requested',
      rider_phone: null,
      rider_name: null,
    });
    expect((await db.orders.findUnique({ where: { id: 11 } })).status).toBe('ready');
    await webhook('assigned', 'new-driver', 'dispatch-1', undefined, {
      changedAt: 300,
      riderPhone: '01011111111',
    });
    await webhook('requested', 'late-unassign', 'dispatch-1', undefined, {
      changedAt: 250,
      reassignment: true,
    });
    expect(await db.delivery_dispatches.findUnique({ where: { id: row.id } })).toMatchObject({
      status: 'assigned',
      rider_phone: '01011111111',
      provider_changed_at: 300n,
    });
    await webhook('picked_up', 'pickup-new', 'dispatch-1', undefined, { changedAt: 400 });
    await webhook('requested', 'unassign-after-pickup', 'dispatch-1', undefined, {
      changedAt: 500,
      reassignment: true,
    });
    expect((await db.delivery_dispatches.findUnique({ where: { id: row.id } })).status).toBe(
      'picked_up'
    );
    await webhook('delivered', 'finished-new', 'dispatch-1', undefined, { changedAt: 600 });
    await webhook('requested', 'unassign-after-finish', 'dispatch-1', undefined, {
      changedAt: 700,
      reassignment: true,
    });
    expect((await db.delivery_dispatches.findUnique({ where: { id: row.id } })).status).toBe(
      'delivered'
    );
    expect((await db.orders.findUnique({ where: { id: 11 } })).status).toBe('completed');
  });
  test('early callback resolves a committed stable claim without response overwriting pickup', async () => {
    adapter.externalIdForClaim = (id) => `delivery-dispatch:${id}`;
    jest.spyOn(adapter, 'parseWebhook').mockImplementation(({ body }) => ({
      eventId: body.event_id,
      externalId: body.dispatch_id,
      status: body.status,
      changedAt: body.changedAt,
    }));
    spy.mockImplementation(async ({ idempotencyKey }) => {
      await webhook('picked_up', 'early', idempotencyKey, undefined, { changedAt: 200 });
      return { externalId: idempotencyKey, status: 'requested' };
    });
    try {
      expect(await svc.request(11)).toMatchObject({
        status: 'picked_up',
        request_state: 'confirmed',
      });
      expect((await db.orders.findUnique({ where: { id: 11 } })).delivery_status).toBe(
        'delivering'
      );
    } finally {
      delete adapter.externalIdForClaim;
    }
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
    const failedService = {
      applyCommittedDeliveryEffects: jest.fn().mockRejectedValue(new Error('crash')),
    };
    await expect(webhook('delivered', 'restart', 'dispatch-1', failedService)).rejects.toThrow(
      'crash'
    );
    await db.delivery_webhook_events.updateMany({ data: { effect_lease_until: new Date(0) } });
    const recovered = { applyCommittedDeliveryEffects: jest.fn().mockResolvedValue() };
    const fresh = new DeliveryDispatchService(null, db);
    await expect(fresh.recoverPendingEffects(recovered)).resolves.toEqual({
      attempted: 1,
      failed: 0,
    });
    expect(recovered.applyCommittedDeliveryEffects).toHaveBeenCalledWith(11, 'completed');
    expect((await db.delivery_webhook_events.findFirst()).effect_completed_at).not.toBeNull();
    await expect(fresh.recoverPendingEffects(recovered)).resolves.toEqual({
      attempted: 0,
      failed: 0,
    });
  });
  test('a persistently failing first order cannot starve later orders at batch limit 1', async () => {
    await sql.query(
      "INSERT INTO public.orders(id,store_id,order_number,order_type,status,delivery_status) VALUES(12,3,'D-12','delivery','completed','delivered')"
    );
    await db.orders.update({
      where: { id: 11 },
      data: { status: 'completed', delivery_status: 'delivered' },
    });
    await db.delivery_webhook_events.createMany({
      data: [
        { provider: 'mock', event_id: 'failed-first', order_id: 11, effect_status: 'delivered' },
        { provider: 'mock', event_id: 'healthy-second', order_id: 12, effect_status: 'delivered' },
      ],
    });
    const effects = {
      applyCommittedDeliveryEffects: jest.fn(async (id) => {
        if (id === 11) throw new Error('persistent failure');
      }),
    };
    const worker = new DeliveryDispatchService(null, db);
    await expect(worker.recoverPendingEffects(effects, 1)).resolves.toEqual({
      attempted: 1,
      failed: 1,
    });
    await expect(worker.recoverPendingEffects(effects, 1)).resolves.toEqual({
      attempted: 1,
      failed: 0,
    });
    const second = await db.delivery_webhook_events.findUnique({
      where: { provider_event_id: { provider: 'mock', event_id: 'healthy-second' } },
    });
    expect(second.effect_completed_at).not.toBeNull();
    // Reaching the end wraps around and still retries the failed older order.
    await expect(worker.recoverPendingEffects(effects, 1)).resolves.toEqual({
      attempted: 1,
      failed: 1,
    });
  });
});
