jest.mock('../../../config/prisma', () => require('../../../tests/helpers/prismaMock').create());
jest.mock('../../../services/DemandForecastService', () => ({
  generateForecastsForStore: jest.fn(),
}));
jest.mock('../../../services/DynamicPricingService', () => ({
  activatePricingRules: jest.fn(),
}));

const pricingOptimizationService = require('../../../services/pricingOptimizationService');
const prisma = require('../../../config/prisma');
const DemandForecastService = require('../../../services/DemandForecastService');
const DynamicPricingService = require('../../../services/DynamicPricingService');

describe('PricingOptimizationService', () => {
  const pendingJob = {
    id: 1,
    store_id: 7,
    status: 'PENDING',
    job_type: 'FULL_OPTIMIZATION',
    started_at: null,
    completed_at: null,
    error_message: null,
    result_summary: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('runJob', () => {
    test('PENDING 잡을 RUNNING → COMPLETED로 전이하고 요약을 기록한다', async () => {
      prisma.pricing_optimization_jobs.findUnique.mockResolvedValue(pendingJob);
      prisma.pricing_optimization_jobs.update.mockResolvedValue({});
      prisma.dynamic_pricing_rules.count.mockResolvedValue(3);
      DemandForecastService.generateForecastsForStore.mockResolvedValue([{ id: 101 }]);
      DynamicPricingService.activatePricingRules.mockResolvedValue([{ new_price: 12000 }]);

      const result = await pricingOptimizationService.runJob(1);

      expect(result.status).toBe('COMPLETED');
      expect(result.summary).toEqual({ forecastGenerated: 1, pricesChanged: 1, rulesApplied: 3 });

      expect(prisma.pricing_optimization_jobs.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'RUNNING' }),
        })
      );
      const completedCall = [...prisma.pricing_optimization_jobs.update.mock.calls].pop();
      expect(completedCall[0].data.status).toBe('COMPLETED');
      expect(completedCall[0].data.result_summary).toEqual({
        forecastGenerated: 1,
        pricesChanged: 1,
        rulesApplied: 3,
      });
    });

    test('FULL_OPTIMIZATION은 수요 예측과 가격 규칙을 모두 수행한다', async () => {
      prisma.pricing_optimization_jobs.findUnique.mockResolvedValue(pendingJob);
      prisma.pricing_optimization_jobs.update.mockResolvedValue({});
      prisma.dynamic_pricing_rules.count.mockResolvedValue(0);
      DemandForecastService.generateForecastsForStore.mockResolvedValue([{ id: 1 }]);
      DynamicPricingService.activatePricingRules.mockResolvedValue([]);

      await pricingOptimizationService.runJob(1);

      expect(DemandForecastService.generateForecastsForStore).toHaveBeenCalledWith(7);
      expect(DynamicPricingService.activatePricingRules).toHaveBeenCalledWith(7);
    });

    test('DEMAND_FORECAST 전용 잡은 가격 규칙 적용을 생략한다', async () => {
      prisma.pricing_optimization_jobs.findUnique.mockResolvedValue({
        ...pendingJob,
        job_type: 'DEMAND_FORECAST',
      });
      prisma.pricing_optimization_jobs.update.mockResolvedValue({});
      DemandForecastService.generateForecastsForStore.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await pricingOptimizationService.runJob(1);

      expect(result.status).toBe('COMPLETED');
      expect(result.summary).toEqual({ forecastGenerated: 2 });
      expect(DynamicPricingService.activatePricingRules).not.toHaveBeenCalled();

      const completedCall = [...prisma.pricing_optimization_jobs.update.mock.calls].pop();
      expect(completedCall[0].data.result_summary).toEqual({ forecastGenerated: 2 });
    });

    test('실행 실패 시 FAILED로 전이하고 에러 메시지를 기록하며 재전파한다', async () => {
      prisma.pricing_optimization_jobs.findUnique.mockResolvedValue(pendingJob);
      prisma.pricing_optimization_jobs.update.mockResolvedValue({});
      DemandForecastService.generateForecastsForStore.mockRejectedValue(new Error('DB timeout'));

      await expect(pricingOptimizationService.runJob(1)).rejects.toThrow('DB timeout');

      const failedCall = [...prisma.pricing_optimization_jobs.update.mock.calls].find(
        (args) => args[0]?.data?.status === 'FAILED'
      );
      expect(failedCall).toBeTruthy();
      expect(failedCall[0].data.error_message).toBe('DB timeout');
    });

    test('이미 처리된 잡은 SKIPPED로 반환하고 DB를 건드리지 않는다', async () => {
      prisma.pricing_optimization_jobs.findUnique.mockResolvedValue({
        ...pendingJob,
        status: 'COMPLETED',
      });

      const result = await pricingOptimizationService.runJob(1);

      expect(result.status).toBe('SKIPPED');
      expect(prisma.pricing_optimization_jobs.update).not.toHaveBeenCalled();
    });
  });

  describe('processPendingJobs', () => {
    test('PENDING 잡 목록을 순차 처리하고 job_type별 분기를 수행한다', async () => {
      prisma.pricing_optimization_jobs.findMany.mockResolvedValue([
        { ...pendingJob, id: 2, job_type: 'INCREMENTAL_UPDATE' },
        { ...pendingJob, id: 3, job_type: 'DEMAND_FORECAST' },
      ]);
      prisma.pricing_optimization_jobs.findUnique.mockImplementation(async ({ where }) => ({
        ...pendingJob,
        id: where.id,
        job_type: where.id === 3 ? 'DEMAND_FORECAST' : 'INCREMENTAL_UPDATE',
      }));
      prisma.pricing_optimization_jobs.update.mockResolvedValue({});
      prisma.dynamic_pricing_rules.count.mockResolvedValue(0);
      DynamicPricingService.activatePricingRules.mockResolvedValue([]);
      DemandForecastService.generateForecastsForStore.mockResolvedValue([]);

      const results = await pricingOptimizationService.processPendingJobs(2);

      expect(results).toHaveLength(2);
      expect(results.filter((r) => r.status === 'COMPLETED')).toHaveLength(2);
      expect(DemandForecastService.generateForecastsForStore).toHaveBeenCalledTimes(1);
      expect(DynamicPricingService.activatePricingRules).toHaveBeenCalledTimes(1);
    });

    test('개별 잡 실패가 워커 전체 실행을 중단하지 않는다', async () => {
      prisma.pricing_optimization_jobs.findMany.mockResolvedValue([
        { ...pendingJob, id: 1, job_type: 'FULL_OPTIMIZATION' },
        { ...pendingJob, id: 2, job_type: 'INCREMENTAL_UPDATE' },
      ]);
      prisma.pricing_optimization_jobs.findUnique.mockImplementation(async ({ where }) => ({
        ...pendingJob,
        id: where.id,
        job_type: where.id === 1 ? 'FULL_OPTIMIZATION' : 'INCREMENTAL_UPDATE',
      }));
      prisma.pricing_optimization_jobs.update.mockResolvedValue({});
      prisma.dynamic_pricing_rules.count.mockResolvedValue(0);
      DemandForecastService.generateForecastsForStore.mockRejectedValueOnce(
        new Error('forecast fail')
      );
      DynamicPricingService.activatePricingRules.mockResolvedValue([]);

      const results = await pricingOptimizationService.processPendingJobs(2);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('COMPLETED');
    });
  });
});
