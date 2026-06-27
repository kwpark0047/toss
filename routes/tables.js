const express = require('express');
const router = express.Router();
const Table = require('../models/Table');
const authMiddleware = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');

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
