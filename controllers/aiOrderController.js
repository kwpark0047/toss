const voiceOrderService = require('../services/VoiceOrderService');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

const {
  resolveVoiceDraft,
  parseOptionGroups,
  getChoices,
} = require('../services/VoiceOrderDraftService');

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

  parsePublicOrder: catchAsync(async (req, res) => {
    const storeId = Number(req.body?.store_id);
    const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript.trim() : '';
    if (!Number.isSafeInteger(storeId) || storeId <= 0 || !transcript || transcript.length > 500) {
      return res
        .status(400)
        .json({ success: false, error: '매장과 500자 이내의 주문 내용을 확인해 주세요.' });
    }

    const [store, catalog] = await Promise.all([
      prisma.stores.findUnique({ where: { id: storeId }, select: { id: true, is_active: true } }),
      prisma.products.findMany({
        where: {
          store_id: storeId,
          is_active: true,
          AND: [
            { OR: [{ is_sold_out: false }, { is_sold_out: null }] },
            { OR: [{ stock_quantity: null }, { stock_quantity: { gt: 0 } }] },
          ],
        },
        select: { id: true, name: true, price: true, options: true },
        take: 300,
        orderBy: { id: 'asc' },
      }),
    ]);
    if (!store || store.is_active === false) {
      return res.status(404).json({ success: false, error: '매장 메뉴를 불러오지 못했어요.' });
    }
    if (!catalog.length) {
      return res
        .status(422)
        .json({ success: false, error: '현재 주문할 수 있는 메뉴가 없습니다.' });
    }

    const parserCatalog = catalog.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      options: parseOptionGroups(item.options).map((group, index) => ({
        name: group.name,
        required: Boolean(group.is_required ?? group.required),
        choices: getChoices(group, index).map((choice) => choice.name),
      })),
    }));
    const parsed = await voiceOrderService.parseOrderFromText(transcript, parserCatalog);
    const draft = resolveVoiceDraft(parsed, catalog, transcript);
    if (!draft.success) return res.status(422).json(draft);
    return res.json(draft);
  }),
};

module.exports = aiOrderController;
