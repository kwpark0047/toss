const StoreService = require('../services/StoreService');
const Store = require('../repositories/Store');
const logger = require('../utils/logger');

const storeService = new StoreService();

const storeController = {
    // GET / — 전체 매장 목록 조회
    async getStores(req, res) {
        const limit = parseInt(req.query.limit) || 0;
        if (limit > 0) {
            const prisma = require('../config/prisma');
            const { NOT } = require('@prisma/client');
            const stores = await prisma.stores.findMany({
                where: { is_active: true, NOT: [{ name: { contains: '?' } }, { name: { contains: '' } }] },
                select: { id: true, name: true, address: true, business_type: true, latitude: true, longitude: true },
                take: Math.min(limit, 200),
                orderBy: { id: 'desc' },
            });
            return res.success(stores);
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
            district, business_type, q, lat, lng, limit, page,
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

        if (result.linkRequested) {
            // 매칭된 매장에 대한 링크 요청 생성
            const linkReq = await storeService.createLinkRequest(
                req.user.id, result.matchedStore.id,
                req.body.name, req.body.address
            );
            if (io) {
                io.to('admin').emit('store-link-request-created', {
                    id: linkReq.id, userId: req.user.id, userName: req.user.name,
                    storeId: result.matchedStore.id, storeName: result.matchedStore.name,
                    storeAddress: result.matchedStore.address, requestedName: req.body.name,
                    matchMethod: result.matchMethod, matchScore: result.matchScore,
                    createdAt: linkReq.created_at,
                });
            }
            return res.success(
                { linkRequested: true, matchedStore: result.matchedStore, matchMethod: result.matchMethod, matchScore: result.matchScore },
                result.matchMethod === 'business_number'
                    ? '사업자등록번호가 일치하는 매장이 확인되어 자동 승인을 요청했습니다.'
                    : result.matchMethod === 'phone'
                        ? '전화번호가 일치하는 매장이 확인되어 자동 승인을 요청했습니다.'
                        : '기존 등록된 매장과 일치하여 관리자에게 자동 승인을 요청했습니다.',
                202
            );
        }

        res.success(result.store, '매장이 생성되었습니다.', 201);
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

    // PUT /:id — 매장 수정
    async updateStore(req, res) {
        const store = await Store.findById(req.params.id);
        if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });

        const updated = await Store.update(req.params.id, req.body);
        storeService.flushStoreCache(req.params.id);
        res.success(updated, '매장 정보가 수정되었습니다.');
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
            return res.status(400).json({ success: false, error: '은행명, 계좌번호, 예금주명은 필수입니다.' });
        }
        const account = await storeService.upsertAccount(req.params.id, req.body);
        res.success(account, '계좌 정보가 저장되었습니다.');
    },
};

module.exports = storeController;
