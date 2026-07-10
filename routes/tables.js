const express = require('express');
const router = express.Router();
const Table = require('../repositories/Table');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission, getStoreRole } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const crypto = require('crypto');
const prisma = require('../config/prisma');

// 매장�??�이�?목록 조회 (매장 권한 ?�요)
router.get('/store/:storeId', authMiddleware, checkStorePermission('order:read'), catchAsync(async (req, res) => {
    const tables = await Table.findByStoreId(req.params.storeId);
    res.success(tables);
}));

router.put('/store/:storeId/layout', authMiddleware, checkStorePermission('store:update'), catchAsync(async (req, res) => {
    const { layout } = req.body;
    if (!layout || !Array.isArray(layout)) {
        return res.status(400).json({ success: false, error: 'layout 배열이 필요합니다.' });
    }
    const tables = await Table.updateLayout(req.params.storeId, layout);

    const io = req.app.get('io');
    if (io) {
        io.emit('table-layout-updated', { store_id: req.params.storeId, tables });
    }

    res.success(tables, '테이블 배치도가 저장되었습니다.');
}));

// QR 코드�??�이�?조회 (?�증 불필??- 고객 QR ?�캔??
router.get('/qr/:qrCode', catchAsync(async (req, res) => {
    const table = await Table.findByQrCode(req.params.qrCode);
    if (!table) return res.status(404).json({ error: '?�효?��? ?��? QR 코드?�니??' });
    res.success(table);
}));

// ?�이�??�성
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const table = await Table.create(req.body);
    res.success(table, '?�이블이 ?�성?�었?�니??', 201);
}));

// ?�이�??�정
router.put('/:id', authMiddleware, catchAsync(async (req, res) => {
    const table = await Table.update(req.params.id, req.body);

    const io = req.app.get('io');
    if (io && table) {
        io.emit('table-updated', { store_id: table.store_id, table_id: table.id });
    }

    res.success(table, '?�이�??�보가 ?�정?�었?�니??');
}));

// QR 코드 ?�생??(?�이�??�속 매장 권한 검�?
router.post('/:id/regenerate-qr', authMiddleware, catchAsync(async (req, res) => {
    const existing = await prisma.tables.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!existing) return res.status(404).json({ error: '?�이블을 찾을 ???�습?�다.' });

    if (req.user.role !== 'super_admin') {
        const role = await getStoreRole(req.user.id, existing.store_id);
        if (!role) return res.status(403).json({ error: '?�당 매장???�??권한???�습?�다.' });
    }

    const newQrCode = `qr_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    const table = await prisma.tables.update({
        where: { id: parseInt(req.params.id) },
        data: { qr_code: newQrCode, updated_at: new Date() }
    });
    const io = req.app.get('io');
    if (io) {
        io.emit('table-updated', { store_id: table.store_id, table_id: table.id });
    }
    res.success(table, 'QR 코드가 ?�생?�되?�습?�다.');
}));

// ?�이�???��
router.delete('/:id', authMiddleware, catchAsync(async (req, res) => {
    const table = await Table.findById(req.params.id);
    if (table) {
        await Table.delete(req.params.id);
        const io = req.app.get('io');
        if (io) {
            io.emit('table-updated', { store_id: table.store_id, table_id: req.params.id });
        }
    }
    res.success(null, '?�이블이 ??��?�었?�니??');
}));

module.exports = router;

