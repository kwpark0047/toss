const prisma = require('../config/prisma');
const cache = require('../utils/cache');

/**
 * 매장 모델 (Prisma 기반 + Caching)
 * 매장 정보 관리 및 조회 성능 최적화를 담당합니다.
 */
const Store = {
    // plan 옵션: 'free' (기본), 'pro', 'enterprise'
    create: async (data) => {
        const {
            user_id, name, description, address, phone,
            business_type, open_time, close_time, theme, plan,
            latitude, longitude
        } = data;

        // 테마가 객체로 들어오면 문자열로 변환
        const themeString = theme && typeof theme === 'object' ? JSON.stringify(theme) : theme;

        const store = await prisma.stores.create({
            data: {
                user_id,
                name,
                description,
                address,
                phone,
                business_type,
                open_time,
                close_time,
                theme: themeString,
                plan: plan || 'free',
                latitude,
                longitude,
                is_active: true,
                can_send_sms: data.can_send_sms || false
            }
        });

        // 관련 캐시 초기화
        cache.del('stores:all');

        return store;
    },

    findById: async (id) => {
        try {
            if (!id) return null;
            const cacheKey = `store:${id}`;

            // 1. 캐시 시도
            const cached = cache.get(cacheKey);
            if (cached) return cached;

            // 2. DB 조회
            const store = await prisma.stores.findUnique({
                where: { id: parseInt(id) }
            });

            // 3. 캐시에 저장 (300초/5분)
            if (store) cache.set(cacheKey, store);

            return store;
        } catch (error) {
            console.error(`[Prisma Error] Store.findById failed for ID: ${id}`, error);
            return null;
        }
    },

    findByUserId: async (userId) => {
        const uid = parseInt(userId);
        if (isNaN(uid)) return [];

        // 1. 소유한 매장 조회
        const ownedStores = await prisma.stores.findMany({
            where: { user_id: uid, is_active: { not: false } }
        });

        // 2. 직원으로 등록된 매장 조회
        const staffed = await prisma.staff.findMany({
            where: { user_id: uid },
            include: { stores: true }
        });

        const result = new Map();
        ownedStores.forEach(store => {
            result.set(store.id, { ...store, role: 'owner' });
        });
        staffed.forEach(item => {
            if (item.stores && item.stores.is_active && !result.has(item.stores.id)) {
                result.set(item.stores.id, { ...item.stores, role: item.role });
            }
        });
        return Array.from(result.values());
    },

    findAll: async () => {
        const cacheKey = 'stores:all';
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const stores = await prisma.stores.findMany({
            where: { is_active: true }
        });

        cache.set(cacheKey, stores);
        return stores;
    },

    update: async (id, data) => {
        const {
            name, description, address, phone,
            business_type, open_time, close_time, theme, plan,
            latitude, longitude, can_send_sms
        } = data;

        // 테마 처리
        let themeValue = undefined;
        if (theme !== undefined) {
            themeValue = typeof theme === 'object' ? JSON.stringify(theme) : theme;
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (address !== undefined) updateData.address = address;
        if (phone !== undefined) updateData.phone = phone;
        if (business_type) updateData.business_type = business_type;
        if (open_time) updateData.open_time = open_time;
        if (close_time) updateData.close_time = close_time;
        if (themeValue !== undefined) updateData.theme = themeValue;
        if (plan) updateData.plan = plan;
        if (latitude !== undefined) updateData.latitude = latitude;
        if (longitude !== undefined) updateData.longitude = longitude;
        if (can_send_sms !== undefined) updateData.can_send_sms = can_send_sms;

        updateData.updated_at = new Date();

        const updatedStore = await prisma.stores.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        // 관련 캐시 무효화
        cache.del(`store:${id}`);
        cache.del('stores:all');

        return updatedStore;
    },

    delete: async (id) => {
        // Soft delete
        await prisma.stores.update({
            where: { id: parseInt(id) },
            data: { is_active: false }
        });

        // 관련 캐시 무효화
        cache.del(`store:${id}`);
        cache.del('stores:all');

        return true;
    }
};

module.exports = Store;
