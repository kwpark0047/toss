import AIUsageRepository from '../repositories/AIUsageRepository.js';
import logger from './logger.js';

interface TrackOptions {
    provider: string;
    endpoint: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    statusCode: number;
    durationMs: number;
    cacheHit?: boolean;
    fallbackUsed?: boolean;
    storeId?: number | null;
    ipAddress?: string | null;
}

interface StatsParams {
    from?: Date;
    to?: Date;
    provider?: string;
    endpoint?: string;
    groupBy?: 'day' | 'week' | 'month';
}

export const aiUsageTracker = {
    async track(options: {
        provider: string;
        endpoint: string;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        costUsd: number;
        statusCode: number;
        durationMs: number;
        cacheHit?: boolean;
        fallbackUsed?: boolean;
        storeId?: number | null;
        ipAddress?: string | null;
    }): Promise<void> {
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
        } catch (err: any) {
            logger.warn('[AIUsageTracker] Tracking failed:', err.message);
        }
    },

    async getUsageStats(storeId: number | null, params: {
        from?: Date;
        to?: Date;
        provider?: string;
        endpoint?: string;
        groupBy?: 'day' | 'week' | 'month';
    } = {}): Promise<any> {
        return AIUsageRepository.getUsageStats(storeId, params);
    },
};

export default aiUsageTracker;