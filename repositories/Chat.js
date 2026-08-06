const prisma = require('../config/prisma');
const { getStoreRole } = require('../middleware/storeAuth');
const { phoneSearchCandidates } = require('../utils/phoneEncryption');

/**
 * 채팅 모델 (Prisma 기반)
 * 고객-매장 간 채팅 및 슈퍼관리자-사업자 간 지원 채팅을 관리합니다.
 */
const Chat = {
  // [채팅방 조회 또는 생성]
  accessRoom: async (options) => {
    const { store_id, customer_phone, customer_id, user_id, type = 'STORE_CUSTOMER' } = options;

    const where = { type, is_active: true };
    if (type === 'STORE_CUSTOMER') {
      where.store_id = parseInt(store_id);
      if (customer_phone) where.customer_phone = customer_phone;
      if (customer_id) where.customer_id = customer_id;
    } else if (type === 'ADMIN_SUPPORT') {
      where.user_id = parseInt(user_id);
    }

    let room = await prisma.chat_rooms.findFirst({
      where,
      include: {
        users: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!room) {
      room = await prisma.chat_rooms.create({
        data: {
          store_id: store_id ? parseInt(store_id) : null,
          customer_phone,
          customer_id,
          user_id: user_id ? parseInt(user_id) : null,
          type,
        },
        include: {
          users: {
            select: { id: true, name: true, phone: true },
          },
        },
      });
    }

    return room;
  },

  // [주문 capability 기반 고객 채팅방 조회/생성]
  // 클라이언트가 임의의 store_id/phone을 지정할 수 없도록 주문 컨텍스트만 사용한다.
  accessCustomerRoom: async ({ orderId, storeId }) => {
    const order = await prisma.orders.findUnique({ where: { id: parseInt(orderId) } });
    if (!order || parseInt(order.store_id) !== parseInt(storeId)) {
      const err = new Error('유효한 주문이 아닙니다.');
      err.status = 403;
      throw err;
    }

    // 주문의 고객 전화를 채팅방 매칭에 사용 (암호화 후보 포함)
    const candidates = phoneSearchCandidates(order.customer_phone || '');

    const where = {
      type: 'STORE_CUSTOMER',
      store_id: parseInt(storeId),
      is_active: true,
      customer_phone: { in: candidates },
    };

    let room = await prisma.chat_rooms.findFirst({
      where,
      include: { users: { select: { id: true, name: true, phone: true } } },
    });

    if (!room) {
      room = await prisma.chat_rooms.create({
        data: {
          store_id: parseInt(storeId),
          customer_phone: order.customer_phone || null,
          type: 'STORE_CUSTOMER',
        },
        include: { users: { select: { id: true, name: true, phone: true } } },
      });
    }

    return room;
  },

  // [관리자용 모든 지원 채팅방 목록 조회]
  getAdminRooms: async () => {
    const rooms = await prisma.chat_rooms.findMany({
      where: { type: 'ADMIN_SUPPORT' },
      include: {
        users: {
          select: { id: true, name: true, phone: true },
        },
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    // 읽지 않은 메시지 수 합산
    return await Promise.all(
      rooms.map(async (room) => {
        const unreadCount = await prisma.chat_messages.count({
          where: {
            room_id: room.id,
            is_read: false,
            sender_type: { notIn: ['super_admin', 'system'] },
          },
        });
        return { ...room, unreadCount };
      })
    );
  },

  // [메시지 내역 조회]
  getMessages: async (roomId) => {
    return await prisma.chat_messages.findMany({
      where: { room_id: parseInt(roomId) },
      orderBy: { created_at: 'asc' },
    });
  },

  // [메시지 전송]
  sendMessage: async (data) => {
    const { room_id, sender_id, sender_type, content, message_type = 'text' } = data;

    const message = await prisma.chat_messages.create({
      data: {
        room_id: parseInt(room_id),
        sender_id: sender_id ? parseInt(sender_id) : null,
        sender_type,
        content,
        message_type,
      },
      include: {
        rooms: {
          include: {
            users: {
              select: { name: true },
            },
          },
        },
      },
    });

    // 채팅방의 마지막 메시지 및 업데이트 시간 갱신
    await prisma.chat_rooms.update({
      where: { id: parseInt(room_id) },
      data: {
        updated_at: new Date(),
        last_message: content.substring(0, 100),
      },
    });

    const result = { ...message };
    if (message.rooms?.users?.name) {
      result.sender_name = message.rooms.users.name;
    }
    delete result.rooms;

    return result;
  },

  // [읽음 처리]
  markAsRead: async (roomId, senderTypeNot) => {
    return await prisma.chat_messages.updateMany({
      where: {
        room_id: parseInt(roomId),
        is_read: false,
        sender_type: senderTypeNot ? { not: senderTypeNot } : undefined,
      },
      data: { is_read: true },
    });
  },

  // [채팅방 접근 권한 검증]
  // ctx.user(인증 매장 직원) 또는 ctx.capability(주문 capability) 기반 멤버십을 반환한다.
  // 반환: { senderId, senderType } | null (권한 없음)
  authorizeRoom: async (roomId, ctx) => {
    const room = await prisma.chat_rooms.findUnique({ where: { id: parseInt(roomId) } });
    if (!room) return null;

    // 주문 capability — 방의 매장/고객에 묶인 주문만 허용
    if (ctx.capability) {
      const { orderId, storeId } = ctx.capability;
      if (!orderId || parseInt(storeId) !== room.store_id) return null;

      const order = await prisma.orders.findUnique({ where: { id: parseInt(orderId) } });
      if (!order || parseInt(order.store_id) !== room.store_id) return null;

      // 주문의 고객 전화가 채팅방 고객과 일치해야 한다 (암호화 후보 포함)
      const candidates = phoneSearchCandidates(order.customer_phone || '');
      if (room.customer_phone && !candidates.includes(room.customer_phone)) return null;

      return { senderId: null, senderType: 'customer' };
    }

    // 인증 매장 직원 — 실제 매장 역할로 senderType 파생
    if (ctx.user) {
      const role = await getStoreRole(ctx.user.id, room.store_id);
      if (!role) return null;
      return { senderId: ctx.user.id, senderType: role };
    }

    return null;
  },
};

module.exports = Chat;
