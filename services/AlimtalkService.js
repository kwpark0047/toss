const logger = require('../utils/logger');
const { FRONTEND_URL } = require('../config/domain');
const { getAlimtalkTemplate } = require('../utils/i18n');

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

      logger.info({
        event: 'ALIMTALK_SEND',
        target: phone,
        template: templateCode,
        lang,
        title: tpl.title,
        message: tpl.message
      }, 'Kakao Alimtalk simulated request');

      return { success: true, message: 'Alimtalk queued (Mock)', title: tpl.title, body: tpl.message };
    } catch (error) {
      logger.error({
        event: 'ALIMTALK_FAIL',
        target: phone,
        error: error.message
      }, 'Kakao Alimtalk sending failed');

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
}

module.exports = new AlimtalkService();