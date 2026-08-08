const logger = require('../utils/logger');
const prisma = require('../config/prisma');
const { phoneSearchCandidates } = require('../utils/phoneEncryption');
const AlimtalkService = require('../services/AlimtalkService');
const { getStoreRole } = require('../middleware/storeAuth');

const activeFoodTruckClients = new Map();

const deny = (ack, code, message) => {
  if (typeof ack === 'function') ack({ ok: false, code, message });
};

async function getAuthorizedStoreRole(socket, storeId, allowedRoles) {
  const sid = Number(storeId);
  const user = socket.data?.user;
  if (!Number.isInteger(sid) || sid <= 0 || !user) return null;
  if (user.role === 'super_admin') return 'super_admin';

  const role = await getStoreRole(user.id, sid);
  if (!role || (allowedRoles && !allowedRoles.includes(role))) return null;
  return role;
}

/**
 * [Socket.io 핸들러]
 * app.js에서 분리된 Socket.io 이벤트 핸들러.
 * io.on('connection', ...)의 콜백으로 사용된다.
 *
 * 사용법:
 *   const { registerSocketHandlers } = require('./socket/handlers');
 *   registerSocketHandlers(io);
 */

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.debug(`[Socket] 연결됨: ${socket.id}`);

    // ── 공통 룸 참여 ─────────────────────────────────────
    socket.on('join-order', (orderId) => {
      socket.join(`order - ${orderId}`);
    });

    socket.on('join-store', async (data, ack) => {
      const storeId = typeof data === 'object' ? data.storeId : data;
      const role = await getAuthorizedStoreRole(socket, storeId);
      if (!role) return deny(ack, 'FORBIDDEN', '매장 구독 권한이 없습니다.');

      const sid = Number(storeId);
      socket.join(`store - ${sid}`);
      socket.join(`user - ${socket.data.user.id}`);
      if (typeof ack === 'function') ack({ ok: true, role });
    });

    socket.on('join-kitchen', async ({ storeId } = {}, ack) => {
      const role = await getAuthorizedStoreRole(socket, storeId, [
        'owner',
        'manager',
        'staff',
        'kitchen',
      ]);
      if (!role) return deny(ack, 'FORBIDDEN', '주방 구독 권한이 없습니다.');

      const sid = Number(storeId);
      socket.join(`kitchen - ${sid}`);
      socket.join(`user - ${socket.data.user.id}`);
      if (typeof ack === 'function') ack({ ok: true, role });
    });

    socket.on('join-admin', (ack) => {
      const user = socket.data?.user;
      if (!user || user.role !== 'super_admin') {
        return deny(ack, 'FORBIDDEN', '관리자 구독 권한이 없습니다.');
      }
      socket.join('admin');
      socket.join(`user - ${user.id}`);
      if (typeof ack === 'function') ack({ ok: true });
    });

    // ── 실시간 대시보드 (DashboardBroadcastService 연동) ──
    socket.on('join-dashboard', async (data, ack) => {
      const storeId = typeof data === 'object' ? data.storeId : data;
      const role = await getAuthorizedStoreRole(socket, storeId, [
        'owner',
        'manager',
        'super_admin',
      ]);
      if (!role) return deny(ack, 'FORBIDDEN', '대시보드 구독 권한이 없습니다.');

      const sid = Number(storeId);
      socket.join(`store_${sid}_dashboard`);
      if (typeof ack === 'function') ack({ ok: true, role });
    });

    socket.on('register-foodtruck-client', ({ phone, storeId }) => {
      const normalized = String(phone || '').replace(/[^0-9]/g, '');
      activeFoodTruckClients.set(socket.id, { phone: normalized, storeId });
      logger.debug(`[Socket] FoodTruck client registered: ${socket.id} -> ${normalized}`);
    });

    socket.on('trigger-ingredient-sold-out', async ({ storeId, ingredientName } = {}, ack) => {
      try {
        const role = await getAuthorizedStoreRole(socket, storeId, ['owner', 'manager']);
        const sid = Number(storeId);
        const normalizedIngredient =
          typeof ingredientName === 'string' ? ingredientName.trim() : '';
        if (!role) return deny(ack, 'FORBIDDEN', '상품 변경 권한이 없습니다.');
        if (!normalizedIngredient || normalizedIngredient.length > 100) {
          return deny(ack, 'INVALID_PAYLOAD', '재료명이 올바르지 않습니다.');
        }

        const products = await prisma.products.findMany({
          where: { store_id: sid, is_active: true },
        });
        const matchingProducts = products.filter((p) => {
          if (!p.ingredients) return false;
          const list = p.ingredients.split(',').map((i) => i.trim().toLowerCase());
          return list.includes(normalizedIngredient.toLowerCase());
        });
        if (matchingProducts.length > 0) {
          const productIds = matchingProducts.map((p) => p.id);
          await prisma.products.updateMany({
            where: { id: { in: productIds } },
            data: { is_sold_out: true },
          });
          io.to(`store - ${sid}`).emit('products-updated', { storeId: sid });
          io.to(`store - ${sid}`).emit('ingredient-sold-out', {
            storeId: sid,
            ingredientName: normalizedIngredient,
            productIds,
          });
          logger.info(
            `[Socket Ingredient Sold Out] Updated ${productIds.length} products for: ${normalizedIngredient}`
          );
        }
        if (typeof ack === 'function') ack({ ok: true, updated: matchingProducts.length });
      } catch (err) {
        logger.error(`[Socket Ingredient Sold Out] Error: ${err.message}`);
        deny(ack, 'INTERNAL_ERROR', '품절 처리 중 오류가 발생했습니다.');
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`[Socket] 연결 해제됨: ${socket.id}`);
      const client = activeFoodTruckClients.get(socket.id);
      if (client) {
        const { phone, storeId } = client;
        activeFoodTruckClients.delete(socket.id);
        setTimeout(async () => {
          let reconnected = false;
          for (const item of activeFoodTruckClients.values()) {
            if (item.phone === phone && item.storeId === storeId) {
              reconnected = true;
              break;
            }
          }
          if (!reconnected) {
            try {
              const store = await prisma.stores.findUnique({
                where: { id: parseInt(storeId) },
                select: { name: true },
              });
              const candidates = phoneSearchCandidates(phone);
              const order = await prisma.orders.findFirst({
                where: {
                  store_id: parseInt(storeId),
                  customer_phone: { in: candidates },
                  status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] },
                },
                orderBy: { created_at: 'desc' },
              });
              if (order) {
                await AlimtalkService.sendHeartbeatDisconnectAlert(
                  phone,
                  store ? store.name : 'WeMarket 푸드트럭',
                  order.queue_number,
                  order.order_number || order.id
                );
              }
            } catch (err) {
              logger.error(`[Socket Heartbeat Fallback] Failed: ${err.message}`);
            }
          }
        }, 5000);
      }
    });

    // ── 채팅 ──────────────────────────────────────────────
    socket.on('join-chat-room', ({ roomId }) => {
      socket.join(`chat - ${roomId}`);
    });

    socket.on('send-chat-message', async (data) => {
      const { roomId, message, roomType, targetId } = data;

      io.to(`chat - ${roomId}`).emit('new-chat-message', message);

      if (message.sender_type === 'customer') {
        io.to(`store - ${targetId}`).emit('manager-notification', {
          type: 'CHAT_RECEPTION',
          title: '💬 새 고객 메시지',
          message: '새로운 고객 메시지가 도착했습니다.',
          roomId,
        });
      } else if (message.sender_type === 'owner' && roomType === 'ADMIN_SUPPORT') {
        io.to('admin').emit('manager-notification', {
          type: 'ADMIN_SUPPORT_REQUEST',
          title: '🔧 지원 요청 도착',
          message: `[지원요청] ${message.sender_name || '사업자'}님의 메시지`,
          roomId,
        });
      } else if (message.sender_type === 'super_admin' && roomType === 'ADMIN_SUPPORT') {
        io.to(`user - ${targetId}`).emit('manager-notification', {
          type: 'ADMIN_SUPPORT_REPLY',
          title: '✅ 운영팀 답변',
          message: '운영팀의 답변이 도착했습니다.',
          roomId,
        });
      }
    });

    // ── 매니저 호출 ──────────────────────────────────────
    // ── 매장 매니저 호출 (DB 기록 및 직원 연결 정밀 체크 고도화) ─────────────────
    socket.on('manager-call', async (data) => {
      const { storeId, tableName, type } = data;

      try {
        // 1. 매장 룸('store - ${storeId}')에 연결된 활성 스태프 소켓 개수 정밀 체크 (SLA 가용 확인)
        const room = io.sockets.adapter.rooms.get(`store - ${storeId}`);
        const isStaffConnected = room && room.size >= 1; // 기기 연결 세션 파악

        // 2. 알림 레코드 DB 영구 저장 (관리자 대시보드 검증 및 누적 집계 연동)
        const notification = await prisma.notifications.create({
          data: {
            store_id: parseInt(storeId),
            type: 'MANAGER_CALL',
            title: '🛎️ 직원 호출 도착',
            message: `${tableName || '포장'}에서 "${type || '직원 호출'}" 호출이 들어왔습니다.`,
            data: JSON.stringify({ tableName, type, isStaffConnected }),
            is_read: false,
            priority: 'high',
          },
        });

        // 3. 매장 전체 룸에 실시간 전파 (FCM 토큰 미등록 단말기도 소켓으로 이중 보장)
        io.to(`store - ${storeId}`).emit('manager-notification', {
          id: notification.id,
          type: 'MANAGER_CALL',
          title: '🛎️ 직원 호출 도착',
          message: `${tableName || '포장'}에서 "${type || '직원 호출'}" 호출이 들어왔습니다.`,
          data: { tableName, type, isStaffConnected, id: notification.id },
          priority: 'high',
          created_at: notification.created_at,
        });

        // 4. 호출한 손님 단말기에 가용성 피드백 ACK 전파 (심리적 신뢰감 증진)
        socket.emit('manager-call-ack', {
          success: true,
          isStaffConnected,
          message: isStaffConnected
            ? '직원이 실시간 연결되어 있습니다. 즉시 이동 중입니다! 🏃'
            : '현재 홀 직원이 바쁘지만, 호출 신호가 정상 접수되었습니다.',
        });

        logger.info(
          `[Socket Staff Call] Saved and broadcasted call for table ${tableName} on Store ${storeId} (Active Staff: ${isStaffConnected})`
        );
      } catch (err) {
        logger.error(`[Socket Staff Call] Error: ${err.message}`);
      }
    });

    // ── 공유 장바구니 ────────────────────────────────────
    socket.on('join-table-cart', ({ tableId }) => {
      socket.join(`table - cart - ${tableId}`);
    });

    // ── 분할 결제 테이블 룸 (PaymentService._emitSplitUpdate와 쌍) ──
    socket.on('join-table-payment', ({ tableId }) => {
      socket.join(`table - ${tableId}`);
    });

    socket.on('leave-table-payment', ({ tableId }) => {
      socket.leave(`table - ${tableId}`);
    });

    socket.on('update-shared-cart', (data) => {
      const { tableId, item, userPhone, action } = data;
      io.to(`table - cart - ${tableId}`).emit('cart-item-updated', {
        item,
        userPhone,
        action,
      });
    });

    // ── 고객 주문 알림 ───────────────────────────────────
    socket.on('join-customer-orders', ({ phone }) => {
      const normalized = phone.replace(/[^0-9]/g, '');
      socket.join(`customer-orders-${normalized}`);
    });

    // ── 스마트 웨이팅 ────────────────────────────────────
    socket.on('join-store-waiting', ({ storeId }) => {
      socket.join(`store - waiting - ${storeId}`);
    });

    socket.on('join-my-waiting', ({ phone }) => {
      socket.join(`customer - waiting - ${phone}`);
    });

    socket.on('leave-my-waiting', ({ phone }) => {
      socket.leave(`customer - waiting - ${phone}`);
    });

    socket.on('update-waiting-status', (data) => {
      const { storeId, phone, status, entry } = data;

      io.to(`store - waiting - ${storeId}`).emit('waiting-list-changed', { storeId });

      io.to(`customer - waiting - ${phone}`).emit('waiting-status-changed', {
        status,
        entry,
        message:
          status === 'called'
            ? '입장해 주세요! 점원이 기다리고 있습니다.'
            : '대기 상태가 업데이트되었습니다.',
      });

      io.to(`store - waiting - ${storeId}`).emit('refresh-ahead-count');
    });
  });
}

module.exports = { registerSocketHandlers };
