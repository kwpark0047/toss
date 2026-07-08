const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const prisma = require('../config/prisma');
const cache = require('../utils/cache');
const { haversineKm } = require('../utils/geo');

// 전체 매장 목록 조회. ?limit 지정 시 최소 필드·소량만 반환(대용량 덤프 방지).
// (활성 매장 15만+ 전체 반환은 100MB+ 페이로드라 반드시 limit 사용 권장)
router.get('/', catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 0;
    if (limit > 0) {
        const stores = await prisma.stores.findMany({
            where: { is_active: true, NOT: [{ name: { contains: '?' } }, { name: { contains: '�' } }] },
            select: { id: true, name: true, address: true, business_type: true, latitude: true, longitude: true },
            take: Math.min(limit, 200),
            orderBy: { id: 'desc' },
        });
        return res.success(stores);
    }
    const stores = await Store.findAll();
    res.success(stores);
}));

// 내 매장 목록 조회 (인증 필요)
router.get('/my', authMiddleware, catchAsync(async (req, res) => {
    const stores = await Store.findByUserId(req.user.id);
    res.success(stores);
}));

// 손상된 이름(인코딩 깨짐: 물음표 '?' 또는 치환문자 U+FFFD 포함) 매장 제외 조건.
// 데이터 임포트 시 한글이 '?'+라틴으로 깨진 레코드를 공개 노출에서 숨긴다.
const EXCLUDE_CORRUPT_NAME = { NOT: [{ name: { contains: '?' } }, { name: { contains: '�' } }] };

// ── 공개 매장 검색 (지역·업종·키워드·고객위치 거리순) ──────────────────────────
// 랜딩 "매장 위치" 섹션용. 인증 불필요, 공개 필드만 반환. (거리계산: utils/geo)
// 비활성 매장(is_active=false)·이름 손상 매장은 리스트/그리드/지도에서 제외
router.get('/search', catchAsync(async (req, res) => {
    const { district, business_type, q, lat, lng, limit = 30 } = req.query;
    const where = { is_active: true, ...EXCLUDE_CORRUPT_NAME };
    if (district) where.address = { contains: String(district) };
    if (business_type && business_type !== 'all') where.business_type = String(business_type);
    if (q) {
        const kw = String(q);
        where.OR = [{ name: { contains: kw } }, { address: { contains: kw } }];
    }
    let stores = await prisma.stores.findMany({
        where,
        select: { id: true, name: true, business_type: true, address: true, latitude: true, longitude: true },
        take: Math.min(parseInt(limit) || 30, 100),
        orderBy: { name: 'asc' },
    });

    // 고객 위치가 있으면 거리(km) 계산 + 가까운 순 정렬
    const la = parseFloat(lat), lo = parseFloat(lng);
    if (!isNaN(la) && !isNaN(lo)) {
        stores = stores
            .map(s => ({
                ...s,
                distance_km: (s.latitude != null && s.longitude != null)
                    ? Math.round(haversineKm(la, lo, s.latitude, s.longitude) * 10) / 10 : null,
            }))
            .sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
    }

    // 업종 필터 옵션(facets): 활성 매장의 distinct business_type
    const typeRows = await prisma.stores.findMany({
        where: { is_active: true, business_type: { not: null } },
        select: { business_type: true },
        distinct: ['business_type'],
    });
    const businessTypes = typeRows.map(r => r.business_type).filter(Boolean).sort();

    res.success({ stores, facets: { businessTypes } });
}));

// ── 지역 하이라이트 배너 (추천메뉴 + 이벤트/프로모션) ────────────────────────
// 랜딩 "매장 위치" 상단 롤링 배너용. 공개. 이벤트=커뮤니티 포스트, 추천메뉴=인기 상품.
router.get('/highlights', catchAsync(async (req, res) => {
    const { district } = req.query;
    const now = new Date();
    // 손상 이름 매장 제외 + (선택)지역 필터를 관계형 조건으로 구성
    const storeRel = {
        NOT: [{ name: { contains: '?' } }, { name: { contains: '�' } }],
        ...(district ? { address: { contains: String(district) } } : {}),
    };

    // 1) 이벤트/프로모션/신메뉴/소식 (미만료)
    const posts = await prisma.community_posts.findMany({
        where: {
            type: { in: ['EVENT', 'PROMOTION', 'PRODUCT', 'NEWS'] },
            OR: [{ expires_at: null }, { expires_at: { gte: now } }],
            stores: storeRel,
        },
        select: {
            id: true, type: true, title: true, content: true, image_url: true,
            stores: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 6,
    });

    // 2) 추천(인기) 메뉴
    const products = await prisma.products.findMany({
        where: { is_active: true, is_sold_out: false, stores: storeRel },
        select: {
            id: true, name: true, price: true, image_url: true, is_popular: true, store_id: true,
            stores: { select: { id: true, name: true } },
        },
        orderBy: [{ is_popular: 'desc' }, { id: 'desc' }],
        take: 6,
    });

    const banners = [
        ...posts.map(p => ({
            kind: 'event',
            type: p.type,
            title: p.title,
            subtitle: p.content?.slice(0, 60) || '',
            store_id: p.stores?.id,
            store_name: p.stores?.name || '',
            image_url: p.image_url || null,
        })),
        ...products.map(p => ({
            kind: 'menu',
            type: p.is_popular ? 'POPULAR' : 'MENU',
            title: p.name,
            subtitle: `${Number(p.price).toLocaleString('ko-KR')}원`,
            store_id: p.stores?.id ?? p.store_id,
            store_name: p.stores?.name || '',
            image_url: p.image_url || null,
        })),
    ];

    res.success({ banners });
}));

// 매장 상세 조회 — 고객 메뉴판 진입 시 매번 호출되는 핫 경로라 60초 캐시 적용
router.get('/:id', catchAsync(async (req, res) => {
    const cacheKey = `store:${req.params.id}:profile`;
    const cached = cache.get(cacheKey);
    if (cached) return res.success(cached);

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    cache.set(cacheKey, store, 60);
    res.success(store);
}));

// 상호/주소 정규화 헬퍼 (공공매장 매칭용)
const PUBLIC_OWNER_ID = 1; // 공공데이터 매장 소유자(전체관리자)
const normNm = (s = '') => String(s).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[\s·.,'"()\-]/g, '');
// 동은 괄호 안(도로명주소의 법정동)에 있을 수 있어 원문 전체에서 탐색
const dongOf = (a = '') => { const m = String(a).match(/([가-힣]{1,10}(?:\d가|동|리))(?![가-힣])/); return m ? m[1] : ''; };
// 구/군만(시는 제외 — '서울특별시'가 아니라 '중랑구'를 잡도록)
const guOf = (a = '') => { const m = String(a).match(/([가-힣]{1,10}(?:군|구))(?![가-힣])/); return m ? m[1] : ''; };

// 매장 생성 — 공공데이터 매장과 상호·주소 일치 시 연동 승인 요청 생성
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const { name, address } = req.body;

    // 공공(super_admin 소유) 매장 매칭 검사: 상호명 정규화 일치 + 지역(동/구) 겹침
    if (name && name.trim()) {
        // 프랜차이즈 접두어(이디야 등) 대신 가장 긴(고유한) 토큰으로 조회
        const tokens = name.trim().split(/\s+/).filter(Boolean);
        const nameKey = tokens.sort((a, b) => b.length - a.length)[0].slice(0, 20);
        const target = normNm(name);
        const inDong = dongOf(address), inGu = guOf(address);
        const candidates = await prisma.stores.findMany({
            where: { user_id: PUBLIC_OWNER_ID, name: { contains: nameKey } },
            select: { id: true, name: true, address: true },
            take: 80,
        });
        const match = candidates.find(c => {
            if (normNm(c.name) !== target) return false;
            if (!address) return true;
            const cd = dongOf(c.address), cg = guOf(c.address);
            return (inDong && cd && inDong === cd) || (inGu && cg && inGu === cg);
        });
        if (match) {
            // 중복 요청 방지
            const existing = await prisma.store_link_requests.findFirst({
                where: { user_id: req.user.id, store_id: match.id, status: 'pending' },
            });
            if (!existing) {
                await prisma.store_link_requests.create({
                    data: { user_id: req.user.id, store_id: match.id, requested_name: name, requested_address: address || null },
                });
            }
            return res.success(
                { linkRequested: true, matchedStore: { id: match.id, name: match.name, address: match.address } },
                '기존 등록된 매장과 일치하여 관리자에게 연동 승인을 요청했습니다.', 202
            );
        }
    }

    // 매칭 없음 → 신규 매장 생성
    const store = await Store.create({ ...req.body, user_id: req.user.id });
    res.success(store, '매장이 생성되었습니다', 201);
}));

// checkStorePermission은 req.params.storeId를 참조하므로 /:id → storeId 브리지
const bridgeStoreId = (req, _res, next) => { req.storeId = req.params.id; next(); };

// 매장 정보 수정
router.put('/:id', authMiddleware, bridgeStoreId, checkStorePermission('store:update'), catchAsync(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    const updated = await Store.update(req.params.id, req.body);
    cache.flushByStore(req.params.id);
    res.success(updated, '매장 정보가 수정되었습니다');
}));

// ── 사업자 정보 조회 ──────────────────────────────────────────────────────────
router.get('/:id/business', authMiddleware, bridgeStoreId, checkStorePermission('settings:read'), catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    const store = await Store.findBusinessInfo(sid);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });

    let enabledMethods = ['cash', 'store_card', 'transfer'];
    try { enabledMethods = JSON.parse(store.enabled_payment_methods || '[]'); } catch {}

    res.success({ ...store, enabled_payment_methods: enabledMethods });
}));

// ── 사업자 정보 저장 ──────────────────────────────────────────────────────────
router.put('/:id/business', authMiddleware, bridgeStoreId, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    // 검증에 사용하는 필드만 추출 (나머지는 Store.updateBusinessInfo가 req.body로 저장)
    const { business_number, settlement_cycle } = req.body;

    // 사업자번호 형식 검증 (000-00-00000)
    if (business_number && !/^\d{3}-\d{2}-\d{5}$/.test(business_number)) {
        return res.status(400).json({ success: false, error: '사업자번호 형식이 올바르지 않습니다. (예: 123-45-67890)' });
    }

    const validCycles = ['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL'];
    if (settlement_cycle && !validCycles.includes(settlement_cycle)) {
        return res.status(400).json({ success: false, error: '정산 주기가 올바르지 않습니다.' });
    }

    const updated = await Store.updateBusinessInfo(sid, req.body);
    res.success(updated, '사업자 정보가 저장되었습니다.');
}));

// ── 계좌이체 계좌 조회 (관리자용 — 전체 정보) ────────────────────────────────
router.get('/:id/account', authMiddleware, bridgeStoreId, checkStorePermission('settings:read'), catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    const account = await prisma.store_accounts.findUnique({ where: { store_id: sid } });
    res.success(account || null);
}));

// ── 계좌이체 계좌 조회 (고객용 — 송금 표시 정보만, 민감정보 최소화) ────────────
router.get('/:id/account/public', catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    const account = await prisma.store_accounts.findUnique({
        where: { store_id: sid },
        select: { bank_name: true, account_number: true, account_holder: true }
    });
    res.success(account || null);
}));

// ── 계좌이체 계좌 등록·수정 ───────────────────────────────────────────────────
router.put('/:id/account', authMiddleware, bridgeStoreId, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    const { bank_code, bank_name, account_number, account_holder } = req.body;

    if (!bank_name || !account_number || !account_holder) {
        return res.status(400).json({ success: false, error: '은행명, 계좌번호, 예금주명은 필수입니다.' });
    }

    const account = await prisma.store_accounts.upsert({
        where: { store_id: sid },
        create: { store_id: sid, bank_code: bank_code || '', bank_name, account_number, account_holder, is_active: true },
        update: { bank_code: bank_code || bank_name, bank_name, account_number, account_holder, is_active: true, updated_at: new Date() }
    });
    res.success(account, '계좌 정보가 저장되었습니다.');
}));

// 매장 삭제 (소프트 딜리트)
router.delete('/:id', authMiddleware, bridgeStoreId, checkStorePermission('store:delete'), catchAsync(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    await Store.delete(req.params.id);
    res.success(null, '매장이 삭제되었습니다');
}));

// ── 인기 매장 랭킹 (주문량 기준 상위 8개) ────────────────────────────
router.get('/popular', catchAsync(async (req, res) => {
    const stores = await prisma.stores.findMany({
        where: { is_active: true, ...EXCLUDE_CORRUPT_NAME },
        select: {
            id: true, name: true, address: true, business_type: true,
            latitude: true, longitude: true,
            _count: { select: { orders: { where: { status: 'completed' } } } },
        },
        orderBy: { orders: { _count: 'desc' } },
        take: 8,
    });
    const ranked = stores.map((s, i) => ({
        rank: i + 1,
        id: s.id,
        name: s.name,
        address: s.address,
        business_type: s.business_type,
        latitude: s.latitude,
        longitude: s.longitude,
        order_count: s._count.orders,
    }));
    res.success(ranked);
}));

// ── 찜한 매장 ───────────────────────────────────────────────────────────────────

router.post('/favorites', catchAsync(async (req, res) => {
    const { customer_phone, store_id } = req.body;
    if (!customer_phone || !store_id) {
        return res.status(400).json({ success: false, error: '전화번호와 매장ID가 필요합니다.' });
    }
    const existing = await prisma.store_favorites.findUnique({
        where: { customer_phone_store_id: { customer_phone, store_id: parseInt(store_id) } }
    });
    if (existing) return res.success(existing, '이미 찜한 매장입니다.');
    const fav = await prisma.store_favorites.create({
        data: { customer_phone, store_id: parseInt(store_id) }
    });
    res.success(fav, '찜한 매장에 추가했습니다.');
}));

router.delete('/favorites', catchAsync(async (req, res) => {
    const { customer_phone, store_id } = req.body;
    if (!customer_phone || !store_id) {
        return res.status(400).json({ success: false, error: '전화번호와 매장ID가 필요합니다.' });
    }
    await prisma.store_favorites.deleteMany({
        where: { customer_phone, store_id: parseInt(store_id) }
    });
    res.success(null, '찜을 해제했습니다.');
}));

router.get('/favorites/:phone', catchAsync(async (req, res) => {
    const list = await prisma.store_favorites.findMany({
        where: { customer_phone: req.params.phone },
        include: {
            stores: {
                select: { id: true, name: true, address: true, business_type: true, latitude: true, longitude: true, is_active: true }
            }
        },
        orderBy: { created_at: 'desc' }
    });
    res.success(list.map(f => ({ ...f.stores, favorited_at: f.created_at })));
}));

module.exports = router;
