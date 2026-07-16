const fs = require('fs');
const file = 'services/ProductsService.js';
let content = fs.readFileSync(file, 'utf8');

// Insert auto-translate method at the end of the class
const autoTranslateMethod = `
    /**
     * 비동기 자동 번역 및 DB 저장
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
                logger.info(\`[ProductsService] 자동 번역 완료: productId=\${productId}\`);
            }
        } catch (e) {
            const logger = require('../utils/logger');
            logger.error(\`[ProductsService] 자동 번역 실패: \${e.message}\`);
        }
    }
}
`;

content = content.replace(/}\s*module\.exports = ProductsService;/g, autoTranslateMethod + '\nmodule.exports = ProductsService;');

// Update createProduct
const createProductPattern = /async createProduct\(data\) {[\s\S]*?return product;\n    }/;
const newCreateProduct = `    async createProduct(data) {
        logger.info(\`상품 생성: store=\${data.store_id}, name=\${data.name}, price=\${data.price}\`);
        const product = await Product.create(data);
        cache.flushByStore(data.store_id);
        
        // 자동 번역 비동기 실행
        this._autoTranslateProduct(product.id, product);
        
        return product;
    }`;
content = content.replace(createProductPattern, newCreateProduct);

// Update updateProduct
const updateProductPattern = /async updateProduct\(id, data, io\) {[\s\S]*?const product = await Product\.update\(id, data\);/;
const newUpdateProduct = `    async updateProduct(id, data, io) {
        const oldProduct = await Product.findById(id);
        const product = await Product.update(id, data);
        
        if (oldProduct && (oldProduct.name !== product.name || oldProduct.description !== product.description)) {
            this._autoTranslateProduct(product.id, product);
        }`;
content = content.replace(updateProductPattern, newUpdateProduct);

fs.writeFileSync(file, content);
console.log('Fixed ProductsService.js');
