const logger = require('../utils/logger');
const { FRONTEND_URL } = require('../config/domain');

class AlimtalkService {
  /**
   * 카카오 알림톡 발송 (Mock)
   * 실제 연동 시 알리고(Aligo), 비즈뿌리오 등의 API로 교체
   */
  async sendAlimtalk(phone, templateCode, templateData) {
    try {
      // 1. 발송 데이터 로깅 (비용 과금 방지를 위한 Mocking)
      logger.info({
        event: 'ALIMTALK_SEND',
        target: phone,
        template: templateCode,
        data: templateData
      }, 'Kakao Alimtalk simulated request');

      // 2. 실제 API 호출 로직이 들어갈 자리
      // const response = await axios.post('https://api.aligo.in/send/', payload);

      return { success: true, message: 'Alimtalk queued (Mock)' };
    } catch (error) {
      logger.error({
        event: 'ALIMTALK_FAIL',
        target: phone,
        error: error.message
      }, 'Kakao Alimtalk sending failed');
      
      // 알림톡 실패가 메인 비즈니스 로직(대기 등록 등)을 롤백시키지 않도록
      // 에러를 던지지 않고 성공/실패 여부만 반환
      return { success: false, error: error.message };
    }
  }

  // 템플릿: 웨이팅 등록 완료
  async sendWaitingRegistered(phone, storeName, waitingNumber, waitingCount) {
    const data = {
      storeName,
      waitingNumber,
      waitingCount,
      link: FRONTEND_URL
    };
    return this.sendAlimtalk(phone, 'WAITING_REG', data);
  }

  // 템플릿: 입장 순서 안내 (내 앞 1팀)
  async sendWaitingReady(phone, storeName, waitingNumber) {
    const data = { storeName, waitingNumber };
    return this.sendAlimtalk(phone, 'WAITING_READY', data);
  }

  // 템플릿: 입장 호출 (지금 입장해주세요)
  async sendWaitingCall(phone, storeName, waitingNumber) {
    const data = { storeName, waitingNumber };
    return this.sendAlimtalk(phone, 'WAITING_CALL', data);
  }

  // 템플릿: 웨이팅 취소
  async sendWaitingCancel(phone, storeName) {
    const data = { storeName };
    return this.sendAlimtalk(phone, 'WAITING_CANCEL', data);
  }

  // ── 주문 관련 알림톡 ─────────────────────────────────────

  // 템플릿: 주문 접수 확인
  async sendOrderConfirmed(phone, storeName, orderNumber, queueNumber, totalAmount) {
    const data = { storeName, orderNumber, queueNumber, totalAmount };
    return this.sendAlimtalk(phone, 'ORDER_CONFIRMED', data);
  }

  // 템플릿: 음식 준비 완료
  async sendFoodReady(phone, storeName, orderNumber, tableName) {
    const data = { storeName, orderNumber, tableName };
    return this.sendAlimtalk(phone, 'FOOD_READY', data);
  }

  // 템플릿: 주문 취소
  async sendOrderCancelled(phone, storeName, orderNumber, reason) {
    const data = { storeName, orderNumber, reason };
    return this.sendAlimtalk(phone, 'ORDER_CANCELLED', data);
  }
}

module.exports = new AlimtalkService();