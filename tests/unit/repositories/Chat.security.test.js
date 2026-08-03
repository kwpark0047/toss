jest.mock('../../../config/prisma', () => ({
  chat_rooms: { findUnique: jest.fn() },
}));

const prisma = require('../../../config/prisma');
const Chat = require('../../../repositories/Chat');

describe('Chat repository membership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('방 멤버가 아닌 사용자는 거부한다', async () => {
    prisma.chat_rooms.findUnique.mockResolvedValue({
      id: 8,
      type: 'STORE_CUSTOMER',
      users: [{ id: 5, sender_type: 'owner' }],
    });

    const membership = await Chat.authorizeRoom(8, { user: { id: 77, role: 'owner' } });

    expect(membership).toBeNull();
  });

  test('방 멤버의 실제 sender_type을 반환한다', async () => {
    prisma.chat_rooms.findUnique.mockResolvedValue({
      id: 8,
      type: 'STORE_CUSTOMER',
      users: [{ id: 7, sender_type: 'manager' }],
    });

    const membership = await Chat.authorizeRoom(8, { user: { id: 7, role: 'owner' } });

    expect(membership).toEqual(
      expect.objectContaining({
        senderType: 'manager',
        room: { id: 8 },
      })
    );
  });

  test('존재하지 않는 방은 거부한다', async () => {
    prisma.chat_rooms.findUnique.mockResolvedValue(null);

    const membership = await Chat.authorizeRoom(999, { user: { id: 7 } });

    expect(membership).toBeNull();
  });
});
