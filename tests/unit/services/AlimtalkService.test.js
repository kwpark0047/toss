jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const AlimtalkService = require('../../../services/AlimtalkService');
const logger = require('../../../utils/logger');

describe('AlimtalkService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('sendAlimtalk', () => {
        test('알림톡 발송 시 로깅 후 성공 반환', async () => {
            const result = await AlimtalkService.sendAlimtalk('01012345678', 'TEST_TMPL', { foo: 'bar' });
            expect(result.success).toBe(true);
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({ event: 'ALIMTALK_SEND', template: 'TEST_TMPL' }),
                expect.any(String)
            );
        });

        test('예외 발생 시 실패 반환 (메인 흐름 롤백 안 함)', async () => {
            logger.info.mockImplementation(() => { throw new Error('log fail'); });
            const result = await AlimtalkService.sendAlimtalk('01012345678', 'TMPL', {});
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('sendWaitingRegistered', () => {
        test('웨이팅 등록 완료 알림톡을 발송한다', async () => {
            const spy = jest.spyOn(AlimtalkService, 'sendAlimtalk').mockResolvedValue({ success: true });
            const result = await AlimtalkService.sendWaitingRegistered('01012345678', '테스트매장', 5, 3);
            expect(spy).toHaveBeenCalledWith('01012345678', 'WAITING_REG', expect.objectContaining({
                storeName: '테스트매장',
                waitingNumber: 5,
                waitingCount: 3,
                link: expect.any(String)
            }), 'ko');
            expect(result.success).toBe(true);
        });
    });

    describe('sendWaitingReady', () => {
        test('대기 순서 안내 알림톡을 발송한다', async () => {
            const spy = jest.spyOn(AlimtalkService, 'sendAlimtalk').mockResolvedValue({ success: true });
            await AlimtalkService.sendWaitingReady('01012345678', '테스트매장', 5);
            expect(spy).toHaveBeenCalledWith('01012345678', 'WAITING_READY', expect.objectContaining({
                storeName: '테스트매장',
                waitingNumber: 5
            }), 'ko');
        });
    });

    describe('sendWaitingCall', () => {
        test('입장 호출 알림톡을 발송한다', async () => {
            const spy = jest.spyOn(AlimtalkService, 'sendAlimtalk').mockResolvedValue({ success: true });
            await AlimtalkService.sendWaitingCall('01012345678', '테스트매장', 5);
            expect(spy).toHaveBeenCalledWith('01012345678', 'WAITING_CALL', expect.objectContaining({
                storeName: '테스트매장',
                waitingNumber: 5
            }), 'ko');
        });
    });

    describe('sendWaitingCancel', () => {
        test('웨이팅 취소 알림톡을 발송한다', async () => {
            const spy = jest.spyOn(AlimtalkService, 'sendAlimtalk').mockResolvedValue({ success: true });
            await AlimtalkService.sendWaitingCancel('01012345678', '테스트매장');
            expect(spy).toHaveBeenCalledWith('01012345678', 'WAITING_CANCEL', expect.objectContaining({
                storeName: '테스트매장'
            }), 'ko');
        });
    });

    describe('sendOrderConfirmed', () => {
        test('주문 접수 확인 알림톡을 발송한다', async () => {
            const spy = jest.spyOn(AlimtalkService, 'sendAlimtalk').mockResolvedValue({ success: true });
            await AlimtalkService.sendOrderConfirmed('01012345678', '매장', 'ORD-001', 1, 15000);
            expect(spy).toHaveBeenCalledWith('01012345678', 'ORDER_CONFIRMED', expect.objectContaining({
                storeName: '매장', orderNumber: 'ORD-001', queueNumber: 1, totalAmount: 15000
            }), 'ko');
        });
    });

    describe('sendFoodReady', () => {
        test('음식 준비 완료 알림톡을 발송한다', async () => {
            const spy = jest.spyOn(AlimtalkService, 'sendAlimtalk').mockResolvedValue({ success: true });
            await AlimtalkService.sendFoodReady('01012345678', '매장', 'ORD-001', '3번');
            expect(spy).toHaveBeenCalledWith('01012345678', 'FOOD_READY', expect.objectContaining({
                storeName: '매장', orderNumber: 'ORD-001', tableName: '3번'
            }), 'ko');
        });
    });

    describe('sendOrderCancelled', () => {
        test('주문 취소 알림톡을 발송한다', async () => {
            const spy = jest.spyOn(AlimtalkService, 'sendAlimtalk').mockResolvedValue({ success: true });
            await AlimtalkService.sendOrderCancelled('01012345678', '매장', 'ORD-001', '재고 소진');
            expect(spy).toHaveBeenCalledWith('01012345678', 'ORDER_CANCELLED', expect.objectContaining({
                storeName: '매장', orderNumber: 'ORD-001', reason: '재고 소진'
            }), 'ko');
        });
    });
});
