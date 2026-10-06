const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function service(prisma, gateway) {
  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../../services/SaaSBillingService.js'), 'utf8'),
    {
      module,
      Buffer,
      Date,
      process: { env: { JWT_SECRET: 'test', TOSS_CLIENT_KEY: 'test_ck' } },
      require(name) {
        if (name === '../config/prisma') return prisma;
        if (name === '../utils/toss') return gateway;
        if (name === 'crypto') return require('crypto');
        if (name === '../utils/subscriptionPolicy')
          return require('../../utils/subscriptionPolicy');
        if (name === '../utils/tokenEncryption')
          return {
            encryptToken: (v) => `encrypted:${v}`,
            decryptToken: (v) => v.replace(/^encrypted:/, ''),
          };
        if (name === '../utils/errorHandler')
          return {
            AppError: class extends Error {
              constructor(m, statusCode) {
                super(m);
                this.statusCode = statusCode;
              }
            },
          };
        if (name === '../utils/logger') return { info() {}, error() {} };
        return {};
      },
    }
  );
  return module.exports;
}
test('renewal price changes require new consent and never create a charge', async () => {
  let created = 0;
  const sub = { id: 's-price', store_id: 1, status: 'active', auto_renew: true, current_period_end: new Date('2026-01-01'), billing_cycle: 'MONTHLY', metadata: { automatic_payment_consent: { amount: 30000 } }, plan: { id: 'pro', name: 'pro', is_active: true, price_monthly: 35000 } };
  const invoices = { updateMany: async () => ({ count: 0 }), findMany: async () => [], upsert: async () => { created++; } };
  const tx = { $queryRaw: async () => [], subscription: { findUnique: async () => sub, findMany: async () => [] }, billingInvoice: invoices };
  const prisma = { $transaction: async (fn) => fn(tx), subscription: { findMany: async () => [sub] }, billingInvoice: invoices };
  await service(prisma, {}).runDueBilling();
  assert.equal(created, 0);
});
test('subscription is activated only after a verified invoice with server amount and order ID', async () => {
  const invoice = {
    id: 'i1',
    subscription_id: 's1',
    store_id: 1,
    plan_id: 'pro',
    billing_cycle: 'MONTHLY',
    order_id: 'wm-i1',
    amount: 30000,
    status: 'pending',
    period_start: new Date('2026-10-06'),
    period_end: new Date('2026-11-06'),
    attempts: 0,
  };
  const sub = {
    id: 's1',
    store_id: 1,
    status: 'incomplete',
    payment_method_id: 'encrypted:billing-key',
    metadata: {},
    plan: { name: 'pro', display_name: 'Pro' },
  };
  let active = false;
  const tx = {
    $queryRaw: async () => [],
    billingInvoice: {
      update: async ({ data }) => {
        Object.assign(invoice, data);
        return invoice;
      },
      updateMany: async () => ({ count: 1 }),
    },
    subscription: {
      findUnique: async () => sub,
      update: async ({ data }) => {
        active = data.status === 'active';
        Object.assign(sub, data);
        return sub;
      },
    },
    stores: { update: async () => {} },
    store_subscriptions: { upsert: async () => {} },
  };
  const prisma = {
    ...tx,
    $transaction: async (fn) => fn(tx),
    billingInvoice: {
      ...tx.billingInvoice,
      findUnique: async () => ({ ...invoice, subscription: sub }),
      updateMany: async ({ data }) => {
        if (invoice.status === 'processing') return { count: 0 };
        Object.assign(invoice, data);
        return { count: 1 };
      },
    },
  };
  let charges = 0;
  const billing = service(prisma, {
    async payWithBillingKey(_key, _customer, amount, orderId) {
      charges++;
      assert.equal(active, false);
      assert.equal(amount, 30000);
      return {
        status: 'DONE',
        totalAmount: amount,
        orderId,
        paymentKey: 'pay-1',
        approvedAt: '2026-10-06T00:00:00Z',
      };
    },
  });
  await billing.chargeInvoice('i1');
  assert.equal(active, true);
  assert.equal(invoice.status, 'paid');
  await billing.chargeInvoice('i1');
  assert.equal(charges, 1);
});
test('mismatched provider amount never activates the paid plan', async () => {
  let active = false;
  const invoice = {
    id: 'i2',
    status: 'pending',
    amount: 30000,
    attempts: 0,
    order_id: 'wm-i2',
    subscription_id: 's2',
    subscription: {
      id: 's2',
      store_id: 1,
      payment_method_id: 'encrypted:key',
      plan: { name: 'pro' },
    },
  };
  const tx = {
    $queryRaw: async () => [],
    billingInvoice: { update: async () => {}, updateMany: async () => ({ count: 1 }) },
    subscription: {
      findUnique: async () => invoice.subscription,
      update: async ({ data }) => {
        active = data.status === 'active';
      },
    },
  };
  const billing = service(
    {
      ...tx,
      $transaction: (fn) => fn(tx),
      billingInvoice: {
        ...tx.billingInvoice,
        findUnique: async () => invoice,
        updateMany: async () => ({ count: 1 }),
      },
    },
    { payWithBillingKey: async () => ({ status: 'DONE', totalAmount: 1, orderId: 'wm-i2' }) }
  );
  await assert.rejects(billing.chargeInvoice('i2'));
  assert.equal(active, false);
});
test('a canceled subscription cannot send a renewal charge to the provider', async () => {
  let charges = 0;
  let status;
  const sub = { id: 's3', store_id: 1, auto_renew: false };
  const invoice = { id: 'i3', status: 'pending', attempts: 0, subscription: sub };
  const tx = {
    $queryRaw: async () => [],
    subscription: { findUnique: async () => sub },
    billingInvoice: {
      updateMany: async ({ data }) => {
        status = data.status;
        return { count: 1 };
      },
    },
  };
  const billing = service(
    {
      ...tx,
      $transaction: async (fn) => fn(tx),
      billingInvoice: { ...tx.billingInvoice, findUnique: async () => invoice },
    },
    {
      payWithBillingKey: async () => {
        charges++;
      },
    }
  );
  await assert.rejects(billing.chargeInvoice('i3'));
  assert.equal(charges, 0);
  assert.equal(status, 'void');
});
