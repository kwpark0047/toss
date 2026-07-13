const Cart = require('../repositories/Cart');
const logger = require('../utils/logger');

/**
 * [공유 장바구니 서비스]
 * 테이블 단위 분할 결제 정보 및 실시간 공유 주문 카트 비즈니스 정합성을 전담 처리합니다.
 */
class CartService {
    /**
     * 특정 테이블의 실시간 장바구니 아이템들을 조회합니다.
     */
    async getCartByTable(tableId) {
        if (!tableId) throw new Error('테이블 ID가 올바르지 않습니다.');
        return await Cart.findByTableId(tableId);
    }

    /**
     * 장바구니 아이템을 등록하거나 수량을 갱신(혹은 제거)합니다.
     */
    async updateCartItem({ tableId, productId, quantity, userPhone }) {
        if (!tableId || !productId) {
            throw new Error('테이블 ID와 상품 ID는 필수입니다.');
        }

        const qty = parseInt(quantity);
        const pid = parseInt(productId);
        const tid = parseInt(tableId);

        // 기존 장바구니 품목 유무 확인
        const existing = await Cart.findFirst(tid, pid);

        let item = null;

        if (existing) {
            if (qty <= 0) {
                // 수량이 0 이하인 경우 품목 삭제 처리
                await Cart.delete(existing.id);
                item = { ...existing, quantity: 0, deleted: true };
                logger.info(`[장바구니] 테이블 ${tid}번에서 상품 ${pid}번 품목이 수량 0으로 제거되었습니다.`);
            } else {
                // 수량 및 기여자(전화번호) 변경 처리
                item = await Cart.update(existing.id, {
                    quantity: qty,
                    user_phone: userPhone || existing.user_phone
                });
                logger.info(`[장바구니] 테이블 ${tid}번 상품 ${pid}번 수량 업데이트: ${qty}개`);
            }
        } else if (qty > 0) {
            // 신규 품목 추가
            item = await Cart.create({
                table_id: tid,
                product_id: pid,
                quantity: qty,
                user_phone: userPhone || null
            });
            logger.info(`[장바구니] 테이블 ${tid}번에 신규 상품 ${pid}번 추가: ${qty}개`);
        }

        return item;
    }

    /**
     * 특정 테이블의 장바구니를 전체 초기화합니다.
     */
    async clearCart(tableId) {
        if (!tableId) throw new Error('테이블 ID가 올바르지 않습니다.');
        const tid = parseInt(tableId);
        
        const result = await Cart.deleteManyByTableId(tid);
        logger.info(`[장바구니] 테이블 ${tid}번 장바구니가 완전 비워졌습니다.`);
        
        return result;
    }
}

module.exports = CartService;
