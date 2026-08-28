const prisma = require('../config/prisma');
const aiService = require('./aiService');
const logger = require('../utils/logger');

/**
 * 고도화된 수요 예측 서비스
 * - 시계열 분석 (이동평균, 가중이동평균, 지수평활법)
 * - 계절성/요일성 패턴 감지
 * - 외부 요인(날씨, 휴일, 이벤트) 반영
 * - Gemini API를 통한 지능형 인사이트 생성
 */
class DemandForecastService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10분
  }

  /**
   * 매장 전체 상품에 대한 수요 예측 생성 및 저장
   */
  async generateForecastsForStore(storeId, options = {}) {
    const { productIds = null, horizonDays = 7, useAI = true } = options;

    try {
      // 1. 대상 상품 조회
      const products = await prisma.products.findMany({
        where: {
          store_id: storeId,
          is_active: true,
          ...(productIds && { id: { in: productIds.map(Number) } }),
        },
        select: { id: true, name: true, price: true, category_id: true },
      });

      if (!products.length) {
        logger.warn({ storeId }, '예측 대상 상품 없음');
        return [];
      }

      // 2. 과거 주문 데이터 수집 (최근 90일)
      const since90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const orderItems = await prisma.order_items.findMany({
        where: {
          orders: {
            store_id: storeId,
            created_at: { gte: since90Days },
            status: { not: 'cancelled' },
          },
          product_id: { in: products.map((p) => p.id) },
        },
        select: {
          product_id: true,
          quantity: true,
          orders: { select: { created_at: true } },
        },
      });

      // 3. 상품별 일일 수요 시계열 구성
      const timeSeriesByProduct = this._buildTimeSeries(orderItems, products);

      // 4. 각 상품별 예측 수행
      const forecasts = [];
      for (const product of products) {
        try {
          const ts = timeSeriesByProduct.get(product.id) || [];

          if (ts.length < 7) {
            logger.debug({ productId: product.id }, '데이터 부족으로 기본 예측 사용');
            forecasts.push(await this._createFallbackForecast(storeId, product, horizonDays));
            continue;
          }

          // 통계적 예측
          const statisticalForecast = this._statisticalForecast(ts, horizonDays);

          // AI 보정
          let aiAdjusted = statisticalForecast;
          if (useAI) {
            aiAdjusted = await this._aiAdjustForecast(
              product,
              ts,
              statisticalForecast,
              horizonDays
            );
          }

          // 예측 결과 저장
          for (let i = 0; i < horizonDays; i++) {
            const forecastDate = new Date();
            forecastDate.setDate(forecastDate.getDate() + i + 1);
            forecastDate.setHours(0, 0, 0, 0);

            const predicted = aiAdjusted.daily[i] || 0;
            const confidence = aiAdjusted.confidence || 0.5;

            const forecast = await prisma.demand_forecasts.upsert({
              where: {
                store_product_date: {
                  store_id: storeId,
                  product_id: product.id,
                  forecast_date: forecastDate,
                },
              },
              create: {
                store_id: storeId,
                product_id: product.id,
                forecast_date: forecastDate,
                predicted_demand: Math.max(0, Math.round(predicted)),
                confidence_score: confidence,
                factors: {
                  dayOfWeek: forecastDate.getDay(),
                  trend: statisticalForecast.trend,
                  seasonality: statisticalForecast.seasonality,
                  dataPoints: ts.length,
                  modelVersion: 'v3.0-statistical-gemini',
                  aiInsight: aiAdjusted.insight || '',
                },
                model_version: 'v3.0-gemini',
              },
              update: {
                predicted_demand: Math.max(0, Math.round(predicted)),
                confidence_score: confidence,
                factors: {
                  dayOfWeek: forecastDate.getDay(),
                  trend: statisticalForecast.trend,
                  seasonality: statisticalForecast.seasonality,
                  dataPoints: ts.length,
                  modelVersion: 'v3.0-statistical-gemini',
                  aiInsight: aiAdjusted.insight || '',
                },
                model_version: 'v3.0-gemini',
                updated_at: new Date(),
              },
            });
            forecasts.push(forecast);
          }
        } catch (error) {
          logger.warn(
            {
              storeId,
              productId: product.id,
              error: error.message,
            },
            '상품별 예측 실패 (계속 진행)'
          );
        }
      }

      logger.info(
        {
          storeId,
          products: products.length,
          forecasts: forecasts.length,
        },
        '수요 예측 생성 완료'
      );

      return forecasts;
    } catch (error) {
      logger.error({ storeId, error: error.message }, '수요 예측 생성 실패');
      throw error;
    }
  }

  /**
   * 주문 아이템으로부터 일일 시계열 데이터 구성
   */
  _buildTimeSeries(orderItems, products) {
    const timeSeriesByProduct = new Map();
    const productIds = products.map((p) => p.id);

    // 초기화
    productIds.forEach((id) => timeSeriesByProduct.set(id, []));

    // 일일 수요 집계
    const dailyByProduct = new Map();

    for (const item of orderItems) {
      if (!item.product_id || !productIds.includes(item.product_id)) continue;

      const date = new Date(item.orders.created_at).toISOString().slice(0, 10);
      const key = `${item.product_id}:${date}`;

      dailyByProduct.set(key, (dailyByProduct.get(key) || 0) + item.quantity);
    }

    // 최근 90일 범위 생성
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 89);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      for (const productId of productIds) {
        const key = `${productId}:${dateStr}`;
        const qty = dailyByProduct.get(key) || 0;
        const series = timeSeriesByProduct.get(productId);
        series.push({ date: dateStr, quantity: qty });
      }
    }

    return timeSeriesByProduct;
  }

  /**
   * 통계적 시계열 예측 (이동평균 + 트렌드 + 계절성)
   */
  _statisticalForecast(timeSeries, horizon) {
    const quantities = timeSeries.map((d) => d.quantity);
    const n = quantities.length;

    if (n < 7) {
      return {
        daily: Array(horizon).fill(0),
        trend: 'insufficient',
        seasonality: null,
        confidence: 0.3,
      };
    }

    // 1. 이동평균 (7일)
    const ma7 = this._movingAverage(quantities, 7);
    const recentMA7 = ma7[ma7.length - 1] || 0;

    // 2. 가중 이동평균 (최근 14일, 지수 가중치)
    const wma = this._weightedMovingAverage(quantities.slice(-14), 0.15);

    // 3. 지수 평활법 (Holt-Winters 단순화)
    const ses = this._simpleExponentialSmoothing(quantities, 0.3);
    const forecastSES = ses[ses.length - 1];

    // 4. 트렌드 감지 (선형 회귀 기울기)
    const trend = this._detectTrend(quantities.slice(-30));

    // 5. 요일별 계절성 계산
    const seasonality = this._calculateSeasonality(timeSeries);

    // 6. 요일별 계절성 인자 적용
    const lastDate = new Date(timeSeries[timeSeries.length - 1].date);
    const dailyForecasts = [];

    for (let i = 1; i <= horizon; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      const dow = forecastDate.getDay();

      const seasonalFactor = seasonality[dow] || 1.0;
      const baseForecast = (recentMA7 * 0.4 + wma * 0.3 + forecastSES * 0.3) * seasonalFactor;

      // 트렌드 반영
      const trendFactor = 1 + trend.slope * i;
      const predicted = Math.max(0, baseForecast * trendFactor);

      dailyForecasts.push(predicted);
    }

    // 신뢰도 계산
    const cv = this._coefficientOfVariation(quantities.slice(-30));
    const dataScore = Math.min(1, n / 60);
    const confidence = Math.max(0.3, Math.min(0.9, 0.5 + dataScore * 0.3 - cv * 0.2));

    return {
      daily: dailyForecasts,
      trend: trend.direction,
      seasonality: seasonality,
      confidence,
    };
  }

  _movingAverage(arr, window) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      if (i < window - 1) {
        result.push(null);
      } else {
        const sum = arr.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / window);
      }
    }
    return result;
  }

  _weightedMovingAverage(arr, alpha) {
    if (!arr.length) return 0;
    let ema = arr[0];
    for (let i = 1; i < arr.length; i++) {
      ema = alpha * arr[i] + (1 - alpha) * ema;
    }
    return ema;
  }

  _simpleExponentialSmoothing(arr, alpha) {
    if (!arr.length) return [];
    const result = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      result.push(alpha * arr[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
  }

  _detectTrend(arr) {
    const n = arr.length;
    if (n < 2) return { slope: 0, direction: 'stable' };

    const x = Array.from({ length: n }, (_, i) => i);
    const y = arr;

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0,
      denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += (x[i] - xMean) ** 2;
    }

    const slope = denominator ? numerator / denominator : 0;
    let direction = 'stable';
    if (slope > 0.05) direction = 'increasing';
    else if (slope < -0.05) direction = 'decreasing';

    return { slope, direction };
  }

  _calculateSeasonality(timeSeries) {
    const dowSums = Array(7).fill(0);
    const dowCounts = Array(7).fill(0);

    for (const point of timeSeries) {
      const dow = new Date(point.date).getDay();
      dowSums[dow] += point.quantity;
      dowCounts[dow]++;
    }

    const overallMean = timeSeries.reduce((s, p) => s + p.quantity, 0) / timeSeries.length;
    const seasonality = {};

    for (let i = 0; i < 7; i++) {
      if (dowCounts[i] >= 3) {
        seasonality[i] = dowSums[i] / dowCounts[i] / (overallMean || 1);
      } else {
        seasonality[i] = 1.0;
      }
    }

    return seasonality;
  }

  _coefficientOfVariation(arr) {
    const n = arr.length;
    if (n < 2) return 1;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    if (mean === 0) return 1;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    return Math.sqrt(variance) / mean;
  }

  /**
   * AI를 통한 예측 보정
   */
  async _aiAdjustForecast(product, timeSeries, statisticalForecast, horizon) {
    const recentData = timeSeries.slice(-30).map((d) => ({
      date: d.date,
      quantity: d.quantity,
      dow: new Date(d.date).getDay(),
    }));

    const prompt = `
당신은 식당 매출 분석 전문가입니다. 다음 데이터를 바탕으로 수요 예측을 보정해주세요.

[상품 정보]
- 상품명: ${product.name}
- 가격: ${product.price}원
- 카테고리 ID: ${product.category_id}

[최근 30일 일일 수요 데이터]
${JSON.stringify(recentData, null, 2)}

[통계적 예측 결과 (향후 ${horizon}일)]
${JSON.stringify(
  statisticalForecast.daily.map((v, i) => ({
    day: i + 1,
    predicted: Math.round(v),
    dow: new Date(Date.now() + (i + 1) * 86400000).getDay(),
  })),
  null,
  2
)}

[감지된 패턴]
- 트렌드: ${statisticalForecast.trend} (기울기: ${statisticalForecast.trend?.slope || 0})
- 요일별 계절성: ${JSON.stringify(statisticalForecast.seasonality)}
- 변동계수: ${statisticalForecast.confidence ? '높음' : '보통'}

[요청사항]
다음 JSON 형식으로 보정된 예측치를 제안해주세요:
{
  "daily": [숫자, 숫자, ...],  // ${horizon}일치 보정된 예측 수량
  "confidence": 0.0~1.0,       // 전체 신뢰도
  "insight": "한국어 코멘트 (1~2문장, 매장 운영에 도움되는 인사이트)",
  "adjustments": ["조정 사유1", "조정 사유2"]
}

고려사항:
1. 요일별 계절성 패턴 반영
2. 최근 트렌드(증가/감소) 반영
3. 이상치(특별 이벤트, 휴일 등) 감안
4. 현실적인 수량 범위 내 보정
`;

    try {
      const aiResponse = await aiService.generateWithFallback(prompt, {
        generationConfig: {
          temperature: 0.2,
          response_mime_type: 'application/json',
        },
      });

      const cleaned = aiResponse.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        daily: parsed.daily || statisticalForecast.daily,
        confidence: parsed.confidence || statisticalForecast.confidence,
        insight: parsed.insight || '',
        adjustments: parsed.adjustments || [],
      };
    } catch (error) {
      logger.warn(
        {
          productId: product.id,
          error: error.message,
        },
        'AI 예측 보정 실패, 통계적 예측 사용'
      );
      return statisticalForecast;
    }
  }

  /**
   * 폴백 예측 (데이터 부족 시)
   */
  async _createFallbackForecast(storeId, product, horizonDays) {
    const forecasts = [];
    for (let i = 1; i <= horizonDays; i++) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + i);
      forecastDate.setHours(0, 0, 0, 0);

      const forecast = await prisma.demand_forecasts.upsert({
        where: {
          store_product_date: {
            store_id: storeId,
            product_id: product.id,
            forecast_date: forecastDate,
          },
        },
        create: {
          store_id: storeId,
          product_id: product.id,
          forecast_date: forecastDate,
          predicted_demand: 0,
          confidence_score: 0.2,
          factors: {
            reason: '데이터 부족',
            modelVersion: 'v3.0-fallback',
          },
          model_version: 'v3.0-fallback',
        },
        update: {
          predicted_demand: 0,
          confidence_score: 0.2,
          factors: {
            reason: '데이터 부족',
            modelVersion: 'v3.0-fallback',
          },
          model_version: 'v3.0-fallback',
          updated_at: new Date(),
        },
      });
      forecasts.push(forecast);
    }
    return forecasts[0]; // 첫 번째만 반환 (호출부에서 루프로 전체 처리)
  }

  /**
   * 특정 상품의 예측 조회
   */
  async getForecasts(storeId, productId, days = 7) {
    const cacheKey = `forecast_${storeId}_${productId}_${days}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const forecasts = await prisma.demand_forecasts.findMany({
      where: {
        store_id: storeId,
        ...(productId && { product_id: productId }),
        forecast_date: {
          gte: new Date(),
          lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { forecast_date: 'asc' },
      include: { products: { select: { id: true, name: true, price: true } } },
    });

    this.cache.set(cacheKey, { data: forecasts, timestamp: Date.now() });
    return forecasts;
  }

  /**
   * 예측 정확도 평가 (실제 vs 예측)
   */
  async evaluateForecastAccuracy(storeId, productId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const forecasts = await prisma.demand_forecasts.findMany({
      where: {
        store_id: storeId,
        ...(productId && { product_id: productId }),
        forecast_date: { gte: since, lte: new Date() },
      },
      orderBy: { forecast_date: 'asc' },
    });

    if (!forecasts.length) return { accuracy: null, mae: null, mape: null };

    // 실제 주문량 조회
    const forecastDates = forecasts.map((f) => f.forecast_date.toISOString().slice(0, 10));
    const actualOrders = await prisma.order_items.groupBy({
      by: ['product_id'],
      where: {
        orders: {
          store_id: storeId,
          created_at: { gte: since },
          status: { not: 'cancelled' },
        },
        product_id: productId || undefined,
      },
      _sum: { quantity: true },
    });

    const actualMap = {};
    actualOrders.forEach((a) => {
      actualMap[a.product_id] = a._sum.quantity;
    });

    let totalError = 0;
    let totalActual = 0;
    let validCount = 0;

    for (const f of forecasts) {
      const actual = actualMap[f.product_id] || 0;
      const predicted = f.predicted_demand;

      if (actual > 0) {
        totalError += Math.abs(predicted - actual);
        totalActual += actual;
        validCount++;
      }
    }

    const mae = validCount ? totalError / validCount : null;
    const mape = validCount && totalActual ? (totalError / totalActual) * 100 : null;
    const accuracy = mape ? Math.max(0, 100 - mape) : null;

    return {
      accuracy,
      mae,
      mape,
      validCount,
      totalForecasts: forecasts.length,
    };
  }
}

module.exports = new DemandForecastService();
