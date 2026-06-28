const express = require('express');
const router = express.Router();
const Table = require('../models/Table');
const authMiddleware = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const crypto = require('crypto');
const prisma = require('../config/prisma');

// 매장별 테이블 목록 조회
router.get('/store/:storeId', authMiddleware, catchAsync(async (req, res) => {
    const tables = await Table.findByStoreId(req.params.storeId);
    res.success(tables);
}));

// QR 코드로 테이블 조회
router.get('/qr/:qrCode', catchAsync(async (req, res) => {
    const table = await Table.findByQrCode(req.params.qrCode);
    if (!table) return res.status(404).json({ error: '유효하지 않은 QR 코드입니다.' });
    res.success(table);
}));

// 테이블 생성
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const table = await Table.create(req.body);
    res.success(table, '테이블이 생성되었습니다.', 201);
}));

// 테이블 수정
router.put('/:id', authMiddleware, catchAsync(async (req, res) => {
    const table = await Table.update(req.params.id, req.body);

    const io = req.app.get('io');
    if (io && table) {
        io.emit('table-updated', { store_id: table.store_id, table_id: table.id });
    }

    res.success(table, '테이블 정보가 수정되었습니다.');
}));

// QR 코드 재생성
router.post('/:id/regenerate-qr', authMiddleware, catchAsync(async (req, res) => {
    const newQrCode = `qr_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    const table = await prisma.tables.update({
        where: { id: parseInt(req.params.id) },
        data: { qr_code: newQrCode, updated_at: new Date() }
    });
    const io = req.app.get('io');
    if (io && table) {
        io.emit('table-updated', { store_id: table.store_id, table_id: table.id });
    }
    res.success(table, 'QR 코드가 재생성되었습니다.');
}));

// 테이블 삭제
router.delete('/:id', authMiddleware, catchAsync(async (req, res) => {
    const table = await Table.findById(req.params.id);
    if (table) {
        await Table.delete(req.params.id);
        const io = req.app.get('io');
        if (io) {
            io.emit('table-updated', { store_id: table.store_id, table_id: req.params.id });
        }
    }
    res.success(null, '테이블이 삭제되었습니다.');
}));

module.exports = router;
