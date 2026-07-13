const prisma = require('../config/prisma');

/**
 * [공유 장바구니 레포지토리]
 * 각 테이블별 실시간 공유 장바구니 아이템의 영속성(CRUD) 트랜잭션을 처리합니다.
 */
const Cart = {
    /**
     * 특정 테이블의 전체 장바구니 아이템 조회
     */
    findByTableId: async (tableId) => {
        return await prisma.shared_cart_items.findMany({
            where: { table_id: parseInt(tableId) },
            include: { products: true },
            orderBy: { created_at: 'asc' }
        });
    },

    /**
     * 특정 테이블 및 특정 상품의 단일 장바구니 아이템 조회
     */
    findFirst: async (tableId, productId) => {
        return await prisma.shared_cart_items.findFirst({
            where: {
                table_id: parseInt(tableId),
                product_id: parseInt(productId)
            }
        });
    },

    /**
     * 장바구니에 새 아이템 추가
     */
    create: async (data) => {
        return await prisma.shared_cart_items.create({
            data,
            include: { products: true }
        });
    },

    /**
     * 기존 장바구니 아이템 업데이트 (수량, 전화번호 등)
     */
    update: async (id, data) => {
        return await prisma.shared_cart_items.update({
            where: { id: parseInt(id) },
            data
        });
    },

    /**
     * 특정 장바구니 아이템 삭제
     */
    delete: async (id) => {
        return await prisma.shared_cart_items.delete({
            where: { id: parseInt(id) }
        });
    },

    /**
     * 특정 테이블의 장바구니 전체 비우기 (초기화)
     */
    deleteManyByTableId: async (tableId) => {
        return await prisma.shared_cart_items.deleteMany({
            where: { table_id: parseInt(tableId) }
        });
    }
};

module.exports = Cart;
