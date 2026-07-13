const CartService = require('../services/CartService');

const cartService = new CartService();

/**
 * [공유 장바구니 컨트롤러]
 * HTTP 요청 핸들러 바인딩 레이어입니다.
 */
const cartController = {
    /**
     * GET /api/cart/:tableId
     * 특정 테이블의 전체 공유 장바구니 아이템들을 조회합니다.
     */
    async getCart(req, res) {
        const { tableId } = req.params;
        if (!tableId) {
            return res.status(400).json({ success: false, error: '테이블 ID는 필수입니다.' });
        }
        
        const items = await cartService.getCartByTable(tableId);
        res.json({ success: true, data: items });
    },

    /**
     * POST /api/cart/:tableId
     * 장바구니에 아이템을 등록하거나 수량을 갱신(혹은 제거)합니다.
     */
    async updateCart(req, res) {
        const { tableId } = req.params;
        const { product_id, quantity, user_phone } = req.body;
        
        if (!tableId) {
            return res.status(400).json({ success: false, error: '테이블 ID는 필수입니다.' });
        }
        if (!product_id) {
            return res.status(400).json({ success: false, error: '상품 ID(product_id)는 필수입니다.' });
        }

        const item = await cartService.updateCartItem({
            tableId,
            productId: product_id,
            quantity: quantity !== undefined ? quantity : 1,
            userPhone: user_phone
        });

        res.json({ success: true, data: item });
    },

    /**
     * DELETE /api/cart/:tableId
     * 특정 테이블의 장바구니를 전체 초기화합니다.
     */
    async clearCart(req, res) {
        const { tableId } = req.params;
        if (!tableId) {
            return res.status(400).json({ success: false, error: '테이블 ID는 필수입니다.' });
        }

        await cartService.clearCart(tableId);
        res.json({ success: true, message: '장바구니가 초기화되었습니다.' });
    }
};

module.exports = cartController;
