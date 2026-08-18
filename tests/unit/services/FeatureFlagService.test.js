jest.mock('../../../config/prisma', () => ({
  feature_flags: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../../../config/prisma');
const featureFlagService = require('../../../services/FeatureFlagService');

describe('FeatureFlagService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('DB flag를 rollout 기준으로 평가한다', async () => {
    prisma.feature_flags.findMany.mockResolvedValue([
      {
        key: 'new_kds',
        enabled: true,
        rollout_percent: 100,
      },
    ]);

    await expect(featureFlagService.isEnabled('new_kds', { userId: 1, storeId: 3 })).resolves.toBe(
      true
    );
  });

  it('flag를 upsert하고 rollout 범위를 검증한다', async () => {
    prisma.feature_flags.upsert.mockResolvedValue({ key: 'new_kds', enabled: true });

    await featureFlagService.upsert({ key: 'new_kds', enabled: true, rollout_percent: 50 });
    expect(prisma.feature_flags.upsert).toHaveBeenCalled();
    await expect(
      featureFlagService.upsert({ key: 'bad key', enabled: true })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      featureFlagService.upsert({ key: 'new_kds', enabled: true, rollout_percent: 101 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('flag 목록과 삭제를 지원한다', async () => {
    prisma.feature_flags.findMany.mockResolvedValue([]);
    prisma.feature_flags.delete.mockResolvedValue({ key: 'new_kds' });

    await expect(featureFlagService.list()).resolves.toEqual([]);
    await featureFlagService.remove('new_kds');
    expect(prisma.feature_flags.delete).toHaveBeenCalledWith({ where: { key: 'new_kds' } });
  });
});
