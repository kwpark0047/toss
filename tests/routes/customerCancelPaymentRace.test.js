// Real order/payment/compensation services; deterministic in-memory transactions
// and a fake PG. This verifies interleavings, not PostgreSQL lock semantics.
jest.mock('../../config/prisma', () => ({ $transaction: jest.fn(), orders: {}, payments: {} }));
jest.mock('../../repositories/Order', () => ({ findById: jest.fn() }));
jest.mock('../../utils/toss', () => ({
  confirmPayment: jest.fn(),
  getPayment: jest.fn(),
  cancelPayment: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../utils/sentry', () => ({ captureMessage: jest.fn(), captureException: jest.fn() }));
jest.mock('../../utils/alerting', () => ({ send: jest.fn().mockResolvedValue({}) }));
jest.mock('../../utils/errorHandler', () => ({
  AppError: class extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
jest.mock('../../services/notificationService', () => ({}));
jest.mock('../../services/DashboardBroadcastService', () => ({}));
jest.mock('../../services/webhookDispatcher', () => ({}));
jest.mock('../../services/printService', () => ({}));
jest.mock('../../services/PointsService', () => ({
  calculateEarnPoints: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../services/LedgerService', () => ({ recordIncome: jest.fn() }));
jest.mock('../../services/AnomalyDetectionService', () => ({ checkSalesAnomaly: jest.fn() }));
jest.mock('../../services/PaymentWebhookInbox', () => ({
  run: jest.fn(async (event, execute) => execute(event)),
}));

const prisma = require('../../config/prisma');
const gateway = require('../../utils/toss');
const ledger = require('../../services/LedgerService');
const alerts = require('../../utils/alerting');
const Order = require('../../repositories/Order');
const OrderService = require('../../services/OrderService');
const PaymentService = require('../../services/PaymentService');
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const copy = (value) => (value ? { ...value } : null);
let state, tx, queue, orderService, paymentService, entered, release, expectedPgCalls;
const matches = (row, where) =>
  Object.entries(where).every(([key, value]) =>
    value && typeof value === 'object' ? value.in.includes(row[key]) : row[key] === value
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(require('node:net').Socket.prototype, 'connect').mockImplementation(() => {
    throw Error('Network forbidden in service race fixture');
  });
  state = {
    order: {
      id: 10,
      store_id: 3,
      order_number: 'FIXTURE-10',
      status: 'pending',
      payment_status: 'pending',
      total_amount: 1000,
      customer_phone: null,
    },
    payment: {
      id: 20,
      order_id: 10,
      store_id: 3,
      toss_transaction_id: 'FIXTURE-10',
      status: 'READY',
      method: 'CARD',
      amount: 1000,
      payment_key: null,
    },
    provider: 'READY',
    income: [],
  };
  queue = Promise.resolve();
  tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 10 }]),
    orders: {
      findUnique: jest.fn(async () => copy(state.order)),
      updateMany: jest.fn(async ({ where, data }) => {
        if (!matches(state.order, where)) return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }) => {
        Object.assign(state.order, data);
        return copy(state.order);
      }),
    },
    payments: {
      findFirst: jest.fn(async ({ where }) =>
        matches(state.payment, where) ? copy(state.payment) : null
      ),
      findMany: jest.fn(async ({ where }) =>
        matches(state.payment, where) ? [copy(state.payment)] : []
      ),
      aggregate: jest.fn(async () => ({
        _sum: { amount: state.payment.status === 'DONE' ? state.payment.amount : 0 },
      })),
      updateMany: jest.fn(async ({ where, data }) => {
        if (!matches(state.payment, where)) return { count: 0 };
        Object.assign(state.payment, data);
        return { count: 1 };
      }),
    },
  };
  prisma.orders = tx.orders;
  prisma.payments = tx.payments;
  prisma.$transaction.mockImplementation((callback) => {
    const result = queue.then(async () => {
      const snapshot = {
        order: copy(state.order),
        payment: copy(state.payment),
        income: [...state.income],
      };
      try {
        return await callback(tx);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    });
    queue = result.catch(() => {});
    return result;
  });
  Order.findById.mockImplementation(async () => copy(state.order));
  ledger.recordIncome.mockImplementation(async (entry) => {
    state.income.push(entry);
  });
  orderService = new OrderService();
  jest.spyOn(orderService, '_revertPointsOnCancel').mockResolvedValue();
  paymentService = new PaymentService();
  jest.spyOn(paymentService, '_upsertCustomer').mockResolvedValue();
  entered = deferred();
  release = deferred();
  expectedPgCalls = 1;
  gateway.confirmPayment.mockImplementation(async () => {
    if (gateway.confirmPayment.mock.calls.length === expectedPgCalls) entered.resolve();
    await release.promise;
    state.provider = 'DONE';
    return { paymentKey: 'fixture-payment-key', totalAmount: 1000, method: 'CARD' };
  });
  gateway.getPayment.mockImplementation(async (key) => ({
    paymentKey: key,
    status: state.provider,
    balanceAmount: state.provider === 'CANCELED' ? 0 : 1000,
    totalAmount: 1000,
  }));
  gateway.cancelPayment.mockImplementation(async (key) => {
    state.provider = 'CANCELED';
    return { paymentKey: key, status: 'CANCELED', balanceAmount: 0 };
  });
});
afterEach(() => jest.restoreAllMocks());
const approve = () =>
  paymentService.processApproval('fixture-payment-key', 'FIXTURE-10', 1000, null, 20);

test('PG READY blocks customer cancellation while approval is in flight', async () => {
  const approval = approve();
  await entered.promise;
  await expect(orderService.customerCancelOrder(10)).rejects.toMatchObject({ statusCode: 409 });
  release.resolve();
  await expect(approval).resolves.toMatchObject({ success: true });
  expect(state.order.payment_status).toBe('paid');
  expect(state.payment.status).toBe('DONE');
  expect(state.income).toHaveLength(1);
  expect(gateway.cancelPayment).not.toHaveBeenCalled();
});

test('a counter READY cancellation winning in-flight approval triggers real compensation logic', async () => {
  state.payment.method = 'CASH';
  const approval = approve().catch((error) => error);
  await entered.promise;
  await orderService.customerCancelOrder(10);
  release.resolve();
  expect(await approval).toMatchObject({ statusCode: 409 });
  expect(state.order.status).toBe('cancelled');
  expect(state.payment.status).toBe('CANCELED');
  expect(state.provider).toBe('CANCELED');
  expect(gateway.cancelPayment).toHaveBeenCalledWith(
    'fixture-payment-key',
    '취소된 주문 결제 자동 취소',
    1000,
    expect.stringMatching(/^auto-cancel:/)
  );
  expect(state.income).toHaveLength(0);
});

test('failed compensation stays an error and emits manual review instead of recording income', async () => {
  state.payment.method = 'STORE_CARD';
  gateway.cancelPayment.mockRejectedValue(Error('fixture unavailable'));
  const approval = approve().catch((error) => error);
  await entered.promise;
  await orderService.customerCancelOrder(10);
  release.resolve();
  expect(await approval).toMatchObject({ statusCode: 409 });
  expect(state.provider).toBe('DONE');
  expect(state.income).toHaveLength(0);
  expect(alerts.send).toHaveBeenCalledWith(
    expect.objectContaining({ meta: expect.objectContaining({ autoCanceled: false }) })
  );
});

test('approval winning prevents cancellation and repeated approval does not duplicate income', async () => {
  release.resolve();
  await approve();
  await expect(orderService.customerCancelOrder(10)).rejects.toMatchObject({ statusCode: 409 });
  await approve();
  expect(state.income).toHaveLength(1);
  expect(gateway.confirmPayment).toHaveBeenCalledTimes(1);
});

test('two in-flight approvals of the same payment record income only once', async () => {
  expectedPgCalls = 2;
  const approvals = [approve(), approve()];
  await entered.promise;
  expect(gateway.confirmPayment).toHaveBeenCalledTimes(2);
  release.resolve();
  await Promise.all(approvals);
  expect(state.payment.status).toBe('DONE');
  expect(state.income).toHaveLength(1);
  expect(gateway.cancelPayment).not.toHaveBeenCalled();
});
