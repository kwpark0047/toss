const prisma = require('../config/prisma');

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

  // [채팅방 권한 검증] - 사용자가 해당 방의 멤버인지 확인하고 sender_type 반환
  authorizeRoom: async (roomId, req) => {
    const room = await prisma.chat_rooms.findUnique({
      where: { id: parseInt(roomId) },
      include: { users: { select: { id: true, sender_type: true } } },
    });
    if (!room) return null;
    const users = room.users || [];
    const user = users.find((u) => u.id === req.user.id);
    if (!user) return null;
    return { senderType: user.sender_type, room: { id: room.id } };
  },
};

module.exports = Chat;
