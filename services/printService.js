/**
 * printService.js — 프린트 잡 큐 관리
 *
 * order.created 시 주방 영수증 ESC/POS 바이트를 생성해 print_jobs에 pending으로
 * 적재한다. 온프레미스 프린트 브리지가 claim → 프린터 전송 → ack 하는 구조라
 * 클라우드가 로컬 프린터에 직접 접근할 필요가 없다(제로 하드웨어 교체).
 */
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { buildKitchenReceipt } = require('../utils/escpos');

/** 주문에 대한 주방 프린트 잡 생성 (실패해도 주문 흐름은 막지 않음) */
async function createKitchenJob(order, { tableName } = {}) {
    try {
        const items = await prisma.order_items.findMany({
            where: { order_id: order.id },
            select: { product_name: true, quantity: true, options: true },
        });
        const store = await prisma.stores.findUnique({ where: { id: order.store_id }, select: { name: true } });
        const bytes = buildKitchenReceipt(
            { ...order, table_name: tableName || order.table_name },
            items.map(i => ({ name: i.product_name, quantity: i.quantity, options: i.options })),
            store || {}
        );
        await prisma.$executeRawUnsafe(
            `INSERT INTO print_jobs (store_id, order_id, kind, status, payload_b64) VALUES ($1,$2,'kitchen','pending',$3)`,
            order.store_id, order.id, bytes.toString('base64')
        );
        logger.info(`[print] 주방 잡 생성 (order ${order.id}, store ${order.store_id})`);
    } catch (e) {
        logger.warn(`[print] 잡 생성 실패 (order ${order?.id}): ${e.message}`);
    }
}

module.exports = { createKitchenJob };
