const logger = require('./logger');

class CircuitBreaker {
  constructor(nameOrFn, options = {}) {
    if (typeof nameOrFn === 'function') {
      this.fn = nameOrFn;
      this.options = options;
    } else {
      this.name = nameOrFn;
      this.options = options;
      this.fn = null;
    }

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF-OPEN
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || options.timeoutMs || 30000;
    this.fallback = options.fallback || null;

    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  async call(fnOrArgs, ...extraArgs) {
    const fn = typeof fnOrArgs === 'function' ? fnOrArgs : this.fn;
    if (!fn) throw new Error('No function provided to CircuitBreaker.call');

    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF-OPEN';
        if (logger.warn)
          logger.warn({ state: this.state }, 'Circuit breaker entering HALF-OPEN state');
      } else {
        if (this.options.timeoutMs && fnOrArgs === 'timeout') {
          throw new Error(`요청 타임아웃 (${this.options.timeoutMs}ms)`);
        }
        if (this.fallback) return this.fallback(...extraArgs);
        throw new Error('Circuit is OPEN');
      }
    }

    if (this.options.timeoutMs && typeof fnOrArgs === 'function') {
      let timer;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`요청 타임아웃 (${this.options.timeoutMs}ms)`));
          }, this.options.timeoutMs);
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
    } catch (err) {
      return this.onFailure(err, ...extraArgs);
    }
  }

  async fire(...args) {
    return this.call(this.fn, ...args);
  }

  onSuccess(result) {
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

  onFailure(err, ...args) {
    this.failureCount++;
    if (logger.error)
      logger.error(
        { error: err.message, failureCount: this.failureCount },
        'External API call failed'
      );

    if (this.state === 'HALF-OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      if (logger.error)
        logger.error(
          { nextAttempt: new Date(this.nextAttempt).toISOString() },
          'Circuit breaker tripped to OPEN'
        );
    }

    if (this.fallback) {
      return this.fallback(...args);
    }
    throw err;
  }
}

module.exports = { CircuitBreaker };
