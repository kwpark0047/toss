const catchAsync = require('../utils/catchAsync');
const ReservationsService = require('../services/ReservationsService');
const { createReservationCapability } = require('../utils/orderCapability');

const reservationsService = new ReservationsService();

const reservationsController = {
    // [POST] 예약 요청 (고객)
    register: catchAsync(async (req, res) => {
        const io = req.app.get('io');
        const data = await reservationsService.register(req.body, io);
        const capability = createReservationCapability({
            id: data.id,
            store_id: data.store_id,
            customer_phone: req.body.customer_phone || data.customer_phone
        });
        res.json({ success: true, data, capability });
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

    // [GET] 내 예약 상태 조회 (capability 기반)
    getMyReservations: catchAsync(async (req, res) => {
        const phone = req.capability.customer_phone;
        const data = await reservationsService.getMyReservations(phone);
        res.json({ success: true, data });
    }),

    // [PATCH] 고객 본인 예약 취소
    cancelReservation: catchAsync(async (req, res) => {
        const io = req.app.get('io');
        const phone = req.capability.customer_phone;
        const data = await reservationsService.cancelReservation(req.params.id, phone, io);
        res.json({ success: true, data });
    })
};

module.exports = reservationsController;
