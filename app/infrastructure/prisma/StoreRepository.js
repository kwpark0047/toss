// [수정] 모듈마다 new PrismaClient() 를 만들면 커넥션 풀이 중복 생성되어
// 서버리스/컨테이너 환경에서 DB 연결 수가 폭증한다. 공유 싱글턴을 사용한다.
const prisma = require('../../../config/prisma');

class StoreRepository {
  async findById(id) {
    return await prisma.stores.findUnique({
      where: { id },
    });
  }

  async findByName(name) {
    return await prisma.stores.findFirst({
      where: { name },
    });
  }

  async findByUserId(userId) {
    return await prisma.stores.findMany({
      where: { user_id: userId },
    });
  }

  async create(storeData) {
    return await prisma.stores.create({
      data: storeData,
    });
  }

  async update(id, storeData) {
    return await prisma.stores.update({
      where: { id },
      data: storeData,
    });
  }

  async delete(id) {
    return await prisma.stores.delete({
      where: { id },
    });
  }

  async search(options) {
    const { district, business_type, q, lat, lng, limit = 30, page = 1 } = options;
    const where = { is_active: true };

    if (district) where.address = { contains: String(district) };
    if (business_type && business_type !== 'all') where.business_type = String(business_type);
    if (q) {
      const kw = String(q);
      where.OR = [{ name: { contains: kw } }, { address: { contains: kw } }];
    }

    const skip = (page - 1) * limit;
    const total = await prisma.stores.count({ where });

    const stores = await prisma.stores.findMany({
      where,
      select: {
        id: true,
        name: true,
        business_type: true,
        address: true,
        latitude: true,
        longitude: true,
        open_time: true,
        close_time: true,
        business_hours: true,
      },
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    });

    return {
      stores,
      pagination: { total, page, limit, hasMore: skip + stores.length < total },
    };
  }

  async getPopular() {
    return await prisma.stores.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        address: true,
        business_type: true,
        latitude: true,
        longitude: true,
        _count: { select: { orders: { where: { status: 'completed' } } } },
      },
      orderBy: { orders: { _count: 'desc' } },
      take: 8,
    });
  }

  async getHighlights(district) {
    const now = new Date();
    const storeRel = {
      NOT: [{ name: { contains: '?' } }, { name: { contains: '\uFFFD' } }],
      ...(district ? { address: { contains: String(district) } } : {}),
    };

    const posts = await prisma.community_posts.findMany({
      where: {
        type: { in: ['EVENT', 'PROMOTION', 'PRODUCT', 'NEWS'] },
        OR: [{ expires_at: null }, { expires_at: { gte: now } }],
        stores: storeRel,
      },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        image_url: true,
        stores: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 6,
    });

    const products = await prisma.products.findMany({
      where: { is_active: true, is_sold_out: false, stores: storeRel },
      select: {
        id: true,
        name: true,
        price: true,
        image_url: true,
        is_popular: true,
        store_id: true,
        stores: { select: { id: true, name: true } },
      },
      orderBy: [{ is_popular: 'desc' }, { id: 'desc' }],
      take: 6,
    });

    return { posts, products };
  }

  async getStats(storeId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [store, orderCount, productCount] = await Promise.all([
      prisma.stores.findUnique({ where: { id: storeId } }),
      prisma.orders.count({ where: { store_id: storeId, created_at: { gte: startOfMonth } } }),
      prisma.products.count({ where: { store_id: storeId, is_active: true } }),
    ]);

    return { store, orderCount, productCount };
  }
}

module.exports = new StoreRepository();
