const mockPaymentClient = {
  create: jest.fn(),
  update: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
};
const mockPrisma = { payments: mockPaymentClient };
jest.mock('../../../config/prisma', () => mockPrisma);

const PaymentRepository = require('../../../app/infrastructure/prisma/PaymentRepository');

describe('PaymentRepository 카드번호 저장 시 마스킹 가드', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaymentClient.create.mockResolvedValue({ id: 'pay-1' });
    mockPaymentClient.update.mockResolvedValue({ id: 'pay-1' });
  });

  test('create: card_number가 있으면 저장 전에 마스킹된다', async () => {
    const payload = {
      order_id: 'ord-1',
      store_id: 7,
      amount: 15000,
      card_number: '1234567890123456',
    };

    await PaymentRepository.create(payload);

    expect(mockPaymentClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        card_number: '123456******3456',
      }),
    });

    expect(payload.card_number).toBe('1234567890123456');
  });

  test('update: card_number가 있으면 저장 전에 마스킹된다', async () => {
    const payload = {
      status: 'approved',
      card_number: '1234567890123456',
    };

    await PaymentRepository.update('pay-1', payload);

    expect(mockPaymentClient.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: expect.objectContaining({
        card_number: '123456******3456',
      }),
    });

    expect(payload.card_number).toBe('1234567890123456');
  });

  test('create: 이미 마스킹된 카드번호는 그대로 유지된다(멱등)', async () => {
    const payload = {
      order_id: 'ord-1',
      card_number: '123456******3456',
    };

    await PaymentRepository.create(payload);

    expect(mockPaymentClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        card_number: '123456******3456',
      }),
    });
  });

  test('create: card_number가 없으면 그대로 전달한다', async () => {
    const payload = { order_id: 'ord-1', amount: 5000, method: 'cash' };

    await PaymentRepository.create(payload);

    expect(mockPaymentClient.create).toHaveBeenCalledWith({ data: payload });
  });

  test('update: card_number가 null이면 그대로 전달한다', async () => {
    const payload = { status: 'pending', card_number: null };

    await PaymentRepository.update('pay-1', payload);

    expect(mockPaymentClient.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: payload,
    });
  });
});
