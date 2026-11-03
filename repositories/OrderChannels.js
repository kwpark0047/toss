const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/**
 * 매장별 주문 유형 스위치(매장 식사/포장/배달)와 직접 배달 설정 (Prisma 기반)
 * 저장된 행이 없으면 DEFAULTS를 돌려준다 — 기존 매장은 지금처럼 매장 식사·포장만 받는다.
 * 매장 식사 끄기(온라인 전용)와 배달 켜기는 '온라인 주문' 부가기능(무료)을 켠 매장만 할 수 있다.
 */
const ONLINE_ADDON = 'online_ordering';
const ORDER_TYPES = ['dine_in', 'takeout', 'delivery'];
const AREA_MODES = ['radius', 'areas'];
const MAX_AREAS = 50;
const AREA_NAME_MAX = 30;
const PICKUP_GUIDE_MAX = 200;
const MAX_RADIUS_KM = 20;
const MAX_AMOUNT = 1000000;

const DEFAULTS = Object.freeze({
  dine_in_enabled: true,
  takeout_enabled: true,
  delivery_enabled: false,
  pickup_guide: '',
  hide_exact_address: false,
  delivery_fulfillment: 'self',
  delivery_area_mode: 'radius',
  delivery_radius_km: 3,
  delivery_areas: [],
  min_order_amount: 0,
  delivery_fee: 0,
  delivery_est_minutes: 40,
  agency_provider: null,
  agency_auto_dispatch: false,
});
const FULFILLMENTS = ['self', 'agency'];
const AGENCY_PROVIDER_PATTERN = /^[a-z]{2,20}$/;

const toPublic = (row) => {
  const out = {};
  for (const key of Object.keys(DEFAULTS)) out[key] = row?.[key] ?? DEFAULTS[key];
  out.pickup_guide = out.pickup_guide || '';
  out.delivery_areas = Array.isArray(out.delivery_areas) ? out.delivery_areas : [];
  return out;
};

// 고객이 고를 수 있는 주문 유형 목록
const enabledTypes = (channels) =>
  ORDER_TYPES.filter((type) => channels[`${type}_enabled`] === true);

// 매장 식사가 꺼진 매장 = 온라인 전용
const isOnlineOnly = (channels) => channels.dine_in_enabled === false;

// 공개 응답에서 정확한 매장 주소를 숨길지. 온라인 전용 매장만 숨길 수 있다.
const hidesAddress = (channels) => isOnlineOnly(channels) && channels.hide_exact_address === true;

const isBool = (v) => typeof v === 'boolean';
const isAmount = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_AMOUNT;

/**
 * 요청 본문에서 허용 필드만 골라 검증한다. 잘못된 값이면 { error }를 돌려준다.
 */
function sanitize(body = {}) {
  const data = {};
  for (const key of [
    'dine_in_enabled',
    'takeout_enabled',
    'delivery_enabled',
    'hide_exact_address',
  ]) {
    if (body[key] === undefined) continue;
    if (!isBool(body[key])) return { error: `${key}는 true/false 값이어야 합니다.` };
    data[key] = body[key];
  }
  if (body.pickup_guide !== undefined) {
    if (body.pickup_guide !== null && typeof body.pickup_guide !== 'string')
      return { error: '픽업 안내는 문자열이어야 합니다.' };
    const guide = (body.pickup_guide || '').trim();
    if (guide.length > PICKUP_GUIDE_MAX)
      return { error: `픽업 안내는 ${PICKUP_GUIDE_MAX}자 이내로 입력해 주세요.` };
    data.pickup_guide = guide || null;
  }
  if (body.delivery_fulfillment !== undefined) {
    if (!FULFILLMENTS.includes(body.delivery_fulfillment))
      return { error: '배달 방식은 직접 배달 또는 배달대행이어야 합니다.' };
    data.delivery_fulfillment = body.delivery_fulfillment;
  }
  if (body.agency_provider !== undefined) {
    // 지원 대행사 목록 대조는 컨트롤러가 어댑터 목록으로 한다.
    if (
      body.agency_provider !== null &&
      !AGENCY_PROVIDER_PATTERN.test(String(body.agency_provider))
    )
      return { error: '배달대행사가 올바르지 않습니다.' };
    data.agency_provider = body.agency_provider;
  }
  if (body.agency_auto_dispatch !== undefined) {
    if (!isBool(body.agency_auto_dispatch))
      return { error: 'agency_auto_dispatch는 true/false 값이어야 합니다.' };
    data.agency_auto_dispatch = body.agency_auto_dispatch;
  }
  if (body.delivery_area_mode !== undefined) {
    if (!AREA_MODES.includes(body.delivery_area_mode))
      return { error: '배달 권역 방식이 올바르지 않습니다.' };
    data.delivery_area_mode = body.delivery_area_mode;
  }
  if (body.delivery_radius_km !== undefined) {
    const r = Number(body.delivery_radius_km);
    if (!Number.isFinite(r) || r <= 0 || r > MAX_RADIUS_KM)
      return { error: `배달 반경은 0보다 크고 ${MAX_RADIUS_KM}km 이하여야 합니다.` };
    data.delivery_radius_km = Math.round(r * 10) / 10;
  }
  if (body.delivery_areas !== undefined) {
    if (!Array.isArray(body.delivery_areas) || body.delivery_areas.length > MAX_AREAS)
      return { error: `배달 동네는 ${MAX_AREAS}개까지 입력할 수 있습니다.` };
    const areas = [];
    for (const raw of body.delivery_areas) {
      if (typeof raw !== 'string') return { error: '배달 동네 이름은 문자열이어야 합니다.' };
      const name = raw.trim();
      if (!name) continue;
      if (name.length > AREA_NAME_MAX)
        return { error: `배달 동네 이름은 ${AREA_NAME_MAX}자 이내로 입력해 주세요.` };
      if (!areas.includes(name)) areas.push(name);
    }
    data.delivery_areas = areas;
  }
  for (const key of ['min_order_amount', 'delivery_fee']) {
    if (body[key] === undefined) continue;
    if (!isAmount(body[key]))
      return { error: `${key}는 0 이상 ${MAX_AMOUNT}원 이하 정수여야 합니다.` };
    data[key] = body[key];
  }
  if (body.delivery_est_minutes !== undefined) {
    const m = body.delivery_est_minutes;
    if (!Number.isInteger(m) || m < 5 || m > 240)
      return { error: '예상 배달 시간은 5~240분 사이 정수여야 합니다.' };
    data.delivery_est_minutes = m;
  }
  return { data };
}

/**
 * 저장 후의 설정이 성립하는지 확인한다. 문제가 있으면 에러 메시지를 돌려준다.
 */
function validateMerged(next, { addonActive }) {
  if (!next.dine_in_enabled && !next.takeout_enabled && !next.delivery_enabled)
    return '주문 유형을 하나 이상 켜 주세요.';
  if (!addonActive && (!next.dine_in_enabled || next.delivery_enabled))
    return '매장 식사 끄기와 배달은 온라인 주문 부가기능을 켠 뒤 사용할 수 있습니다.';
  if (
    next.delivery_enabled &&
    next.delivery_area_mode === 'areas' &&
    next.delivery_areas.length === 0
  )
    return '배달 동네를 하나 이상 입력해 주세요.';
  if (next.delivery_enabled && next.delivery_fulfillment === 'agency' && !next.agency_provider)
    return '배달대행사를 선택해 주세요.';
  return null;
}

const OrderChannels = {
  ONLINE_ADDON,
  ORDER_TYPES,
  DEFAULTS,
  sanitize,
  validateMerged,
  enabledTypes,
  isOnlineOnly,
  hidesAddress,
  toPublic,

  // 매장 설정 조회 (기본값 병합). 테이블이 아직 없거나 조회가 실패하면 기본값으로 주문을 받는다(fail-open).
  findByStoreId: async (storeId, client = prisma) => {
    try {
      const row = await client.store_order_channels.findUnique({
        where: { store_id: parseInt(storeId) },
      });
      return toPublic(row);
    } catch (error) {
      logger.warn(`[OrderChannels] 설정 조회 실패, 기본값 사용: ${error.message}`);
      return toPublic(null);
    }
  },

  // 여러 매장 설정을 한 번에 조회 (공개 목록 응답용). Map<storeId, channels>
  findByStoreIds: async (storeIds) => {
    const ids = [...new Set(storeIds.map(Number).filter(Number.isInteger))];
    const map = new Map();
    if (!ids.length) return map;
    try {
      const rows = await prisma.store_order_channels.findMany({ where: { store_id: { in: ids } } });
      for (const row of rows) map.set(row.store_id, toPublic(row));
    } catch (error) {
      logger.warn(`[OrderChannels] 목록 설정 조회 실패, 기본값 사용: ${error.message}`);
    }
    return map;
  },

  // 매장 설정 저장
  upsert: async (storeId, data) => {
    const row = await prisma.store_order_channels.upsert({
      where: { store_id: parseInt(storeId) },
      update: { ...data, updated_at: new Date() },
      create: { store_id: parseInt(storeId), ...data, updated_at: new Date() },
    });
    return toPublic(row);
  },

  // 부가기능이 켜져 있는지 (만료일이 지났으면 꺼진 것으로 본다)
  isAddonActive: async (storeId, addonKey = ONLINE_ADDON, client = prisma) => {
    let row;
    try {
      row = await client.store_addons.findUnique({
        where: { store_id_addon_key: { store_id: parseInt(storeId), addon_key: addonKey } },
      });
    } catch (error) {
      logger.warn(`[OrderChannels] 부가기능 조회 실패: ${error.message}`);
      return false;
    }
    if (!row || !['active', 'trialing'].includes(row.status)) return false;
    return !row.expires_at || row.expires_at > new Date();
  },

  // 매장 부가기능 목록
  listAddons: async (storeId) => {
    const rows = await prisma.store_addons.findMany({ where: { store_id: parseInt(storeId) } });
    const online = rows.find((row) => row.addon_key === ONLINE_ADDON);
    return [
      {
        key: ONLINE_ADDON,
        name: '온라인 주문',
        description: '매장 식사 없이 포장·배달만 받는 온라인 전용 운영과 직접 배달',
        price: 0,
        active: !!online && ['active', 'trialing'].includes(online.status),
        started_at: online?.started_at || null,
        canceled_at: online?.canceled_at || null,
      },
    ];
  },

  /**
   * 온라인 주문 부가기능 켜기/끄기. 끌 때는 배달을 끄고, 매장 식사가 꺼진 매장은 포장만 받게 한다
   * (매장 식사를 자동으로 켜면 테이블이 없는 매장에 매장 식사 주문이 들어온다).
   */
  setOnlineAddon: async (storeId, active) => {
    const store_id = parseInt(storeId);
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.store_addons.upsert({
        where: { store_id_addon_key: { store_id, addon_key: ONLINE_ADDON } },
        update: active
          ? { status: 'active', started_at: now, canceled_at: null, updated_at: now }
          : { status: 'canceled', canceled_at: now, updated_at: now },
        create: {
          store_id,
          addon_key: ONLINE_ADDON,
          status: active ? 'active' : 'canceled',
          price: 0,
          started_at: now,
          canceled_at: active ? null : now,
          updated_at: now,
        },
      });
      if (!active) {
        const current = toPublic(await tx.store_order_channels.findUnique({ where: { store_id } }));
        if (current.delivery_enabled || !current.dine_in_enabled) {
          await tx.store_order_channels.upsert({
            where: { store_id },
            update: {
              delivery_enabled: false,
              takeout_enabled: current.dine_in_enabled ? current.takeout_enabled : true,
              updated_at: now,
            },
            create: { store_id, delivery_enabled: false, updated_at: now },
          });
        }
      }
    });
  },
};

module.exports = OrderChannels;
