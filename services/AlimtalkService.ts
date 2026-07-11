import crypto from 'crypto';
import axios from 'axios';
import logger from '../utils/logger';
import { sendSms } from '../utils/smsService';

const IS_DEV = process.env.NODE_ENV !== 'production';
const SMS_ENV = process.env.SMS_ENV || 'none';
const COOLSMS_API_URL = 'https://api.coolsms.co.kr';

export interface AlimtalkResponse {
    sent: boolean;
    simulated?: boolean;
    fallback?: boolean;
    messageId?: string;
    error?: string;
}

export interface AlimtalkLog {
    id: string;
    storeId: number;
    phone: string;
    templateId: string;
    text: string;
    status: 'SUCCESS' | 'FAILED' | 'FALLBACK';
    cost: number; // ₩15 per Alimtalk, ₩20 per Fallback SMS
    errorMessage?: string;
    createdAt: Date;
}

export interface AlimtalkHistorySummary {
    total_sent: number;
    success_rate: number;
    total_cost: number;
    logs: AlimtalkLog[];
}

class AlimtalkService {
    private pfId: string;
    private historyLogs: AlimtalkLog[] = [];

    constructor() {
        this.pfId = process.env.KAKAO_PF_ID || 'KA01PF24050012'; // 가상의 카카오 알림톡 pfId
    }

    /**
     * 카카오 알림톡 공통 발송 및 이력 누적 로깅 모듈 (지수 비용 계산 탑재)
     */
    async sendAlimtalk(
        phone: string, 
        templateId: string, 
        text: string, 
        variables: any = {}, 
        storeId: number = 1
    ): Promise<AlimtalkResponse> {
        const logId = `talk_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
        
        if (IS_DEV || SMS_ENV === 'none') {
            logger.info(`[ALIMTALK SIMULATION] → ${phone} | Template: ${templateId}`);
            logger.info(`[ALIMTALK CONTENT] \n${text}`);
            
            // 이력 누적
            this.historyLogs.push({
                id: logId,
                storeId,
                phone,
                templateId,
                text,
                status: 'SUCCESS',
                cost: 15, // 가상 알림톡 수수료 15원
                createdAt: new Date()
            });

            return { sent: true, simulated: true };
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
                
                this.historyLogs.push({
                    id: logId,
                    storeId,
                    phone,
                    templateId,
                    text,
                    status: 'SUCCESS',
                    cost: 15,
                    createdAt: new Date()
                });

                return { sent: true, messageId: res.data.messageId };
            }

            // Fallback to SMS if Alimtalk environment is not fully configured
            logger.warn(`[ALIMTALK] 알림톡 발송 환경변수가 활성화되지 않아 SMS로 대체 전송합니다.`);
            await sendSms(phone, text);

            this.historyLogs.push({
                id: logId,
                storeId,
                phone,
                templateId,
                text,
                status: 'FALLBACK',
                cost: 20, // SMS 대체 발송 비용 20원
                createdAt: new Date()
            });

            return { sent: true, fallback: true };
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message;
            logger.error('[ALIMTALK] 발송 실패:', errorMsg);

            this.historyLogs.push({
                id: logId,
                storeId,
                phone,
                templateId,
                text,
                status: 'FAILED',
                cost: 0,
                errorMessage: errorMsg,
                createdAt: new Date()
            });

            return { sent: false, error: error.message };
        }
    }

    /**
     * 특정 매장의 알림톡 발송 내역 조회 및 통계 집계 산출
     */
    getHistoryLogs(storeId: string | number): AlimtalkHistorySummary {
        const numericStoreId = typeof storeId === 'string' ? parseInt(storeId, 10) : storeId;
        const logs = this.historyLogs.filter(l => l.storeId === numericStoreId);
        
        if (logs.length === 0) {
            return {
                total_sent: 0,
                success_rate: 100,
                total_cost: 0,
                logs: []
            };
        }

        const successCount = logs.filter(l => l.status === 'SUCCESS' || l.status === 'FALLBACK').length;
        const totalCost = logs.reduce((sum, l) => sum + l.cost, 0);

        return {
            total_sent: logs.length,
            success_rate: Math.round((successCount / logs.length) * 1000) / 10,
            total_cost: totalCost,
            logs: [...logs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // 최신순 정렬
        };
    }

    /**
     * 1. 주문 접수 알림톡
     */
    async sendOrderConfirmed(
        phone: string, 
        storeName: string, 
        orderNumber: string, 
        queueNumber: number | null, 
        totalAmount: number,
        storeId: number = 1
    ): Promise<AlimtalkResponse> {
        const templateId = 'order_confirmed';
        const text = `[${storeName}] 주문이 접수되었습니다! 🎉
\n■ 주문번호: ${orderNumber}
■ 대기번호: ${queueNumber || '접수 대기'}
■ 결제금액: ${Number(totalAmount).toLocaleString('ko-KR')}원
\n매장 내 모니터나 직원의 안내에 따라 대기해 주세요.
이용해 주셔서 감사합니다.`;

        return await this.sendAlimtalk(phone, templateId, text, { storeName, orderNumber, queueNumber, totalAmount }, storeId);
    }

    /**
     * 2. 조리 완료 (픽업 요청) 알림톡
     */
    async sendFoodReady(
        phone: string, 
        storeName: string, 
        orderNumber: string, 
        tableName: string,
        storeId: number = 1
    ): Promise<AlimtalkResponse> {
        const templateId = 'food_ready';
        const text = `[${storeName}] 주문하신 음식이 조리 완료되었습니다! 🔔
\n■ 주문번호: ${orderNumber}
■ 수령위치: 매장 픽업대
\n음식이 식기 전에 픽업대에서 수령해 주세요.
맛있게 드시고 좋은 시간 되세요!`;

        return await this.sendAlimtalk(phone, templateId, text, { storeName, orderNumber, tableName }, storeId);
    }

    /**
     * 3. 주문 취소 알림톡
     */
    async sendOrderCancelled(
        phone: string, 
        storeName: string, 
        orderNumber: string, 
        reason: string = '매장 사정 또는 재고 소진',
        storeId: number = 1
    ): Promise<AlimtalkResponse> {
        const templateId = 'order_cancelled';
        const text = `[${storeName}] 주문 취소 안내 ❌
\n■ 주문번호: ${orderNumber}
■ 취소사유: ${reason}
\n결제하신 금액은 영업일 기준 2~3일 이내에 카드사 또는 결제 수단을 통해 전액 환불 처리됩니다.
이용에 불편을 드려 정말 죄송합니다.`;

        return await this.sendAlimtalk(phone, templateId, text, { storeName, orderNumber, reason }, storeId);
    }

    /**
     * 4. 푸드트럭 실시간 연결 끊김 방지 알림톡 (하트비트 예비 수단)
     */
    async sendHeartbeatDisconnectAlert(
        phone: string, 
        storeName: string, 
        queueNumber: number | string | null, 
        orderNumber: string,
        storeId: number = 1
    ): Promise<AlimtalkResponse> {
        const templateId = 'heartbeat_disconnect';
        const text = `[${storeName}] 실시간 대기 안내 📡
\n고객님! 일시적인 통신 상태 변화로 주문판 웹소켓 연결이 종료되었습니다.
\n하지만 걱정 마세요! 고객님의 주문 및 대기 줄은 정상 유지 중입니다.
\n■ 대기번호: ${queueNumber || 'N/A'}번 (주문번호: ${orderNumber})
\n조리가 완료되거나 호출 시 카카오톡으로 즉시 다시 알림을 발송해 드리겠습니다. 안심하고 이동해 주세요!`;

        return await this.sendAlimtalk(phone, templateId, text, { storeName, queueNumber, orderNumber }, storeId);
    }
}

const alimtalkServiceInstance = new AlimtalkService();
export = alimtalkServiceInstance;
