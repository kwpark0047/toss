import logger from '../utils/logger';
import type {
  SharedCartItem,
  UpdateCartItemParams,
  CartDeleteResult,
} from '../types/cart';

interface CartRepository {
  findByTableId(tableId: number): Promise<SharedCartItem[]>;
  findFirst(tableId: number, productId: number): Promise<SharedCartItem | null>;
  create(data: any): Promise<SharedCartItem>;
  update(id: number, data: any): Promise<SharedCartItem>;
  delete(id: number): Promise<SharedCartItem>;
  deleteManyByTableId(tableId: number): Promise<CartDeleteResult>;
}

const Cart: CartRepository = require('../repositories/Cart');

class CartService {
  async getCartByTable(tableId: number | string): Promise<SharedCartItem[]> {
    if (!tableId) throw new Error('테이블 ID가 올바르지 않습니다.');
    return await Cart.findByTableId(parseInt(String(tableId)));
  }

  async updateCartItem({ tableId, productId, quantity, userPhone }: UpdateCartItemParams): Promise<SharedCartItem | null> {
    if (!tableId || !productId) {
      throw new Error('테이블 ID와 상품 ID는 필수입니다.');
    }

    const qty = parseInt(String(quantity));
    const pid = parseInt(String(productId));
    const tid = parseInt(String(tableId));

    const existing = await Cart.findFirst(tid, pid);

    let item: SharedCartItem | null = null;

    if (existing) {
      if (qty <= 0) {
        await Cart.delete(existing.id);
        item = { ...existing, quantity: 0, deleted: true } as any;
        logger.info(`[장바구니] 테이블 ${tid}번에서 상품 ${pid}번 품목이 수량 0으로 제거되었습니다.`);
      } else {
        item = await Cart.update(existing.id, {
          quantity: qty,
          user_phone: userPhone || existing.user_phone,
        });
        logger.info(`[장바구니] 테이블 ${tid}번 상품 ${pid}번 수량 업데이트: ${qty}개`);
      }
    } else if (qty > 0) {
      item = await Cart.create({
        table_id: tid,
        product_id: pid,
        quantity: qty,
        user_phone: userPhone || null,
      });
      logger.info(`[장바구니] 테이블 ${tid}번에 신규 상품 ${pid}번 추가: ${qty}개`);
    }

    return item;
  }

  async clearCart(tableId: number | string): Promise<CartDeleteResult> {
    if (!tableId) throw new Error('테이블 ID가 올바르지 않습니다.');
    const tid = parseInt(String(tableId));

    const result = await Cart.deleteManyByTableId(tid);
    logger.info(`[장바구니] 테이블 ${tid}번 장바구니가 완전 비워졌습니다.`);

    return result;
  }
}

export = new CartService();
