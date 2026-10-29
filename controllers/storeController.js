const StoreService = require('../services/StoreService');
const Store = require('../repositories/Store');
const prisma = require('../config/prisma');
const geocodeService = require('../services/geocodeService');
const logger = require('../utils/logger');

const storeService = new StoreService();

/**
 * 새 매장의 도로명 주소를 응답 후 백그라운드로 지오코딩한다 (실패해도 매장 생성에는 영향 없음).
 * 그 사이 사장님이 직접 위치를 지정했다면 덮어쓰지 않도록 좌표가 비어 있을 때만 갱신한다.
 */
function geocodeNewStoreInBackground(store) {
  if (!store?.id || !store.address || store.latitude != null || !geocodeService.isConfigured())
    return;
  geocodeService
    .geocode(store.address)
    .then(async (coord) => {
      if (!coord) return;
      const { count } = await prisma.stores.updateMany({
        where: { id: store.id, latitude: null, longitude: null },
        data: { latitude: coord.lat, longitude: coord.lng },
      });
      if (count) storeService.flushStoreCache(store.id);
    })
    .catch((err) =>
      logger.warn({ storeId: store.id, error: err.message }, '신규 매장 지오코딩 실패')
    );
}

const storeController = {
  // GET / — 전체 매장 목록 조회
  async getStores(req, res) {
    const limit = parseInt(req.query.limit) || 0;
    if (limit > 0) {
      const stores = await prisma.stores.findMany({
        where: {
          is_active: true,
          NOT: [{ name: { contains: '?' } }, { name: { contains: '\uFFFD' } }],
        },
        select: {
          id: true,
          name: true,
          address: true,
          store_business_info: { select: { business_type: true } },
          latitude: true,
          longitude: true,
        },
        take: Math.min(limit, 200),
        orderBy: { id: 'desc' },
      });
      return res.success(
        stores.map(({ store_business_info, ...store }) => ({
          ...store,
          business_type: store_business_info?.business_type ?? null,
        }))
      );
    }
    const stores = await Store.findAll();
    res.success(stores);
  },

  // GET /my — 내 매장 목록 조회
  async getMyStores(req, res) {
    const stores = await Store.findByUserId(req.user.id);
    res.success(stores);
  },

  // GET /search — 공개 매장 검색 (페이지네이션 지원)
  async searchStores(req, res) {
    const { district, business_type, q, lat, lng, limit, page } = req.query;
    const result = await storeService.searchStores({
      district,
      business_type,
      q,
      lat,
      lng,
      limit,
      page,
    });
    res.success(result);
  },

  // GET /highlights — 지역 하이라이트 배너
  async getHighlights(req, res) {
    const { district } = req.query;
    const result = await storeService.getHighlights(district);
    res.success(result);
  },

  // GET /popular — 인기 매장 랭킹
  async getPopular(req, res) {
    const ranked = await storeService.getPopular();
    res.success(ranked);
  },

  // GET /favorites/:phone — 찜 목록 조회
  async getFavorites(req, res) {
    const favorites = await storeService.getFavorites(req.params.phone);
    res.success(favorites);
  },

  // POST /favorites — 찜 추가
  async addFavorite(req, res) {
    const { customer_phone, store_id } = req.body;
    if (!customer_phone || !store_id) {
      return res.status(400).json({ success: false, error: '전화번호와 매장ID가 필요합니다.' });
    }
    const fav = await storeService.addFavorite(customer_phone, store_id);
    res.success(fav, '찜한 매장에 추가됐습니다.');
  },

  // DELETE /favorites — 찜 해제
  async removeFavorite(req, res) {
    const { customer_phone, store_id } = req.body;
    if (!customer_phone || !store_id) {
      return res.status(400).json({ success: false, error: '전화번호와 매장ID가 필요합니다.' });
    }
    await storeService.removeFavorite(customer_phone, store_id);
    res.success(null, '찜을 해제했습니다.');
  },

  // POST / — 매장 생성 (공공데이터 매칭 포함)
  async createStore(req, res, io) {
    const result = await storeService.createStoreWithMatching({
      ...req.body,
      userId: req.user.id,
    });

    if (result.alreadyOwned) {
      // 사용자가 이미 전화번호로 소유한 매장이 존재 → 중복 생성 방지
      return res.success(
        { alreadyOwned: true, store: result.store, matchMethod: result.matchMethod },
        '이미 등록된 매장입니다.',
        200
      );
    }

    if (result.linkRequested) {
      // 매칭된 매장에 대한 링크 요청 생성
      const linkReq = await storeService.createLinkRequest(
        req.user.id,
        result.matchedStore.id,
        req.body.name,
        req.body.address
      );
      if (io) {
        io.to('admin').emit('store-link-request-created', {
          id: linkReq.id,
          userId: req.user.id,
          userName: req.user.name,
          storeId: result.matchedStore.id,
          storeName: result.matchedStore.name,
          storeAddress: result.matchedStore.address,
          requestedName: req.body.name,
          matchMethod: result.matchMethod,
          matchScore: result.matchScore,
          createdAt: linkReq.created_at,
        });
      }
      return res.success(
        {
          linkRequested: true,
          matchedStore: result.matchedStore,
          matchMethod: result.matchMethod,
          matchScore: result.matchScore,
        },
        result.matchMethod === 'business_number'
          ? '사업자등록번호가 일치하는 매장이 확인되어 자동 승인을 요청했습니다.'
          : result.matchMethod === 'phone'
            ? '전화번호가 일치하는 매장이 확인되어 자동 승인을 요청했습니다.'
            : '기존 등록된 매장과 일치하여 관리자에게 자동 승인을 요청했습니다.',
        202
      );
    }

    res.created(result.store, '매장이 생성되었습니다.');
    geocodeNewStoreInBackground(result.store);
  },

  // GET /:id — 매장 상세 조회
  async getStore(req, res) {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });

    const cache = require('../utils/cache');
    const cacheKey = `store:${req.params.id}:profile`;
    cache.set(cacheKey, store, 60);
    res.success(store);
  },

  // GET /public-intro/:id — QR 진입 소개 화면에 필요한 공개 정보만 반환
  async getPublicIntro(req, res) {
    const storeId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(storeId) || storeId < 1) {
      return res.status(400).json({ success: false, error: '매장 번호가 올바르지 않습니다.' });
    }

    const store = await prisma.stores.findFirst({
      where: { id: storeId, is_active: { not: false } },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        customer_entry_mode: true,
        store_operating_hours: {
          select: { open_time: true, close_time: true, business_hours: true },
        },
        products: {
          where: { is_active: true, is_sold_out: false },
          orderBy: [{ is_popular: 'desc' }, { sort_order: 'asc' }],
          take: 3,
          select: { id: true, name: true, description: true, price: true, image_url: true },
        },
      },
    });

    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
    const { store_operating_hours: operatingHours, ...publicStore } = store;
    res.success({ ...publicStore, operating_hours: operatingHours || null });
  },

  // PUT /:id — 매장 수정
  async updateStore(req, res) {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });

    const updated = await Store.update(req.params.id, req.body);
    storeService.flushStoreCache(req.params.id);
    res.success(updated, '매장 정보가 수정되었습니다.');
  },

  // GET /:id/location/search?q= — 위치 지정용 주소 후보 검색 (권한은 라우터에서 확인)
  async searchLocation(req, res) {
    if (!geocodeService.isConfigured()) {
      // 502/503은 프론트의 콜드스타트 재시도를 유발하므로 424(외부 의존성 실패)로 응답
      return res
        .status(424)
        .json({ success: false, error: '주소 검색 서비스가 설정되지 않았습니다.' });
    }
    try {
      // Express 5에서는 req.query 재할당이 무시될 수 있어 검증된 값을 우선 사용
      const q = req.validated?.query?.q ?? String(req.query.q || '').trim();
      const results = await geocodeService.searchAddresses(q);
      res.success({ query: q, results });
    } catch (err) {
      if (err instanceof geocodeService.GeocodeProviderError) {
        return res
          .status(err.status === 429 ? 429 : 424)
          .json({ success: false, error: err.message });
      }
      throw err;
    }
  },

  // DELETE /:id — 매장 삭제
  async deleteStore(req, res) {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    await Store.delete(req.params.id);
    res.success(null, '매장이 삭제되었습니다.');
  },

  // GET /:id/business — 사업자 정보 조회
  async getBusinessInfo(req, res) {
    const store = await storeService.getBusinessInfo(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    res.success(store);
  },

  // PUT /:id/business — 사업자 정보 저장
  async updateBusinessInfo(req, res) {
    const error = storeService.validateBusinessInfo(req.body);
    if (error) return res.status(400).json({ success: false, error });

    const updated = await Store.updateBusinessInfo(parseInt(req.params.id), req.body);
    res.success(updated, '사업자 정보가 저장되었습니다.');
  },

  // GET /:id/account — 계좌 조회 (관리자)
  async getAccount(req, res) {
    const account = await storeService.getAccount(req.params.id);
    res.success(account || null);
  },

  // GET /:id/account/public — 계좌 조회 (고객용)
  async getPublicAccount(req, res) {
    const account = await storeService.getPublicAccount(req.params.id);
    res.success(account || null);
  },

  // PUT /:id/account — 계좌 등록·수정
  async upsertAccount(req, res) {
    const { bank_name, account_number, account_holder } = req.body;
    if (!bank_name || !account_number || !account_holder) {
      return res
        .status(400)
        .json({ success: false, error: '은행명, 계좌번호, 예금주명은 필수입니다.' });
    }
    const account = await storeService.upsertAccount(req.params.id, req.body);
    res.success(account, '계좌 정보가 저장되었습니다.');
  },
};

module.exports = storeController;
