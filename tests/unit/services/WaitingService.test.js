jest.mock('../../../config/prisma', () => ({
    waiting_list: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    stores: {
        findUnique: jest.fn(),
    },
}));
jest.mock('../../../utils/phoneEncryption', () => ({
    encryptPhone: jest.fn((phone) => `enc_${phone}`),
    decryptPhoneFields: jest.fn((entry) => ({ ...entry, customer_phone: '01012345678' })),
    phoneSearchCandidates: jest.fn((phone) => [`enc_${phone}`]),
}));
jest.mock('../../../services/AlimtalkService', () => ({
    sendWaitingRegistered: jest.fn().mockResolvedValue({ success: true }),
    sendWaitingCall: jest.fn().mockResolvedValue({ success: true }),
    sendWaitingCancel: jest.fn().mockResolvedValue({ success: true }),
}));

const WaitingService = require('../../../services/WaitingService');
const prisma = require('../../../config/prisma');
const alimtalkService = require('../../../services/AlimtalkService');

describe('WaitingService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new WaitingService();
    });

    describe('getStoreStatus', () => {
        test('대기 중인 팀 수를 반환한다', async () => {
            prisma.waiting_list.count.mockResolvedValue(5);
            const result = await svc.getStoreStatus(1);
            expect(result).toBe(5);
            expect(prisma.waiting_list.count).toHaveBeenCalledWith(expect.objectContaining({
                where: { store_id: 1, status: 'waiting' }
            }));
        });
    });

    describe('getStoreWaitingList', () => {
        test('매장 대기 리스트를 조회한다', async () => {
            prisma.waiting_list.findMany.mockResolvedValue([{ id: 1, queue_number: 1 }]);
            const result = await svc.getStoreWaitingList(1);
            expect(result).toHaveLength(1);
        });
    });

    describe('register', () => {
        beforeEach(() => {
            prisma.stores.findUnique.mockResolvedValue({ name: '테스트매장' });
        });

        test('대기 등록에 성공한다', async () => {
            prisma.waiting_list.findFirst.mockResolvedValueOnce(null); // 이미 대기 없음
            prisma.waiting_list.findFirst.mockResolvedValueOnce({ queue_number: 3 }); // 마지막 번호
            prisma.waiting_list.create.mockResolvedValue({ id: 1, queue_number: 4, status: 'waiting' });

            const result = await svc.register({
                store_id: '1', customer_name: '홍길동', customer_phone: '01012345678', party_size: '4'
            });
            expect(result.queue_number).toBe(4);
        });

        test('등록 성공 시 알림톡을 발송한다', async () => {
            prisma.waiting_list.findFirst.mockResolvedValueOnce(null);
            prisma.waiting_list.findFirst.mockResolvedValueOnce({ queue_number: 2 });
            prisma.waiting_list.create.mockResolvedValue({ id: 1, queue_number: 3, status: 'waiting' });
            prisma.waiting_list.count.mockResolvedValue(2);

            await svc.register({
                store_id: '1', customer_name: '홍길동', customer_phone: '01012345678', party_size: '4'
            });

            expect(alimtalkService.sendWaitingRegistered).toHaveBeenCalledWith(
                '01012345678', '테스트매장', 3, 2
            );
        });

        test('이미 대기 중이면 400 에러', async () => {
            prisma.waiting_list.findFirst.mockResolvedValueOnce({ id: 1 }); // 이미 대기 중
            await expect(svc.register({
                store_id: '1', customer_name: '홍길동', customer_phone: '01012345678', party_size: '2'
            })).rejects.toThrow('이미 대기 등록이 되어 있습니다.');
        });
    });

    describe('updateStatus', () => {
        beforeEach(() => {
            prisma.stores.findUnique.mockResolvedValue({ name: '테스트매장' });
        });

        test('대기 상태를 변경한다', async () => {
            prisma.waiting_list.update.mockResolvedValue({ id: 1, status: 'called', store_id: 1 });
            const result = await svc.updateStatus(1, 'called');
            expect(result.status).toBe('called');
        });

        test('호출 시 called_at을 설정한다', async () => {
            prisma.waiting_list.update.mockResolvedValue({ id: 1, status: 'called', store_id: 1 });
            await svc.updateStatus(1, 'called');
            expect(prisma.waiting_list.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'called', called_at: expect.any(Date) })
            }));
        });

        test('호출 시 알림톡을 발송한다', async () => {
            prisma.waiting_list.update.mockResolvedValue({ id: 1, status: 'called', store_id: 1, queue_number: 5 });
            await svc.updateStatus(1, 'called');
            expect(alimtalkService.sendWaitingCall).toHaveBeenCalledWith('01012345678', '테스트매장', 5);
        });

        test('취소 시 알림톡을 발송한다', async () => {
            prisma.waiting_list.update.mockResolvedValue({ id: 1, status: 'cancelled', store_id: 1 });
            await svc.updateStatus(1, 'cancelled');
            expect(alimtalkService.sendWaitingCancel).toHaveBeenCalledWith('01012345678', '테스트매장');
        });
    });

    describe('getMyWaiting', () => {
        test('내 대기 상태와 앞 대기 수를 반환한다', async () => {
            prisma.waiting_list.findMany.mockResolvedValue([
                { id: 1, store_id: 1, queue_number: 3, status: 'waiting' }
            ]);
            prisma.waiting_list.count.mockResolvedValue(2); // 앞에 2팀

            const result = await svc.getMyWaiting('01012345678');
            expect(result[0].ahead_count).toBe(2);
        });
    });
});
