const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const cron = require('node-cron');
const DemandForecastService = require('./DemandForecastService');
const DynamicPricingService = require('./DynamicPricingService');

/**
 * 가격 최적화 잡 워커
 *
 * pricing_optimization_jobs 테이블의 PENDING 잡을 주기적으로 소비한다.
 * 각 잡은 PENDING → RUNNING → COMPLETED/FAILED 상태 전이를 거치며,
 * job_type에 따라 수요 예측(FULL_OPTIMIZATION/DEMAND_FORECAST)과
 * 동적 가격 규칙 적용(FULL_OPTIMIZATION/INCREMENTAL_UPDATE/COMPETITOR_SYNC)을 수행한다.
 *
 * DEMAND_FORECAST는 수요 예측 전용 잡이므로 가격 규칙 적용을 생략한다.
 */
class PricingOptimizationService {
  constructor() {
    this._scheduler = null;
  }

  /**
   * 대기 중인 PENDING 잡을 순차 실행한다.
   * 개별 잡 실패는 로그로 남기고 전체 워커 실행은 중단되지 않는다.
   */
  async processPendingJobs(limit = 20) {
    const jobs = await prisma.pricing_optimization_jobs.findMany({
      where: { status: 'PENDING' },
      orderBy: { id: 'asc' },
      take: Number(limit),
    });

    const results = [];
    for (const job of jobs) {
      try {
        results.push(await this.runJob(job.id));
      } catch (err) {
        logger.error(`[PricingWorker] 잡 ${job.id} 처리 실패: ${err.message}`);
      }
    }
    return results;
  }

  /**
   * 단일 잡을 실행한다. 이미 처리된(PENDING이 아닌) 잡은 건너뛴다.
   */
  async runJob(jobId) {
    const job = await prisma.pricing_optimization_jobs.findUnique({
      where: { id: Number(jobId) },
    });
    if (!job) throw new Error(`잡 ${jobId}를 찾을 수 없습니다.`);
    if (job.status !== 'PENDING') {
      logger.info(`[PricingWorker] 잡 ${jobId}은(는) 이미 ${job.status} 상태 — 건너뜀`);
      return { jobId, status: 'SKIPPED' };
    }

    await prisma.pricing_optimization_jobs.update({
      where: { id: job.id },
      data: { status: 'RUNNING', started_at: new Date() },
    });

    try {
      const summary = await this._execute(job);
      await prisma.pricing_optimization_jobs.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completed_at: new Date(), result_summary: summary },
      });
      logger.info(
        `[PricingWorker] 잡 ${job.id} 완료 (${job.job_type}) — ${JSON.stringify(summary)}`
      );
      return { jobId: job.id, status: 'COMPLETED', summary };
    } catch (err) {
      await prisma.pricing_optimization_jobs.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completed_at: new Date(),
          error_message: err.message,
        },
      });
      throw err;
    }
  }

  async _execute(job) {
    const summary = {};

    // 1) 수요 예측 생성 (전체 최적화 + 수요 예측 전용 잡)
    if (job.job_type === 'FULL_OPTIMIZATION' || job.job_type === 'DEMAND_FORECAST') {
      const forecasts = await DemandForecastService.generateForecastsForStore(job.store_id);
      summary.forecastGenerated = Array.isArray(forecasts) ? forecasts.length : 0;
    }

    // 2) 동적 가격 규칙 적용 (수요 예측 전용 잡 제외)
    if (job.job_type !== 'DEMAND_FORECAST') {
      const [priceChanges, activeRules] = await Promise.all([
        DynamicPricingService.activatePricingRules(job.store_id),
        prisma.dynamic_pricing_rules.count({ where: { store_id: job.store_id, is_active: true } }),
      ]);
      summary.pricesChanged = Array.isArray(priceChanges) ? priceChanges.length : 0;
      summary.rulesApplied = activeRules;
    }

    return summary;
  }

  /**
   * 매 10분마다 PENDING 잡을 처리하는 스케줄러를 등록한다 (중복 등록 방지).
   */
  startScheduler(interval = '*/10 * * * *') {
    if (this._scheduler) return this._scheduler;

    this._scheduler = cron.schedule(
      interval,
      async () => {
        logger.info('[PricingWorker] 스케줄러 실행 — 대기 중인 가격 최적화 잡 처리');
        try {
          const results = await this.processPendingJobs();
          logger.info(`[PricingWorker] 스케줄러 완료 — ${results.length}개 잡 처리`);
        } catch (err) {
          logger.error(`[PricingWorker] 스케줄러 오류: ${err.message}`);
        }
      },
      { timezone: 'Asia/Seoul' }
    );
    logger.info('[PricingWorker] 스케줄러 등록 완료 (매 10분 KST)');
    return this._scheduler;
  }
}

module.exports = new PricingOptimizationService();
