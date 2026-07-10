const prisma = require('../config/prisma');
const Store = require('../repositories/Store');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

// 공공매장 매칭 상수
const PUBLIC_OWNER_ID = 1;
const EXCLUDE_CORRUPT_NAME = { NOT: [{ name: { contains: '?' } }, { name: { contains: '' } }] };

// 이름 정규화
const normNm = (s = '') => String(s).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[\s·.,'"()\u002D]/g, '');
const dongOf = (a = '') => { const m = String(a).match(/([가-힣]{1,10}(?:\d가|동|읍|면))(?![가-힣])/); return m ? m[1] : ''; };
const guOf = (a = '') => { const m = String(a).match(/([가-힣]{1,10}(?:시|구))(?![가-힣])/); return m ? m[1] : ''; };
const digitsOnly = (s = '') => String(s).replace(/\D/g, '');

// 자카드 유사도 (bigram 기반)
const jaccardSim = (a, b) => {
    if (!a || !b) return 0;
    const s1 = new Set(), s2 = new Set();
    for (let i = 0; i < a.length - 1; i++) s1.add(a.substring(i, i + 2));
    for (let i = 0; i < b.length - 1; i++) s2.add(b.substring(i, i + 2));
    if (!s1.size || !s2.size) return a === b ? 1 : 0;
    let inter = 0;
    for (const x of s1) if (s2.has(x)) inter++;
    return inter / (s1.size + s2.size - inter);
};

class StoreService {
    // 매장 검색 (지역·업종·키워드·고객위치 거리순)
    async searchStores({ district, business_type, q, lat, lng, limit = 30 }) {
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

        // 거리 계산
        const { haversineKm } = require('../utils/geo');
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

        // 업종 필터 facets
        const typeRows = await prisma.stores.findMany({
            where: { is_active: true, business_type: { not: null } },
            select: { business_type: true },
            distinct: ['business_type'],
        });
        const businessTypes = typeRows.map(r => r.business_type).filter(Boolean).sort();

        return { stores, facets: { businessTypes } };
    }

    // 지역 하이라이트 배너
    async getHighlights(district) {
        const now = new Date();
        const storeRel = {
            NOT: [{ name: { contains: '?' } }, { name: { contains: '' } }],
            ...(district ? { address: { contains: String(district) } } : {}),
        };

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
                kind: 'event', type: p.type, title: p.title,
                subtitle: p.content?.slice(0, 60) || '',
                store_id: p.stores?.id, store_name: p.stores?.name || '',
                image_url: p.image_url || null,
            })),
            ...products.map(p => ({
                kind: 'menu', type: p.is_popular ? 'POPULAR' : 'MENU',
                title: p.name, subtitle: `${Number(p.price).toLocaleString('ko-KR')}원`,
                store_id: p.stores?.id ?? p.store_id, store_name: p.stores?.name || '',
                image_url: p.image_url || null,
            })),
        ];

        return { banners };
    }

    // 인기 매장 랭킹
    async getPopular() {
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

        return stores.map((s, i) => ({
            rank: i + 1, id: s.id, name: s.name, address: s.address,
            business_type: s.business_type, latitude: s.latitude, longitude: s.longitude,
            order_count: s._count.orders,
        }));
    }

    // 매장 생성 (공공데이터 매칭 포함)
    async createStoreWithMatching(data) {
        const { name, address, phone, business_number, userId } = data;

        if (name && name.trim()) {
            // 1) 사업자등록번호 매칭
            if (business_number) {
                const bnMatch = await prisma.stores.findFirst({
                    where: { user_id: PUBLIC_OWNER_ID, business_number: business_number.trim() },
                    select: { id: true, name: true, address: true, phone: true, business_number: true },
                });
                if (bnMatch) {
                    return { linkRequested: true, matchedStore: bnMatch, matchMethod: 'business_number' };
                }
            }

            // 2) 전화번호 매칭
            if (phone) {
                const phoneDigits = digitsOnly(phone);
                if (phoneDigits.length >= 9) {
                    const allCandidates = await prisma.stores.findMany({
                        where: { user_id: PUBLIC_OWNER_ID, phone: { not: null } },
                        select: { id: true, name: true, address: true, phone: true },
                        take: 500,
                    });
                    const phoneMatch = allCandidates.find(c => digitsOnly(c.phone || '') === phoneDigits);
                    if (phoneMatch) {
                        return { linkRequested: true, matchedStore: phoneMatch, matchMethod: 'phone' };
                    }
                }
            }

            // 3) 상호명+주소 점수 기반 매칭
            const tokens = name.trim().split(/\s+/).filter(Boolean);
            const nameKey = tokens.sort((a, b) => b.length - a.length)[0].slice(0, 20);
            const target = normNm(name);
            const inDong = dongOf(address), inGu = guOf(address);

            const candidates = await prisma.stores.findMany({
                where: { user_id: PUBLIC_OWNER_ID, name: { contains: nameKey } },
                select: { id: true, name: true, address: true, phone: true },
                take: 80,
            });

            const scored = candidates.map(c => {
                let score = 0;
                if (normNm(c.name) === target) score += 50;
                const sim = jaccardSim(normNm(c.name), target);
                score += Math.round(sim * 20);
                const cd = dongOf(c.address), cg = guOf(c.address);
                if (address && inDong && cd && inDong === cd) score += 30;
                else if (address && inGu && cg && inGu === cg) score += 15;
                if (phone) {
                    const reqPhone = digitsOnly(phone);
                    if (reqPhone.length >= 9 && digitsOnly(c.phone || '') === reqPhone) score += 40;
                }
                return { ...c, score };
            }).filter(c => c.score >= 60).sort((a, b) => b.score - a.score);

            if (scored[0]) {
                return { linkRequested: true, matchedStore: scored[0], matchMethod: 'name_address', matchScore: scored[0].score };
            }
        }

        // 매칭 없음 → 신규 매장 생성
        const store = await Store.create({ ...data, user_id: userId });
        return { store };
    }

    // 매장 접근 검증 요청 생성
    async createLinkRequest(userId, storeId, name, address) {
        const existing = await prisma.store_link_requests.findFirst({
            where: { user_id: userId, store_id: storeId, status: 'pending' },
        });
        if (existing) return existing;

        return prisma.store_link_requests.create({
            data: { user_id: userId, store_id: storeId, requested_name: name, requested_address: address || null },
        });
    }

    // 계좌 관리
    async getAccount(storeId) {
        return prisma.store_accounts.findUnique({ where: { store_id: parseInt(storeId) } });
    }

    async getPublicAccount(storeId) {
        return prisma.store_accounts.findUnique({
            where: { store_id: parseInt(storeId) },
            select: { bank_name: true, account_number: true, account_holder: true },
        });
    }

    async upsertAccount(storeId, data) {
        const { bank_code, bank_name, account_number, account_holder } = data;
        return prisma.store_accounts.upsert({
            where: { store_id: parseInt(storeId) },
            create: { store_id: parseInt(storeId), bank_code: bank_code || '', bank_name, account_number, account_holder, is_active: true },
            update: { bank_code: bank_code || bank_name, bank_name, account_number, account_holder, is_active: true, updated_at: new Date() },
        });
    }

    // 찜 관리
    async addFavorite(customerPhone, storeId) {
        const existing = await prisma.store_favorites.findUnique({
            where: { customer_phone_store_id: { customer_phone: customerPhone, store_id: parseInt(storeId) } },
        });
        if (existing) return existing;

        return prisma.store_favorites.create({
            data: { customer_phone: customerPhone, store_id: parseInt(storeId) },
        });
    }

    async removeFavorite(customerPhone, storeId) {
        return prisma.store_favorites.deleteMany({
            where: { customer_phone: customerPhone, store_id: parseInt(storeId) },
        });
    }

    async getFavorites(customerPhone) {
        const list = await prisma.store_favorites.findMany({
            where: { customer_phone: customerPhone },
            include: {
                stores: { select: { id: true, name: true, address: true, business_type: true, latitude: true, longitude: true, is_active: true } },
            },
            orderBy: { created_at: 'desc' },
        });
        return list.map(f => ({ ...f.stores, favorited_at: f.created_at }));
    }

    // 사업자 정보 검증
    validateBusinessInfo({ business_number, settlement_cycle }) {
        if (business_number && !/^\d{3}-\d{2}-\d{5}$/.test(business_number)) {
            return '사업자번호 형식이 올바르지 않습니다. (예: 123-45-67890)';
        }
        const validCycles = ['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL'];
        if (settlement_cycle && !validCycles.includes(settlement_cycle)) {
            return '정산 주기가 올바르지 않습니다.';
        }
        return null;
    }

    // 사업자 정보 조회
    async getBusinessInfo(storeId) {
        const store = await Store.findBusinessInfo(parseInt(storeId));
        if (!store) return null;

        let enabledMethods = ['cash', 'store_card', 'transfer'];
        try { enabledMethods = JSON.parse(store.enabled_payment_methods || '[]'); } catch {}

        return { ...store, enabled_payment_methods: enabledMethods };
    }

    // 캐시 처리
    flushStoreCache(storeId) {
        cache.flushByStore(storeId);
    }
}

module.exports = StoreService;
