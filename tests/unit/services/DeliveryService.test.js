jest.mock('../../../config/prisma', () => ({
  store_order_channels: {
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
  staff: { findFirst: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('../../../services/geocodeService', () => ({
  isConfigured: jest.fn(() => true),
  geocode: jest.fn(),
  isKoreaCoord: (lat, lng) => lat > 33 && lat < 39 && lng > 124 && lng < 132,
}));

const prisma = require('../../../config/prisma');
const geocodeService = require('../../../services/geocodeService');
const OrderChannels = require('../../../repositories/OrderChannels');
const DeliveryService = require('../../../services/DeliveryService');

const store = {
  id: 7,
  name: '집밥',
  address: '서울 강남구 역삼동 123-4',
  latitude: 37.5,
  longitude: 127.03,
  user_id: 1,
};
const delivery = (over = {}) => ({
  ...OrderChannels.DEFAULTS,
  dine_in_enabled: false,
  delivery_enabled: true,
  delivery_radius_km: 2,
  min_order_amount: 15000,
  delivery_fee: 3000,
  ...over,
});

describe('DeliveryService.quote', () => {
  test('반경 안이고 최소 금액 이상이면 배달 가능 + 배달비', async () => {
    geocodeService.geocode.mockResolvedValue({ lat: 37.505, lng: 127.03 });
    const q = await DeliveryService.quote({
      store,
      channels: delivery(),
      address: '서울 강남구 테헤란로 1',
      subtotal: 20000,
    });
    expect(q).toMatchObject({ deliverable: true, fee: 3000 });
  });

  test('반경 밖은 거절', async () => {
    geocodeService.geocode.mockResolvedValue({ lat: 37.6, lng: 127.03 });
    const q = await DeliveryService.quote({
      store,
      channels: delivery(),
      address: '서울 어딘가로 1',
      subtotal: 20000,
    });
    expect(q.deliverable).toBe(false);
    expect(q.reason).toMatch('2km');
  });

  test('최소 주문 금액 미만은 거절', async () => {
    geocodeService.geocode.mockResolvedValue({ lat: 37.5, lng: 127.03 });
    const q = await DeliveryService.quote({
      store,
      channels: delivery(),
      address: '서울 강남구 테헤란로 1',
      subtotal: 9000,
    });
    expect(q.deliverable).toBe(false);
    expect(q.reason).toMatch('15,000원');
  });

  test('지오코딩이 안 되면 고객 기기 좌표로 판정, 그것도 없으면 거절', async () => {
    geocodeService.geocode.mockResolvedValue(null);
    const ok = await DeliveryService.quote({
      store,
      channels: delivery(),
      address: '역삼동 오피스텔',
      subtotal: 20000,
      clientCoords: { latitude: 37.501, longitude: 127.031 },
    });
    expect(ok.deliverable).toBe(true);
    const no = await DeliveryService.quote({
      store,
      channels: delivery(),
      address: '역삼동 오피스텔',
      subtotal: 20000,
    });
    expect(no.deliverable).toBe(false);
  });

  test('주소를 숨긴 매장은 실제 좌표가 아닌 흐린 권역 중심으로 판정한다 (위치 역추적 방지)', async () => {
    geocodeService.geocode.mockResolvedValue(null);
    const channels = delivery({ hide_exact_address: true, delivery_radius_km: 0.1 });
    const blurred = DeliveryService._blurredCenter(store.id, store.latitude, store.longitude);
    const atBlurred = await DeliveryService.quote({
      store,
      channels,
      address: '어딘가',
      subtotal: 20000,
      clientCoords: { latitude: blurred.lat, longitude: blurred.lng },
    });
    expect(atBlurred.deliverable).toBe(true);
    const atReal = await DeliveryService.quote({
      store,
      channels,
      address: '어딘가',
      subtotal: 20000,
      clientCoords: { latitude: store.latitude, longitude: store.longitude },
    });
    expect(atReal.deliverable).toBe(false);
  });

  test('동네 권역은 주소에 동네 이름이 있어야 한다 (공백 무시)', async () => {
    const channels = delivery({
      delivery_area_mode: 'areas',
      delivery_areas: ['역삼1동', '논현동'],
    });
    await expect(
      DeliveryService.quote({ store, channels, address: '서울 강남구 역삼 1동 5', subtotal: 20000 })
    ).resolves.toMatchObject({ deliverable: true });
    await expect(
      DeliveryService.quote({ store, channels, address: '서울 서초구 서초동 5', subtotal: 20000 })
    ).resolves.toMatchObject({ deliverable: false });
  });

  test('배달을 끈 매장은 거절', async () => {
    const q = await DeliveryService.quote({
      store,
      channels: OrderChannels.DEFAULTS,
      address: 'x로 1',
      subtotal: 1,
    });
    expect(q.deliverable).toBe(false);
  });
});

describe('DeliveryService 공개 응답', () => {
  test('기존 매장(매장 식사만, 배달 없음)은 응답을 바꾸지 않는다', () => {
    expect(DeliveryService.applyPublicPrivacy(store, OrderChannels.DEFAULTS)).toBe(store);
  });

  test('주소를 숨긴 매장은 주소·좌표를 지우고 흐린 권역만 남긴다', () => {
    const out = DeliveryService.applyPublicPrivacy(store, delivery({ hide_exact_address: true }));
    expect(out.address).toBe('서울 강남구');
    expect(out.latitude).toBeNull();
    expect(out.longitude).toBeNull();
    expect(out.online_only).toBe(true);
    expect(out.delivery_area.radius_km).toBe(2);
    const { lat, lng } = out.delivery_area.center;
    expect(lat === store.latitude && lng === store.longitude).toBe(false);
    // 흐린 중심은 300~700m 안에서만 움직인다
    const km = require('../../../utils/geo').haversineKm(lat, lng, store.latitude, store.longitude);
    expect(km).toBeGreaterThan(0.25);
    expect(km).toBeLessThan(0.75);
  });

  test('주소를 숨기지 않은 온라인 매장은 실제 좌표를 권역 중심으로 쓴다', () => {
    const out = DeliveryService.applyPublicPrivacy(store, delivery());
    expect(out.latitude).toBe(store.latitude);
    expect(out.delivery_area.center).toEqual({ lat: store.latitude, lng: store.longitude });
  });

  test('매장 사람은 숨김과 관계없이 전체 정보를 받는다', async () => {
    prisma.store_order_channels.findUnique.mockResolvedValue({
      ...delivery({ hide_exact_address: true }),
    });
    await expect(DeliveryService.storeViewFor({ id: 1, role: 'owner' }, store)).resolves.toBe(
      store
    );
    prisma.staff.findFirst.mockResolvedValueOnce({ id: 9 });
    await expect(DeliveryService.storeViewFor({ id: 2, role: 'staff' }, store)).resolves.toBe(
      store
    );
    prisma.staff.findFirst.mockResolvedValueOnce(null);
    const stranger = await DeliveryService.storeViewFor({ id: 3, role: 'customer' }, store);
    expect(stranger.latitude).toBeNull();
    const anonymous = await DeliveryService.storeViewFor(undefined, store);
    expect(anonymous.address).toBe('서울 강남구');
  });
});
