const prisma = require('../config/prisma');
const OrderChannels = require('../repositories/OrderChannels');
const geocodeService = require('./geocodeService');
const { haversineKm } = require('../utils/geo');

/**
 * 직접 배달 권역·배달비 판정과 공개용 배달 권역 표시.
 * 권역은 반경(km, 매장 좌표 기준) 또는 동네 이름 목록(배달 주소에 포함되는지) 중 하나로 정한다.
 */

const ADDRESS_MAX = 300;

// 주소 문자열에서 공백을 없애 동네 이름 포함 여부를 비교한다 ("역삼 1동" ↔ "역삼1동")
const squash = (s) => String(s || '').replace(/\s+/g, '');

async function resolveCoords(address, clientCoords) {
  if (geocodeService.isConfigured()) {
    try {
      const g = await geocodeService.geocode(address);
      if (g) return { lat: g.lat, lng: g.lng };
    } catch {
      /* 지오코딩 실패 시 고객 기기가 고른 주소 좌표로 대신한다 */
    }
  }
  const lat = Number(clientCoords?.latitude);
  const lng = Number(clientCoords?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && geocodeService.isKoreaCoord(lat, lng)) {
    return { lat, lng };
  }
  return null;
}

/**
 * 배달 가능 여부와 배달비. 주문 생성과 고객 화면 견적이 같은 판정을 쓴다.
 * @returns {{ deliverable: boolean, reason?: string, fee: number, min_order_amount: number,
 *            est_minutes: number, distance_km?: number }}
 */
async function quote({ store, channels, address, subtotal, clientCoords }) {
  const base = {
    fee: channels.delivery_fee,
    min_order_amount: channels.min_order_amount,
    est_minutes: channels.delivery_est_minutes,
  };
  if (!channels.delivery_enabled)
    return { ...base, deliverable: false, reason: '이 매장은 배달을 받지 않습니다.' };
  const addr = String(address || '').trim();
  if (!addr) return { ...base, deliverable: false, reason: '배달 주소를 입력해 주세요.' };
  if (addr.length > ADDRESS_MAX)
    return {
      ...base,
      deliverable: false,
      reason: `배달 주소는 ${ADDRESS_MAX}자 이내로 입력해 주세요.`,
    };

  if (channels.delivery_area_mode === 'areas') {
    const hit = channels.delivery_areas.some((area) => squash(addr).includes(squash(area)));
    if (!hit) return { ...base, deliverable: false, reason: '배달 가능 지역이 아닙니다.' };
  } else {
    if (store.latitude == null || store.longitude == null)
      return {
        ...base,
        deliverable: false,
        reason: '매장 위치가 등록되지 않아 배달 거리를 확인할 수 없습니다.',
      };
    const coords = await resolveCoords(addr, clientCoords);
    if (!coords)
      return {
        ...base,
        deliverable: false,
        reason: '주소 위치를 확인할 수 없습니다. 도로명 주소로 입력해 주세요.',
      };
    const distance = haversineKm(coords.lat, coords.lng, store.latitude, store.longitude);
    base.distance_km = Math.round(distance * 10) / 10;
    if (distance > channels.delivery_radius_km)
      return {
        ...base,
        deliverable: false,
        reason: `배달 가능 거리(${channels.delivery_radius_km}km)를 벗어났습니다.`,
      };
  }

  if (Number.isFinite(subtotal) && subtotal < channels.min_order_amount) {
    return {
      ...base,
      deliverable: false,
      reason: `배달은 ${channels.min_order_amount.toLocaleString()}원 이상 주문할 수 있습니다.`,
    };
  }
  return { ...base, deliverable: true };
}

// 매장마다 고정된 방향·거리(300~700m)로 중심을 흐려, 권역 원으로 정확한 위치를 되짚지 못하게 한다.
function blurredCenter(storeId, lat, lng) {
  const seed = (Number(storeId) * 2654435761) >>> 0;
  const angle = ((seed % 360) * Math.PI) / 180;
  const meters = 300 + ((seed >>> 9) % 400);
  const dLat = (meters * Math.cos(angle)) / 111320;
  const dLng = (meters * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
  const round4 = (n) => Math.round(n * 1e4) / 1e4;
  return { lat: round4(lat + dLat), lng: round4(lng + dLng) };
}

// "서울 강남구 역삼동 123" → "서울 강남구" (주소를 숨긴 매장의 지역 표시)
function districtLabel(address) {
  const parts = String(address || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.slice(0, 2).join(' ');
}

/**
 * 고객에게 보여 줄 주문 유형·배달 권역 정보.
 */
function publicServiceInfo(store, channels) {
  const info = {
    order_types: OrderChannels.enabledTypes(channels),
    online_only: OrderChannels.isOnlineOnly(channels),
    address_hidden: OrderChannels.hidesAddress(channels),
  };
  if (channels.delivery_enabled) {
    const area = { mode: channels.delivery_area_mode };
    if (channels.delivery_area_mode === 'areas') {
      area.areas = channels.delivery_areas;
    } else if (store.latitude != null && store.longitude != null) {
      area.radius_km = channels.delivery_radius_km;
      area.center = info.address_hidden
        ? blurredCenter(store.id, store.latitude, store.longitude)
        : { lat: store.latitude, lng: store.longitude };
    }
    info.delivery_area = area;
  }
  if (info.address_hidden) info.area_label = districtLabel(store.address);
  return info;
}

/**
 * 공개 매장 응답에 주문 유형·권역을 붙이고, 주소를 숨긴 매장은 정확한 주소·좌표를 지운다.
 * 프론트에서 숨기는 것으로는 부족하다 — 응답에 남으면 그대로 노출된다.
 */
function applyPublicPrivacy(store, channels = OrderChannels.DEFAULTS) {
  if (!store) return store;
  // 매장 식사만 받고 배달하지 않는 기존 매장은 응답을 바꾸지 않는다(공개 응답 계약 유지).
  if (!OrderChannels.isOnlineOnly(channels) && !channels.delivery_enabled) return store;
  const info = publicServiceInfo(store, channels);
  const out = { ...store, ...info };
  if (info.address_hidden) {
    out.address = info.area_label || null;
    out.latitude = null;
    out.longitude = null;
    for (const key of ['business_address', 'road_address', 'jibun_address', 'detail_address']) {
      if (key in out) out[key] = null;
    }
  }
  return out;
}

// 공개 매장 목록 전체에 적용 (설정은 한 번에 조회)
async function applyPublicPrivacyToList(stores) {
  if (!Array.isArray(stores) || stores.length === 0) return stores;
  const map = await OrderChannels.findByStoreIds(stores.map((s) => s.id));
  return stores.map((s) => applyPublicPrivacy(s, map.get(Number(s.id)) || OrderChannels.DEFAULTS));
}

/**
 * 매장 상세 응답: 매장 사람(사장님·직원·플랫폼 관리자)이 아니면 주소를 숨긴 매장의 정확한 주소·좌표를 지운다.
 */
async function storeViewFor(user, store) {
  if (!store) return store;
  if (user) {
    if (user.role === 'super_admin' || Number(store.user_id) === Number(user.id)) return store;
    try {
      const member = await prisma.staff.findFirst({
        where: { store_id: Number(store.id), user_id: Number(user.id) },
        select: { id: true },
      });
      if (member) return store;
    } catch {
      /* 직원 확인 실패 시 공개 응답으로 */
    }
  }
  return applyPublicPrivacy(store, await OrderChannels.findByStoreId(store.id));
}

module.exports = {
  quote,
  storeViewFor,
  publicServiceInfo,
  applyPublicPrivacy,
  applyPublicPrivacyToList,
  _blurredCenter: blurredCenter,
};
