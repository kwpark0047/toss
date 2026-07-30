import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearUserCaches } from '../utils/userCaches';

describe('clearUserCaches', () => {
  beforeEach(() => {
    globalThis.caches = {
      keys: vi.fn().mockResolvedValue(['wemarket-api', 'wemarket-api-stale', 'wemarket-uploads']),
      delete: vi.fn().mockResolvedValue(true),
    };
  });

  it('purges private API caches without deleting public asset caches', async () => {
    await clearUserCaches();

    expect(caches.delete).toHaveBeenCalledWith('wemarket-api');
    expect(caches.delete).toHaveBeenCalledWith('wemarket-api-stale');
    expect(caches.delete).not.toHaveBeenCalledWith('wemarket-uploads');
  });
});
