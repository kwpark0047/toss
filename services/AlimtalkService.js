const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');
const { sendSms } = require('../utils/smsService');

const IS_DEV = process.env.NODE_ENV !== 'production';
const SMS_ENV = process.env.SMS_ENV || 'none';
const COOLSMS_API_URL = 'https://api.coolsms.co.kr';

class AlimtalkService {
    constructor() {
        this.pfId = process.env.KAKAO_PF_ID || 'KA01PF24050012'; // 가상의 카카오 알림톡 pfId
    }

    /**
     * 카카오 알림톡 공통 발송 모듈
     * pfId 및 등록된 승인 템플릿(templateId)을 사용하여 알림톡을 전송합니다.
     */
    async sendAlimtalk(phone, templateId, text, variables = {}) {
        if (IS_DEV || SMS_ENV === 'none') {
            logger.info(`[ALIMTALK SIMULATION] → ${phone} | Template: ${templateId}`);
            logger.info(`[ALIMTALK CONTENT] \n${text}`);
            return { simulated: true, templateId, phone };
        }

        try {
            if (SMS_ENV === 'coolsms') {
                const apiKey = process.env.SMS_API_KEY;
                const apiSecret = process.env.SMS_API_SECRET;
                const sender = process.env.SMS_SENDER;

                if (!apiKey || !apiSecret || !sender) {
                    throw new Error('Coolsms 환경변수가 누락되었습니다.');
                }

                const salt = crypto.randomBytes(16).toString('hex');
                const timestamp = Date.now().toString();
                
                const signature = crypto.createHmac('sha256', apiSecret)
                    .update(`${timestamp}${salt}`)
                    .digest('hex');

                const res = await axios.post(`${COOLSMS_API_URL}/messages/v4/send`, {
                    message: {
                        to: phone,
                        from: sender,
                        type: 'ATA',
                        text: text,
                        kakaoOptions: {
                            pfId: this.pfId,
                            templateId: templateId
                        }
                    }
                }, {
                    headers: {
                        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${salt}, signature=${signature}`,
                        'Content-Type': 'application/json'
                    }
                });

                logger.info(`[ALIMTALK] 발송 성공 → ${phone} | Template: ${templateId}`);
                return { sent: true, messageId: res.data.messageId };
            }

            // Fallback to SMS if Alimtalk environment is not fully configured
            logger.warn(`[ALIMTALK] 알림톡 발송 환경변수가 활성화되지 않아 SMS로 대체 전송합니다.`);
            await sendSms(phone, text);
            return { fallback: true };
        } catch (error) {
            logger.error('[ALIMTALK] 발송 실패:', error.response?.data || error.message);
            return { sent: false, error: error.message };
        }
    }

    /**
     * 1. 주문 접수 알림톡
     */
    async sendOrderConfirmed(phone, storeName, orderNumber, queueNumber, totalAmount) {
        const templateId = 'order_confirmed';
        const text = `[${storeName}] 주문이 접수되었습니다! 🎉

■ 주문번호: ${orderNumber}
■ 대기번호: ${queueNumber || '접수 대기'}
■ 결제금액: ${Number(totalAmount).toLocaleString('ko-KR')}원

매장 내 모니터나 직원의 안내에 따라 대기해 주세요.
이용해 주셔서 감사합니다.`;

        return await this.sendAlimtalk(phone, templateId, text, { storeName, orderNumber, queueNumber, totalAmount });
    }

    /**
     * 2. 조리 완료 (픽업 요청) 알림톡
     */
    async sendFoodReady(phone, storeName, orderNumber, tableName) {
        const templateId = 'food_ready';
        const text = `[${storeName}] 주문하신 음식이 조리 완료되었습니다! 🔔

■ 주문번호: ${orderNumber}
■ 수령위치: 매장 픽업대

음식이 식기 전에 픽업대에서 수령해 주세요.
맛있게 드시고 좋은 시간 되세요!`;

        return await this.sendAlimtalk(phone, templateId, text, { storeName, orderNumber, tableName });
    }

    /**
     * 3. 주문 취소 알림톡
     */
    async sendOrderCancelled(phone, storeName, orderNumber, reason = '매장 사정 또는 재고 소진') {
        const templateId = 'order_cancelled';
        const text = `[${storeName}] 주문 취소 안내 ❌

■ 주문번호: ${orderNumber}
■ 취소사유: ${reason}

결제하신 금액은 영업일 기준 2~3일 이내에 카드사 또는 결제 수단을 통해 전액 환불 처리됩니다.
이용에 불편을 드려 정말 죄송합니다.`;

        return await this.sendAlimtalk(phone, templateId, text, { storeName, orderNumber, reason });
    }

    /**
     * 4. 푸드트럭 실시간 연결 끊김 방지 알림톡 (하트비트 예비 수단)
     */
    async sendHeartbeatDisconnectAlert(phone, storeName, queueNumber, orderNumber) {
        const templateId = 'heartbeat_disconnect';
        const text = `[${storeName}] 실시간 대기 안내 📡

고객님! 일시적인 통신 상태 변화로 주문판 웹소켓 연결이 종료되었습니다.

하지만 걱정 마세요! 고객님의 주문 및 대기 줄은 정상 유지 중입니다.

■ 대기번호: ${queueNumber || 'N/A'}번 (주문번호: ${orderNumber})

조리가 완료되거나 호출 시 카카오톡으로 즉시 다시 알림을 발송해 드리겠습니다. 안심하고 이동해 주세요!`;

        return await this.sendAlimtalk(phone, templateId, text, { storeName, queueNumber, orderNumber });
    }
}

module.exports = new AlimtalkService();
