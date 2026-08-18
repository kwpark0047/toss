const logger = require('../utils/logger');
const { FRONTEND_URL } = require('../config/domain');
const { getAlimtalkTemplate } = require('../utils/i18n');
const prisma = require('../config/prisma');

class AlimtalkService {
  /**
   * 카카오 알림톡 발송 (Mock)
   * 실제 연동 시 알리고(Aligo), 비즈뿌리오 등의 API로 교체
   * @param {string} phone - 수신자 전화번호
   * @param {string} templateCode - 템플릿 코드 (예: WAITING_REG)
   * @param {object} templateData - 치환 변수
   * @param {string} [lang='ko'] - 언어 코드 (ko/en/ja/zh)
   */
  async sendAlimtalk(phone, templateCode, templateData, lang = 'ko') {
    try {
      // 다국어 번역 템플릿 조회
      const tpl = getAlimtalkTemplate(templateCode, lang, templateData);

      logger.info(
        {
          event: 'ALIMTALK_SEND',
          target: phone,
          template: templateCode,
          lang,
          title: tpl.title,
          message: tpl.message,
        },
        'Kakao Alimtalk simulated request'
      );

      return {
        success: true,
        message: 'Alimtalk queued (Mock)',
        title: tpl.title,
        body: tpl.message,
      };
    } catch (error) {
      logger.error(
        {
          event: 'ALIMTALK_FAIL',
          target: phone,
          error: error.message,
        },
        'Kakao Alimtalk sending failed'
      );

      return { success: false, error: error.message };
    }
  }

  // 템플릿: 웨이팅 등록 완료
  async sendWaitingRegistered(phone, storeName, waitingNumber, waitingCount, lang = 'ko') {
    const data = { storeName, waitingNumber, waitingCount, link: FRONTEND_URL };
    return this.sendAlimtalk(phone, 'WAITING_REG', data, lang);
  }

  // 템플릿: 입장 순서 안내 (내 앞 1팀)
  async sendWaitingReady(phone, storeName, waitingNumber, lang = 'ko') {
    const data = { storeName, waitingNumber };
    return this.sendAlimtalk(phone, 'WAITING_READY', data, lang);
  }

  // 템플릿: 입장 호출 (지금 입장해주세요)
  async sendWaitingCall(phone, storeName, waitingNumber, lang = 'ko') {
    const data = { storeName, waitingNumber };
    return this.sendAlimtalk(phone, 'WAITING_CALL', data, lang);
  }

  // 템플릿: 웨이팅 취소
  async sendWaitingCancel(phone, storeName, lang = 'ko') {
    const data = { storeName };
    return this.sendAlimtalk(phone, 'WAITING_CANCEL', data, lang);
  }

  // ── 주문 관련 알림톡 ─────────────────────────────────────

  // 템플릿: 주문 접수 확인
  async sendOrderConfirmed(phone, storeName, orderNumber, queueNumber, totalAmount, lang = 'ko') {
    const data = { storeName, orderNumber, queueNumber, totalAmount };
    return this.sendAlimtalk(phone, 'ORDER_CONFIRMED', data, lang);
  }

  // 템플릿: 음식 준비 완료
  async sendFoodReady(phone, storeName, orderNumber, tableName, lang = 'ko') {
    const data = { storeName, orderNumber, tableName };
    return this.sendAlimtalk(phone, 'FOOD_READY', data, lang);
  }

  // 템플릿: 주문 취소
  async sendOrderCancelled(phone, storeName, orderNumber, reason, lang = 'ko') {
    const data = { storeName, orderNumber, reason };
    return this.sendAlimtalk(phone, 'ORDER_CANCELLED', data, lang);
  }

  // ── 알림톡 전송 이력 조회 (모니터 대시보드용) ─────────────────
  async getHistoryLogs(storeId, options = {}) {
    const { limit = 100, offset = 0, _templateFilter, _statusFilter } = options;

    try {
      // notifications 테이블에서 해당 매장의 알림톡 관련 이력 조회
      // type이 ORDER_*, WAITING_* 등으로 시작하는 것들을 알림톡 전송으로 간주
      const where = {
        store_id: storeId,
        type: {
          in: [
            'ORDER_CONFIRMED',
            'FOOD_READY',
            'ORDER_CANCELLED',
            'WAITING_REG',
            'WAITING_READY',
            'WAITING_CALL',
            'WAITING_CANCEL',
            'SETTLEMENT_INFO',
            'PAYMENT_COMPLETE',
            'ANOMALY_ALERT',
          ],
        },
      };

      const [logs, total] = await Promise.all([
        prisma.notifications.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            type: true,
            title: true,
            message: true,
            data: true,
            created_at: true,
            priority: true,
          },
        }),
        prisma.notifications.count({ where }),
      ]);

      // 프론트엔드 AlimtalkDeliveryConsole이 기대하는 포맷으로 변환
      const formattedLogs = logs.map((log) => {
        let phone = '알수없음';
        let templateId = log.type;
        let simulated = true; // 현재는 Mock이므로 모두 시뮬레이션
        let fallback = false;
        let cost = 15; // 알림톡 단가 ₩15

        // data 필드(JSON 문자열)에서 추가 정보 파싱
        if (log.data) {
          try {
            const parsed = JSON.parse(log.data);
            phone = parsed.customer_phone || parsed.phone || phone;
            templateId = parsed.templateCode || parsed.template || templateId;
            fallback = parsed.fallback === true;
            if (fallback) cost = 50; // SMS 대체 단가 ₩50
            simulated = parsed.simulated !== false;
          } catch {
            // 파싱 실패 시 기본값 유지
          }
        }

        return {
          id: log.id,
          phone,
          templateId,
          text: log.message,
          simulated,
          fallback,
          sent: true,
          timestamp: log.created_at,
          cost,
        };
      });

      // 성공/대체 통계 계산
      const successCount = formattedLogs.filter((l) => !l.fallback && l.sent).length;
      const fallbackCount = formattedLogs.filter((l) => l.fallback).length;
      const totalCost = formattedLogs.reduce((sum, l) => sum + (l.cost || 0), 0);

      return {
        summary: {
          total: total,
          success: successCount,
          fallback: fallbackCount,
          total_cost: totalCost,
        },
        logs: formattedLogs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      logger.error(
        {
          event: 'ALIMTALK_HISTORY_FAIL',
          storeId,
          error: error.message,
        },
        '알림톡 이력 조회 실패'
      );

      // 에러 시 빈 데이터 반환 (UI 깨짐 방지)
      return {
        summary: { total: 0, success: 0, fallback: 0, total_cost: 0 },
        logs: [],
        pagination: { total: 0, limit, offset, hasMore: false },
      };
    }
  }
}

module.exports = new AlimtalkService();
