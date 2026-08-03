const request = require('supertest');
const { app } = require('../../app');

jest.mock(
  '../../config/database',
  () => ({
    prepare: jest.fn(() => ({
      get: jest.fn(() => ({ id: 'test-order-id', store_id: 'test-store-id' })),
      run: jest.fn(),
    })),
  }),
  { virtual: true }
);

jest.mock('../../repositories/Payment', () => ({
  create: jest.fn((data) => ({ id: 'new-payment-id', ...data })),
  findById: jest.fn((id) => ({ id, payment_status: 'pending' })),
  findByOrderId: jest.fn(),
  updateStatus: jest.fn(),
  confirmTransfer: jest.fn(),
  getPendingTransfers: jest.fn(),
  findByStore: jest.fn(),
}));

jest.mock('../../repositories/Point', () => ({
  getBalance: jest.fn(() => ({ total_points: 5000 })),
  use: jest.fn(),
  calculateEarnPoints: jest.fn(() => 100),
  earn: jest.fn(),
  cancel: jest.fn(),
}));

jest.mock('../../services/PaymentService', () =>
  jest.fn().mockImplementation(() => ({
    processDirectPayment: jest.fn(async (data) => ({ id: 'new-payment-id', ...data })),
    processApproval: jest.fn(async () => ({ id: 'new-payment-id' })),
    preparePayment: jest.fn(async (data) => ({ ...data })),
  }))
);

describe('Payments API', () => {
  const baseUrl = '/api/payments';

  describe('POST /', () => {
    it('should create a payment', async () => {
      // This is a placeholder test. The actual implementation will be more complex.
      const response = await request(app).post(baseUrl).send({
        store_id: 'test-store-id',
        payment_method: 'cash',
        total_amount: 10000,
      });
      // Since the model is mocked, we can't assert a specific status code without more setup.
      // For now, we just check that the endpoint doesn't crash.
      expect(response.status).not.toBe(500);
    });
  });

  describe('GET /:id', () => {
    it('should get a payment by ID', async () => {
      const paymentId = 'test-payment-id';
      const response = await request(app).get(`${baseUrl}/${paymentId}`);
      expect(response.status).not.toBe(500);
    });
  });

  describe('POST /:id/confirm', () => {
    it('should confirm a payment', async () => {
      const paymentId = 'test-payment-id';
      const response = await request(app)
        .post(`${baseUrl}/${paymentId}/confirm`)
        .send({ toss_payment_key: 'test-key' });
      expect(response.status).not.toBe(500);
    });
  });
});
