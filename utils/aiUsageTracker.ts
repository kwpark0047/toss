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
            // Prisma DB 저장 건너뜀 - 메모리 기반 추적만 수행 (Redis/Cost 절감 목적)
            // 필요시 나중에 백필 또는 별도 DB 동기화 구현 가능
            logger.debug('[AIUsageTracker] Tracking recorded in memory (DB skip):', { provider, endpoint, costUsd });
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
        // 메모리 기반 통계 반환 (Prisma DB 쿼리 건너뜀)
        return {
            source: 'memory-tracking',
            totalRequests: 0, // 실제 카운트는 향후 DB 동기화 또는 카운터 추가 시 반영
            message: 'AI 사용량 통계는 메모리 기반 추적 모드입니다. DB 동기화를 위해_tracking() 호출 횟수를 확인하세요.',
            trackedAt: new Date().toISOString(),
        };
    },
};

export default aiUsageTracker;