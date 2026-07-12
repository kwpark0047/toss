const catchAsync = require('../utils/catchAsync');
const WaitingService = require('../services/WaitingService');

const waitingService = new WaitingService();

const waitingController = {
    // [GET] 특정 매장의 현재 대기 현황 조회
    getStoreStatus: catchAsync(async (req, res) => {
        const count = await waitingService.getStoreStatus(req.params.storeId);
        res.json({ success: true, waiting_teams: count });
    }),

    // [GET] 특정 매장의 대기 리스트 조회 (관리자)
    getStoreWaitingList: catchAsync(async (req, res) => {
        const data = await waitingService.getStoreWaitingList(req.params.storeId);
        res.json({ success: true, data });
    }),

    // [POST] 대기 등록 (고객)
    register: catchAsync(async (req, res) => {
        const data = await waitingService.register(req.body);
        res.json({ success: true, data });
    }),

    // [PATCH] 대기 상태 변경 (관리자: 호출/입장/취소, 고객: 취소)
    updateStatus: catchAsync(async (req, res) => {
        const data = await waitingService.updateStatus(req.params.id, req.body.status);
        res.json({ success: true, data });
    }),

    // [GET] 내 대기 상태 조회 (휴대폰 번호 기준)
    getMyWaiting: catchAsync(async (req, res) => {
        const data = await waitingService.getMyWaiting(req.params.phone);
        res.json({ success: true, data });
    })
};

module.exports = waitingController;
