// CartService 단위 테스트
jest.mock('../../../repositories/Cart', () => ({
    findByTableId: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteManyByTableId: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

const CartService = require('../../../services/CartService');
const Cart = require('../../../repositories/Cart');

describe('CartService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new CartService();
    });

    describe('getCartByTable', () => {
        test('특정 테이블 ID가 주어지면 장바구니 아이템 목록을 성공적으로 반환한다', async () => {
            const mockItems = [
                { id: 1, table_id: 5, product_id: 10, quantity: 2, products: { id: 10, name: '아메리카노', price: 4500 } }
            ];
            Cart.findByTableId.mockResolvedValue(mockItems);

            const result = await svc.getCartByTable(5);

            expect(result).toEqual(mockItems);
            expect(Cart.findByTableId).toHaveBeenCalledWith(5);
        });

        test('테이블 ID가 제공되지 않으면 에러를 발생시킨다', async () => {
            await expect(svc.getCartByTable(null)).rejects.toThrow('테이블 ID가 올바르지 않습니다.');
        });
    });

    describe('updateCartItem', () => {
        test('필수 파라미터가 없으면 에러를 발생시킨다', async () => {
            await expect(svc.updateCartItem({ tableId: null, productId: 10, quantity: 1 }))
                .rejects.toThrow('테이블 ID와 상품 ID는 필수입니다.');
            
            await expect(svc.updateCartItem({ tableId: 5, productId: null, quantity: 1 }))
                .rejects.toThrow('테이블 ID와 상품 ID는 필수입니다.');
        });

        test('장바구니에 아이템이 존재하지 않고 수량이 0보다 크면 새로 추가한다', async () => {
            Cart.findFirst.mockResolvedValue(null);
            const mockCreated = { id: 1, table_id: 5, product_id: 10, quantity: 2, user_phone: '01012345678' };
            Cart.create.mockResolvedValue(mockCreated);

            const result = await svc.updateCartItem({
                tableId: 5,
                productId: 10,
                quantity: 2,
                userPhone: '01012345678'
            });

            expect(result).toEqual(mockCreated);
            expect(Cart.findFirst).toHaveBeenCalledWith(5, 10);
            expect(Cart.create).toHaveBeenCalledWith({
                table_id: 5,
                product_id: 10,
                quantity: 2,
                user_phone: '01012345678'
            });
            expect(Cart.update).not.toHaveBeenCalled();
            expect(Cart.delete).not.toHaveBeenCalled();
        });

        test('장바구니에 이미 아이템이 있고 수량이 0보다 크면 수량과 기여자를 업데이트한다', async () => {
            const existingItem = { id: 99, table_id: 5, product_id: 10, quantity: 1, user_phone: '01000000000' };
            Cart.findFirst.mockResolvedValue(existingItem);
            
            const mockUpdated = { id: 99, table_id: 5, product_id: 10, quantity: 3, user_phone: '01012345678' };
            Cart.update.mockResolvedValue(mockUpdated);

            const result = await svc.updateCartItem({
                tableId: 5,
                productId: 10,
                quantity: 3,
                userPhone: '01012345678'
            });

            expect(result).toEqual(mockUpdated);
            expect(Cart.findFirst).toHaveBeenCalledWith(5, 10);
            expect(Cart.update).toHaveBeenCalledWith(99, {
                quantity: 3,
                user_phone: '01012345678'
            });
            expect(Cart.create).not.toHaveBeenCalled();
            expect(Cart.delete).not.toHaveBeenCalled();
        });

        test('장바구니에 아이템이 이미 존재하고 변경할 수량이 0 이하이면 해당 품목을 삭제한다', async () => {
            const existingItem = { id: 99, table_id: 5, product_id: 10, quantity: 2 };
            Cart.findFirst.mockResolvedValue(existingItem);
            Cart.delete.mockResolvedValue(true);

            const result = await svc.updateCartItem({
                tableId: 5,
                productId: 10,
                quantity: 0
            });

            expect(result).toEqual({ ...existingItem, quantity: 0, deleted: true });
            expect(Cart.findFirst).toHaveBeenCalledWith(5, 10);
            expect(Cart.delete).toHaveBeenCalledWith(99);
            expect(Cart.update).not.toHaveBeenCalled();
            expect(Cart.create).not.toHaveBeenCalled();
        });
    });

    describe('clearCart', () => {
        test('특정 테이블 ID가 주어지면 장바구니를 전체 초기화한다', async () => {
            Cart.deleteManyByTableId.mockResolvedValue({ count: 3 });

            const result = await svc.clearCart(5);

            expect(result).toEqual({ count: 3 });
            expect(Cart.deleteManyByTableId).toHaveBeenCalledWith(5);
        });

        test('테이블 ID가 없으면 에러를 발생시킨다', async () => {
            await expect(svc.clearCart(null)).rejects.toThrow('테이블 ID가 올바르지 않습니다.');
        });
    });
});
