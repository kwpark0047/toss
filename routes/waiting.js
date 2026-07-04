const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const { encryptPhone, decryptPhone, decryptPhoneFields } = require('../utils/phoneEncryption');

// [GET] 특정 매장의 현재 대기 현황 조회
router.get('/store/:storeId/status', catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const count = await prisma.waiting_list.count({
        where: { store_id: parseInt(storeId), status: 'waiting' }
    });
    res.json({ success: true, waiting_teams: count });
}));

// [GET] 특정 매장의 대기 리스트 조회 (관리자용)
router.get('/store/:storeId', catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const list = await prisma.waiting_list.findMany({
        where: { store_id: parseInt(storeId) },
        orderBy: { queue_number: 'asc' }
    });
    res.json({ success: true, data: list.map(e => decryptPhoneFields(e)) });
}));

// [POST] 대기 등록 (고객용)
router.post('/register', catchAsync(async (req, res) => {
    const { store_id, customer_name, customer_phone, party_size } = req.body;
    const encPhone = encryptPhone(customer_phone);

    const existing = await prisma.waiting_list.findFirst({
        where: {
            store_id: parseInt(store_id),
            customer_phone: { in: [encPhone, customer_phone] },
            status: { in: ['waiting', 'called'] }
        }
    });

    if (existing) {
        return res.status(400).json({ success: false, error: '이미 대기 등록이 되어 있습니다.', data: decryptPhoneFields(existing) });
    }

    const lastEntry = await prisma.waiting_list.findFirst({
        where: {
            store_id: parseInt(store_id),
            created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        },
        orderBy: { queue_number: 'desc' }
    });

    const newQueueNumber = (lastEntry?.queue_number || 0) + 1;

    const entry = await prisma.waiting_list.create({
        data: {
            store_id: parseInt(store_id),
            customer_name,
            customer_phone: encPhone,
            party_size: parseInt(party_size),
            queue_number: newQueueNumber,
            status: 'waiting'
        }
    });

    res.json({ success: true, data: decryptPhoneFields(entry) });
}));

// [PATCH] 대기 상태 변경 (관리자: 호출/입장/취소, 고객: 취소)
router.patch('/:id/status', catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const entry = await prisma.waiting_list.update({
        where: { id: parseInt(id) },
        data: { status, called_at: status === 'called' ? new Date() : undefined }
    });
    res.json({ success: true, data: decryptPhoneFields(entry) });
}));

// [GET] 내 대기 상태 조회 (휴대폰 번호 기준)
router.get('/my/:phone', catchAsync(async (req, res) => {
    const { phone } = req.params;
    const encPhone = encryptPhone(phone);

    const entries = await prisma.waiting_list.findMany({
        where: {
            customer_phone: { in: [encPhone, phone] },
            status: { in: ['waiting', 'called'] }
        },
        include: { stores: true },
        orderBy: { created_at: 'desc' }
    });

    const results = await Promise.all(entries.map(async (entry) => {
        const aheadCount = await prisma.waiting_list.count({
            where: {
                store_id: entry.store_id,
                status: 'waiting',
                queue_number: { lt: entry.queue_number }
            }
        });
        return { ...decryptPhoneFields(entry), ahead_count: aheadCount };
    }));

    res.json({ success: true, data: results });
}));

module.exports = router;
