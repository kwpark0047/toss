// DataLoader implementation - simplified version without external dependency
import db from '../config/prisma.js';

class SimpleDataLoader<K extends string | number, V> {
  private cache = new Map<string, Promise<V>>();

  constructor(
    private batchFn: (keys: K[]) => Promise<Map<K, V>>,
    private options: { cacheKeyFn?: (key: K) => string; cacheMap?: Map<string, Promise<V>> } = {}
  ) {
    if (options.cacheMap) this.cache = options.cacheMap;
  }

  load(key: K): Promise<V> {
    const cacheKey = this.options.cacheKeyFn ? this.options.cacheKeyFn(key) : String(key);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const promise = this.batchFn([key]).then((result) => result.get(key) as V);
    this.cache.set(cacheKey, promise);
    return promise;
  }

  clear(key: K): this {
    const cacheKey = this.options.cacheKeyFn ? this.options.cacheKeyFn(key) : String(key);
    this.cache.delete(cacheKey);
    return this;
  }

  clearAll(): this {
    this.cache.clear();
    return this;
  }
}

export const createLoader = <T, K extends string | number>(
  batchFn: (keys: K[]) => Promise<Map<K, any>>,
  options: any = {}
) => {
  return new SimpleDataLoader<K, T>(batchFn, {
    cacheKeyFn: key => String(key),
    cacheMap: options.cacheMap || new Map(),
  });
};

// Export all loaders
export { default as db } from '../config/prisma.js';
