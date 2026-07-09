const logger = require('../utils/logger');

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

    socket.on('disconnect', () => {
      logger.debug(`[Socket] 연결 해제됨: ${socket.id}`);
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
