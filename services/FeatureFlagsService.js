/**
 * Feature Flags Service
 *
 * Provides a comprehensive feature flag system with:
 * - Per-store and global flags
 * - Gradual rollout (percentage-based)
 * - User targeting (roles, segments, custom attributes)
 * - A/B testing support
 * - Real-time updates via Socket.io
 * - Audit logging
 * - Fallback to database when Redis unavailable
 */

const { getRedis } = require('../config/redis');
const prisma = require('../config/prisma');
const { emitToStore } = require('../socket/emitter');

class FeatureFlagsService {
  constructor() {
    this.localCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.lastCacheClear = 0;
  }

  /**
   * Get a feature flag value for a specific context
   * @param {string} flagKey - The flag key
   * @param {Object} context - Evaluation context
   * @param {number} context.storeId - Store ID
   * @param {number} context.userId - User ID (optional)
   * @param {string} context.userRole - User role (optional)
   * @param {Object} context.attributes - Custom attributes (optional)
   * @returns {Promise<any>} The flag value (boolean, string, number, object)
   */
  async getFlag(flagKey, context = {}) {
    const { storeId, userId, userRole, attributes = {} } = context;
    const cacheKey = `${flagKey}:${storeId || 'global'}:${userId || 'anon'}`;

    // Check local cache first
    const cached = this.localCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    try {
      // Try Redis first
      const redis = getRedis();
      if (redis) {
        const redisKey = `feature_flag:${flagKey}:${storeId || 'global'}`;
        const data = await redis.get(redisKey);
        if (data) {
          const flag = JSON.parse(data);
          const value = this.evaluateFlag(flag, { storeId, userId, userRole, attributes });
          this.localCache.set(cacheKey, { value, timestamp: Date.now() });
          return value;
        }
      }
    } catch (e) {
      // Redis unavailable, fallback to DB
    }

    // Fallback to database
    const flag = await this.getFlagFromDB(flagKey, storeId);
    if (!flag) return flag?.defaultValue ?? false;

    const value = this.evaluateFlag(flag, { storeId, userId, userRole, attributes });
    this.localCache.set(cacheKey, { value, timestamp: Date.now() });
    return value;
  }

  /**
   * Evaluate flag based on targeting rules
   */
  evaluateFlag(flag, context) {
    const { storeId, userId, userRole, attributes } = context;

    // If flag is disabled globally
    if (!flag.enabled) return flag.defaultValue ?? false;

    // Check store-level override
    if (storeId && flag.storeOverrides?.[storeId] !== undefined) {
      const override = flag.storeOverrides[storeId];
      if (override.enabled === false) return flag.defaultValue ?? false;
      if (override.value !== undefined) return override.value;
    }

    // Check percentage rollout
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashUser(userId || attributes.sessionId || 'anon');
      if (hash >= flag.rolloutPercentage) return flag.defaultValue ?? false;
    }

    // Check user targeting
    if (flag.targeting) {
      // Role targeting
      if (flag.targeting.roles && flag.targeting.roles.length > 0) {
        if (!userRole || !flag.targeting.roles.includes(userRole)) {
          return flag.defaultValue ?? false;
        }
      }

      // User ID targeting
      if (flag.targeting.userIds && flag.targeting.userIds.length > 0) {
        if (!userId || !flag.targeting.userIds.includes(userId)) {
          return flag.defaultValue ?? false;
        }
      }

      // Segment targeting
      if (flag.targeting.segments && flag.targeting.segments.length > 0) {
        const userSegments = attributes.segments || [];
        const hasSegment = flag.targeting.segments.some((s) => userSegments.includes(s));
        if (!hasSegment) return flag.defaultValue ?? false;
      }

      // Custom attribute targeting
      if (flag.targeting.attributes) {
        for (const [key, value] of Object.entries(flag.targeting.attributes)) {
          if (attributes[key] !== value) {
            return flag.defaultValue ?? false;
          }
        }
      }
    }

    // Return flag value (can be boolean, string, number, object)
    return flag.value !== undefined ? flag.value : true;
  }

  /**
   * Get flag from database
   */
  async getFlagFromDB(flagKey, storeId) {
    const flag = await prisma.feature_flags.findUnique({
      where: { key: flagKey },
    });

    if (!flag) return null;

    return {
      key: flag.key,
      enabled: flag.enabled,
      value: flag.value,
      defaultValue: flag.defaultValue,
      rolloutPercentage: flag.rolloutPercentage,
      targeting: flag.targeting,
      storeOverrides: flag.storeOverrides,
      type: flag.type,
      description: flag.description,
    };
  }

  /**
   * Get multiple flags at once (batch)
   */
  async getFlags(flagKeys, context = {}) {
    const results = {};
    await Promise.all(
      flagKeys.map(async (key) => {
        results[key] = await this.getFlag(key, context);
      })
    );
    return results;
  }

  /**
   * Create or update a feature flag
   */
  async setFlag(flagData, actorId) {
    const {
      key,
      enabled = true,
      value = true,
      defaultValue = false,
      rolloutPercentage = 100,
      targeting = null,
      storeOverrides = null,
      type = 'boolean',
      description = '',
    } = flagData;

    const existing = await prisma.feature_flags.findUnique({ where: { key } });

    let flag;
    if (existing) {
      flag = await prisma.feature_flags.update({
        where: { key },
        data: {
          enabled,
          value,
          defaultValue,
          rolloutPercentage,
          targeting,
          storeOverrides,
          type,
          description,
          updatedBy: actorId,
        },
      });
    } else {
      flag = await prisma.feature_flags.create({
        data: {
          key,
          enabled,
          value,
          defaultValue,
          rolloutPercentage,
          targeting,
          storeOverrides,
          type,
          description,
          createdBy: actorId,
        },
      });
    }

    // Invalidate cache and publish update
    await this.invalidateCache(flag.key);
    await this.publishFlagUpdate(flag);

    // Audit log
    await prisma.audit_logs.create({
      data: {
        action: existing ? 'FEATURE_FLAG_UPDATE' : 'FEATURE_FLAG_CREATE',
        entityType: 'feature_flag',
        entityId: flag.key,
        userId: actorId,
        changes: { ...flagData },
      },
    });

    return flag;
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(key, actorId) {
    const flag = await prisma.feature_flags.findUnique({ where: { key } });
    if (!flag) throw new Error(`Feature flag '${key}' not found`);

    await prisma.feature_flags.delete({ where: { key } });
    await this.invalidateCache(key);

    // Publish deletion event
    if (getRedis()) {
      await getRedis().publish('feature_flags:deleted', JSON.stringify({ key }));
    }

    await prisma.audit_logs.create({
      data: {
        action: 'FEATURE_FLAG_DELETE',
        entityType: 'feature_flag',
        entityId: key,
        userId: actorId,
        changes: { key },
      },
    });
  }

  /**
   * List all flags with optional filtering
   */
  async listFlags(filters = {}) {
    const { enabled, type, storeId, search } = filters;

    const where = {};
    if (enabled !== undefined) where.enabled = enabled;
    if (type) where.type = type;
    if (storeId) where.storeOverrides = { path: [`$`, storeId], array_contains: true };
    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.feature_flags.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Create A/B test variant
   */
  async createABTest(testData, actorId) {
    const {
      name,
      flagKey,
      variants = [],
      trafficSplit = {}, // e.g., { control: 50, variant_a: 50 }
      startDate,
      endDate,
      successMetric,
    } = testData;

    // Validate traffic split sums to 100
    const totalSplit = Object.values(trafficSplit).reduce((a, b) => a + b, 0);
    if (totalSplit !== 100) {
      throw new Error('Traffic split must sum to 100%');
    }

    // Create the main flag with rollout
    const flag = await this.setFlag(
      {
        key: flagKey,
        enabled: true,
        value: variants[0]?.key || 'control',
        rolloutPercentage: 100,
        type: 'string',
        description: `A/B Test: ${name}`,
        targeting: {
          attributes: {
            ab_test: name,
            ab_variant: { $in: Object.keys(trafficSplit) },
          },
        },
      },
      actorId
    );

    // Store test config
    await prisma.ab_tests.create({
      data: {
        name,
        flagKey,
        variants: variants.map((v) => ({ ...v, trafficSplit: trafficSplit[v.key] || 0 })),
        trafficSplit,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        successMetric,
        status: 'running',
        createdBy: actorId,
      },
    });

    return flag;
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testName) {
    const test = await prisma.ab_tests.findFirst({ where: { name: testName } });
    if (!test) throw new Error(`A/B test '${testName}' not found`);

    // Get events for each variant
    const events = await prisma.analytics_events.findMany({
      where: {
        eventName: test.successMetric,
        properties: { path: ['ab_test'], equals: test.name },
        createdAt: { gte: test.startDate, lte: test.endDate || new Date() },
      },
    });

    const results = {};
    for (const variant of test.variants) {
      const variantEvents = events.filter((e) => e.properties?.ab_variant === variant.key);
      results[variant.key] = {
        participants: variantEvents.length,
        conversions: variantEvents.filter((e) => e.properties?.converted).length,
        conversionRate:
          variantEvents.length > 0
            ? variantEvents.filter((e) => e.properties?.converted).length / variantEvents.length
            : 0,
      };
    }

    return {
      test: test.name,
      status: test.status,
      variants: results,
      significance: this.calculateSignificance(results),
    };
  }

  calculateSignificance(results) {
    // Simplified significance calculation (Chi-square)
    const variants = Object.entries(results);
    if (variants.length < 2) return null;

    const total = variants.reduce((sum, [, v]) => sum + v.participants, 0);
    if (total < 100) return { significant: false, reason: 'Insufficient sample size' };

    // Chi-square test for independence
    const control = variants[0][1];
    const treatment = variants[1][1];

    const pooledRate =
      (control.conversions + treatment.conversions) /
      (control.participants + treatment.participants);
    const expectedControl = control.participants * pooledRate;
    const expectedTreatment = treatment.participants * pooledRate;

    const chiSquare =
      Math.pow(control.conversions - expectedControl, 2) / expectedControl +
      Math.pow(treatment.conversions - expectedTreatment, 2) / expectedTreatment;

    const significant = chiSquare > 3.841; // p < 0.05, df=1

    return {
      significant,
      chiSquare,
      pValue: significant ? '< 0.05' : '> 0.05',
      confidence: significant ? '95%' : 'N/A',
    };
  }

  /**
   * Invalidate cache for a flag
   */
  async invalidateCache(flagKey) {
    // Clear local cache
    for (const key of this.localCache.keys()) {
      if (key.startsWith(`${flagKey}:`)) {
        this.localCache.delete(key);
      }
    }

    // Clear Redis
    try {
      const redis = getRedis();
      if (redis) {
        const pattern = `feature_flag:${flagKey}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) await redis.del(...keys);
      }
    } catch (e) {
      // Ignore Redis errors
    }
  }

  /**
   * Publish flag update to all connected clients
   */
  async publishFlagUpdate(flag) {
    try {
      // Redis pub/sub for multi-instance
      const redis = getRedis();
      if (redis) {
        await redis.publish(
          'feature_flags:updated',
          JSON.stringify({
            key: flag.key,
            value: flag.value,
            enabled: flag.enabled,
            timestamp: Date.now(),
          })
        );
      }

      // Socket.io for real-time UI updates
      if (flag.storeOverrides) {
        for (const storeId of Object.keys(flag.storeOverrides)) {
          emitToStore(storeId, 'feature_flag:updated', {
            key: flag.key,
            value: flag.value,
            enabled: flag.enabled,
          });
        }
      } else {
        // Global flag - broadcast to all
        emitToStore('global', 'feature_flag:updated', {
          key: flag.key,
          value: flag.value,
          enabled: flag.enabled,
        });
      }
    } catch (e) {
      console.error('[FeatureFlags] Publish update failed:', e.message);
    }
  }

  /**
   * Simple hash function for consistent rollout
   */
  hashUser(input) {
    let hash = 0;
    const str = String(input);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Clear all caches (admin action)
   */
  clearAllCaches() {
    this.localCache.clear();
    this.lastCacheClear = Date.now();
  }

  /**
   * Get flag definition (for admin UI)
   */
  async getFlagDefinition(key) {
    const flag = await prisma.feature_flags.findUnique({ where: { key } });
    if (!flag) return null;

    return {
      key: flag.key,
      enabled: flag.enabled,
      value: flag.value,
      defaultValue: flag.defaultValue,
      rolloutPercentage: flag.rolloutPercentage,
      targeting: flag.targeting,
      storeOverrides: flag.storeOverrides,
      type: flag.type,
      description: flag.description,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
      createdBy: flag.createdBy,
      updatedBy: flag.updatedBy,
    };
  }
}

module.exports = new FeatureFlagsService();
