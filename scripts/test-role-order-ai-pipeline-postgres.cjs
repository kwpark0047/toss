// Reproducible local PostgreSQL role -> order -> AI manager pipeline test.
// It creates synthetic accounts/orders in the dedicated local wemarket_test DB
// only. It never calls Toss, SMS/email providers, or an external LLM.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const databaseUrl = new URL(process.env.DATABASE_URL || 'http://missing');
if (
  process.env.NODE_ENV !== 'test' ||
  !['localhost', '127.0.0.1'].includes(databaseUrl.hostname) ||
  databaseUrl.pathname !== '/wemarket_test'
) {
  throw new Error('Only NODE_ENV=test and the local wemarket_test database are allowed.');
}

// Ensure the analysis path stays deterministic and does not call a paid LLM.
process.env.GEMINI_API_KEY = '';

const prisma = require('../config/prisma');
const { getStoreRole, checkStorePermission } = require('../middleware/storeAuth');
const OrderService = require('../services/OrderService');
const StoreManagerService = require('../services/StoreManagerService');

const DAY_MS = 24 * 60 * 60 * 1000;
const runTag = `PIPE-${new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, '')
  .slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`;
const ownerUsers = [];
const teamUsers = [];
const customerUsers = [];
const stores = [];
const staffRows = [];
const orders = [];
const ordersByStore = new Map();
const products = [];

// Suppress outbound notification and webhook adapters while retaining the real
// OrderService persistence, transition, role, and AI-analysis paths.
const notifications = require('../services/notificationService');
for (const method of [
  'notifyOrderStatus',
  'notifyOrderStatusDB',
  'notifyLowStockDB',
  'notifyNewOrderDB',
]) {
  if (typeof notifications[method] === 'function') notifications[method] = async () => {};
}
const webhooks = require('../services/webhookDispatcher');
if (typeof webhooks.emitEvent === 'function') webhooks.emitEvent = async () => {};

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

async function assertPermission(userId, userRole, storeId, permission, expectedStatus = 200) {
  const req = {
    method: permission.endsWith(':read') ? 'GET' : 'POST',
    user: { id: userId, role: userRole },
    params: { storeId: String(storeId) },
    query: {},
    body: {},
  };
  const res = response();
  let passed = false;
  await checkStorePermission(permission)(req, res, () => {
    passed = true;
  });
  assert.equal(passed ? 200 : res.statusCode, expectedStatus, `${userRole}:${permission}`);
}

async function createUser(kind, number, role) {
  return prisma.users.create({
    data: {
      name: `${runTag} ${kind} ${String(number).padStart(2, '0')}`,
      email: `${kind}-${String(number).padStart(2, '0')}-${runTag.toLowerCase()}@example.invalid`,
      password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 4),
      role,
      business_access_status: 'approved',
      password_login_enabled: true,
    },
  });
}

async function cleanup() {
  const orderNumbers = orders.map((order) => order.order_number);
  const orderIds = orders.map((order) => order.id);
  const storeIds = stores.map((store) => store.id);
  const userIds = [...ownerUsers, ...teamUsers, ...customerUsers].map((user) => user.id);

  if (orderIds.length) {
    await prisma.ledger.deleteMany({ where: { order_id: { in: orderIds } } });
    await prisma.payments.deleteMany({ where: { order_id: { in: orderIds } } });
    await prisma.order_events.deleteMany({ where: { order_id: { in: orderIds } } });
  }
  if (orderNumbers.length)
    await prisma.orders.deleteMany({ where: { order_number: { in: orderNumbers } } });
  if (storeIds.length) await prisma.stores.deleteMany({ where: { id: { in: storeIds } } });
  if (userIds.length) await prisma.users.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  try {
    const testPasswordHashCost = 4;
    assert.equal(testPasswordHashCost, 4); // Keep synthetic fixture creation fast and deterministic.

    for (let i = 1; i <= 5; i += 1) {
      ownerUsers.push(await createUser('owner', i, 'store_admin'));
    }
    for (const role of ['manager', 'staff', 'kitchen']) {
      for (let i = 1; i <= 5; i += 1) {
        teamUsers.push(await createUser(role, i, 'staff'));
      }
    }
    for (let i = 1; i <= 10; i += 1) {
      customerUsers.push(await createUser('customer', i, 'user'));
    }
    assert.equal(ownerUsers.length + teamUsers.length + customerUsers.length, 30);

    for (let i = 0; i < 5; i += 1) {
      const store = await prisma.stores.create({
        data: {
          user_id: ownerUsers[i].id,
          name: `${runTag} store ${i + 1}`,
          address: 'LOCAL TEST DATA',
          is_active: true,
          plan: 'pro',
        },
      });
      stores.push(store);

      for (const [roleOffset, role] of ['manager', 'staff', 'kitchen'].entries()) {
        const user = teamUsers[roleOffset * 5 + i];
        staffRows.push(
          await prisma.staff.create({
            data: { store_id: store.id, user_id: user.id, role, is_active: 1 },
          })
        );
      }

      const category = await prisma.categories.create({
        data: { store_id: store.id, name: `${runTag} category ${i + 1}` },
      });
      products.push(
        await prisma.products.create({
          data: {
            store_id: store.id,
            category_id: category.id,
            name: `${runTag} menu ${i + 1}`,
            price: 10000 + i * 1000,
            is_active: true,
            is_sold_out: false,
            stock_quantity: null,
          },
        })
      );

      // Non-routable synthetic identifiers only; no SMS/phone authentication.
      for (let customerOffset = 0; customerOffset < 2; customerOffset += 1) {
        const customer = customerUsers[i * 2 + customerOffset];
        await prisma.store_customers.create({
          data: {
            store_id: store.id,
            customer_name: customer.name,
            customer_phone: `${runTag}-C${String(customer.id)}`,
            total_spent: 0,
            visit_count: 1,
          },
        });
      }
      ordersByStore.set(store.id, []);
    }

    const orderService = new OrderService(null);
    orderService._sendOrderAlimtalk = async () => {};
    const now = new Date();
    let completedPaidCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;

    for (let storeIndex = 0; storeIndex < stores.length; storeIndex += 1) {
      const store = stores[storeIndex];
      const product = products[storeIndex];
      const manager = teamUsers[storeIndex];
      const staff = teamUsers[5 + storeIndex];
      const kitchen = teamUsers[10 + storeIndex];
      const storeOrders = ordersByStore.get(store.id);

      for (let index = 0; index < 20; index += 1) {
        const customer = customerUsers[storeIndex * 2 + (index % 2)];
        const order = await orderService.createOrder({
          store_id: store.id,
          items: [{ product_id: product.id, quantity: 1 }],
          total_amount: product.price,
          method: 'test_fixture',
          order_number: `${runTag}-${storeIndex + 1}-${String(index + 1).padStart(3, '0')}`,
          customer_name: customer.name,
          is_takeout: true,
        });
        orders.push(order);
        storeOrders.push(order);

        const ageDays = (index * 7) % 28;
        const createdAt = new Date(now.getTime() - ageDays * DAY_MS - (index % 5) * 60 * 60 * 1000);
        await prisma.orders.update({
          where: { id: order.id },
          data: { created_at: createdAt, updated_at: createdAt },
        });

        if (index < 14) {
          await prisma.orders.update({
            where: { id: order.id },
            data: { payment_status: 'paid' },
          });
          const payment = await prisma.payments.create({
            data: {
              order_id: order.id,
              store_id: store.id,
              status: 'DONE',
              amount: product.price,
              method: 'test_fixture',
              completed_at: createdAt,
            },
          });
          await prisma.ledger.create({
            data: {
              store_id: store.id,
              order_id: order.id,
              payment_id: payment.id,
              type: 'PAYMENT',
              category: 'TEST_SALES',
              amount: product.price,
              method: 'test_fixture',
              event_key: `${runTag}-payment-${order.id}`,
            },
          });

          const staffId = staffRows.find((row) => row.user_id === staff.id)?.id;
          const kitchenId = staffRows.find((row) => row.user_id === kitchen.id)?.id;
          await orderService.updateStatus(order.id, 'confirmed', staffId, {
            userId: manager.id,
            role: 'manager',
          });
          await orderService.updateStatus(order.id, 'preparing', staffId, {
            userId: manager.id,
            role: 'manager',
          });
          await orderService.updateStatus(order.id, 'ready', kitchenId, {
            userId: kitchen.id,
            role: 'kitchen',
          });
          await orderService.updateStatus(order.id, 'completed', staffId, {
            userId: staff.id,
            role: 'staff',
          });
          completedPaidCount += 1;
        } else if (index < 17) {
          await orderService.cancelOrder(order.id, ownerUsers[storeIndex].id, 'store_admin');
          cancelledCount += 1;
        } else {
          pendingCount += 1;
        }
      }
    }

    assert.equal(orders.length, 100);
    assert.equal(completedPaidCount, 70);
    assert.equal(cancelledCount, 15);
    assert.equal(pendingCount, 15);

    for (let i = 0; i < stores.length; i += 1) {
      const store = stores[i];
      const manager = teamUsers[i];
      const staff = teamUsers[5 + i];
      const kitchen = teamUsers[10 + i];
      assert.equal(await getStoreRole(ownerUsers[i].id, store.id), 'owner');
      assert.equal(await getStoreRole(manager.id, store.id), 'manager');
      assert.equal(await getStoreRole(staff.id, store.id), 'staff');
      assert.equal(await getStoreRole(kitchen.id, store.id), 'kitchen');
      assert.equal(await getStoreRole(customerUsers[i * 2].id, store.id), null);
      assert.equal(await getStoreRole(manager.id, stores[(i + 1) % stores.length].id), null);

      await assertPermission(manager.id, 'staff', store.id, 'orders:update');
      await assertPermission(staff.id, 'staff', store.id, 'orders:manage');
      await assertPermission(kitchen.id, 'staff', store.id, 'orders:update');
      await assertPermission(customerUsers[i * 2].id, 'user', store.id, 'orders:read', 403);
      await assertPermission(
        manager.id,
        'staff',
        stores[(i + 1) % stores.length].id,
        'orders:read',
        403
      );
    }

    const analysis = new StoreManagerService(prisma);
    const briefings = [];
    for (const store of stores) {
      const briefing = await analysis.briefing(store.id, now);
      assert.equal(briefing.store.id, store.id);
      assert.equal(briefing.provenance.native.provider, 'wemarket');
      assert.ok(briefing.provenance.native.period.start);
      assert.ok(briefing.provenance.native.period.end);
      assert.equal(briefing.provenance.external.sources.length, 0);
      briefings.push({ storeId: store.id, snapshotId: briefing.snapshot_id });
    }

    const duplicateCandidate = orders[0];
    const duplicateCount = await prisma.orders.count({
      where: { order_number: duplicateCandidate.order_number },
    });
    assert.equal(duplicateCount, 1, 'one generated order number maps to exactly one order');

    console.log(
      JSON.stringify({
        passed: true,
        database: 'local wemarket_test (PostgreSQL)',
        syntheticAccounts: {
          businessOwners: ownerUsers.length,
          managers: 5,
          staff: 5,
          kitchen: 5,
          customers: customerUsers.length,
          total: ownerUsers.length + teamUsers.length + customerUsers.length,
        },
        stores: stores.length,
        orders: orders.length,
        statusCounts: { completedPaidCount, cancelledCount, pendingCount },
        roleIsolation: true,
        orderServiceTransitions: true,
        paymentAndLedgerFixtures: 'synthetic only; no PG request',
        aiManagerBriefings: briefings,
        externalLlm: 'not called',
        outboundNotifications: 'suppressed',
      })
    );
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({ passed: false, name: error.name, code: error.code, message: error.message })
  );
  process.exitCode = 1;
});
