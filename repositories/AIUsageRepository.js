const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const AIUsageRepository = {
    async logUsage(data) {
        try {
            const record = await prisma.ai_usage_logs.create({
                data: {
                    provider: data.provider,
                    endpoint: data.endpoint,
                    promptTokens: data.promptTokens ?? null,
                    completionTokens: data.completionTokens ?? null,
                    totalTokens: data.totalTokens ?? null,
                    costUsd: data.costUsd != null ? data.costUsd : null,
                    statusCode: data.statusCode ?? null,
                    durationMs: data.durationMs ?? null,
                    cacheHit: data.cacheHit ?? false,
                    fallbackUsed: data.fallbackUsed ?? false,
                    storeId: data.storeId ?? null,
                    ipAddress: data.ipAddress ?? null,
                },
            });
            return record;
        } catch (err) {
            logger.error('[AIUsage] Failed to log usage:', err.message);
        }
        return null;
    },

    async getUsageStats(storeId, params = {}) {
        const { startDate, endDate, provider, limit = 50 } = params;
        try {
            const where = {};
            if (storeId) where.storeId = storeId;
            if (startDate) where.createdAt = { gte: new Date(startDate) };
            if (endDate) where.createdAt = { lte: new Date(endDate) };
            if (provider) where.provider = provider;

            const records = await prisma.ai_usage_logs.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    provider: true,
                    endpoint: true,
                    promptTokens: true,
                    completionTokens: true,
                    totalTokens: true,
                    costUsd: true,
                    statusCode: true,
                    durationMs: true,
                    cacheHit: true,
                    fallbackUsed: true,
                    storeId: true,
                    createdAt: true,
                },
            });

            const stats = await prisma.ai_usage_logs.aggregate({
                where,
                _sum: {
                    promptTokens: true,
                    completionTokens: true,
                    totalTokens: true,
                    costUsd: true,
                },
                _count: { id: true },
                _avg: { durationMs: true },
            });

            return { records, stats };
        } catch (err) {
            logger.error('[AIUsage] Failed to get stats:', err.message);
            return { records: [], stats: {} };
        }
    },
};

module.exports = AIUsageRepository;
