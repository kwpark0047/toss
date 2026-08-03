const voiceOrderService = require('../services/VoiceOrderService');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

const aiOrderController = {
  parseOrder: catchAsync(async (req, res) => {
    const { store_id, prompt } = req.body;
    if (!store_id || !prompt) {
      return res.status(400).json({ success: false, error: 'store_id and prompt are required.' });
    }

    const menuItems = await prisma.products.findMany({
      where: { store_id: Number(store_id), is_active: true },
      select: { id: true, name: true, price: true },
    });

    const result = await voiceOrderService.parseOrderFromText(prompt, menuItems);
    res.success(result, '음성/채팅 주문이 성공적으로 분석되었습니다.');
  }),
};

module.exports = aiOrderController;
