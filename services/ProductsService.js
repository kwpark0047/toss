const Product = require('../repositories/Product');
const cache = require('../utils/cache');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class ProductsService {
    /**
     * 매장별 상품 목록 조회 (캐시 + 다국어 번역 지원)
     */
    async getStoreProducts(storeId, options = {}) {
        const { category_id, lang } = options;

        let cacheKey = `store:${storeId}:products:${category_id || 'all'}`;
        const isValidLang = lang && ['en', 'jp', 'cn'].includes(lang);
        if (isValidLang) {
            cacheKey = `${cacheKey}:translated:${lang}`;
        }

        const cached = cache.get(cacheKey);
        if (cached) return { data: cached, fromCache: true };

        const products = await Product.findByStoreId(storeId, category_id);

        if (isValidLang && products.length > 0) {
            const aiService = require('../services/aiService');
            const translations = await aiService.batchTranslateMenus(products, lang);

            const translatedProducts = products.map(p => {
                const tr = translations.find(t => t.id === p.id);
                return {
                    ...p,
                    name: tr?.translated_name || p.name,
                    description: tr?.translated_description || p.description
                };
            });

            cache.set(cacheKey, translatedProducts, 300);
            return { data: translatedProducts, fromCache: false };
        }

        cache.set(cacheKey, products, 60);
        return { data: products, fromCache: false };
    }

    /**
     * 상품 상세 조회
     */
    async getProductById(id) {
        const product = await Product.findById(id);
        if (!product) {
            throw new AppError('상품을 찾을 수 없습니다.', 404);
        }
        return product;
    }

    /**
     * 상품 생성
     */
    async createProduct(data) {
        logger.info(`상품 생성: store=${data.store_id}, name=${data.name}, price=${data.price}`);
        const product = await Product.create(data);
        cache.flushByStore(data.store_id);
        return product;
    }

    /**
     * 상품 정보 수정 + WebSocket 알림
     */
        async updateProduct(id, data, io) {
        const oldProduct = await Product.findById(id);
        const product = await Product.update(id, data);
        
        if (oldProduct && (oldProduct.name !== product.name || oldProduct.description !== product.description)) {
            this._autoTranslateProduct(product.id, product);
        }
        if (product?.store_id) cache.flushByStore(product.store_id);

        if (io && product.store_id) {
            io.to(`store - ${product.store_id}`).emit('product-updated', {
                productId: product.id,
                is_sold_out: product.is_sold_out,
                cooking_time: product.cooking_time,
                name: product.name,
                price: product.price
            });
            logger.info(`소켓 상품 업데이트 전파: store=${product.store_id}, productId=${product.id}`);
        }
        return product;
    }

    /**
     * 상품 삭제
     */
    async deleteProduct(id) {
        const existing = await Product.findById(id);
        await Product.delete(id);
        if (existing?.store_id) cache.flushByStore(existing.store_id);
    }

    /**
     * 상품 일괄 등록
     */
    async bulkCreate(storeId, products) {
        if (!products || !Array.isArray(products)) {
            throw new AppError('products 배열이 필요합니다.', 400);
        }
        const createdProducts = await Promise.all(
            products.map(p => Product.create({ ...p, store_id: parseInt(storeId) }))
        );
        cache.flushByStore(storeId);
        return createdProducts;
    }

    /**
     * 다른 매장에서 메뉴 가져오기
     */
    async importFromStore(targetStoreId, sourceStoreId) {
        const sourceProducts = await Product.findByStoreId(sourceStoreId);

        const imported = await Promise.all(
            sourceProducts.map(p => {
                const { id: _id, store_id: _sid, created_at: _ca, updated_at: _ua, ...rest } = p;
                return Product.create({ ...rest, store_id: parseInt(targetStoreId) });
            })
        );
        cache.flushByStore(targetStoreId);
        return imported;
    }

    /**
     * �񵿱� �ڵ� ���� �� DB ����
     */
    async _autoTranslateProduct(productId, productData) {
        try {
            const aiService = require('../services/aiService');
            const targetLangs = ['en', 'jp', 'cn'];
            const translations = {};
            
            for (const lang of targetLangs) {
                const res = await aiService.batchTranslateMenus([productData], lang);
                if (res && res.length > 0) {
                    translations[lang] = {
                        name: res[0].translated_name,
                        description: res[0].translated_description
                    };
                }
            }
            
            if (Object.keys(translations).length > 0) {
                const ProductRepo = require('../repositories/Product');
                await ProductRepo.update(productId, { translations });
                if (productData.store_id) {
                    const cache = require('../utils/cache');
                    cache.flushByStore(productData.store_id);
                }
                const logger = require('../utils/logger');
                logger.info(`[ProductsService] �ڵ� ���� �Ϸ�: productId=${productId}`);
            }
        } catch (e) {
            const logger = require('../utils/logger');
            logger.error(`[ProductsService] �ڵ� ���� ����: ${e.message}`);
        }
    }
}

module.exports = ProductsService;
