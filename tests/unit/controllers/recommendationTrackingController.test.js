jest.mock('../../../services/RecommendationTrackingService', () => ({
  recordConversion: jest.fn(),
}));
const service = require('../../../services/RecommendationTrackingService');
const controller = require('../../../controllers/recommendationTrackingController');

test.each([1234n, null])(
  'conversion response serializes Prisma duration %s without losing precision',
  async (duration) => {
    service.recordConversion.mockResolvedValue({
      id: 'qa-conversion',
      order_id: 42,
      conversion_value: 1000,
      time_to_conversion_ms: duration,
    });
    const res = { created: jest.fn((data) => JSON.stringify(data)) };
    const next = jest.fn();
    await controller.recordConversion(
      {
        body: {
          storeId: 7,
          sessionId: 'qa',
          orderId: 42,
          menuId: 1,
          recommendationType: 'qa_test',
          impressionId: 'qa-impression',
        },
      },
      res,
      next
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.created).toHaveBeenCalledWith(
      expect.objectContaining({ time_to_conversion_ms: duration === null ? null : '1234' }),
      expect.any(String)
    );
  }
);
