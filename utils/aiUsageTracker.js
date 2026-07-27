const AIUsageRepository = require('../repositories/AIUsageRepository');
const logger = require('./logger');

let aiUsageTracker = {
    async track(options) {
        const {
            provider,
            endpoint,
            promptTokens,
            completionTokens,
            totalTokens,
            costUsd,
            statusCode,
            durationMs,
            cacheHit = false,
            fallbackUsed = false,
            storeId = null,
            ipAddress = null,
        } = options;

        try {
            await AIUsageRepository.logUsage({
                provider,
                endpoint,
                promptTokens,
                completionTokens,
                totalTokens,
                costUsd,
                statusCode,
                durationMs,
                cacheHit,
                fallbackUsed,
                storeId,
                ipAddress,
            });
        } catch (err) {
            logger.warn('[AIUsageTracker] Tracking failed:', err.message);
        }
    },

    async getUsageStats(storeId, params = {}) {
        return AIUsageRepository.getUsageStats(storeId, params);
    },
};

module.exports = aiUsageTracker;
