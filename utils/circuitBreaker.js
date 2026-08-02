/**
 * Circuit Breaker utility for external API calls (Toss, Alimtalk, Naver, Firebase, AI)
 * Prevents cascading failures when external services are degraded or down.
 */
const { dbLogger } = require('./logger');

class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF-OPEN
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000; // 30 seconds before retry
    this.fallback = options.fallback || (() => null);

    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  async fire(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF-OPEN';
        dbLogger.warn({ state: this.state }, 'Circuit breaker entering HALF-OPEN state');
      } else {
        dbLogger.warn({ state: this.state }, 'Circuit breaker is OPEN. Executing fallback.');
        return this.fallback(...args);
      }
    }

    try {
      const result = await this.fn(...args);
      return this.onSuccess(result);
    } catch (err) {
      return this.onFailure(err, ...args);
    }
  }

  onSuccess(result) {
    this.failureCount = 0;
    if (this.state === 'HALF-OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        dbLogger.info('Circuit breaker state recovered to CLOSED');
      }
    }
    return result;
  }

  onFailure(err, ...args) {
    this.failureCount++;
    dbLogger.error(
      { error: err.message, failureCount: this.failureCount },
      'External API call failed'
    );

    if (this.state === 'HALF-OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      dbLogger.error(
        { nextAttempt: new Date(this.nextAttempt).toISOString() },
        'Circuit breaker tripped to OPEN'
      );
    }

    return this.fallback(...args);
  }
}

module.exports = CircuitBreaker;
