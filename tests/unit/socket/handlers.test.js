const prisma = require('../../../config/prisma');
const { getStoreRole } = require('../../../middleware/storeAuth');

jest.mock('../../../config/prisma', () => ({
  products: { findMany: jest.fn(), updateMany: jest.fn() },
}));
jest.mock('../../../middleware/storeAuth', () => ({ getStoreRole: jest.fn() }));
jest.mock('../../../utils/phoneEncryption', () => ({ phoneSearchCandidates: jest.fn(() => []) }));
jest.mock('../../../services/AlimtalkService', () => ({}));

const { registerSocketHandlers } = require('../../../socket/handlers');

function createHarness(user = null) {
  const handlers = {};
  const roomEmitter = { emit: jest.fn() };
  const socket = {
    id: 'socket-1',
    data: { user },
    join: jest.fn(),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    emit: jest.fn(),
  };
  const io = {
    on: jest.fn((event, handler) => {
      if (event === 'connection') handler(socket);
    }),
    to: jest.fn(() => roomEmitter),
    sockets: { adapter: { rooms: new Map() } },
  };

  registerSocketHandlers(io);
  return { handlers, io, roomEmitter, socket };
}

describe('Socket.IO protected events', () => {
  beforeEach(() => jest.clearAllMocks());

  test('anonymous clients cannot join a store room', async () => {
    const { handlers, socket } = createHarness();
    const ack = jest.fn();

    await handlers['join-store']({ storeId: 10, userId: 999 }, ack);

    expect(socket.join).not.toHaveBeenCalled();
    expect(getStoreRole).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 'FORBIDDEN' }));
  });

  test('joins only rooms derived from the verified user identity', async () => {
    getStoreRole.mockResolvedValue('owner');
    const { handlers, socket } = createHarness({ id: 7, role: 'owner', type: 'access' });
    const ack = jest.fn();

    await handlers['join-store']({ storeId: 10, userId: 999, role: 'super_admin' }, ack);

    expect(getStoreRole).toHaveBeenCalledWith(7, 10);
    expect(socket.join).toHaveBeenCalledWith('store - 10');
    expect(socket.join).toHaveBeenCalledWith('user - 7');
    expect(socket.join).not.toHaveBeenCalledWith('user - 999');
    expect(ack).toHaveBeenCalledWith({ ok: true, role: 'owner' });
  });

  test('only super administrators can join the admin room', () => {
    const denied = createHarness({ id: 7, role: 'owner', type: 'access' });
    const deniedAck = jest.fn();
    denied.handlers['join-admin'](deniedAck);

    expect(denied.socket.join).not.toHaveBeenCalled();
    expect(deniedAck).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));

    const allowed = createHarness({ id: 1, role: 'super_admin', type: 'access' });
    allowed.handlers['join-admin']();
    expect(allowed.socket.join).toHaveBeenCalledWith('admin');
    expect(allowed.socket.join).toHaveBeenCalledWith('user - 1');
  });

  test('anonymous clients cannot mutate sold-out state', async () => {
    const { handlers } = createHarness();
    const ack = jest.fn();

    await handlers['trigger-ingredient-sold-out']({ storeId: 10, ingredientName: 'milk' }, ack);

    expect(prisma.products.findMany).not.toHaveBeenCalled();
    expect(prisma.products.updateMany).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  test('authorized managers can update matching products', async () => {
    getStoreRole.mockResolvedValue('manager');
    prisma.products.findMany.mockResolvedValue([
      { id: 1, ingredients: 'coffee, milk' },
      { id: 2, ingredients: 'tea' },
    ]);
    prisma.products.updateMany.mockResolvedValue({ count: 1 });
    const { handlers, io } = createHarness({ id: 7, role: 'user', type: 'access' });
    const ack = jest.fn();

    await handlers['trigger-ingredient-sold-out']({ storeId: 10, ingredientName: ' Milk ' }, ack);

    expect(prisma.products.findMany).toHaveBeenCalledWith({
      where: { store_id: 10, is_active: true },
    });
    expect(prisma.products.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] } },
      data: { is_sold_out: true },
    });
    expect(io.to).toHaveBeenCalledWith('store - 10');
    expect(ack).toHaveBeenCalledWith({ ok: true, updated: 1 });
  });
});
