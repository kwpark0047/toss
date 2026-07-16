const { notificationLogger } = require('../utils/logger');

class AlimtalkService {
  /**
   * 카카오 알림톡 발송 (Mock)
   * 실제 연동 시 알리고(Aligo), 비즈뿌리오 등의 API로 교체
   */
  async sendAlimtalk(phone, templateCode, templateData) {
    try {
      // 1. 발송 데이터 로깅 (비용 과금 방지를 위한 Mocking)
      notificationLogger.info({
        event: 'ALIMTALK_SEND',
        target: phone,
        template: templateCode,
        data: templateData
      }, 'Kakao Alimtalk simulated request');

      // 2. 실제 API 호출 로직이 들어갈 자리
      // const response = await axios.post('https://api.aligo.in/send/', payload);

      return { success: true, message: 'Alimtalk queued (Mock)' };
    } catch (error) {
      notificationLogger.error({
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
      link: 'https://toss.wemarket.workers.dev'
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
}

module.exports = new AlimtalkService();
