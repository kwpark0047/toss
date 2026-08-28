// DataLoader implementation - simplified version
import DataLoader from 'dataloader';
import db from '../config/prisma.js';

export const createLoader = <T, K extends string | number>(
  batchFn: (keys: K[]) => Promise<Map<K, any>>,
  options: any = {}
) => {
  return new DataLoader(batchFn, {
    cacheKeyFn: key => String(key),
    maxBatchSize: options.maxBatchSize || 100,
    cacheMap: options.cacheMap || new Map(),
    ...options,
  });
};

// Export all loaders
export const createLoader = createLoader;
export { default as db } from '../config/prisma.js';