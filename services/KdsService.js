/**
 * [Compiled Output — Do Not Edit Directly]
 *
 * 이 파일은 KdsService.ts로부터 TypeScript 컴파일러(tsc)로 생성된 출력물입니다.
 * 소스 코드의 변경이 필요한 경우 KdsService.ts를 수정하고 tsc로 재컴파일하십시오.
 *
 * 관련 파일:
 * - Source: services/KdsService.ts (타입 정의 + 비즈니스 로직)
 * - Runtime: 이 파일 (컴파일된 JavaScript)
 */
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
      const activeStatuses = ['pending', 'preparing', 'ready'];
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
      return orders.map((order) => ({
        ...order,
        items: order.order_items || [],
        table_name: order.tables?.table_number || null,
        store_name: order.stores?.name || '',
      }));
    } catch (error) {
      logger_1.default.error(`[KDS Service] getActiveKdsOrders failed: ${error.message}`);
      throw error;
    }
  }
  /**
   * KDS 주문 상태 업데이트 및 자동 기능 트리거 (알림톡, 주방 프린터 잡)
   */
  async updateKdsOrderStatus(storeId, orderId, status, staffId = null, io = null) {
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
      const allowedTransitions = {
        pending: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['completed'],
      };
      if (!allowedTransitions[order.status]?.includes(status)) {
        throw new errorHandler_1.AppError(
          `현재 ${order.status} 상태에서는 ${status}로 변경할 수 없습니다.`,
          400
        );
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
        const res = await tx.orders.update({
          where: { id: numericOrderId },
          data: updateData,
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
      return {
        ...updatedOrder,
        table_name: order.tables?.table_number || null,
        store_name: order.stores?.name || '',
      };
    } catch (error) {
      logger_1.default.error(`[KDS Service] updateKdsOrderStatus failed: ${error.message}`);
      throw error;
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
      slip += `테이블   : ${order.table_name}번\n`;
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
