const prisma = require('../config/prisma');
const Order = require('../repositories/Order');
const Payment = require('../repositories/Payment');

const STORE_NAMES = [
    '강남 1호점 (본점)', '홍대 2호점', '성수 팝업스토어', '부산 해운대점',
    '제주 공항점', '여의도 더현대점', '이태원 프리덤점', '판교 테크노점',
    '대전 성심당옆점', '광주 상무점'
];

const CATEGORIES = ['커피 & 음료', '디저트', '식사', '시그니처'];
const PRODUCTS = [
    { name: '아메리카노', price: 4500, category: '커피 & 음료' },
    { name: '카페라떼', price: 5000, category: '커피 & 음료' },
    { name: '바닐라 라떼', price: 5500, category: '커피 & 음료' },
    { name: '딸기 스무디', price: 6000, category: '커피 & 음료' },
    { name: '치즈 케이크', price: 7000, category: '디저트' },
    { name: '초코 브라우니', price: 4000, category: '디저트' },
    { name: '크로플', price: 8000, category: '시그니처' },
    { name: '떡볶이', price: 12000, category: '식사' },
    { name: '김치볶음밥', price: 9000, category: '식사' },
    { name: '해물 파스타', price: 15000, category: '식사' }
];

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const PAYMENT_METHODS = ['CARD', 'CASH'];

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seed() {
    try {
        console.log('[SEED] Starting direct data seeding with Prisma...');

        // 1. 기본 관리자 유저 확인 (ID: 1 가정)
        const adminUser = await prisma.users.findFirst({ where: { role: 'admin' } }) || { id: 1 };
        console.log(`[SEED] Using admin user ID: ${adminUser.id}`);

        for (const storeName of STORE_NAMES) {
            console.log(`[SEED] Processing store: ${storeName}`);

            // 2. 매장 생성 (중복 방지: 이름으로 확인)
            let store = await prisma.stores.findFirst({ where: { name: storeName } });
            if (!store) {
                store = await prisma.stores.create({
                    data: {
                        user_id: adminUser.id,
                        name: storeName,
                        address: `서울시 어딘가 ${getRandomInt(100, 999)}`,
                        phone: `010-${getRandomInt(1000, 9999)}-${getRandomInt(1000, 9999)}`,
                        description: 'Prisma 직접 시딩 테스트 매장'
                    }
                });
            }

            // 3. 카테고리 생성 (중복 방지)
            const categoriesMap = {};
            for (const catName of CATEGORIES) {
                let cat = await prisma.categories.findFirst({ where: { store_id: store.id, name: catName } });
                if (!cat) {
                    cat = await prisma.categories.create({
                        data: {
                            store_id: store.id,
                            name: catName,
                            sort_order: 1
                        }
                    });
                }
                categoriesMap[catName] = cat.id;
            }

            // 4. 상품 생성 (중복 방지)
            const storeProducts = [];
            const selectedProducts = PRODUCTS.sort(() => 0.5 - Math.random()).slice(0, getRandomInt(5, 8));
            for (const prod of selectedProducts) {
                let product = await prisma.products.findFirst({
                    where: { store_id: store.id, name: prod.name }
                });

                if (!product) {
                    product = await prisma.products.create({
                        data: {
                            store_id: store.id,
                            category_id: categoriesMap[prod.category],
                            name: prod.name,
                            price: prod.price,
                            is_active: true
                        }
                    });
                }
                storeProducts.push(product);
            }

            // 5. 주문 및 결제 생성 (매장당 20개)
            console.log(`[SEED] Creating 20 orders for ${storeName}...`);
            for (let i = 0; i < 20; i++) {
                const orderItems = [];
                const numItems = getRandomInt(1, 3);
                let totalAmount = 0;

                for (let j = 0; j < numItems; j++) {
                    const product = getRandomItem(storeProducts);
                    const qty = getRandomInt(1, 2);
                    orderItems.push({
                        product_id: product.id,
                        product_name: product.name,
                        quantity: qty,
                        price: product.price
                    });
                    totalAmount += product.price * qty;
                }

                const status = getRandomItem(ORDER_STATUSES);
                const method = getRandomItem(PAYMENT_METHODS);

                // Order 모델 직접 사용 (비동기 트랜잭션 검증)
                const order = await Order.create({
                    store_id: store.id,
                    items: orderItems,
                    total_amount: totalAmount,
                    status: status,
                    method: method,
                    customer_name: `Guest ${getRandomInt(1, 50)}`
                });

                // 결제 데이터 생성 (상태가 completed인 경우)
                if (status === 'completed') {
                    await Payment.create({
                        order_id: order.id,
                        store_id: store.id,
                        order_name: orderItems[0].product_name + (orderItems.length > 1 ? ` 외 ${orderItems.length - 1}건` : ''),
                        amount: totalAmount,
                        status: 'DONE',
                        payment_key: `fake_key_${Date.now()}_${getRandomInt(1000, 9999)}`
                    });

                    // 주문 상태를 'paid'로 업데이트 (Prisma 모델 활용)
                    await Order.updatePayment(order.id, method, 'paid');
                }
            }
        }

        console.log('[SEED] Direct seeding completed successfully!');
    } catch (err) {
        console.error('[SEED] Fatal Error during direct seeding:', err);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
