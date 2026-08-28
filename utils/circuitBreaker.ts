import logger from './logger.js';

export interface CircuitBreakerOptions {
  name?: string;
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  timeoutMs?: number;
  fallback?: ((...args: any[]) => Promise<any>) | null;
}

export interface CircuitBreakerStats {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  failureCount: number;
  successCount: number;
  lastFailureAt: string | null;
  nextAttemptAt: number | null;
}

export class CircuitBreaker {
  private fn: ((...args: any[]) => Promise<any>) | null;
  private options: CircuitBreakerOptions;
  public state: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  public failureCount: number;
  public successCount: number;
  public nextAttempt: number;
  public lastFailureAt: string | null;
  public name: string | null;
  public failureThreshold: number;
  public successThreshold: number;
  public timeout: number;
  public fallback: ((...args: any[]) => Promise<any>) | null;

  constructor(nameOrFn: string | ((...args: any[]) => Promise<any>), options: CircuitBreakerOptions = {}) {
    if (typeof nameOrFn === 'function') {
      this.fn = nameOrFn;
      this.options = options;
    } else {
      this.name = nameOrFn;
      this.options = options;
      this.fn = null;
    }

    this.state = 'CLOSED';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || options.timeoutMs || 30000;
    this.fallback = options.fallback || null;

    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastFailureAt = null;
  }

  get stats(): CircuitBreakerStats {
    return {
      name: this.name || this.options?.name || 'unknown',
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureAt: this.lastFailureAt,
      nextAttemptAt: this.nextAttempt,
    };
  }

  async call(fnOrArgs: Function | any, ...extraArgs: any[]): Promise<any> {
    const fn = typeof fnOrArgs === 'function' ? fnOrArgs : this.fn;
    if (!fn) throw new Error('No function provided to CircuitBreaker.call');

    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF-OPEN';
        if (logger.warn) logger.warn('Circuit breaker entering HALF-OPEN state', { state: this.state });
      } else {
        if (this.options.timeoutMs && fnOrArgs === 'timeout') {
          throw new Error(`요청 타임아웃 (${this.options.timeoutMs}ms)`);
        }
        if (this.fallback) return this.fallback(...extraArgs);
        throw new Error('Circuit is OPEN');
      }
    }

    if (this.options.timeoutMs && typeof fnOrArgs === 'function') {
      let timer: ReturnType<typeof setTimeout>;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => { reject(new Error(`요청 타임아웃 (${this.options.timeoutMs}ms)`)); }, this.options.timeoutMs);
        });
        const result = await Promise.race([fn(), timeoutPromise]);
        clearTimeout(timer);
        return this.onSuccess(result);
      } catch (err) {
        if (timer) clearTimeout(timer);
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
          this.state = 'OPEN';
          this.nextAttempt = Date.now() + this.timeout;
        }
        throw err;
      }
    }

    try {
      const result = await fn(...extraArgs);
      return this.onSuccess(result);
    } catch (err: any) {
      return this.onFailure(err, ...extraArgs);
    }
  }

  onSuccess(result: any): any {
    this.failureCount = 0;
    if (this.state === 'HALF-OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        if (logger.info) logger.info('Circuit breaker state recovered to CLOSED');
      }
    }
    return result;
  }

  onFailure(err: Error, ...args: any[]): any {
    this.failureCount++;
    this.lastFailureAt = new Date().toISOString();
    if (logger.error) logger.error('External API call failed', { error: err.message, failureCount: this.failureCount });

    if (this.state === 'HALF-OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      if (logger.error) logger.error('Circuit breaker tripped to OPEN', { nextAttempt: new Date(this.nextAttempt).toISOString() });

      if (this.fallback) {
        return this.fallback(...args);
      }
      throw err;
    }
  }

  public fire(...args: any[]): Promise<any> {
    return this.call(this.fn, ...args);
  }
}

const registry = new Map<string, CircuitBreaker>();

export const get = (name: string, options?: CircuitBreakerOptions): CircuitBreaker => {
  if (!registry.has(name)) registry.set(name, new CircuitBreaker(name, options));
  return registry.get(name)!;
};

export const allStats = (): CircuitBreakerStats[] => [...registry.values()].map((cb) => cb.stats);

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly isCircuitOpen: boolean = false) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export { get, allStats, CircuitBreaker };
