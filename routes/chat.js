const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

// [GET] 특정 매장의 활성 채팅방 조회 또는 생성 (고객용)
router.post('/rooms/access', catchAsync(async (req, res) => {
    const { store_id, customer_phone, customer_id } = req.body;
    let room = await prisma.chat_rooms.findFirst({
        where: {
            store_id: parseInt(store_id),
            customer_phone: customer_phone || null,
            customer_id: customer_id || null,
            is_active: true
        }
    });

    if (!room) {
        room = await prisma.chat_rooms.create({
            data: {
                store_id: parseInt(store_id),
                customer_phone: customer_phone || null,
                customer_id: customer_id || null,
            }
        });
    }

    res.json({ success: true, data: room });
}));

// [GET] 채팅방 메시지 내역 조회
router.get('/rooms/:roomId/messages', catchAsync(async (req, res) => {
    const { roomId } = req.params;
    const messages = await prisma.chat_messages.findMany({
        where: { room_id: parseInt(roomId) },
        orderBy: { created_at: 'asc' }
    });
    res.json({ success: true, data: messages });
}));

// [POST] 메시지 전송 (DB 저장 전용, 실시간은 소켓에서 처리)
router.post('/messages', catchAsync(async (req, res) => {
    const { room_id, sender_id, sender_type, content } = req.body;
    const message = await prisma.chat_messages.create({
        data: {
            room_id: parseInt(room_id),
            sender_id: sender_id ? parseInt(sender_id) : null,
            sender_type,
            content
        }
    });

    await prisma.chat_rooms.update({
        where: { id: parseInt(room_id) },
        data: { updated_at: new Date() }
    });

    res.json({ success: true, data: message });
}));

module.exports = router;
