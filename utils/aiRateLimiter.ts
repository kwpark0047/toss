import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import logger from './logger.js';

export const AI_RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
    describeMenu: { windowMs: 60_000, max: 30 },
    instagram: { windowMs: 60_000, max: 30 },
    recommend: { windowMs: 60_000, max: 60 },
    recommendDessert: { windowMs: 60_000, max: 60 },
    translateMenu: { windowMs: 60_000, max: 10 },
    translate: { windowMs: 60_000, max: 30 },
    storytelling: { windowMs: 60_000, max: 30 },
    generateMenuImage: { windowMs: 60_000, max: 10 },
    scanMenuImage: { windowMs: 60_000, max: 10 },
    generateReviewReply: { windowMs: 60_000, max: 30 },
    recommendImageEnhancement: { windowMs: 60_000, max: 30 },
    tinkerbellRec: { windowMs: 60_000, max: 60 },
    chat: { windowMs: 60_000, max: 60 },
    translateMessage: { windowMs: 60_000, max: 30 },
    proposeSetMenus: { windowMs: 60_000, max: 20 },
    getMenuAnalysis: { windowMs: 60_000, max: 20 },
    getAISuggestions: { windowMs: 60_000, max: 30 },
};

const ANALYTICS_RATE_LIMIT = { windowMs: 60_000, max: 120 };

let sharedRedisClient: any = null;

async function getRedisClient(): Promise<any> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;

    try {
        const { createClient } = await import('redis');
        const client = createClient({ url: redisUrl });
        client.on('error', (err: Error) => {
            logger.error('[AIRateLimiter] Redis client error:', err.message);
        });
        await client.connect();
        logger.info('[AIRateLimiter] Redis store connected for rate limiting');
        return client;
    } catch (err: any) {
        logger.warn(`[AIRateLimiter] Redis connection failed, falling back to memory store: ${err.message}`);
        return null;
    }
}

class RedisStore {
    private client: any = null;
    private memFallback: Map<string, any> = new Map();
    private useMemFallback = false;
    private prefix = 'ai_rate_limit:';

    async init(): Promise<void> {
        this.client = await getRedisClient();
        if (!this.client) {
            this.useMemFallback = true;
            logger.warn('[AIRateLimiter] Using in-memory fallback store for rate limiting');
        }
    }

    _prefixedKey(key: string): string {
        return `ai_rate_limit:${key}`;
    }

    async get(key: string): Promise<any> {
        const prefixedKey = `ai_rate_limit:${key}`;
        if (this.client) {
            try {
                const data = await this.client.get(prefixedKey);
                if (data === null) return undefined;
                const parsed = JSON.parse(data);
                return {
                    totalHits: parsed.totalHits,
                    resetTime: new Date(parsed.resetTime),
                };
            } catch (err: any) {
                logger.error('[AIRateLimiter] Redis GET error:', err.message);
                return undefined;
            }
        }
        const entry = this.memFallback.get(prefixedKey);
        if (!entry) return undefined;
        const elapsed = Date.now() - entry.createdAt;
        if (elapsed > entry.windowMs) {
            this.memFallback.delete(prefixedKey);
            return undefined;
        }
        return {
            totalHits: entry.totalHits,
            resetTime: new Date(entry.createdAt + entry.windowMs),
        };
    }

    async increment(key: string): Promise<any> {
        const prefixedKey = `ai_rate_limit:${key}`;
        if (this.client) {
            try {
                const windowMs = 60_000;
                const ttl = Math.ceil(windowMs / 1000);
                const results = await this.client
                    .multi()
                    .incr(prefixedKey)
                    .pttl(prefixedKey)
                    .exec();

                let ttlValue = results[1].result;
                if (ttlValue === -1 || ttlValue === -2) {
                    await this.client.expire(prefixedKey, ttl);
                    ttlValue = ttl * 1000;
                }

                return {
                    totalHits: results[0].result,
                    resetTime: new Date(Date.now() + ttlValue),
                };
            } catch (err: any) {
                logger.error('[AIRateLimiter] Redis INCR error:', err.message);
                return this._memIncrement(prefixedKey);
            }
        }
        return this._memIncrement(prefixedKey);
    }

    _memIncrement(key: string): any {
        const now = Date.now();
        const entry = this.memFallback.get(key);
        if (entry && now - entry.createdAt < entry.windowMs) {
            entry.totalHits += 1;
        } else {
            this.memFallback.set(key, { totalHits: 1, createdAt: now, windowMs: 60_000 });
        }
        const stored = this.memFallback.get(key);
        return {
            totalHits: stored.totalHits,
            resetTime: new Date(stored.createdAt + stored.windowMs),
        };
    }

    async decrement(key: string): Promise<void> {
        const prefixedKey = `ai_rate_limit:${key}`;
        if (this.client) {
            try {
                await this.client.decr(prefixedKey);
            } catch (err: any) {
                logger.error('[AIRateLimiter] Redis DECR error:', err.message);
            }
        }
        const entry = this.memFallback.get(prefixedKey);
        if (entry && entry.totalHits > 0) {
            entry.totalHits -= 1;
        }
    }

    async resetKey(key: string): Promise<void> {
        const prefixedKey = `ai_rate_limit:${key}`;
        if (this.client) {
            try {
                await this.client.del(prefixedKey);
            } catch (err: any) {
                logger.error('[AIRateLimiter] Redis DEL error:', err.message);
            }
        }
        this.memFallback.delete(prefixedKey);
    }

    async resetAll(): Promise<void> {
        if (this.client) {
            try {
                const keys = await this.client.keys('ai_rate_limit:*');
                if (keys.length > 0) {
                    await this.client.del(keys);
                }
            } catch (err: any) {
                logger.error('[AIRateLimiter] Redis FLUSH error:', err.message);
            }
        }
        this.memFallback.clear();
    }

    async shutdown(): Promise<void> {
        if (this.client) {
            try {
                await this.client.quit();
            } catch (err: any) {
                logger.error('[AIRateLimiter] Redis shutdown error:', err.message);
            }
            this.client = null;
        }
        this.memFallback.clear();
    }

    get localKeys(): boolean {
        return false;
    }
}

function createAIRateLimiter(endpoint: string) {
    const config = AI_RATE_LIMITS[endpoint] || { windowMs: 60_000, max: 30 };

    const store = process.env.REDIS_URL ? new RedisStore() : undefined;

    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: true,
        legacyHeaders: false,
        store,
        message: {
            error: 'API rate limit exceeded',
            retryAfterSeconds: Math.ceil(config.windowMs / 1000),
        },
        handler: (req: any, res: any, next: Function, options: any) => {
            logger.warn(
                `[AI Rate Limit] ${req.method} ${req.originalUrl} - client: ${req.ip} endpoint: ${endpoint} limit: ${config.max}/${config.windowMs}ms`
            );
            res.status(options.statusCode).json({
                error: options.message.error,
                retryAfter: options.message.retryAfterSeconds,
            });
        },
        skipSuccessfulRequests: false,
    });
}

function createAnalyticsRateLimiter() {
    const config = ANALYTICS_RATE_LIMIT;

    const store = process.env.REDIS_URL ? new RedisStore() : undefined;

    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: true,
        legacyHeaders: false,
        store,
        message: {
            error: 'API rate limit exceeded',
            retryAfterSeconds: Math.ceil(config.windowMs / 1000),
        },
        handler: (req: any, res: any, next: Function, options: any) => {
            logger.warn(
                `[Analytics Rate Limit] ${req.method} ${req.originalUrl} - client: ${req.ip} limit: ${config.max}/${config.windowMs}ms`
            );
            res.status(options.statusCode).json({
                error: options.message.error,
                retryAfter: options.message.retryAfterSeconds,
            });
        },
        skipSuccessfulRequests: false,
    });
}

export { createAIRateLimiter, createAnalyticsRateLimiter, AI_RATE_LIMITS, ANALYTICS_RATE_LIMIT };