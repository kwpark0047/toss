/** KDS runtime source. The historical TypeScript source referenced by the old
 * generated-file header is absent; this module is the active CommonJS entry. */
'use strict';
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
const prisma_1 = __importDefault(require('../config/prisma'));
const AlimtalkService_1 = __importDefault(require('./AlimtalkService'));
const logger_1 = __importDefault(require('../utils/logger'));
const phoneEncryption_1 = require('../utils/phoneEncryption');
const errorHandler_1 = require('../utils/errorHandler');
const orderStatus_1 = require('../utils/orderStatus');
const OrderEventService_1 = require('./OrderEventService');
function kitchenOrder(order) {
  return {
    id: order.id,
    store_id: order.store_id,
    table_id: order.table_id,
    order_number: order.order_number,
    status: order.status,
    notes: order.notes,
    total_amount: order.total_amount,
    queue_number: order.queue_number,
    estimated_minutes: order.estimated_minutes,
    is_takeout: order.is_takeout,
    created_at: order.created_at,
    preparing_at: order.preparing_at,
    ready_at: order.ready_at,
    completed_at: order.completed_at,
    has_customer_contact: Boolean(order.customer_phone),
    items: (order.order_items || order.items || []).map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      options: item.options,
    })),
    table_name: order.table_name || order.tables?.table_number || null,
    store_name: order.store_name || order.stores?.name || '',
  };
}
class KdsService {
  /**
   * KDS 활성 주문 목록 조회 (pending, preparing, ready 상태)
   */
  async getActiveKdsOrders(storeId) {
    try {
      const numericStoreId = Number(storeId);
      if (!Number.isInteger(numericStoreId) || numericStoreId <= 0) {
        throw new errorHandler_1.AppError('올바르지 않은 매장 ID입니다.', 400);
      }
      const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready'];
      const orders = await prisma_1.default.orders.findMany({
        where: {
          store_id: numericStoreId,
          status: { in: activeStatuses },
        },
        include: {
          order_items: true,
          tables: {
            select: {
              table_number: true,
            },
          },
          stores: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          created_at: 'asc', // 오래된 주문이 위로 가게 함
        },
      });
      return orders.map(kitchenOrder);
    } catch (error) {
      logger_1.default.error(`[KDS Service] getActiveKdsOrders failed: ${error.message}`);
      throw error;
    }
  }
  /**
   * KDS 주문 상태 업데이트 및 자동 기능 트리거 (알림톡, 주방 프린터 잡)
   */
  async updateKdsOrderStatus(storeId, orderId, status, staffId = null, io = null, actor = null) {
    try {
      const numericStoreId = Number(storeId);
      const numericOrderId = Number(orderId);
      if (
        !Number.isInteger(numericStoreId) ||
        numericStoreId <= 0 ||
        !Number.isInteger(numericOrderId) ||
        numericOrderId <= 0
      ) {
        throw new errorHandler_1.AppError('매장 ID 또는 주문 ID가 잘못되었습니다.', 400);
      }
      // 1. 주문 데이터 확인
      const order = await prisma_1.default.orders.findUnique({
        where: { id: numericOrderId },
        include: {
          order_items: true,
          tables: {
            select: { table_number: true },
          },
          stores: {
            select: { name: true },
          },
        },
      });
      if (!order || order.store_id !== numericStoreId) {
        throw new errorHandler_1.AppError('주문을 찾을 수 없거나 해당 매장 소유가 아닙니다.', 404);
      }
      (0, orderStatus_1.assertKdsOrderStatusTransition)(order.status, status);
      if (order.status === status) {
        if (['preparing', 'ready', 'completed'].includes(status) && order.order_items?.length)
          await new (require('./OrderService'))(io)._processInventory(order);
        return kitchenOrder(order);
      }
      // 2. 상태 전이 및 업데이트용 데이터 조립
      const updateData = {
        status,
        updated_at: new Date(),
      };
      if (staffId !== null) {
        const numericStaffId = typeof staffId === 'string' ? parseInt(staffId, 10) : staffId;
        if (!Number.isInteger(numericStaffId) || numericStaffId <= 0) {
          throw new errorHandler_1.AppError('유효하지 않은 직원 ID입니다.', 400);
        }
        const staff = await prisma_1.default.staff.findUnique({
          where: { id: numericStaffId },
          select: { store_id: true, is_active: true },
        });
        if (!staff || staff.store_id !== numericStoreId || staff.is_active === 0) {
          throw new errorHandler_1.AppError(
            '해당 매장의 활성 직원만 담당자로 지정할 수 있습니다.',
            400
          );
        }
        updateData.handled_by_staff_id = numericStaffId;
      }
      if (status === 'preparing') {
        updateData.preparing_at = new Date();
      } else if (status === 'ready') {
        updateData.ready_at = new Date();
      } else if (status === 'completed') {
        updateData.completed_at = new Date();
      }
      // 3. 트랜잭션으로 상태 업데이트와 프린트 잡 생성을 일괄 처리
      const updatedOrder = await prisma_1.default.$transaction(async (tx) => {
        const claimed = await tx.orders.updateMany({
          where: { id: numericOrderId, store_id: numericStoreId, status: order.status },
          data: updateData,
        });
        if (claimed.count !== 1)
          throw new errorHandler_1.AppError('주문 상태가 변경되었습니다. 새로고침해 주세요.', 409);
        const res = await tx.orders.findUnique({
          where: { id: numericOrderId },
          include: {
            order_items: true,
          },
        });
        // 조리 시작('preparing') 시 주방 전용 인쇄 작업(Base64 ESC/POS)을 큐에 자동 등록
        if (status === 'preparing') {
          const payloadB64 = this.formatKitchenSlip({
            ...order,
            table_name: order.tables?.table_number || null,
          });
          await tx.print_jobs.create({
            data: {
              store_id: numericStoreId,
              order_id: numericOrderId,
              kind: 'kitchen',
              status: 'pending',
              payload_b64: payloadB64,
            },
          });
          logger_1.default.info(
            `[KDS Service] KDS 주방 인쇄 작업 등록 성공: Order #${order.order_number}`
          );
        }
        return res;
      });
      if (['preparing', 'ready', 'completed'].includes(status) && updatedOrder.order_items?.length)
        await new (require('./OrderService'))(io)._processInventory(updatedOrder);
      // 4. 조리 완료('ready') 시 고객 전화번호 복호화 후 알림톡 자동 발송
      if (status === 'ready' && order.customer_phone) {
        setImmediate(async () => {
          try {
            const decryptedPhone = (0, phoneEncryption_1.decryptPhone)(order.customer_phone);
            if (decryptedPhone) {
              await AlimtalkService_1.default.sendFoodReady(
                decryptedPhone,
                order.stores?.name || 'WeMarket',
                order.order_number,
                order.tables?.table_number || '픽업대'
              );
            }
          } catch (err) {
            logger_1.default.error(`[KDS Service] 알림톡 자동 전송 실패: ${err.message}`);
          }
        });
      }
      // 5. Socket.io 실시간 브로드캐스팅
      if (io) {
        const payload = {
          orderId: numericOrderId,
          orderNumber: order.order_number,
          status,
          table_name: order.tables?.table_number || null,
        };
        // 해당 매장 주방 룸에 전파
        io.to(`kitchen - ${numericStoreId}`).emit('kds:order_updated', payload);
        // 해당 매장 전체 룸에 전파 (태블릿, 매니저 동기화)
        io.to(`store - ${numericStoreId}`).emit('order_updated', payload);
        logger_1.default.info(
          `[KDS Socket] KDS 실시간 브로드캐스트 전송 완료: Store ${numericStoreId}, Order ${order.order_number} → ${status}`
        );
      }
      // 관리자 주문 화면·손님 주문 상태 화면은 'order-updated'(주문 룸 포함)를 듣는다.
      // 상태 변경은 이미 저장됐으므로 전파·후처리 실패가 요청 실패(500)로 번지지 않게 한다.
      const orderService = new (require('./OrderService'))(io);
      try {
        orderService._emitOrderUpdate(updatedOrder, status);
      } catch (e) {
        logger_1.default.error(`[KDS Socket] order-updated 전파 실패: ${e.message}`);
      }
      if (status === 'cancelled') {
        await this._afterKitchenCancel(order, orderService, io).catch((e) =>
          logger_1.default.error(`[KDS Cancel] 취소 후처리 실패: Order ${order.id} ${e.message}`)
        );
      }
      void OrderEventService_1.record({
        orderId: numericOrderId,
        storeId: numericStoreId,
        eventType: 'KDS_STATUS_CHANGED',
        fromStatus: order.status,
        toStatus: status,
        actorUserId: actor?.userId || null,
        actorRole: actor?.role || null,
        metadata: { staff_id: staffId || null },
      });
      return kitchenOrder({
        ...updatedOrder,
        table_name: order.tables?.table_number || null,
        store_name: order.stores?.name || '',
      });
    } catch (error) {
      logger_1.default.error(`[KDS Service] updateKdsOrderStatus failed: ${error.message}`);
      throw error;
    }
  }
  /**
   * 주방 취소 후처리: 관리자 취소(OrderService.cancelOrder)와 같은 재고·포인트·알림 처리에 더해
   * 온라인 결제는 자동 환불하고, 현장 결제나 환불 실패는 매장에 "환불 필요" 알림을 남긴다.
   */
  async _afterKitchenCancel(order, orderService, io) {
    if (order.status !== 'pending') {
      await orderService
        ._restoreInventory(order.id)
        .catch((e) => logger_1.default.error(`[KDS Cancel] 재고 복구 실패: ${e.message}`));
    }
    await orderService
      ._revertPointsOnCancel(order.id)
      .catch((e) => logger_1.default.error(`[KDS Cancel] 포인트 회수 실패: ${e.message}`));
    orderService._sendOrderAlimtalk(order, 'cancelled').catch((e) => logger_1.default.error(e));

    const payments = await prisma_1.default.payments.findMany({
      where: { order_id: order.id, status: 'DONE' },
      select: { id: true, method: true, payment_key: true },
    });
    if (!payments.length) return;

    const offline = payments.some((p) => !p.payment_key);
    let failure = null;
    if (!offline) {
      try {
        const PaymentService = require('./PaymentService');
        await new PaymentService(io).processCancellation(order.id, '주방에서 주문 취소');
        return;
      } catch (e) {
        failure = e.message;
        logger_1.default.error(`[KDS Cancel] 자동 환불 실패: Order ${order.id} ${e.message}`);
      }
    }

    const message = offline
      ? `주문 #${order.order_number}이 주방에서 취소되었습니다. 현장 결제 금액을 손님께 환불한 뒤 결제 취소를 기록해 주세요.`
      : `주문 #${order.order_number} 자동 환불에 실패했습니다(${failure}). 주문 관리에서 결제를 취소해 주세요.`;
    const notification = await prisma_1.default.notifications
      .create({
        data: {
          store_id: order.store_id,
          type: 'REFUND_REQUIRED',
          title: '💸 환불 필요',
          message,
          data: JSON.stringify({ orderId: order.id, offline }),
          is_read: false,
          priority: 'high',
          link: `/admin/stores/${order.store_id}/orders`,
        },
      })
      .catch((e) => logger_1.default.error(`[KDS Cancel] 환불 알림 저장 실패: ${e.message}`));
    if (io) {
      io.to(`store - ${order.store_id}`).emit('manager-notification', {
        id: notification?.id,
        type: 'REFUND_REQUIRED',
        title: '💸 환불 필요',
        message,
        data: { orderId: order.id, offline },
        priority: 'high',
        created_at: notification?.created_at || new Date(),
      });
    }
  }
  /**
   * 주방 주문 영수증 슬립 텍스트 포맷터 및 Base64 인코더
   */
  formatKitchenSlip(order) {
    let slip = `==============================\n`;
    slip += `       KITCHEN ORDER SLIP     \n`;
    slip += `==============================\n`;
    slip += `주문번호 : ${order.order_number}\n`;
    slip += `구  분   : ${order.is_takeout ? '포장(TAKEOUT)' : '매장(DINE-IN)'}\n`;
    if (order.table_name) {
      slip += `테이블   : ${String(order.table_name).replace(/번$/, '')}번\n`;
    }
    slip += `주문시간 : ${new Date(order.created_at).toLocaleString('ko-KR')}\n`;
    slip += `------------------------------\n`;
    (order.order_items || []).forEach((item, idx) => {
      slip += `${idx + 1}. ${item.product_name} x ${item.quantity}\n`;
      if (item.options) {
        try {
          const opts = JSON.parse(item.options);
          Object.entries(opts).forEach(([key, val]) => {
            slip += `   └ ${key}: ${val}\n`;
          });
        } catch (e) {
          logger_1.default.warn(`[KDS] 옵션 파싱 실패: ${e.message}`);
        }
      }
    });
    slip += `==============================\n`;
    return Buffer.from(slip, 'utf-8').toString('base64');
  }
}
const kdsServiceInstance = new KdsService();
module.exports = kdsServiceInstance;
