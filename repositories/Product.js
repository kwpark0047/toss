const prisma = require('../config/prisma');
const cache = require('../utils/dbCache');

/**
 * 상품 모델 (Prisma 기반 + Caching)
 * 상품 정보 관리 및 조회 성능 최적화를 담당합니다.
 */
const Product = {
  // [상품 생성]
  create: async (data) => {
    const {
      store_id,
      category_id,
      name,
      price,
      description,
      image_url,
      is_active = 1,
      is_sold_out = 0,
      detail_description,
      options,
      nutrition_info,
      allergens,
      ingredients,
      spicy_level = 0,
      is_popular = 0,
      is_new = 0,
      tags,
      detail_images,
      cooking_time = 5,
      stock_quantity,
      low_stock_threshold = 5,
    } = data;

    if (store_id === undefined) throw new Error('store_id is undefined');

    const product = await prisma.products.create({
      data: {
        store_id: parseInt(store_id),
        category_id:
          category_id !== null && category_id !== undefined ? parseInt(category_id) : null,
        name,
        price: parseInt(price),
        description,
        image_url,
        is_active: is_active ? true : false,
        is_sold_out: is_sold_out ? true : false,
        detail_description,
        options: typeof options === 'object' ? JSON.stringify(options) : options,
        nutrition_info:
          typeof nutrition_info === 'object' ? JSON.stringify(nutrition_info) : nutrition_info,
        allergens: typeof allergens === 'object' ? JSON.stringify(allergens) : allergens,
        ingredients: typeof ingredients === 'object' ? JSON.stringify(ingredients) : ingredients,
        spicy_level: parseInt(spicy_level) || 0,
        is_popular: is_popular ? 1 : 0,
        is_new: is_new ? 1 : 0,
        tags: typeof tags === 'object' ? JSON.stringify(tags) : tags,
        detail_images:
          typeof detail_images === 'object' ? JSON.stringify(detail_images) : detail_images,
        cooking_time: parseInt(cooking_time) || 5,
        stock_quantity:
          stock_quantity !== null && stock_quantity !== undefined && stock_quantity !== ''
            ? parseInt(stock_quantity)
            : null,
        low_stock_threshold: parseInt(low_stock_threshold) || 5,
        sort_order: 0,
      },
    });

    // 관련 매장 캐시 무효화
    cache.flushByStore(store_id);

    return product;
  },

  // [ID로 상품 상세 조회]
  findById: async (id) => {
    try {
      if (!id) return null;
      const cacheKey = `product:${id}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const product = await prisma.products.findUnique({
        where: { id: parseInt(id) },
      });

      if (product) cache.set(cacheKey, product);
      return product;
    } catch (error) {
      console.error(`[Prisma Error] Product.findById failed for ID: ${id}`, error);
      return null;
    }
  },

  // [매장별 상품 목록 조회]
  findByStoreId: async (storeId, categoryId = null) => {
    try {
      const sid = parseInt(storeId);
      if (isNaN(sid)) return [];

      const cacheKey = categoryId
        ? `store:${sid}:category:${categoryId}:products`
        : `store:${sid}:products`;

      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const where = { store_id: sid };
      if (categoryId) where.category_id = parseInt(categoryId);

      const products = await prisma.products.findMany({
        where,
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      });

      cache.set(cacheKey, products);
      return products;
    } catch (error) {
      console.error(`[Prisma Error] Product.findByStoreId failed for Store: ${storeId}`, error);
      return [];
    }
  },

  // [상품 정보 업데이트]
  update: async (id, data) => {
    const {
      name,
      price,
      description,
      image_url,
      is_active,
      is_sold_out,
      category_id,
      detail_description,
      options,
      nutrition_info,
      allergens,
      ingredients,
      spicy_level,
      is_popular,
      is_new,
      tags,
      detail_images,
      cooking_time,
      stock_quantity,
      low_stock_threshold,
    } = data;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = parseInt(price);
    if (description !== undefined) updateData.description = description;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (is_active !== undefined) updateData.is_active = is_active ? true : false;
    if (is_sold_out !== undefined) updateData.is_sold_out = is_sold_out ? true : false;
    if (category_id !== undefined)
      updateData.category_id =
        category_id !== null && category_id !== '' ? parseInt(category_id) : null;

    if (detail_description !== undefined) updateData.detail_description = detail_description;
    if (options !== undefined)
      updateData.options = typeof options === 'object' ? JSON.stringify(options) : options;
    if (nutrition_info !== undefined)
      updateData.nutrition_info =
        typeof nutrition_info === 'object' ? JSON.stringify(nutrition_info) : nutrition_info;
    if (allergens !== undefined)
      updateData.allergens = typeof allergens === 'object' ? JSON.stringify(allergens) : allergens;
    if (ingredients !== undefined)
      updateData.ingredients =
        typeof ingredients === 'object' ? JSON.stringify(ingredients) : ingredients;
    if (spicy_level !== undefined) updateData.spicy_level = parseInt(spicy_level) || 0;
    if (is_popular !== undefined) updateData.is_popular = is_popular ? 1 : 0;
    if (is_new !== undefined) updateData.is_new = is_new ? 1 : 0;
    if (tags !== undefined)
      updateData.tags = typeof tags === 'object' ? JSON.stringify(tags) : tags;
    if (detail_images !== undefined)
      updateData.detail_images =
        typeof detail_images === 'object' ? JSON.stringify(detail_images) : detail_images;
    if (cooking_time !== undefined) updateData.cooking_time = parseInt(cooking_time) || 5;
    if (stock_quantity !== undefined)
      updateData.stock_quantity =
        stock_quantity !== null && stock_quantity !== '' ? parseInt(stock_quantity) : null;
    if (low_stock_threshold !== undefined)
      updateData.low_stock_threshold = parseInt(low_stock_threshold) || 5;

    const product = await prisma.products.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    // 관련 캐시 무효화
    cache.del(`product:${id}`);
    cache.flushByStore(product.store_id);

    return product;
  },

  // [상품 삭제]
  delete: async (id) => {
    const product = await Product.findById(id);
    if (!product) return true;

    await prisma.products.delete({
      where: { id: parseInt(id) },
    });

    // 관련 캐시 무효화
    cache.del(`product:${id}`);
    cache.flushByStore(product.store_id);

    return true;
  },

  // [추천용 활성화 및 품절되지 않은 상품 조회]
  findActiveAndInStock: async (storeId) => {
    return await prisma.products.findMany({
      where: {
        store_id: parseInt(storeId),
        is_active: true,
        is_sold_out: false,
      },
      select: {
        id: true,
        name: true,
        price: true,
        categories: { select: { name: true } },
      },
    });
  },

  // [다중 ID 상품 조회]
  findByIds: async (ids, storeIdOrSelect = null, includeFields = null) => {
    const storeId = Number.isInteger(Number(storeIdOrSelect)) ? Number(storeIdOrSelect) : null;
    const selectFields = storeId === null ? storeIdOrSelect : null;
    const query = {
      where: {
        id: { in: ids.map((id) => parseInt(id)) },
      },
    };
    if (storeId !== null) query.where.store_id = storeId;
    if (selectFields) query.select = selectFields;
    if (includeFields) query.include = includeFields;
    return await prisma.products.findMany(query);
  },

  // [매장의 활성화 및 품절되지 않은 디저트/음료 목록 조회]
  findDessertsForStore: async (storeId) => {
    return await prisma.products.findMany({
      where: {
        store_id: parseInt(storeId),
        is_active: true,
        is_sold_out: false,
        categories: {
          name: {
            in: ['디저트', 'Dessert', '간식', '사이드', '음료', 'Coffee', '커피'],
          },
        },
      },
      select: {
        id: true,
        name: true,
        price: true,
      },
    });
  },

  // [번역용 활성화 상품 목록 조회]
  findActiveByStoreId: async (storeId, selectFields = null) => {
    const query = {
      where: {
        store_id: parseInt(storeId),
        is_active: true,
      },
    };
    if (selectFields) query.select = selectFields;
    return await prisma.products.findMany(query);
  },

  // [주문 시 재고 예약] 조건부 updateMany로 경쟁 안전하게 차감하고 ORDER 이력을 남긴다.
  // 실패(재고 부족/품절) 시 null, 성공 시 갱신된 상품을 반환한다.
  reserveStock: async (productId, storeId, quantity, orderId) => {
    const updated = await prisma.products.updateMany({
      where: {
        id: parseInt(productId),
        store_id: parseInt(storeId),
        is_active: true,
        is_sold_out: false,
        stock_quantity: { gte: parseInt(quantity) },
      },
      data: { stock_quantity: { decrement: parseInt(quantity) } },
    });

    if (!updated.count) return null;

    const product = await prisma.products.findUnique({ where: { id: parseInt(productId) } });
    if (!product) return null;

    await prisma.stock_history.create({
      data: {
        product_id: product.id,
        store_id: product.store_id,
        change: -parseInt(quantity),
        qty_after: product.stock_quantity,
        reason: 'ORDER',
        order_id: parseInt(orderId),
      },
    });

    cache.flushByStore(product.store_id);
    return product;
  },

  // [주문 취소 시 재고 복구] ORDER 이력을 집계해 취소 재고를 돌려주고 CANCEL 이력을 남긴다.
  // 이미 CANCEL 복구된 주문(order_id)이면 아무것도 하지 않고 []를 반환한다.
  restoreOrderStock: async (orderId) => {
    const history = await prisma.stock_history.findMany({ where: { order_id: parseInt(orderId) } });
    if (!history.length) return [];

    // ORDER(음수)와 CANCEL(양수) 이력이 함께 존재하면 이미 복구된 것
    const alreadyRestored = history.some((h) => h.change > 0);
    if (alreadyRestored) return [];

    const byProduct = history.reduce((acc, h) => {
      if (h.change < 0) {
        const key = `${h.product_id}:${h.store_id}`;
        acc[key] = (acc[key] || 0) + Math.abs(h.change);
      }
      return acc;
    }, {});

    const restored = [];
    for (const [key, amount] of Object.entries(byProduct)) {
      const [product_id, store_id] = key.split(':').map(Number);
      const product = await prisma.products.findUnique({ where: { id: product_id } });
      if (!product) continue;

      await prisma.products.update({
        where: { id: product_id },
        data: { stock_quantity: { increment: amount }, is_sold_out: false },
      });
      await prisma.stock_history.create({
        data: {
          product_id,
          store_id,
          change: amount,
          qty_after: product.stock_quantity,
          reason: 'CANCEL',
          order_id: parseInt(orderId),
        },
      });
      cache.flushByStore(store_id);
      restored.push(product);
    }

    return restored;
  },
};

module.exports = Product;
