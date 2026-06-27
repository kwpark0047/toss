const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

async function seed() {
    try {
        console.log('[SEED] 종합 데모 데이터 생성을 시작합니다...');

        const hashedPassword = bcrypt.hashSync('admin1234', 10);

        // 1. 기본 관리자 생성
        const adminUser = await prisma.users.upsert({
            where: { email: 'admin@wemarket.com' },
            update: {},
            create: {
                name: '최고관리자',
                email: 'admin@wemarket.com',
                password: hashedPassword,
                role: 'admin'
            }
        });
        console.log(`[SEED] 관리자 계정 생성 완료: ${adminUser.email}`);

        // 2. 매장 관리자 및 매장 생성
        const demoStores = [
            {
                admin: { name: '강남 카페 사장님', email: 'gangnam@wemarket.com' },
                store: { name: 'WeMarket 카페 강남본점', address: '서울시 강남구 역삼동 123-45', phone: '02-555-1234', description: '향긋한 커피와 디저트가 있는 프리미엄 카페' },
                categories: ['커피', '논커피', '디저트'],
                products: [
                    { name: '시그니처 아메리카노', price: 4500, category: '커피', description: '산뜻한 산미와 묵직한 바디감의 조화', is_popular: 1, is_new: 1 },
                    { name: '콜드브루 바닐라빈 라떼', price: 5800, category: '커피', description: '천연 바닐라빈으로 숙성시킨 깊은 맛' },
                    { name: '제주 유자 에이드', price: 6000, category: '논커피', description: '상큼한 제주 유자가 듬뿍' },
                    { name: '생딸기 듬뿍 타르트', price: 7500, category: '디저트', description: '시즌 한정 싱싱한 딸기 타르트', is_popular: 1 },
                    { name: '벨기에 초코 와플', price: 6500, category: '디저트', description: '겉바속촉 리얼 초코 와플' }
                ],
                staff: [
                    { name: '이매니저', email: 'manager1@wemarket.com', role: 'manager' },
                    { name: '박알바', email: 'staff1@wemarket.com', role: 'staff' }
                ]
            },
            {
                admin: { name: '홍대 식당 사장님', email: 'hongdae@wemarket.com' },
                store: { name: 'WeMarket 키친 홍대점', address: '서울시 마포구 서교동 99-8', phone: '02-333-9876', description: '정갈한 한식과 트렌디한 퓨전 요리' },
                categories: ['메인메뉴', '사이드', '음료'],
                products: [
                    { name: '눈꽃 치즈 닭갈비', price: 13000, category: '메인메뉴', description: '매콤한 닭갈비 위에 고소한 치즈가 듬뿍', is_popular: 1 },
                    { name: '우삼겹 강된장 비빔밥', price: 11000, category: '메인메뉴', description: '구수한 강된장과 고소한 우삼겹의 만남', is_new: 1 },
                    { name: '바삭 해물 파전', price: 15000, category: '사이드', description: '해산물이 아낌없이 들어간 바삭한 파전' },
                    { name: '매콤 달콤 떡볶이', price: 6000, category: '사이드', description: '추억의 맛 그대로' },
                    { name: '살얼음 식혜', price: 3000, category: '음료', description: '직접 담근 시원한 식혜' }
                ],
                staff: [
                    { name: '김주방', email: 'kitchen1@wemarket.com', role: 'manager' }
                ]
            }
        ];

        for (const data of demoStores) {
            // 매장 관리자 생성
            const storeAdmin = await prisma.users.upsert({
                where: { email: data.admin.email },
                update: {},
                create: {
                    name: data.admin.name,
                    email: data.admin.email,
                    password: hashedPassword,
                    role: 'store_admin'
                }
            });

            // 매장 생성
            const store = await prisma.stores.create({
                data: {
                    ...data.store,
                    user_id: storeAdmin.id,
                    plan: 'pro'
                }
            });
            console.log(`[SEED] 매장 생성 완료: ${store.name}`);

            // 직원 생성
            for (const s of data.staff) {
                const staffUser = await prisma.users.upsert({
                    where: { email: s.email },
                    update: {},
                    create: {
                        name: s.name,
                        email: s.email,
                        password: hashedPassword,
                        role: 'staff'
                    }
                });
                await prisma.staff.upsert({
                    where: { store_id_user_id: { store_id: store.id, user_id: staffUser.id } },
                    update: { role: s.role },
                    create: {
                        store_id: store.id,
                        user_id: staffUser.id,
                        role: s.role
                    }
                });
            }

            // 카테고리 및 상품 생성
            const catMap = {};
            for (const catName of data.categories) {
                const cat = await prisma.categories.create({
                    data: { store_id: store.id, name: catName, sort_order: 1 }
                });
                catMap[catName] = cat.id;
            }

            const createdProducts = [];
            for (const p of data.products) {
                const product = await prisma.products.create({
                    data: {
                        store_id: store.id,
                        category_id: catMap[p.category],
                        name: p.name,
                        price: p.price,
                        description: p.description,
                        is_popular: p.is_popular || 0,
                        is_new: p.is_new || 0,
                        image_url: `https://loremflickr.com/320/240/food,${encodeURIComponent(p.name)}`
                    }
                });
                createdProducts.push(product);
            }

            // 테이블 생성
            for (let i = 1; i <= 8; i++) {
                await prisma.tables.create({
                    data: {
                        store_id: store.id,
                        table_number: `${i}번`,
                        qr_code: `QR-${store.id}-${i}-${Math.random().toString(36).substring(7)}`,
                        capacity: i % 2 === 0 ? 4 : 2,
                        x: (i - 1) % 4 * 150,
                        y: Math.floor((i - 1) / 4) * 150
                    }
                });
            }

            // 주방 데이터 (주문) 생성
            const statuses = ['pending', 'preparing', 'ready', 'completed'];
            for (let i = 0; i < 12; i++) {
                const status = statuses[i % 4];
                const itemsCount = Math.floor(Math.random() * 3) + 1;
                const orderItems = [];
                let total = 0;

                for (let j = 0; j < itemsCount; j++) {
                    const p = createdProducts[Math.floor(Math.random() * createdProducts.length)];
                    const qty = Math.floor(Math.random() * 2) + 1;
                    orderItems.push({
                        product_id: p.id,
                        product_name: p.name,
                        price: p.price,
                        quantity: qty
                    });
                    total += p.price * qty;
                }

                const order = await Order.create({
                    store_id: store.id,
                    items: orderItems,
                    total_amount: total,
                    status: status,
                    method: 'card',
                    customer_name: `고객 ${Date.now().toString().slice(-4)}-${i + 1}`,
                    is_takeout: i % 5 === 0 ? 1 : 0
                });

                if (status === 'completed' || status === 'ready' || status === 'preparing') {
                    await Payment.create({
                        order_id: order.id,
                        store_id: store.id,
                        amount: total,
                        status: 'DONE',
                        method: 'card',
                        payment_key: `demo_key_${Date.now()}_${i}`
                    });
                    await Order.updatePayment(order.id, 'card', 'paid');

                    if (status === 'preparing') {
                        await prisma.orders.update({ where: { id: order.id }, data: { preparing_at: new Date() } });
                    } else if (status === 'ready') {
                        await prisma.orders.update({ where: { id: order.id }, data: { preparing_at: new Date(Date.now() - 1000 * 60 * 10), ready_at: new Date() } });
                    }
                }
            }
        }

        console.log('[SEED] 모든 데모 데이터 생성이 성공적으로 완료되었습니다!');
    } catch (err) {
        console.error('[SEED] 시드 실행 중 치명적 오류 발생:', err);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
