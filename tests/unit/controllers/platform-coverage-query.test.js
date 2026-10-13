jest.mock('../../../config/prisma', () => ({ $queryRaw: jest.fn(), stores: { count: jest.fn() } }));
jest.mock('../../../utils/logger', () => ({}));
jest.mock('../../../repositories/Store', () => ({}));
jest.mock('../../../services/StoreInfoEnhancementService', () => ({}));
const db = require('../../../config/prisma');
const { getEnrichmentCoverage } = require('../../../controllers/platformController');
test('coverage uses one aggregate connection and preserves missing counts', async () => {
  db.$queryRaw.mockResolvedValue([
    {
      total: 10n,
      phone: 2n,
      business_type: 1n,
      latitude: 0n,
      longitude: 0n,
      open_time: 3n,
      description: 4n,
      business_number: 5n,
      ceo_name: 6n,
      business_address: 7n,
    },
  ]);
  const res = { success: jest.fn() };
  const next = jest.fn();
  await getEnrichmentCoverage({}, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  expect(db.stores.count).not.toHaveBeenCalled();
  expect(res.success).toHaveBeenCalledWith(
    expect.objectContaining({
      totalStores: 10,
      overallScore: 69,
      coverage: expect.objectContaining({ phone: { label: '전화번호', missing: 2 } }),
    })
  );
});
