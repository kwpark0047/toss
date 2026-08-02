const prisma = require('../config/prisma');
const logger = require('../utils/logger');

class DynamicSaleService {
  /**
   * 재고가 많거나 유통기한/마감 시간이 임박한 상품에 대한 다이내믹 프라이싱(타임세일) 적용
   */
  async applyFlashSale(storeId, productId, discountPercent, durationHours = 2) {
    const numericStoreId = Number(storeId);
    const numericProductId = Number(productId);

    const product = await prisma.products.findUnique({
      where: { id: numericProductId },
    });

    if (!product || product.store_id !== numericStoreId) {
      throw new Error('상품을 찾을 수 없습니다.');
    }

    const originalPrice = product.price;
    const discountAmount =
      Math.round((originalPrice * (Number(discountPercent) || 10)) / 100 / 10) * 10; // 10원 단위 절사
    const salePrice = Math.max(0, originalPrice - discountAmount);

    const expiresAt = new Date(Date.now() + (Number(durationHours) || 2) * 60 * 60 * 1000);

    const updated = await prisma.products.update({
      where: { id: numericProductId },
      data: {
        price: salePrice,
        // 원가 혹은 기존 가격 보존을 위해 metadata나 비고란 활용 가능
        updated_at: new Date(),
      },
    });

    logger.info(
      { storeId: numericStoreId, productId: numericProductId, originalPrice, salePrice, expiresAt },
      'Flash sale pricing applied'
    );
    return {
      success: true,
      productId: numericProductId,
      originalPrice,
      salePrice,
      discountPercent,
      expiresAt,
    };
  }
}

module.exports = new DynamicSaleService();
