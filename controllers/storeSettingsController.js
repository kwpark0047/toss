const Receipt = require('../repositories/Receipt');
const TinkerbellSettings = require('../repositories/TinkerbellSettings');
const OrderChannels = require('../repositories/OrderChannels');
const DeliveryService = require('../services/DeliveryService');
const { listProviders } = require('../services/delivery/adapters');
const providerCredentials = require('../services/ProviderCredentialService');

// 배달대행사 목록과 매장 계정 연결 여부 (인증정보 값은 내보내지 않는다)
async function agencyProviderStatus(storeId) {
  return Promise.all(
    listProviders().map(async (provider) => {
      let connected = false;
      try {
        connected = Boolean(await providerCredentials.resolve(provider.key, Number(storeId)));
      } catch {
        connected = false;
      }
      return { ...provider, connected };
    })
  );
}
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

  // AI 팅커벨 설정 조회 (관리자·고객 공용 — 민감 정보 없음)
  getTinkerbellSettings: catchAsync(async (req, res) => {
    const storeId = req.params.storeId ?? req.params.id;
    res.success(await TinkerbellSettings.findByStoreId(storeId));
  }),

  // AI 팅커벨 설정 저장
  updateTinkerbellSettings: catchAsync(async (req, res) => {
    const { data, error } = TinkerbellSettings.sanitize(req.body);
    if (error) return res.status(400).json({ success: false, error });
    const saved = await TinkerbellSettings.upsert(req.params.storeId, data);
    res.success(saved, '팅커벨 설정이 저장되었습니다.');
  }),

  // 주문 유형 스위치·직접 배달 설정 조회 (관리자) + 부가기능 상태
  getOrderChannels: catchAsync(async (req, res) => {
    const storeId = req.params.storeId;
    const [channels, addonActive, agencyProviders] = await Promise.all([
      OrderChannels.findByStoreId(storeId),
      OrderChannels.isAddonActive(storeId),
      agencyProviderStatus(storeId),
    ]);
    res.success({
      ...channels,
      online_addon_active: addonActive,
      agency_providers: agencyProviders,
    });
  }),

  // 주문 유형 스위치·직접 배달 설정 저장
  updateOrderChannels: catchAsync(async (req, res) => {
    const { data, error } = OrderChannels.sanitize(req.body);
    if (error) return res.status(400).json({ success: false, error });
    const storeId = req.params.storeId;
    const [current, addonActive] = await Promise.all([
      OrderChannels.findByStoreId(storeId),
      OrderChannels.isAddonActive(storeId),
    ]);
    const next = { ...current, ...data };
    const invalid = OrderChannels.validateMerged(next, { addonActive });
    if (invalid) return res.status(400).json({ success: false, error: invalid });
    const agencyProviders = await agencyProviderStatus(storeId);
    if (data.agency_provider && !agencyProviders.some((p) => p.key === data.agency_provider))
      return res.status(400).json({ success: false, error: '지원하지 않는 배달대행사입니다.' });
    // 배달대행으로 배달을 받으려면 연동이 준비된 대행사이고, 매장 계정이 연결돼 있어야 한다.
    if (next.delivery_enabled && next.delivery_fulfillment === 'agency') {
      const chosen = agencyProviders.find((p) => p.key === next.agency_provider);
      if (!chosen?.ready)
        return res
          .status(400)
          .json({
            success: false,
            error: `${chosen?.label || '선택한 대행사'} 연동은 준비 중입니다. 지금은 직접 배달을 선택해 주세요.`,
          });
      if (!chosen.connected)
        return res
          .status(400)
          .json({ success: false, error: `${chosen.label} 계정을 먼저 연결해 주세요.` });
    }
    const saved = await OrderChannels.upsert(storeId, data);
    res.success(
      { ...saved, online_addon_active: addonActive, agency_providers: agencyProviders },
      '주문 받는 방식이 저장되었습니다.'
    );
  }),

  // 고객 화면용 주문 유형·배달 조건 (정확한 매장 좌표는 내보내지 않는다)
  getPublicOrderChannels: catchAsync(async (req, res) => {
    const storeId = req.params.id;
    const store = await prisma.stores.findUnique({
      where: { id: parseInt(storeId) },
      select: { id: true, address: true, latitude: true, longitude: true },
    });
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
    const channels = await OrderChannels.findByStoreId(storeId);
    const info = DeliveryService.publicServiceInfo(store, channels);
    res.success({
      ...info,
      pickup_guide: channels.takeout_enabled ? channels.pickup_guide : '',
      delivery: channels.delivery_enabled
        ? {
            fee: channels.delivery_fee,
            min_order_amount: channels.min_order_amount,
            est_minutes: channels.delivery_est_minutes,
          }
        : null,
    });
  }),

  // 배달 가능 여부·배달비 견적 (고객 화면)
  getDeliveryQuote: catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.id);
    const store = await prisma.stores.findUnique({
      where: { id: storeId },
      select: { id: true, latitude: true, longitude: true },
    });
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
    const channels = await OrderChannels.findByStoreId(storeId);
    const subtotal = Number(req.body?.subtotal);
    const result = await DeliveryService.quote({
      store,
      channels,
      address: req.body?.address,
      subtotal: Number.isFinite(subtotal) ? subtotal : undefined,
      clientCoords: req.body,
    });
    // 거리는 매장 위치를 되짚는 데 쓰일 수 있어 응답에서 뺀다.
    delete result.distance_km;
    res.success(result);
  }),

  // 매장 부가기능 목록
  getAddons: catchAsync(async (req, res) => {
    res.success(await OrderChannels.listAddons(req.params.storeId));
  }),

  // 온라인 주문 부가기능 켜기/끄기 (현재 무료)
  setOnlineAddon: catchAsync(async (req, res) => {
    if (typeof req.body?.active !== 'boolean')
      return res
        .status(400)
        .json({ success: false, error: 'active는 true/false 값이어야 합니다.' });
    await OrderChannels.setOnlineAddon(req.params.storeId, req.body.active);
    const [addons, channels] = await Promise.all([
      OrderChannels.listAddons(req.params.storeId),
      OrderChannels.findByStoreId(req.params.storeId),
    ]);
    res.success(
      { addons, channels: { ...channels, online_addon_active: req.body.active } },
      req.body.active ? '온라인 주문 부가기능을 켰습니다.' : '온라인 주문 부가기능을 껐습니다.'
    );
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
