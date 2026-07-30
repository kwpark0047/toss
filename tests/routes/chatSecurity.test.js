const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'chat-route-test-secret';
process.env.ORDER_CAPABILITY_SECRET = 'chat-order-capability-secret';

const mockChat = {
  accessCustomerRoom: jest.fn(),
  accessRoom: jest.fn(),
  authorizeRoom: jest.fn(),
  getAdminRooms: jest.fn(),
  getMessages: jest.fn(),
  markAsRead: jest.fn(),
  sendMessage: jest.fn(),
};
jest.mock('../../repositories/Chat', () => mockChat);

const { createOrderCapability } = require('../../utils/orderCapability');

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/chat', require('../../routes/chat'));
  instance.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return instance;
}

describe('chat HTTP security', () => {
  beforeEach(() => jest.clearAllMocks());

  test('customer room access uses the order capability and ignores client identity fields', async () => {
    const capability = createOrderCapability({ id: 10, store_id: 3 });
    mockChat.accessCustomerRoom.mockResolvedValue({ id: 8, store_id: 3 });

    const response = await request(app())
      .post('/api/chat/rooms/access')
      .set('x-order-capability', capability)
      .send({ store_id: 999, customer_phone: 'victim', customer_id: 999 });

    expect(response.status).toBe(200);
    expect(mockChat.accessCustomerRoom).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 10,
      storeId: 3,
    }));
  });

  test('denies message history when the requester is not a room member', async () => {
    mockChat.authorizeRoom.mockResolvedValue(null);
    const response = await request(app()).get('/api/chat/rooms/8/messages');

    expect(response.status).toBe(403);
    expect(mockChat.getMessages).not.toHaveBeenCalled();
  });

  test('derives sender id and type from verified membership', async () => {
    const token = jwt.sign({ id: 5, role: 'owner', type: 'access' }, process.env.JWT_SECRET);
    mockChat.authorizeRoom.mockResolvedValue({
      room: { id: 8, type: 'STORE_CUSTOMER' },
      senderId: 5,
      senderType: 'manager',
    });
    mockChat.sendMessage.mockResolvedValue({ id: 20, room_id: 8, sender_type: 'manager' });

    const response = await request(app())
      .post('/api/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ room_id: 8, content: 'hello', sender_type: 'super_admin' });

    expect(response.status).toBe(200);
    expect(mockChat.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      room_id: 8,
      sender_id: 5,
      sender_type: 'manager',
      content: 'hello',
    }));
  });

  test('derives read filtering from membership instead of request body', async () => {
    mockChat.authorizeRoom.mockResolvedValue({ senderType: 'customer', room: { id: 8 } });
    const response = await request(app())
      .patch('/api/chat/rooms/8/read')
      .send({ sender_type_not: 'super_admin' });

    expect(response.status).toBe(200);
    expect(mockChat.markAsRead).toHaveBeenCalledWith('8', 'customer');
  });
});
