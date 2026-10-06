const prisma = require('../config/prisma');
const cache = require('../utils/cache');

const STORE_DETAILS = {
  store_business_info: true,
  store_settlement_config: true,
  store_legal_documents: true,
  store_operating_hours: true,
};
const DOMAIN_FIELDS = {
  store_business_info: [
    'business_type',
    'business_number',
    'business_name',
    'ceo_name',
    'tax_invoice_email',
    'business_address',
    'customer_service_phone',
    'customer_service_email',
    'mail_order_number',
    'pg_company',
    'pg_business_number',
  ],
  store_settlement_config: [
    'settlement_cycle',
    'commission_rate',
    'vat_rate',
    'enabled_payment_methods',
  ],
  store_legal_documents: ['terms_of_service', 'privacy_policy', 'refund_policy'],
  store_operating_hours: ['open_time', 'close_time', 'business_hours'],
};
function domainUpdates(data) {
  const result = {};
  for (const [relation, fields] of Object.entries(DOMAIN_FIELDS)) {
    const values = {};
    for (const field of fields)
      if (data[field] !== undefined)
        values[field] =
          field === 'enabled_payment_methods'
            ? JSON.stringify(Array.isArray(data[field]) ? data[field] : [])
            : data[field];
    if (Object.keys(values).length)
      result[relation] = { upsert: { create: values, update: values } };
  }
  return result;
}
function flattenStore(store) {
  if (!store) return null;
  const result = { ...store };
  for (const [relation, fields] of Object.entries(DOMAIN_FIELDS)) {
    for (const field of fields)
      if (store[relation]?.[field] !== undefined) result[field] = store[relation][field];
    delete result[relation];
  }
  return result;
}

/**
 * 매장 모델 (Prisma 기반 + Caching)
 * 매장 정보 관리 및 조회 성능 최적화를 담당합니다.
 */
const Store = {
  // plan 옵션: 'free' (기본), 'pro', 'enterprise'
  create: async (data) => {
    const {
      user_id,
      name,
      description,
      address,
      phone,
      business_type,
      open_time,
      close_time,
      theme,
      plan,
      latitude,
      longitude,
    } = data;

    // 테마가 객체로 들어오면 문자열로 변환
    const themeString = theme && typeof theme === 'object' ? JSON.stringify(theme) : theme;

    const store = await prisma.stores
      .create({
        data: {
          user_id,
          name,
          description,
          address,
          phone,
          ...Object.fromEntries(
            Object.entries(domainUpdates({ business_type, open_time, close_time })).map(
              ([key, value]) => [key, { create: value.upsert.create }]
            )
          ),
          theme: themeString,
          plan: plan || 'free',
          latitude,
          longitude,
          is_active: true,
          can_send_sms: data.can_send_sms || false,
        },
        include: STORE_DETAILS,
      })
      .then(flattenStore);

    // 관련 캐시 초기화
    cache.del('stores:all');

    return store;
  },

  findById: async (id) => {
    try {
      if (!id) return null;
      const cacheKey = `store:${id}`;

      // 1. 캐시 시도
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      // 2. DB 조회
      const store = await prisma.stores
        .findUnique({
          where: { id: parseInt(id) },
          include: STORE_DETAILS,
        })
        .then(flattenStore);

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
        where: { user_id: uid, is_active: { not: false } },
        include: STORE_DETAILS,
      });
      ownedStores.forEach((store) => {
        result.set(store.id, { ...flattenStore(store), role: 'owner' });
      });
    } catch (error) {
      console.error(`[Prisma Error] Store.findByUserId ownedStores failed for User: ${uid}`, error);
    }

    // 2. 직원으로 등록된 매장 조회 (별도 try-catch: 스키마 불일치 시에도 소유 매장 반환)
    try {
      const staffed = await prisma.staff.findMany({
        where: { user_id: uid },
        include: { stores: { include: STORE_DETAILS } },
      });
      staffed.forEach((item) => {
        if (item.stores && item.stores.is_active && !result.has(item.stores.id)) {
          result.set(item.stores.id, { ...flattenStore(item.stores), role: item.role });
        }
      });
    } catch (error) {
      console.error(
        `[Prisma Error] Store.findByUserId staffed query failed for User: ${uid}`,
        error
      );
    }

    return Array.from(result.values());
  },

  findAll: async () => {
    const cacheKey = 'stores:all';
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const stores = await prisma.stores
      .findMany({
        where: { is_active: true },
        include: STORE_DETAILS,
      })
      .then((rows) => rows.map(flattenStore));

    cache.set(cacheKey, stores);
    return stores;
  },

  update: async (id, data) => {
    const { name, description, address, phone, theme, plan, latitude, longitude, can_send_sms } =
      data;

    // 테마 처리
    let themeValue = undefined;
    if (theme !== undefined) {
      themeValue = typeof theme === 'object' ? JSON.stringify(theme) : theme;
    }

    const updateData = domainUpdates(data);
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;

    if (themeValue !== undefined) updateData.theme = themeValue;
    if (plan) updateData.plan = plan;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (can_send_sms !== undefined) updateData.can_send_sms = can_send_sms;

    const updatedStore = await prisma.stores
      .update({
        where: { id: parseInt(id) },
        data: updateData,
        include: STORE_DETAILS,
      })
      .then(flattenStore);

    // 관련 캐시 무효화
    cache.del(`store:${id}`);
    cache.del('stores:all');

    return updatedStore;
  },

  delete: async (id) => {
    // Soft delete
    await prisma.stores.update({
      where: { id: parseInt(id) },
      data: { is_active: false },
    });

    // 관련 캐시 무효화
    cache.del(`store:${id}`);
    cache.del('stores:all');

    return true;
  },

  findBusinessInfo: async (id) => {
    const store = await prisma.stores.findUnique({
      where: { id: parseInt(id) },
      include: {
        ...STORE_DETAILS,
        store_accounts: {
          select: {
            bank_code: true,
            bank_name: true,
            account_number: true,
            account_holder: true,
            is_active: true,
          },
        },
      },
    });
    return flattenStore(store);
  },

  updateBusinessInfo: async (id, data) => {
    const payload = domainUpdates(data);
    if (data.theme_settings != null) payload.theme = JSON.stringify(data.theme_settings);
    const store = await prisma.stores.update({
      where: { id: parseInt(id) },
      data: payload,
      include: STORE_DETAILS,
    });
    cache.del('store:' + id);
    cache.del('stores:all');
    return flattenStore(store);
  },

  updateLegalInfo: async (id, data) => {
    const store = await prisma.stores.update({
      where: { id: parseInt(id) },
      data: domainUpdates(data),
      include: STORE_DETAILS,
    });
    cache.del('store:' + id);
    cache.del('stores:all');
    const flat = flattenStore(store);
    return {
      id: flat.id,
      business_name: flat.business_name,
      business_number: flat.business_number,
      mail_order_number: flat.mail_order_number,
    };
  },
};

module.exports = Store;
