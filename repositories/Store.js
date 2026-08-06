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

        const result = new Map();

        // 1. 소유한 매장 조회 (is_active null 포함)
        try {
            const ownedStores = await prisma.stores.findMany({
                where: { user_id: uid, is_active: { not: false } }
            });
            ownedStores.forEach(store => {
                result.set(store.id, { ...store, role: 'owner' });
            });
        } catch (error) {
            console.error(`[Prisma Error] Store.findByUserId ownedStores failed for User: ${uid}`, error);
        }

        // 2. 직원으로 등록된 매장 조회 (별도 try-catch: 스키마 불일치 시에도 소유 매장 반환)
        try {
            const staffed = await prisma.staff.findMany({
                where: { user_id: uid },
                include: { stores: true }
            });
            staffed.forEach(item => {
                if (item.stores && item.stores.is_active && !result.has(item.stores.id)) {
                    result.set(item.stores.id, { ...item.stores, role: item.role });
                }
            });
        } catch (error) {
            console.error(`[Prisma Error] Store.findByUserId staffed query failed for User: ${uid}`, error);
        }

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
            latitude, longitude, can_send_sms, business_hours
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
        if (open_time !== undefined) updateData.open_time = open_time;
        if (close_time !== undefined) updateData.close_time = close_time;
        if (themeValue !== undefined) updateData.theme = themeValue;
        if (plan) updateData.plan = plan;
        if (latitude !== undefined) updateData.latitude = latitude;
        if (longitude !== undefined) updateData.longitude = longitude;
        if (can_send_sms !== undefined) updateData.can_send_sms = can_send_sms;
        if (business_hours !== undefined) updateData.business_hours = business_hours;

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
    },

    findBusinessInfo: async (id) => {
        return prisma.stores.findUnique({
            where: { id: parseInt(id) },
            select: {
                business_number: true,
                business_name: true,
                ceo_name: true,
                tax_invoice_email: true,
                settlement_cycle: true,
                commission_rate: true,
                vat_rate: true,
                enabled_payment_methods: true,
                store_accounts: {
                    select: {
                        bank_code: true, bank_name: true,
                        account_number: true, account_holder: true,
                        is_active: true
                    }
                }
            }
        });
    },

    updateBusinessInfo: async (id, data) => {
        const updateData = {};
        if (data.business_number !== undefined) updateData.business_number = data.business_number;
        if (data.business_name !== undefined) updateData.business_name = data.business_name;
        if (data.ceo_name !== undefined) updateData.ceo_name = data.ceo_name;
        if (data.tax_invoice_email !== undefined) updateData.tax_invoice_email = data.tax_invoice_email;
        if (data.settlement_cycle !== undefined) updateData.settlement_cycle = data.settlement_cycle;
        if (data.enabled_payment_methods !== undefined) {
            updateData.enabled_payment_methods = JSON.stringify(
                Array.isArray(data.enabled_payment_methods) ? data.enabled_payment_methods : []
            );
        }
        return prisma.stores.update({ where: { id: parseInt(id) }, data: updateData });
    },

    // [매장 법적 정보 업데이트]
    updateLegalInfo: async (id, data) => {
        const {
            business_name, business_number, ceo_name, tax_invoice_email,
            business_address, customer_service_phone, customer_service_email,
            mail_order_number, pg_company, pg_business_number,
            terms_of_service, privacy_policy, refund_policy
        } = data;

        const updateData = {};
        if (business_name !== undefined) updateData.business_name = business_name;
        if (business_number !== undefined) updateData.business_number = business_number;
        if (ceo_name !== undefined) updateData.ceo_name = ceo_name;
        if (tax_invoice_email !== undefined) updateData.tax_invoice_email = tax_invoice_email;
        if (business_address !== undefined) updateData.business_address = business_address;
        if (customer_service_phone !== undefined) updateData.customer_service_phone = customer_service_phone;
        if (customer_service_email !== undefined) updateData.customer_service_email = customer_service_email;
        if (mail_order_number !== undefined) updateData.mail_order_number = mail_order_number;
        if (pg_company !== undefined) updateData.pg_company = pg_company;
        if (pg_business_number !== undefined) updateData.pg_business_number = pg_business_number;
        if (terms_of_service !== undefined) updateData.terms_of_service = terms_of_service;
        if (privacy_policy !== undefined) updateData.privacy_policy = privacy_policy;
        if (refund_policy !== undefined) updateData.refund_policy = refund_policy;

        const updatedStore = await prisma.stores.update({
            where: { id: parseInt(id) },
            data: updateData,
            select: { id: true, business_name: true, business_number: true, mail_order_number: true }
        });

        // 캐시 무효화
        cache.del(`store:${id}`);
        cache.del('stores:all');

        return updatedStore;
    }
};

module.exports = Store;
