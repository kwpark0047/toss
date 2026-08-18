const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { rolloutBucket, getAll: getEnvFlags } = require('../utils/featureFlags');

const KEY_PATTERN = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/;

const validateKey = (key) => {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key) || key.length > 100) {
    throw new AppError('Feature Flag key 형식이 올바르지 않습니다.', 400);
  }
  return key;
};

const validateRollout = (value) => {
  const rollout = Number(value);
  if (!Number.isInteger(rollout) || rollout < 0 || rollout > 100) {
    throw new AppError('rollout_percent는 0에서 100 사이의 정수여야 합니다.', 400);
  }
  return rollout;
};

const evaluate = (flag, { userId = 'anonymous', storeId = 'global' } = {}) => {
  if (!flag?.enabled) return false;
  if (flag.rollout_percent >= 100) return true;
  return rolloutBucket(flag.key, `${userId}:${storeId}`) < flag.rollout_percent;
};

const FeatureFlagService = {
  async isEnabled(key, context = {}) {
    validateKey(key);
    if (!prisma.feature_flags) {
      const envFlag = getEnvFlags()[key];
      return typeof envFlag === 'boolean' ? envFlag : evaluate({ key, ...envFlag }, context);
    }

    const flags = await prisma.feature_flags.findMany({
      where: {
        key,
        environment: process.env.NODE_ENV || 'production',
        OR: [{ store_id: context.storeId || null }, { store_id: null }],
      },
      orderBy: { store_id: 'desc' },
      take: 1,
    });
    return evaluate(flags[0], context);
  },

  async list({ environment = process.env.NODE_ENV || 'production', storeId } = {}) {
    if (!prisma.feature_flags) {
      return Object.entries(getEnvFlags()).map(([key, value]) => ({
        key,
        ...(typeof value === 'boolean' ? { enabled: value, rollout_percent: 100 } : value),
        environment,
        store_id: null,
      }));
    }
    return prisma.feature_flags.findMany({
      where: {
        environment,
        ...(storeId ? { store_id: Number.parseInt(storeId, 10) } : {}),
      },
      orderBy: [{ updated_at: 'desc' }, { key: 'asc' }],
    });
  },

  async upsert({
    key,
    description = null,
    enabled = false,
    rollout_percent = 100,
    environment = 'production',
    store_id = null,
  }) {
    const safeKey = validateKey(key);
    const rollout = validateRollout(rollout_percent);
    if (typeof enabled !== 'boolean') throw new AppError('enabled는 boolean이어야 합니다.', 400);
    if (!prisma.feature_flags)
      throw new AppError('Feature Flag 저장소가 준비되지 않았습니다.', 503);

    return prisma.feature_flags.upsert({
      where: { key: safeKey },
      create: {
        key: safeKey,
        description,
        enabled,
        rollout_percent: rollout,
        environment,
        store_id: store_id ? Number.parseInt(store_id, 10) : null,
      },
      update: {
        description,
        enabled,
        rollout_percent: rollout,
        environment,
        store_id: store_id ? Number.parseInt(store_id, 10) : null,
      },
    });
  },

  async remove(key) {
    validateKey(key);
    if (!prisma.feature_flags)
      throw new AppError('Feature Flag 저장소가 준비되지 않았습니다.', 503);
    return prisma.feature_flags.delete({ where: { key } });
  },
};

module.exports = FeatureFlagService;
