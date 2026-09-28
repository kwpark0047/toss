/**
 * Webhook Dispatcher Service with Retry & Dead Letter Queue
 *
 * Features:
 * - Exponential backoff retry with jitter
 * - Configurable retry policies per webhook type
 * - Dead Letter Queue (DLQ) for failed deliveries
 * - Automatic DLQ reprocessing
 * - Webhook signature verification
 * - Idempotency key support
 * - Delivery metrics & monitoring
 * - Circuit breaker for failing endpoints
 */

const { getRedis } = require('../config/redis');
const prisma = require('../config/prisma');
const axios = require('axios');
const crypto = require('crypto');

class WebhookDispatcherService {
  constructor() {
    this.redis = null;
    this.retryScheduler = null;
    this.circuitBreakers = new Map(); // endpoint -> { failures, lastFailure, state }
    this.CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening
    this.CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute before half-open

    // Default retry configurations by webhook type
    this.defaultRetryConfigs = {
      payment: { maxRetries: 5, baseDelay: 2000, maxDelay: 300000, backoffMultiplier: 2 },
      order: { maxRetries: 4, baseDelay: 1000, maxDelay: 120000, backoffMultiplier: 2 },
      notification: { maxRetries: 3, baseDelay: 500, maxDelay: 60000, backoffMultiplier: 1.5 },
      default: { maxRetries: 3, baseDelay: 1000, maxDelay: 60000, backoffMultiplier: 2 },
    };

    // HTTP status codes that should NOT trigger retry
    this.nonRetryableStatuses = new Set([400, 401, 403, 404, 422]);
  }

  async init() {
    this.redis = getRedis();
    if (this.redis) {
      this.redis.on('error', (e) => console.error('[WebhookDispatcher] Redis error:', e.message));
    }
    await this.startRetryScheduler();
    await this.startCircuitBreakerMonitor();
    console.log('[WebhookDispatcher] Service initialized');
  }

  /**
   * Dispatch a webhook with automatic retry handling
   */
  async dispatch(webhookData) {
    const {
      url,
      payload,
      headers = {},
      type = 'default',
      idempotencyKey,
      storeId,
      maxRetries,
      retryConfig,
      verifySignature = true,
      secret,
    } = webhookData;

    // Validate URL
    if (!url || !this.isValidUrl(url)) {
      throw new Error('Invalid webhook URL');
    }

    // Generate idempotency key if not provided
    const finalIdempotencyKey = idempotencyKey || this.generateIdempotencyKey(url, payload);

    // Check for duplicate (idempotency)
    const existing = await this.checkIdempotency(finalIdempotencyKey);
    if (existing) {
      return { success: true, idempotent: true, deliveryId: existing.id };
    }

    // Create initial delivery record
    const delivery = await this.createDeliveryRecord({
      url,
      payload,
      headers,
      type,
      idempotencyKey: finalIdempotencyKey,
      storeId,
      maxRetries: maxRetries ?? this.defaultRetryConfigs[type]?.maxRetries ?? 3,
      retryConfig: { ...this.defaultRetryConfigs[type], ...retryConfig },
      secret,
    });

    // Attempt immediate delivery
    const result = await this.attemptDelivery(delivery);

    // Schedule retry if failed and retries remaining
    if (!result.success && delivery.attempt < delivery.maxRetries) {
      await this.scheduleRetry(delivery.id, delivery.attempt + 1);
    } else if (!result.success) {
      // Max retries exceeded - move to DLQ
      await this.moveToDLQ(delivery.id, result.error);
    }

    return {
      success: result.success,
      deliveryId: delivery.id,
      statusCode: result.statusCode,
      error: result.error,
    };
  }

  /**
   * Attempt to deliver a webhook
   */
  async attemptDelivery(delivery) {
    const startTime = Date.now();
    const attempt = delivery.attempt + 1;

    try {
      // Check circuit breaker
      const cb = this.getCircuitBreaker(delivery.url);
      if (cb.state === 'open') {
        throw new Error('Circuit breaker open for this endpoint');
      }

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'WeMarket-Webhook/1.0',
        'X-WeMarket-Delivery': delivery.id,
        'X-WeMarket-Attempt': attempt,
        'X-WeMarket-Timestamp': new Date().toISOString(),
        ...delivery.headers,
      };

      // Add signature if secret provided
      if (delivery.secret && delivery.payload) {
        const signature = this.generateSignature(JSON.stringify(delivery.payload), delivery.secret);
        headers['X-WeMarket-Signature'] = signature;
      }

      // Make HTTP request
      const response = await axios({
        method: 'POST',
        url: delivery.url,
        data: delivery.payload,
        headers,
        timeout: 10000, // 10 second timeout
        validateStatus: () => true, // Don't throw on non-2xx
      });

      const latency = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      // Update circuit breaker
      this.recordCircuitBreakerResult(delivery.url, success);

      // Update delivery record
      await this.updateDeliveryRecord(delivery.id, {
        attempt,
        lastStatusCode: response.status,
        lastResponse: response.data,
        lastError: success ? null : `HTTP ${response.status}`,
        lastLatency: latency,
        nextRetryAt: success ? null : this.calculateNextRetry(delivery, attempt),
      });

      // Log to analytics
      await this.logDeliveryEvent({
        deliveryId: delivery.id,
        storeId: delivery.storeId,
        url: delivery.url,
        attempt,
        statusCode: response.status,
        success,
        latency,
        payloadSize: JSON.stringify(delivery.payload).length,
      });

      if (success) {
        await this.markDeliveryCompleted(delivery.id);
      }

      return { success, statusCode: response.status, latency };
    } catch (error) {
      const latency = Date.now() - startTime;

      // Update circuit breaker
      this.recordCircuitBreakerResult(delivery.url, false);

      // Update delivery record
      await this.updateDeliveryRecord(delivery.id, {
        attempt,
        lastStatusCode: error.response?.status || 0,
        lastResponse: error.response?.data,
        lastError: error.message,
        lastLatency: latency,
        nextRetryAt: this.calculateNextRetry(delivery, attempt),
      });

      // Log failure
      await this.logDeliveryEvent({
        deliveryId: delivery.id,
        storeId: delivery.storeId,
        url: delivery.url,
        attempt,
        statusCode: error.response?.status || 0,
        success: false,
        latency,
        error: error.message,
      });

      return { success: false, error: error.message, statusCode: error.response?.status || 0 };
    }
  }

  /**
   * Schedule a retry with exponential backoff
   */
  async scheduleRetry(deliveryId, attempt) {
    const delivery = await prisma.webhook_deliveries.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) return;

    const config =
      delivery.retryConfig ||
      this.defaultRetryConfigs[delivery.type] ||
      this.defaultRetryConfigs.default;
    const delay = this.calculateBackoff(attempt, config);
    const retryAt = new Date(Date.now() + delay);

    await prisma.webhook_deliveries.update({
      where: { id: deliveryId },
      data: {
        attempt,
        nextRetryAt: retryAt,
        status: 'pending_retry',
      },
    });

    // Add to Redis sorted set for efficient scheduling
    if (this.redis) {
      await this.redis.zAdd('webhook:retry_queue', {
        score: retryAt.getTime(),
        value: JSON.stringify({ deliveryId, attempt }),
      });
    }

    console.log(
      `[WebhookDispatcher] Scheduled retry for delivery ${deliveryId} at ${retryAt.toISOString()} (attempt ${attempt}, delay ${delay}ms)`
    );
  }

  /**
   * Calculate exponential backoff with jitter
   */
  calculateBackoff(attempt, config) {
    const { baseDelay = 1000, maxDelay = 60000, backoffMultiplier = 2 } = config;
    const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Add jitter (±25%)
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(Math.max(100, cappedDelay + jitter));
  }

  /**
   * Calculate next retry time
   */
  calculateNextRetry(delivery, attempt) {
    if (attempt >= delivery.maxRetries) return null;
    const config =
      delivery.retryConfig ||
      this.defaultRetryConfigs[delivery.type] ||
      this.defaultRetryConfigs.default;
    const delay = this.calculateBackoff(attempt, config);
    return new Date(Date.now() + delay);
  }

  /**
   * Process retry queue (called by scheduler)
   */
  async processRetryQueue() {
    if (!this.redis) return;

    const now = Date.now();
    const ready = await this.redis.zRangeByScore('webhook:retry_queue', 0, now, { limit: 100 });

    for (const item of ready) {
      try {
        const { deliveryId, attempt } = JSON.parse(item);

        // Remove from queue
        await this.redis.zRem('webhook:retry_queue', item);

        // Verify delivery still exists and needs retry
        const delivery = await prisma.webhook_deliveries.findUnique({
          where: { id: deliveryId },
        });

        if (
          !delivery ||
          delivery.status === 'completed' ||
          delivery.attempt >= delivery.maxRetries
        ) {
          continue;
        }

        // Attempt delivery
        const result = await this.attemptDelivery({ ...delivery, attempt });

        if (!result.success && delivery.attempt >= delivery.maxRetries) {
          await this.moveToDLQ(delivery.id, result.error);
        }
      } catch (e) {
        console.error('[WebhookDispatcher] Retry processing error:', e.message);
      }
    }
  }

  /**
   * Move failed delivery to Dead Letter Queue
   */
  async moveToDLQ(deliveryId, error) {
    const delivery = await prisma.webhook_deliveries.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) return;

    await prisma.webhook_deliveries.update({
      where: { id: deliveryId },
      data: {
        status: 'dead_letter',
        lastError: error,
        dlqAt: new Date(),
      },
    });

    // Also store in DLQ table for easier querying
    await prisma.webhook_dlq.create({
      data: {
        deliveryId: delivery.id,
        url: delivery.url,
        payload: delivery.payload,
        headers: delivery.headers,
        type: delivery.type,
        storeId: delivery.storeId,
        attempts: delivery.attempt,
        lastStatusCode: delivery.lastStatusCode,
        lastError: error,
        lastResponse: delivery.lastResponse,
        originalCreatedAt: delivery.createdAt,
      },
    });

    console.warn(
      `[WebhookDispatcher] Moved delivery ${deliveryId} to DLQ after ${delivery.attempt} attempts`
    );

    // Alert if critical
    if (delivery.type === 'payment') {
      // Could send alert here
    }
  }

  /**
   * Retry a DLQ entry (manual or automatic)
   */
  async retryDLQEntry(dlqId) {
    const dlqEntry = await prisma.webhook_dlq.findUnique({ where: { id: dlqId } });
    if (!dlqEntry) throw new Error('DLQ entry not found');

    // Create new delivery from DLQ entry
    const delivery = await prisma.webhook_deliveries.create({
      data: {
        url: dlqEntry.url,
        payload: dlqEntry.payload,
        headers: dlqEntry.headers,
        type: dlqEntry.type,
        storeId: dlqEntry.storeId,
        attempt: 0,
        maxRetries: 3,
        status: 'pending',
      },
    });

    // Mark DLQ entry as retried
    await prisma.webhook_dlq.update({
      where: { id: dlqId },
      data: { retriedAt: new Date(), retriedDeliveryId: delivery.id },
    });

    // Attempt immediately
    return this.attemptDelivery(delivery);
  }

  /**
   * Get DLQ entries with filtering
   */
  async getDLQEntries(filters = {}) {
    const { storeId, type, fromDate, toDate, limit = 100, offset = 0 } = filters;

    const where = {};
    if (storeId) where.storeId = storeId;
    if (type) where.type = type;
    if (fromDate || toDate) {
      where.originalCreatedAt = {};
      if (fromDate) where.originalCreatedAt.gte = new Date(fromDate);
      if (toDate) where.originalCreatedAt.lte = new Date(toDate);
    }

    return prisma.webhook_dlq.findMany({
      where,
      orderBy: { originalCreatedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Circuit Breaker Pattern Implementation
   */
  getCircuitBreaker(url) {
    if (!this.circuitBreakers.has(url)) {
      this.circuitBreakers.set(url, {
        failures: 0,
        lastFailure: 0,
        state: 'closed', // closed, open, half-open
      });
    }
    return this.circuitBreakers.get(url);
  }

  recordCircuitBreakerResult(url, success) {
    const cb = this.getCircuitBreaker(url);

    if (success) {
      cb.failures = 0;
      if (cb.state === 'half-open') {
        cb.state = 'closed';
      }
    } else {
      cb.failures++;
      cb.lastFailure = Date.now();

      if (cb.failures >= this.CIRCUIT_BREAKER_THRESHOLD && cb.state === 'closed') {
        cb.state = 'open';
        console.warn(`[WebhookDispatcher] Circuit breaker OPENED for ${url}`);
      }
    }
  }

  async startCircuitBreakerMonitor() {
    setInterval(() => {
      const now = Date.now();
      for (const [url, cb] of this.circuitBreakers.entries()) {
        if (cb.state === 'open' && now - cb.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
          cb.state = 'half-open';
          console.log(`[WebhookDispatcher] Circuit breaker HALF-OPEN for ${url}`);
        }
      }
    }, 10000);
  }

  /**
   * Start the retry scheduler
   */
  async startRetryScheduler() {
    this.retryScheduler = setInterval(() => {
      this.processRetryQueue().catch((e) =>
        console.error('[WebhookDispatcher] Scheduler error:', e)
      );
    }, 5000); // Check every 5 seconds
  }

  /**
   * Create delivery record in database
   */
  async createDeliveryRecord(data) {
    return prisma.webhook_deliveries.create({
      data: {
        url: data.url,
        payload: data.payload,
        headers: data.headers || {},
        type: data.type,
        idempotencyKey: data.idempotencyKey,
        storeId: data.storeId,
        maxRetries: data.maxRetries,
        retryConfig: data.retryConfig,
        secret: data.secret,
        status: 'pending',
        attempt: 0,
      },
    });
  }

  async updateDeliveryRecord(id, data) {
    return prisma.webhook_deliveries.update({
      where: { id },
      data,
    });
  }

  async markDeliveryCompleted(id) {
    await prisma.webhook_deliveries.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  async checkIdempotency(key) {
    return prisma.webhook_deliveries.findFirst({
      where: { idempotencyKey: key, status: 'completed' },
    });
  }

  generateIdempotencyKey(url, payload) {
    const hash = crypto
      .createHash('sha256')
      .update(url + JSON.stringify(payload))
      .digest('hex')
      .slice(0, 32);
    return `idem_${hash}`;
  }

  generateSignature(payload, secret) {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  verifySignature(payload, signature, secret) {
    const expected = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return url.startsWith('https://') || url.startsWith('http://localhost');
    } catch {
      return false;
    }
  }

  async logDeliveryEvent(data) {
    try {
      await prisma.analytics_events.create({
        data: {
          eventName: 'webhook_delivery',
          storeId: data.storeId,
          properties: {
            deliveryId: data.deliveryId,
            url: data.url,
            attempt: data.attempt,
            statusCode: data.statusCode,
            success: data.success,
            latency: data.latency,
            payloadSize: data.payloadSize,
            error: data.error,
          },
        },
      });
    } catch (e) {
      // Don't fail delivery if analytics fails
    }
  }

  /**
   * Get delivery statistics
   */
  async getStats(filters = {}) {
    const { storeId, type, fromDate, toDate } = filters;

    const where = {};
    if (storeId) where.storeId = storeId;
    if (type) where.type = type;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [total, completed, failed, dlq] = await Promise.all([
      prisma.webhook_deliveries.count({ where }),
      prisma.webhook_deliveries.count({ where: { ...where, status: 'completed' } }),
      prisma.webhook_deliveries.count({ where: { ...where, status: 'failed' } }),
      prisma.webhook_dlq.count({ where: { storeId } }),
    ]);

    const avgLatency = await prisma.webhook_deliveries.aggregate({
      where: { ...where, status: 'completed', lastLatency: { not: null } },
      _avg: { lastLatency: true },
    });

    return {
      total,
      completed,
      failed,
      dlq,
      successRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0,
      avgLatency: avgLatency._avg.lastLatency?.toFixed(0) || 0,
    };
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    if (this.retryScheduler) {
      clearInterval(this.retryScheduler);
    }
    console.log('[WebhookDispatcher] Service shutdown');
  }
}

module.exports = new WebhookDispatcherService();
