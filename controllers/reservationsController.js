const catchAsync = require('../utils/catchAsync');
const ReservationsService = require('../services/ReservationsService');

const reservationsService = new ReservationsService();

const reservationsController = {
    // [POST] 예약 요청 (고객)
    register: catchAsync(async (req, res) => {
        const io = req.app.get('io');
        const data = await reservationsService.register(req.body, io);
        res.json({ success: true, data });
    }),

    // [GET] 특정 매장의 예약 리스트 조회 (관리자)
    getStoreReservations: catchAsync(async (req, res) => {
        const data = await reservationsService.getStoreReservations(req.params.storeId, req.query);
        res.json({ success: true, data });
    }),

    // [PATCH] 예약 상태 변경 (관리자)
    updateStatus: catchAsync(async (req, res) => {
        const data = await reservationsService.updateStatus(req.params.id, req.body.status);
        res.json({ success: true, data });
    }),

    // [GET] 내 예약 상태 조회 (휴대폰 번호 기준)
    getMyReservations: catchAsync(async (req, res) => {
        const data = await reservationsService.getMyReservations(req.params.phone);
        res.json({ success: true, data });
    }),

    // [PATCH] 고객 본인 예약 취소
    cancelReservation: catchAsync(async (req, res) => {
        const io = req.app.get('io');
        const data = await reservationsService.cancelReservation(req.params.id, req.body.phone, io);
        res.json({ success: true, data });
    })
};

module.exports = reservationsController;
