jest.mock('../../../config/prisma', () => ({ orders: { findUnique: jest.fn() } }));
jest.mock('../../../utils/orderCapability', () => ({
  verifyOrderCapability: jest.fn(),
  verifyCustomerHistoryCapability: jest.fn(),
  verifyWaitingCapability: jest.fn(),
}));
const prisma = require('../../../config/prisma');
const capabilities = require('../../../utils/orderCapability');
const { registerSocketHandlers } = require('../../../socket/handlers');
function harness() {
  const handlers = {};
  const socket = {
    id: 'qa',
    data: {},
    connected: true,
    on: (name, handler) => {
      handlers[name] = handler;
    },
    join: jest.fn(),
    leave: jest.fn(),
  };
  registerSocketHandlers({ on: (_name, callback) => callback(socket) });
  return { socket, handlers };
}
beforeEach(() => {
  jest.resetAllMocks();
  prisma.orders.findUnique.mockResolvedValue({ store_id: 1 });
});
test('requires an owned order capability and matching store before joining', async () => {
  const { socket, handlers } = harness();
  const ack = jest.fn();
  capabilities.verifyOrderCapability.mockReturnValue({ orderId: 2, storeId: 1 });
  await handlers['watch-order-status']({ orderId: 2, capability: 'fixture' }, ack);
  expect(socket.join).toHaveBeenCalledWith('customer-order - 2');
  expect(ack).toHaveBeenCalledWith({ ok: true });
  handlers['unwatch-order-status']({ orderId: 2 });
  expect(socket.leave).toHaveBeenCalledWith('customer-order - 2');
});
test('rejects missing credentials and forged order ids without database reads', async () => {
  const { socket, handlers } = harness();
  const ack = jest.fn();
  await handlers['watch-order-status']({ orderId: 2 }, ack);
  capabilities.verifyOrderCapability.mockReturnValue({ orderId: 3, storeId: 1 });
  await handlers['watch-order-status']({ orderId: 2, capability: 'fixture' }, ack);
  expect(socket.join).not.toHaveBeenCalled();
  expect(prisma.orders.findUnique).not.toHaveBeenCalled();
  expect(ack).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
});
test('accepts only history-scoped orders and rejects a mismatched store', async () => {
  const { socket, handlers } = harness();
  const ack = jest.fn();
  capabilities.verifyCustomerHistoryCapability.mockReturnValue({ orderIds: [2], storeId: 1 });
  await handlers['watch-order-status']({ orderId: 2, historyCapability: 'fixture' }, ack);
  expect(socket.join).toHaveBeenCalledTimes(1);
  prisma.orders.findUnique.mockResolvedValue({ store_id: 99 });
  await handlers['watch-order-status']({ orderId: 2, historyCapability: 'fixture' }, ack);
  expect(socket.join).toHaveBeenCalledTimes(1);
});
test('does not join a room after its pending subscription was cancelled', async () => {
  const { socket, handlers } = harness();
  capabilities.verifyOrderCapability.mockReturnValue({ orderId: 2, storeId: 1 });
  let resolve;
  prisma.orders.findUnique.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const pending = handlers['watch-order-status']({ orderId: 2, capability: 'fixture' }, jest.fn());
  handlers['unwatch-order-status']({ orderId: 2 });
  resolve({ store_id: 1 });
  await pending;
  expect(socket.join).not.toHaveBeenCalled();
  expect(() => handlers['unwatch-order-status'](null)).not.toThrow();
});
