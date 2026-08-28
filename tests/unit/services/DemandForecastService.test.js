const demandForecastService = require('../../../services/DemandForecastService');

jest.mock('../../../config/prisma');
jest.mock('../../../services/aiService');

const prisma = require('../../../config/prisma');
const aiService = require('../../../services/aiService');

describe('DemandForecastService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('_movingAverage', () => {
    test('7일 이동평균 계산', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = demandForecastService._movingAverage(arr, 7);

      expect(result[0]).toBeNull(); // 0번 인덱스
      expect(result[5]).toBeNull(); // 5번 인덱스 (window-1)
      expect(result[6]).toBe(4); // (1+2+3+4+5+6+7)/7 = 4
      expect(result[9]).toBe(7); // (4+5+6+7+8+9+10)/7 = 7
    });

    test('배열 길이가 window보다 짧으면 null 반환', () => {
      const arr = [1, 2, 3];
      const result = demandForecastService._movingAverage(arr, 5);
      expect(result.every((v) => v === null)).toBe(true);
    });
  });

  describe('_weightedMovingAverage', () => {
    test('지수 가중 이동평균 계산', () => {
      const arr = [10, 12, 11, 13, 12];
      const result = demandForecastService._weightedMovingAverage(arr, 0.3);

      // ema = alpha * current + (1-alpha) * previous
      // ema0 = 10
      // ema1 = 0.3*12 + 0.7*10 = 10.6
      // ema2 = 0.3*11 + 0.7*10.6 = 10.72
      expect(result).toBeGreaterThan(10);
      expect(result).toBeLessThan(13);
    });

    test('빈 배열이면 0 반환', () => {
      expect(demandForecastService._weightedMovingAverage([], 0.3)).toBe(0);
    });
  });

  describe('_simpleExponentialSmoothing', () => {
    test('단순 지수 평활법 결과 배열 반환', () => {
      const arr = [10, 12, 11, 13, 12];
      const result = demandForecastService._simpleExponentialSmoothing(arr, 0.3);

      expect(result.length).toBe(5);
      expect(result[0]).toBe(10); // 첫 값은 동일
      expect(result[1]).toBeCloseTo(10.6, 1);
    });
  });

  describe('_detectTrend', () => {
    test('상승 트렌드 감지', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = demandForecastService._detectTrend(arr);

      expect(result.slope).toBeGreaterThan(0);
      expect(result.direction).toBe('increasing');
    });

    test('하락 트렌드 감지', () => {
      const arr = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      const result = demandForecastService._detectTrend(arr);

      expect(result.slope).toBeLessThan(0);
      expect(result.direction).toBe('decreasing');
    });

    test('안정 트렌드 감지', () => {
      const arr = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
      const result = demandForecastService._detectTrend(arr);

      expect(result.slope).toBe(0);
      expect(result.direction).toBe('stable');
    });
  });

  describe('_calculateSeasonality', () => {
    test('요일별 계절성 인자 계산', () => {
      // 월요일(1)마다 수요가 2배, 일요일(0)마다 0.5배인 시계열 생성
      const timeSeries = [];
      for (let i = 0; i < 28; i++) {
        const date = new Date('2026-01-01');
        date.setDate(date.getDate() + i);
        const dow = date.getDay();
        let qty = 10;
        if (dow === 1) qty = 20; // 월요일
        if (dow === 0) qty = 5; // 일요일
        timeSeries.push({ date: date.toISOString().slice(0, 10), quantity: qty });
      }

      const seasonality = demandForecastService._calculateSeasonality(timeSeries);

      expect(seasonality[1]).toBeGreaterThan(seasonality[0]); // 월요일 > 일요일
      expect(seasonality[1]).toBeCloseTo(2.0, 0); // 월요일 ~2배
      expect(seasonality[0]).toBeCloseTo(0.5, 0); // 일요일 ~0.5배
    });
  });

  describe('_coefficientOfVariation', () => {
    test('변동계수 계산', () => {
      const arr = [10, 10, 10, 10]; // 변동 없음
      expect(demandForecastService._coefficientOfVariation(arr)).toBe(0);

      const arr2 = [5, 15, 5, 15]; // 변동 있음
      const cv = demandForecastService._coefficientOfVariation(arr2);
      expect(cv).toBeGreaterThan(0);
      expect(cv).toBeLessThan(1);
    });
  });

  describe('generateForecastsForStore', () => {
    test('상품이 없으면 빈 배열 반환', async () => {
      prisma.products.findMany.mockResolvedValue([]);

      const result = await demandForecastService.generateForecastsForStore(1);
      expect(result).toEqual([]);
    });
  });
});
