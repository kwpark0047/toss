describe('TossAPI mock payment guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, TOSS_SECRET_KEY: 'test_secret' };
    jest.doMock('axios', () => ({
      post: jest.fn().mockResolvedValue({ data: { status: 'PROVIDER_RESPONSE' } }),
      get: jest.fn(),
    }));
    jest.doMock('../../../utils/circuitBreaker', () => ({
      get: () => ({ call: (fn) => fn() }),
    }));
    jest.doMock('../../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('does not accept mock payment keys in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_MOCK_PAYMENTS = 'true';

    const axios = require('axios');
    const TossAPI = require('../../../utils/toss').default;
    const result = await TossAPI.confirmPayment('mock_forged', 'ORDER-1', 1000);

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.tosspayments.com/v1/payments/confirm',
      { paymentKey: 'mock_forged', orderId: 'ORDER-1', amount: 1000 },
      expect.any(Object)
    );
    expect(result).toEqual({ status: 'PROVIDER_RESPONSE' });
  });

  test('allows mock payment keys only in explicit test mode', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_MOCK_PAYMENTS = 'true';

    const axios = require('axios');
    const TossAPI = require('../../../utils/toss').default;
    const result = await TossAPI.confirmPayment('mock_allowed', 'ORDER-2', 2000);

    expect(axios.post).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ status: 'DONE', amount: 2000 }));
  });

  test('reports provider API access denial as an operational configuration error without provider IP', async () => {
    const axios = require('axios');
    axios.post.mockRejectedValue({
      response: {
        status: 403,
        data: {
          code: 'API_KEY_ACCESS_DENIED',
          message: 'API access denied for request IP: 192.0.2.12',
        },
      },
    });
    const TossAPI = require('../../../utils/toss').default;
    await expect(
      TossAPI.confirmPayment('test-payment-key', 'TEST-ORDER', 1000)
    ).rejects.toMatchObject({
      statusCode: 503,
      isOperational: true,
      code: 'PAYMENT_PROVIDER_ACCESS_DENIED',
      message:
        '결제 서버의 접근 설정을 확인해야 합니다. 매장에 문의해 주세요. 중복 결제하지 마세요.',
    });
  });

  test('sends the provider idempotency key for cancellation', async () => {
    process.env.NODE_ENV = 'production';

    const axios = require('axios');
    const TossAPI = require('../../../utils/toss').default;
    await TossAPI.cancelPayment('pay-key', '부분 환불', 1000, 'refund-key');

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.tosspayments.com/v1/payments/pay-key/cancel',
      { cancelReason: '부분 환불', cancelAmount: 1000 },
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'refund-key' }),
      })
    );
  });
});
