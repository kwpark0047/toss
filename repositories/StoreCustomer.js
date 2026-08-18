const prisma = require('../config/prisma');
const { encryptPhone, phoneSearchCandidates } = require('../utils/phoneEncryption');
const { AppError } = require('../utils/errorHandler');

const CUSTOMER_SORT_FIELDS = new Set([
  'last_visit_at',
  'total_spent',
  'visit_count',
  'created_at',
  'customer_name',
  'tier',
]);

const parsePositiveInt = (value, fieldName, defaultValue = null) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName}는 양의 정수여야 합니다.`, 400);
  }
  return parsed;
};

const StoreCustomer = {
  /**
   * [고객 정보 업데이트 또는 생성 (Upsert)]
   * 결제 완료 시 호출되어 방문 횟수와 결제 금액을 누적합니다.
   * @param {Object} data - { store_id, customer_phone, customer_name, toss_user_key, amount }
   * @param {import('@prisma/client').PrismaTransactionClient} [tx] - 트랜잭션 클라이언트 (선택)
   */
  upsertCustomer: async (data, tx) => {
    const { store_id, customer_phone: rawPhone, customer_name, toss_user_key, amount } = data;
    const customer_phone = encryptPhone(rawPhone);
    const db = tx || prisma;

    if (!customer_phone) return null;

    try {
      // 1. 기존 고객 정보 및 누적 금액 확인 (등급 계산용)
      const existing = await db.store_customers.findUnique({
        where: {
          uk_store_customer: {
            store_id: parseInt(store_id),
            customer_phone: customer_phone,
          },
        },
      });

      // [추가] 신규 고객인 경우 WELCOME 캠페인 트리거 실행
      if (!existing) {
        const CampaignService = require('../services/CampaignService');
        CampaignService.handleWelcome(store_id, customer_phone).catch((err) => {
          console.error('[Campaign Welcome Trigger Error]:', err);
        });
      }

      const currentTotalSpent = (existing?.total_spent || 0) + amount;

      // 2. 새로운 등급 계산
      const StoreTier = require('./StoreTier');
      const tierInfo = await StoreTier.calculateTier(store_id, currentTotalSpent);

      // [추가] 등급이 변경된 경우(승급) 캠페인 트리거 실행
      if (existing && existing.tier !== tierInfo.tier_name) {
        const CampaignService = require('../services/CampaignService');
        // 비동기로 실행하여 결제 흐름에 영향을 주지 않도록 함 (await 생략 가능하나 안정성을 위해 유지할 수도 있음)
        CampaignService.handleTierUp(store_id, customer_phone, tierInfo.tier_name).catch((err) => {
          console.error('[Campaign Trigger Error]:', err);
        });
      }

      // 3. Upsert 실행
      return await db.store_customers.upsert({
        where: {
          uk_store_customer: {
            store_id: parseInt(store_id),
            customer_phone: customer_phone,
          },
        },
        update: {
          customer_name: customer_name || undefined,
          toss_user_key: toss_user_key || undefined,
          visit_count: { increment: 1 },
          total_spent: { increment: amount },
          tier: tierInfo.tier_name,
          last_visit_at: new Date(),
        },
        create: {
          store_id: parseInt(store_id),
          customer_phone: customer_phone,
          customer_name: customer_name || null,
          toss_user_key: toss_user_key || null,
          visit_count: 1,
          total_spent: amount,
          tier: tierInfo.tier_name,
          last_visit_at: new Date(),
        },
      });
    } catch (error) {
      console.error('[StoreCustomer.upsertCustomer Error]:', error);
      return null;
    }
  },

  /**
   * [매장별 단골고객 리스트 조회]
   * 방문 횟수나 총 결제 금액순으로 정렬하여 조회할 수 있습니다.
   */
  findByStoreId: async (storeId, options = {}) => {
    const {
      sortBy = 'last_visit_at',
      order = 'desc',
      limit = 50,
      search = '',
      tier = '',
      page = 1,
    } = options;
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const pageNumber = parsePositiveInt(page, '페이지', 1);
    const limitNumber = Math.min(parsePositiveInt(limit, '페이지 크기', 50), 100);
    const safeSortBy = CUSTOMER_SORT_FIELDS.has(sortBy) ? sortBy : null;
    if (!safeSortBy) throw new AppError('유효하지 않은 정렬 기준입니다.', 400);
    if (order !== 'asc' && order !== 'desc') {
      throw new AppError('유효하지 않은 정렬 방향입니다.', 400);
    }

    const where = {
      store_id: storeNumber,
    };

    // 티어 필터
    if (tier && tier !== 'ALL') {
      where.tier = tier;
    }

    if (search) {
      const candidates = phoneSearchCandidates(search);
      const phoneOr =
        candidates.length > 1
          ? { customer_phone: { in: candidates } }
          : { customer_phone: { contains: candidates[0] || search } };
      where.OR = [phoneOr, { customer_name: { contains: search } }];
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [total, items] = await Promise.all([
      prisma.store_customers.count({ where }),
      prisma.store_customers.findMany({
        where,
        orderBy: {
          [safeSortBy]: order,
        },
        skip,
        take: limitNumber,
      }),
    ]);

    return {
      items,
      total,
      page: pageNumber,
      limit: limitNumber,
      total_pages: Math.ceil(total / limitNumber),
    };
  },

  /**
   * [단일 고객 상세 정보 조회]
   */
  findById: async (id) => {
    const customerId = parsePositiveInt(id, '고객 ID');
    return await prisma.store_customers.findUnique({
      where: { id: customerId },
    });
  },
};

module.exports = StoreCustomer;
