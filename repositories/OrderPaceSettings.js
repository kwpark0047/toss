const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/**
 * 매장 주문 페이스(바쁨 모드) 설정
 * - extra_wait_minutes: 주방이 몰릴 때 손님에게 보여 줄 예상 시간에 더하는 분
 * - orders_paused_until: 이 시각 전까지 새 QR 주문을 받지 않는다 (지나면 자동 재개)
 * 행이 없거나 테이블이 아직 없으면(마이그레이션 전) 평소처럼 주문을 받는다.
 */
const EXTRA_WAIT_OPTIONS = [0, 10, 20, 30];
const PAUSE_MINUTES_OPTIONS = [15, 30, 60];

const DEFAULTS = Object.freeze({
  extra_wait_minutes: 0,
  orders_paused_until: null,
});

const toPublic = (row, now = new Date()) => {
  const pausedUntil = row?.orders_paused_until ? new Date(row.orders_paused_until) : null;
  const paused = Boolean(pausedUntil && pausedUntil > now);
  return {
    extra_wait_minutes: row?.extra_wait_minutes ?? DEFAULTS.extra_wait_minutes,
    orders_paused: paused,
    orders_paused_until: paused ? pausedUntil.toISOString() : null,
  };
};

/**
 * 요청 본문 검증. 일시정지는 시각 대신 분(pause_minutes)으로 받아 서버 시계로 계산한다.
 * pause_minutes: 15 | 30 | 60 → 일시정지, 0 → 즉시 재개
 */
function sanitize(body = {}, now = new Date()) {
  const data = {};
  if (body.extra_wait_minutes !== undefined) {
    if (!EXTRA_WAIT_OPTIONS.includes(body.extra_wait_minutes)) {
      return { error: `추가 대기 시간은 ${EXTRA_WAIT_OPTIONS.join(', ')}분 중에서 선택해 주세요.` };
    }
    data.extra_wait_minutes = body.extra_wait_minutes;
  }
  if (body.pause_minutes !== undefined) {
    if (body.pause_minutes === 0) {
      data.orders_paused_until = null;
    } else if (PAUSE_MINUTES_OPTIONS.includes(body.pause_minutes)) {
      data.orders_paused_until = new Date(now.getTime() + body.pause_minutes * 60 * 1000);
    } else {
      return { error: `주문 일시정지는 ${PAUSE_MINUTES_OPTIONS.join(', ')}분 중에서 선택해 주세요.` };
    }
  }
  if (Object.keys(data).length === 0) return { error: '변경할 설정이 없습니다.' };
  return { data };
}

const OrderPaceSettings = {
  DEFAULTS,
  EXTRA_WAIT_OPTIONS,
  PAUSE_MINUTES_OPTIONS,
  sanitize,
  toPublic,

  // 설정 조회 (기본값 병합)
  findByStoreId: async (storeId) => {
    const row = await prisma.store_order_pace.findUnique({
      where: { store_id: parseInt(storeId) },
    });
    return toPublic(row);
  },

  // 주문·ETA 경로용 조회: 조회 실패가 주문 접수를 막지 않도록 기본값으로 대체한다.
  findByStoreIdSafe: async (storeId) => {
    try {
      return await OrderPaceSettings.findByStoreId(storeId);
    } catch (error) {
      logger.warn({ storeId, error: error.message }, 'order pace settings unavailable; using defaults');
      return toPublic(null);
    }
  },

  upsert: async (storeId, data) => {
    const row = await prisma.store_order_pace.upsert({
      where: { store_id: parseInt(storeId) },
      update: { ...data, updated_at: new Date() },
      create: { store_id: parseInt(storeId), ...data, updated_at: new Date() },
    });
    return toPublic(row);
  },
};

module.exports = OrderPaceSettings;
