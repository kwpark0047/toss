const crypto = require('crypto');

const parseFlags = () => {
  const raw = process.env.FEATURE_FLAGS_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const rolloutBucket = (key, subject) => {
  const digest = crypto.createHash('sha256').update(`${key}:${subject}`).digest();
  return digest.readUInt32BE(0) % 100;
};

const isEnabled = (key, { userId = 'anonymous', storeId = 'global' } = {}) => {
  if (!key || typeof key !== 'string') return false;
  const flag = parseFlags()[key];
  if (typeof flag === 'boolean') return flag;
  if (!flag || flag.enabled !== true) return false;

  const rollout = Number.isInteger(flag.rollout_percent) ? flag.rollout_percent : 100;
  if (rollout <= 0) return false;
  if (rollout >= 100) return true;
  return rolloutBucket(key, `${userId}:${storeId}`) < rollout;
};

const getAll = () => parseFlags();

module.exports = { isEnabled, getAll, rolloutBucket };
