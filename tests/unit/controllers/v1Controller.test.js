const v1Controller = require('../../../controllers/v1Controller');
const prisma = require('../../../config/prisma');
const OrderRepository = require('../../../repositories/Order');
const { emitEvent } = require('../../../services/webhookDispatcher');

// catchAsync 미들웨어 모의화 (동기적 직접 실행 목적)
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

// Prisma 클라이언트 모의화
jest.mock('../../../config/prisma', () => {
    return {
        stores: {
            findUnique: jest.fn(),
        },
        products: {
            findMany: jest.fn(),
        },
        orders: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
        },
        $queryRawUnsafe: jest.fn(),
        $executeRawUnsafe: jest.fn(),
    };
});

// 주문 레포지토리 및 웹훅 디스패처 모의화
jest.mock('../../../repositories/Order');
jest.mock('../../../services/webhookDispatcher', () => {
    return {
        emitEvent: jest.fn(),
    };
});

// 전화번호 복호화 모의화 (마스킹 테스트용)
jest.mock('../../../utils/phoneEncryption', () => {
    return {
        decryptPhone: jest.fn((enc) => {
            if (enc === 'enc_phone_test') return '01012345678';
            return null;
        }),
    };
});

describe('v1Controller Unit Tests', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            apiClient: { storeId: 1 },
            params: {},
            query: {},
            body: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
    });

    describe('getStore', () => {
        it('매장 정보를 성공적으로 리스팅한다', async () => {
            prisma.stores.findUnique.mockResolvedValue({
                id: 1,
                name: '가산동 대박트럭',
                business_type: 'FOOD_TRUCK',
            });

            await v1Controller.getStore(req, res);

            expect(prisma.stores.findUnique).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
            }));
            expect(res.json).toHaveBeenCalledWith({
                data: expect.objectContaining({ name: '가산동 대박트럭', business_type: 'FOOD_TRUCK' }),
            });
        });

        it('매장 정보가 없으면 404 에러를 반환한다', async () => {
            prisma.stores.findUnique.mockResolvedValue(null);

            await v1Controller.getStore(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'not_found',
            }));
        });
    });

    describe('getMenus', () => {
        it('매장의 상품 메뉴 목록을 정상 조회한다', async () => {
            prisma.products.findMany.mockResolvedValue([
                { id: 10, name: '양념 닭꼬치', price: 3500 },
                { id: 11, name: '소금 닭꼬치', price: 3000 },
            ]);

            await v1Controller.getMenus(req, res);

            expect(prisma.products.findMany).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.any(Array),
                meta: { count: 2 },
            }));
        });
    });

    describe('getOrders', () => {
        it('매장 주문 목록을 마스킹 처리된 휴대폰 번호와 함께 조회한다', async () => {
            prisma.orders.findMany.mockResolvedValue([
                {
                    id: 501,
                    order_number: '20260711-1001',
                    status: 'pending',
                    total_amount: 6500,
                    customer_phone: 'enc_phone_test',
                    order_items: [{ product_name: '양념 닭꼬치', quantity: 2, price: 3500 }],
                }
            ]);

            await v1Controller.getOrders(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({
                        customer_phone: '010-****-5678', // 01012345678의 마스킹된 포맷 검증
                    })
                ]),
            }));
        });
    });

    describe('createOrder', () => {
        it('올바른 가격 검증을 통해 외부 주문을 생성하고 웹훅을 방출한다', async () => {
            req.body = {
                items: [
                    { product_id: 10, quantity: 2 },
                ],
            };

            prisma.products.findMany.mockResolvedValue([
                { id: 10, price: 3500 },
            ]);

            OrderRepository.create.mockResolvedValue({
                id: 501,
                order_number: '20260711-1001',
                total_amount: 7000,
                status: 'pending',
            });

            await v1Controller.createOrder(req, res);

            expect(OrderRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                total_amount: 7000, // 3500 * 2 재계산 검증
            }));
            expect(emitEvent).toHaveBeenCalledWith(1, 'order.created', expect.any(Object));
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('claimPrintJobs', () => {
        it('원자적 DB select-for-update-skip-locked 쿼리를 전개한다', async () => {
            req.body = { max: 5 };
            prisma.$queryRawUnsafe.mockResolvedValue([
                { id: 1, payload_b64: 'YmFzZTY0cG9z' },
            ]);

            await v1Controller.claimPrintJobs(req, res);

            expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                meta: { count: 1 },
            }));
        });
    });
});
