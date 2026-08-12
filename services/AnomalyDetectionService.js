const prisma = require('../config/prisma');
const AlimtalkService = require('./AlimtalkService');
const logger = require('../utils/logger');

/**
 * AI 기반 매출 변동성 분석 및 실시간 매장 위기 경보(Crisis Alarm) 서비스
 * 최근 1시간 결제 및 주문량을 지난 24시간 동안의 평균/표준편차와 대조하여
 * 통계적 Z-Score 가 한계치(절대값 2.0)를 초과하는 돌발 이상 징후(폭증/급감) 감지 시
 * 실시간 소켓 알림 브로드캐스트와 모바일 비상 알림톡 전송을 원자적으로 가동합니다.
 */
class AnomalyDetectionService {
  /**
   * 특정 매장의 라이브 결제 트랜잭션 변동성 감사 및 비상 위기 알림 감지
   */
  async checkSalesAnomaly(storeId, io = null) {
    try {
      const numericStoreId = parseInt(storeId);
      if (isNaN(numericStoreId)) return null;

      // 1. 최근 1시간 주문 결제 수량 파악
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const currentHourOrders = await prisma.orders.count({
        where: {
          store_id: numericStoreId,
          created_at: { gte: oneHourAgo },
          status: { not: 'cancelled' },
        },
      });

      // 지난 24시간 쿼리 데이터 적재 (시간대별 모수 산출을 위함)
      const pastOrders = await prisma.orders.findMany({
        where: {
          store_id: numericStoreId,
          created_at: { gte: twentyFourHoursAgo, lte: oneHourAgo },
          status: { not: 'cancelled' },
        },
        select: { created_at: true },
      });

      // 24시간을 1시간 단위 슬롯(총 23개 구간)으로 파쇄하여 분포율 계산
      const hourlySlots = Array.from({ length: 23 }, () => 0);
      pastOrders.forEach((order) => {
        const hoursDiff =
          Math.floor((now.getTime() - new Date(order.created_at).getTime()) / (60 * 60 * 1000)) - 1;
        if (hoursDiff >= 0 && hoursDiff < 23) {
          hourlySlots[hoursDiff]++;
        }
      });

      // 통계 모델 Z-Score 구현 (평균 및 표준편차 편차율 산출)
      const totalSlots = hourlySlots.length;
      const mean = hourlySlots.reduce((a, b) => a + b, 0) / totalSlots;
      const variance = hourlySlots.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / totalSlots;
      const stdDev = Math.sqrt(variance) || 1; // 0 분모 격파 방지

      // Z-Score = (현재 표본값 - 역사적 모평균) / 표준편차
      const zScore = (currentHourOrders - mean) / stdDev;

      logger.info(
        `[Anomaly Engine] Store ${numericStoreId} | Current Slot: ${currentHourOrders} | Historical Mean: ${mean.toFixed(2)} | StdDev: ${stdDev.toFixed(2)} | Z-Score: ${zScore.toFixed(2)}`
      );

      // 2. 비상 경보 트리거 감지 (표준편차 2.0배수 이격을 넘어서는 비정상 징후 필터)
      // 단, 극단적 표본 왜곡 방지를 위해 현재 시간 주문이 최소 5건 이상이거나 평균이 최소 2개 이상일 때만 동작 보증
      if (Math.abs(zScore) >= 2.0 && (currentHourOrders >= 5 || mean >= 2)) {
        const store = await prisma.stores.findUnique({
          where: { id: numericStoreId },
          select: { name: true, phone: true },
        });
        const storeName = store ? store.name : '위마켓';

        let alertType = '';
        let alertTitle = '';
        let alertMessage = '';
        let alimtalkText = '';

        if (zScore > 2.0) {
          // 주문 폭증 경보 (조리 대기열 포화 위험성)
          alertType = 'SURGE';
          alertTitle = '🚨 [위마켓 비상] 주문 결제 급증 경보';
          alertMessage = `현재 1시간 주문 수량(${currentHourOrders}건)이 평소 평균 대비 극도로 돌발 폭증하였습니다. 조리 지연 방지를 위해 즉시 인력을 충원하거나 메뉴 상태를 점검하십시오.`;
          alimtalkText = `[${storeName}] 실시간 위기 알림 🚨\n\n현재 매장의 신규 주문 유입 속도가 평소 평균 대비 ${Math.round(zScore * 100)}% 이상 돌발 폭증하였습니다!\n\n■ 1시간 주문: ${currentHourOrders}건\n■ 평균 주문: ${mean.toFixed(1)}건\n\nKDS 조리 지연 대기열 및 영수증 프린터 상태를 즉시 정밀 진단하시고, 필요한 경우 점주 전용 어드민에서 '비상 전체 품절' 킬스위치를 즉시 가동하십시오!`;
        } else if (zScore < -2.0) {
          // 주문 급감 경보 (결제 모듈 오프라인 및 인터넷 장애 감지)
          alertType = 'FREEZE';
          alertTitle = '🚨 [위마켓 경보] 주문 결제 급감 경보';
          alertMessage = `현재 1시간 주문 결제 수량(${currentHourOrders}건)이 역사적 최저 평균치 미만으로 급감하였습니다. 단말기 와이파이 신호선 또는 결제대행(Toss API) 웹 브릿지 오류 상태를 지금 즉시 긴급 점검하십시오.`;
          alimtalkText = `[${storeName}] 시스템 위기 알림 🚨\n\n현재 최근 1시간 동안의 신규 결제 매출이 평소 역사적 평균 대비 90% 이상 비정상 급감하였습니다!\n\n■ 1시간 주문: ${currentHourOrders}건\n■ 평균 주문: ${mean.toFixed(1)}건\n\n매장의 결제용 단말기 무선 인터넷 연결 상태 또는 토스페이먼츠(Toss Payments) 실시간 API 가동 한계 지표를 지금 즉시 긴급 점검하십시오!`;
        }

        // 3. 데이터베이스 알림 레코드 영구 적재 (Prisma Audit)
        await prisma.notifications.create({
          data: {
            store_id: numericStoreId,
            type: 'SYSTEM',
            title: alertTitle,
            message: alertMessage,
            data: JSON.stringify({ zScore, currentHourOrders, mean, alertType }),
            is_read: false,
            priority: 'urgent',
          },
        });

        // 4. 점주 모바일 보안 알림톡/SMS 자동 긴급 전파
        if (store && store.phone) {
          const decryptPhone = require('../utils/phoneEncryption').decryptPhone;
          try {
            const decryptedPhone = decryptPhone(store.phone);
            if (decryptedPhone) {
              await AlimtalkService.sendAlimtalk(decryptedPhone, 'anomaly_alert', alimtalkText);
            }
          } catch (err) {
            logger.error(`[Anomaly Alimtalk] Failed to dispatch: ${err.message}`);
          }
        }

        // 5. 웹소켓 매니저 다이얼로그 즉시 팝업 이벤트 브로드캐스팅
        if (io) {
          io.to(`store - ${numericStoreId}`).emit('system:anomaly_alert', {
            storeId: numericStoreId,
            alertType,
            title: alertTitle,
            message: alertMessage,
            zScore,
            currentHourOrders,
            mean,
          });
          logger.info(
            `[Anomaly Socket] Successfully broadcasted system:anomaly_alert to Store ${numericStoreId}`
          );
        }

        return { anomalyDetected: true, alertType, zScore };
      }

      return { anomalyDetected: false, zScore };
    } catch (err) {
      logger.error(`[Anomaly Engine] Failure: ${err.message}`);
      return null;
    }
  }
}

module.exports = new AnomalyDetectionService();
