const logger = require('../utils/logger');
const prisma = require('../config/prisma');
const { phoneSearchCandidates } = require('../utils/phoneEncryption');
const AlimtalkService = require('../services/AlimtalkService');

const activeFoodTruckClients = new Map();

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

    socket.on('join-store', (data) => {
      const storeId = typeof data === 'object' ? data.storeId : data;
      const userId = typeof data === 'object' ? data.userId : null;
      socket.join(`store - ${storeId}`);
      if (userId) socket.join(`user - ${userId}`);
    });

    socket.on('join-kitchen', ({ storeId, userId }) => {
      socket.join(`kitchen - ${storeId}`);
      if (userId) socket.join(`user - ${userId}`);
    });

    socket.on('register-foodtruck-client', ({ phone, storeId }) => {
      const normalized = String(phone || '').replace(/[^0-9]/g, '');
      activeFoodTruckClients.set(socket.id, { phone: normalized, storeId });
      logger.debug(`[Socket] FoodTruck client registered: ${socket.id} -> ${normalized}`);
    });

    socket.on('trigger-ingredient-sold-out', async ({ storeId, ingredientName }) => {
      try {
        const products = await prisma.products.findMany({
          where: { store_id: parseInt(storeId), is_active: true }
        });
        const matchingProducts = products.filter(p => {
          if (!p.ingredients) return false;
          const list = p.ingredients.split(',').map(i => i.trim().toLowerCase());
          return list.includes(ingredientName.toLowerCase());
        });
        if (matchingProducts.length > 0) {
          const productIds = matchingProducts.map(p => p.id);
          await prisma.products.updateMany({
            where: { id: { in: productIds } },
            data: { is_sold_out: true }
          });
          io.to(`store - ${storeId}`).emit('products-updated', { storeId });
          io.to(`store - ${storeId}`).emit('ingredient-sold-out', { storeId, ingredientName, productIds });
          logger.info(`[Socket Ingredient Sold Out] Updated ${productIds.length} products for: ${ingredientName}`);
        }
      } catch (err) {
        logger.error(`[Socket Ingredient Sold Out] Error: ${err.message}`);
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
                select: { name: true }
              });
              const candidates = phoneSearchCandidates(phone);
              const order = await prisma.orders.findFirst({
                where: {
                  store_id: parseInt(storeId),
                  customer_phone: { in: candidates },
                  status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] }
                },
                orderBy: { created_at: 'desc' }
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
          message: '새로운 고객 메시지가 도착했습니다.',
          roomId,
        });
      } else if (message.sender_type === 'owner' && roomType === 'ADMIN_SUPPORT') {
        io.to('admin').emit('manager-notification', {
          type: 'ADMIN_SUPPORT_REQUEST',
          message: `[지원요청] ${message.sender_name || '사업자'}님의 메시지`,
          roomId,
        });
      } else if (message.sender_type === 'super_admin' && roomType === 'ADMIN_SUPPORT') {
        io.to(`user - ${targetId}`).emit('manager-notification', {
          type: 'ADMIN_SUPPORT_REPLY',
          message: '운영팀의 답변이 도착했습니다.',
          roomId,
        });
      }
    });

    // ── 매니저 호출 ──────────────────────────────────────
    socket.on('manager-call', (data) => {
      const { storeId, tableName, type } = data;
      io.to(`store - ${storeId}`).emit('manager-notification', {
        type: 'MANAGER_CALL',
        message: `${tableName || '고객'}님이 매니저를 호출하셨습니다. (${type})`,
        tableName,
      });
    });

    // ── 공유 장바구니 ────────────────────────────────────
    socket.on('join-table-cart', ({ tableId }) => {
      socket.join(`table - cart - ${tableId}`);
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

    socket.on('update-waiting-status', (data) => {
      const { storeId, phone, status, entry } = data;

      io.to(`store - waiting - ${storeId}`).emit('waiting-list-changed', { storeId });

      io.to(`customer - waiting - ${phone}`).emit('waiting-status-changed', {
        status,
        entry,
        message: status === 'called'
          ? '입장해 주세요! 점원이 기다리고 있습니다.'
          : '대기 상태가 업데이트되었습니다.',
      });

      io.to(`store - waiting - ${storeId}`).emit('refresh-ahead-count');
    });
  });
}

module.exports = { registerSocketHandlers };
