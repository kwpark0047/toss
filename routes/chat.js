const express = require('express');
const router = express.Router();
const Chat = require('../repositories/Chat');
const catchAsync = require('../utils/catchAsync');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { verifyOrderCapability } = require('../utils/orderCapability');

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: 실시간 채팅 API
 */

/**
 * @swagger
 * /api/chat/rooms/access:
 *   post:
 *     tags: [Chat]
 *     summary: 특정 매장의 활성 채팅방 조회 또는 생성 (고객용)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, customer_phone]
 *             properties:
 *               store_id:
 *                 type: integer
 *               customer_phone:
 *                 type: string
 *               customer_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 채팅방 데이터 반환
 */
router.post(
  '/rooms/access',
  catchAsync(async (req, res) => {
    const capability = verifyOrderCapability(req.get('x-order-capability'));
    if (!capability) {
      return res.status(403).json({ error: '주문 결제 권한이 없거나 만료되었습니다.' });
    }

    const room = await Chat.accessCustomerRoom({
      orderId: capability.orderId,
      storeId: capability.storeId,
    });
    res.json({ success: true, data: room });
  })
);

/**
 * @swagger
 * /api/chat/rooms/admin/access:
 *   post:
 *     tags: [Chat]
 *     summary: 슈퍼관리자-사업자 채팅방 조회 또는 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 채팅방 데이터 반환
 */
router.post(
  '/rooms/admin/access',
  authMiddleware,
  catchAsync(async (req, res) => {
    const { user_id } = req.body;
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    const targetUserId =
      currentUserRole === 'super_admin'
        ? user_id
          ? parseInt(user_id)
          : currentUserId
        : currentUserId;

    const room = await Chat.accessRoom({
      user_id: targetUserId,
      type: 'ADMIN_SUPPORT',
    });
    res.json({ success: true, data: room });
  })
);

/**
 * @swagger
 * /api/chat/rooms/admin:
 *   get:
 *     tags: [Chat]
 *     summary: 슈퍼관리자의 모든 지원 채팅방 목록 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 채팅방 목록 반환
 */
router.get(
  '/rooms/admin',
  authMiddleware,
  adminOnly,
  catchAsync(async (req, res) => {
    const rooms = await Chat.getAdminRooms();
    res.json({ success: true, data: rooms });
  })
);

/**
 * @swagger
 * /api/chat/rooms/{roomId}/messages:
 *   get:
 *     tags: [Chat]
 *     summary: 채팅방 메시지 내역 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 메시지 목록 반환
 */
router.get(
  '/rooms/:roomId/messages',
  catchAsync(async (req, res) => {
    const { roomId } = req.params;
    const auth = await Chat.authorizeRoom(roomId, req);
    if (!auth) return res.status(403).json({ error: '접근 권한이 없습니다' });

    const messages = await Chat.getMessages(roomId);
    res.json({ success: true, data: messages });
  })
);

/**
 * @swagger
 * /api/chat/rooms/{roomId}/read:
 *   patch:
 *     tags: [Chat]
 *     summary: 채팅방 메시지 읽음 처리
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sender_type_not:
 *                 type: string
 *     responses:
 *       200:
 *         description: 읽음 처리 완료
 */
router.patch(
  '/rooms/:roomId/read',
  catchAsync(async (req, res) => {
    const { roomId } = req.params;
    const auth = await Chat.authorizeRoom(roomId, req);
    if (!auth) return res.status(403).json({ error: '접근 권한이 없습니다' });

    await Chat.markAsRead(roomId, auth.senderType);
    res.json({ success: true });
  })
);

/**
 * @swagger
 * /api/chat/messages:
 *   post:
 *     tags: [Chat]
 *     summary: 메시지 전송
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [room_id, content, sender_type]
 *             properties:
 *               room_id:
 *                 type: string
 *               content:
 *                 type: string
 *               sender_type:
 *                 type: string
 *               message_type:
 *                 type: string
 *                 enum: [text, image, file]
 *     responses:
 *       200:
 *         description: 메시지 전송 완료
 */
router.post(
  '/messages',
  authMiddleware,
  catchAsync(async (req, res) => {
    const { room_id, content, message_type } = req.body;

    const auth = await Chat.authorizeRoom(room_id, req);
    if (!auth) return res.status(403).json({ error: '접근 권한이 없습니다' });

    const message = await Chat.sendMessage({
      room_id,
      sender_id: auth.senderId,
      sender_type: auth.senderType,
      content,
      message_type,
    });

    res.json({ success: true, data: message });
  })
);

module.exports = router;
