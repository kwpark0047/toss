const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const { sendReservationNotification } = require('../utils/notifications');
const catchAsync = require('../utils/catchAsync');
const { encryptPhone, decryptPhoneFields, phoneSearchCandidates } = require('../utils/phoneEncryption');

// [POST] 예약 신청 (고객용)
router.post('/register', catchAsync(async (req, res) => {
    const { store_id, customer_name, customer_phone, party_size, reservation_time, notes } = req.body;
    const entry = await prisma.reservations.create({
        data: {
            store_id: parseInt(store_id),
            customer_name,
            customer_phone: encryptPhone(customer_phone),
            party_size: parseInt(party_size),
            reservation_time: new Date(reservation_time),
            notes,
            status: 'PENDING'
        }
    });
    const io = req.app.get('io');
    if (io) {
        io.to(`store - ${store_id}`).emit('new-reservation', decryptPhoneFields(entry));
    }
    res.json({ success: true, data: decryptPhoneFields(entry) });
}));

// [GET] 특정 매장의 예약 리스트 조회 (관리자용)
router.get('/store/:storeId', authMiddleware, catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { status, date } = req.query;
    const where = { store_id: parseInt(storeId) };
    if (status) where.status = status;
    if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        where.reservation_time = { gte: start, lte: end };
    }
    const list = await prisma.reservations.findMany({
        where,
        orderBy: { reservation_time: 'asc' }
    });
    res.json({ success: true, data: list.map(e => decryptPhoneFields(e)) });
}));

// [PATCH] 예약 상태 변경 (관리자)
router.patch('/:id/status', authMiddleware, catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const entry = await prisma.reservations.update({
        where: { id: parseInt(id) },
        data: { status }
    });
    sendReservationNotification(decryptPhoneFields(entry), status).catch(err => logger.error(err));
    res.json({ success: true, data: decryptPhoneFields(entry) });
}));

// [GET] 내 예약 상태 조회 (휴대폰 번호 기준)
router.get('/my/:phone', catchAsync(async (req, res) => {
    const { phone } = req.params;
    const entries = await prisma.reservations.findMany({
        where: {
            customer_phone: { in: [...phoneSearchCandidates(phone), phone] },
            status: { in: ['PENDING', 'CONFIRMED'] }
        },
        include: { stores: true },
        orderBy: { reservation_time: 'asc' }
    });
    res.json({ success: true, data: entries.map(e => decryptPhoneFields(e)) });
}));

// [PATCH] 고객 본인 예약 취소
router.patch('/:id/cancel', catchAsync(async (req, res) => {
    const { id } = req.params;
    const { phone } = req.body;
    const reservation = await prisma.reservations.findUnique({
        where: { id: parseInt(id) }
    });

    if (!reservation) {
        return res.status(404).json({ success: false, error: '예약을 찾을 수 없습니다.' });
    }
    if (reservation.customer_phone !== phone) {
        return res.status(403).json({ success: false, error: '본인의 예약만 취소할 수 있습니다.' });
    }
    if (reservation.status !== 'PENDING' && reservation.status !== 'CONFIRMED') {
        return res.status(400).json({ success: false, error: '현재 상태에서는 취소할 수 없습니다.' });
    }

    const entry = await prisma.reservations.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELED' }
    });

    const io = req.app.get('io');
    if (io) {
        io.to(`store - ${entry.store_id}`).emit('new-reservation', entry);
    }

    sendReservationNotification(entry, 'CANCELED').catch(err => logger.error(err));
    res.json({ success: true, data: entry });
}));

module.exports = router;
