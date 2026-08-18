const Receipt = require('../repositories/Receipt');
const StoreTier = require('../repositories/StoreTier');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

const VALID_RECEIPT_FIELDS = [
  'title',
  'greetings',
  'footer_text',
  'header_logo',
  'show_order_number',
  'show_item_details',
  'show_store_address',
  'show_points',
];

const storeSettingsController = {
  // 영수증 설정 조회
  getReceiptSettings: catchAsync(async (req, res) => {
    const settings = await Receipt.findByStoreId(req.params.storeId);
    // 기본값 적용
    const defaults = {
      title: '영수증',
      greetings: '방문해 주셔서 감사합니다.',
      footer_text: '교환/환불은 영수증 지참 시 7일 이내 가능합니다.',
      header_logo: null,
      show_order_number: true,
      show_item_details: true,
      show_store_address: true,
      show_points: true,
    };
    res.success({ ...defaults, ...settings });
  }),

  // 영수증 설정 업데이트
  updateReceiptSettings: catchAsync(async (req, res) => {
    // 허용된 필드만 필터링
    const filteredData = {};
    for (const field of VALID_RECEIPT_FIELDS) {
      if (req.body[field] !== undefined) {
        filteredData[field] = req.body[field];
      }
    }

    // Boolean 필드 변환
    if (filteredData.show_order_number !== undefined) {
      filteredData.show_order_number = Boolean(filteredData.show_order_number);
    }
    if (filteredData.show_item_details !== undefined) {
      filteredData.show_item_details = Boolean(filteredData.show_item_details);
    }
    if (filteredData.show_store_address !== undefined) {
      filteredData.show_store_address = Boolean(filteredData.show_store_address);
    }
    if (filteredData.show_points !== undefined) {
      filteredData.show_points = Boolean(filteredData.show_points);
    }

    await Receipt.update(req.params.storeId, filteredData);
    res.success(null, '영수증 설정이 업데이트되었습니다.');
  }),

  // 매장 등급 설정 조회
  getTierSettings: catchAsync(async (req, res) => {
    const tiers = await StoreTier.getTiers(req.params.storeId);
    res.success(tiers);
  }),

  // 매장 등급 설정 업데이트/추가
  upsertTierSetting: catchAsync(async (req, res) => {
    const tier = await StoreTier.upsertTier(req.params.storeId, req.body);
    res.success(tier, '등급 설정이 저장되었습니다.');
  }),

  // 매장 등급 설정 삭제
  deleteTierSetting: catchAsync(async (req, res) => {
    await StoreTier.deleteTier(req.params.storeId, req.params.tierName);
    res.success(null, '등급 설정이 삭제되었습니다.');
  }),

  // 매장 수수료율 설정 (super_admin 전용)
  updateCommission: catchAsync(async (req, res) => {
    const { commission_rate, vat_rate } = req.body;
    if (commission_rate !== undefined && (commission_rate < 0 || commission_rate > 0.3)) {
      return res.status(400).json({ error: '수수료율은 0% ~ 30% 범위여야 합니다.' });
    }
    const updateData = {};
    if (commission_rate !== undefined) updateData.commission_rate = parseFloat(commission_rate);
    if (vat_rate !== undefined) updateData.vat_rate = parseFloat(vat_rate);

    await prisma.stores.update({ where: { id: parseInt(req.params.storeId) }, data: updateData });
    res.success(null, '수수료율이 업데이트되었습니다.');
  }),
};

module.exports = storeSettingsController;
