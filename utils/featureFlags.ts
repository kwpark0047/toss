import crypto from 'crypto';

interface FeatureFlag {
  enabled?: boolean;
  rollout_percent?: number;
}

interface Flags {
  [key: string]: boolean | FeatureFlag;
}

const parseFlags = (): Record<string, boolean | FeatureFlag> => {
  const raw = process.env.FEATURE_FLAGS_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const rolloutBucket = (key: string, subject: string): number => {
  const digest = crypto.createHash('sha256').update(`${key}:${subject}`).digest();
  return digest.readUInt32BE(0) % 100;
};

export const isEnabled = (key: string, { userId = 'anonymous', storeId = 'global' } = {}): boolean => {
  if (!key || typeof key !== 'string') return false;
  const flag = parseFlags()[key];
  if (typeof flag === 'boolean') return flag;
  if (!flag || flag.enabled !== true) return false;

  const rollout = Number.isInteger(flag.rollout_percent) ? flag.rollout_percent : 100;
  if (rollout <= 0) return false;
  if (rollout >= 100) return true;
  return rolloutBucket(key, `${userId}:${storeId}`) < rollout;
};

export const getAll = (): Record<string, boolean | FeatureFlag> => parseFlags();

export const rolloutBucket = (key: string, subject: string): number => {
  const digest = crypto.createHash('sha256').update(`${key}:${subject}`).digest();
  return digest.readUInt32BE(0) % 100;
};

export default { isEnabled, getAll, rolloutBucket };