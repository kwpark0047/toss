jest.mock('../../../config/prisma', () => ({
  chat_rooms: { findUnique: jest.fn() },
  orders: { findUnique: jest.fn() },
}));
jest.mock('../../../middleware/storeAuth', () => ({ getStoreRole: jest.fn() }));
jest.mock('../../../utils/phoneEncryption', () => ({
  phoneSearchCandidates: jest.fn((phone) => [phone, `enc_${phone}`]),
}));

const prisma = require('../../../config/prisma');
const { getStoreRole } = require('../../../middleware/storeAuth');
const Chat = require('../../../repositories/Chat');

describe('Chat repository membership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.chat_rooms.findUnique.mockResolvedValue({
      id: 8,
      type: 'STORE_CUSTOMER',
      store_id: 3,
      customer_id: null,
      customer_phone: 'enc_01012345678',
      is_active: true,
    });
  });

  test('denies an authenticated user without store or customer membership', async () => {
    getStoreRole.mockResolvedValue(null);
    const membership = await Chat.authorizeRoom(8, {
      user: { id: 77, role: 'owner' },
    });

    expect(membership).toBeNull();
  });

  test('derives a store sender type from the actual store role', async () => {
    getStoreRole.mockResolvedValue('manager');
    const membership = await Chat.authorizeRoom(8, {
      user: { id: 7, role: 'owner' },
    });

    expect(membership).toEqual(expect.objectContaining({
      senderId: 7,
      senderType: 'manager',
    }));
    expect(getStoreRole).toHaveBeenCalledWith(7, 3);
  });

  test('accepts only an order capability bound to the room store and customer', async () => {
    prisma.orders.findUnique.mockResolvedValue({ store_id: 3, customer_phone: '01012345678' });

    const allowed = await Chat.authorizeRoom(8, {
      capability: { orderId: 10, storeId: 3 },
    });
    const denied = await Chat.authorizeRoom(8, {
      capability: { orderId: 10, storeId: 999 },
    });

    expect(allowed).toEqual(expect.objectContaining({ senderId: null, senderType: 'customer' }));
    expect(denied).toBeNull();
  });
});
