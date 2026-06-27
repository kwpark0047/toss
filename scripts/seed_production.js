const axios = require('axios');

// const API_URL = 'https://wemarket.onrender.com/api';
const API_URL = 'http://localhost:3000/api'; // 로컬 테스트용

const ADMIN_EMAIL = 'admin@wemarket.com';
const ADMIN_PASSWORD = 'admin1234';

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
const PAYMENT_METHODS = ['카드', '현금', '토스페이', '카카오페이'];

// 랜덤 유틸리티
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 날짜 유틸리티 (최근 7일 내 랜덤)
const getRandomDate = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
};

async function seed() {
    try {
        console.log(`[SEED] Starting data seeding to ${API_URL}...`);

        // 1. 관리자 로그인
        console.log('[SEED] Logging in as admin...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        const { token, user } = loginRes.data.data ? loginRes.data.data : loginRes.data;

        if (!token) throw new Error('Token not found in login response');
        console.log(`[SEED] Login successful. Token acquired.`);

        const authHeaders = { Authorization: `Bearer ${token}` };

        // 2. 매장 생성
        const stores = [];
        for (const storeName of STORE_NAMES) {
            try {
                console.log(`[SEED] Creating store: ${storeName}`);
                const storeRes = await axios.post(`${API_URL}/stores`, {
                    name: storeName,
                    address: `서울시 강남구 테헤란로 ${getRandomInt(100, 900)}`,
                    phone: `02-${getRandomInt(1000, 9999)}-${getRandomInt(1000, 9999)}`,
                    description: '테스트용 자동 생성 매장입니다.'
                }, { headers: authHeaders });

                const store = storeRes.data.data || storeRes.data;
                stores.push(store);

                // 3. 카테고리 & 상품 등록
                const categories = {};
                for (const catName of CATEGORIES) {
                    const catRes = await axios.post(`${API_URL}/categories`, {
                        store_id: store.id,
                        name: catName,
                        sort_order: 1
                    }, { headers: authHeaders });
                    categories[catName] = catRes.data.data || catRes.data;
                }

                const storeProducts = [];
                // 매장당 5~8개 상품 랜덤 선택
                const selectedProducts = PRODUCTS.sort(() => 0.5 - Math.random()).slice(0, getRandomInt(5, 8));

                for (const prod of selectedProducts) {
                    const prodRes = await axios.post(`${API_URL}/products`, {
                        store_id: store.id,
                        category_id: categories[prod.category].id,
                        name: prod.name,
                        price: prod.price,
                        description: `${prod.name} 설명`,
                        image_url: '/placeholder.jpg',
                        is_active: true
                    }, { headers: authHeaders });
                    storeProducts.push(prodRes.data.data || prodRes.data);
                }

                // 4. 주문 및 결제 생성 (매장당 20개)
                console.log(`[SEED] Creating 20 orders for store ${storeName}...`);
                for (let i = 0; i < 20; i++) {
                    // 상품 1~3개 랜덤 선택
                    const orderItems = [];
                    const numItems = getRandomInt(1, 3);
                    let totalAmount = 0;

                    for (let j = 0; j < numItems; j++) {
                        const product = getRandomItem(storeProducts);
                        const quantity = getRandomInt(1, 2);
                        orderItems.push({
                            product_id: product.id,
                            product_name: product.name,
                            quantity: quantity,
                            price: product.price,
                            options: []
                        });
                        totalAmount += product.price * quantity;
                    }

                    const orderStatus = getRandomItem(ORDER_STATUSES);
                    const paymentMethod = getRandomItem(PAYMENT_METHODS);

                    // 1. 통합 결제 API 활용 (주문+결제 동시 생성 모델 시뮬레이션)
                    // 현재 routes/payments.js의 POST / 라우트는 주문과 결제를 동시에 처리함
                    const payload = {
                        store_id: store.id,
                        items: orderItems,
                        total_amount: totalAmount,
                        payment_method: paymentMethod.toLowerCase() === '카드' ? 'card' :
                            paymentMethod.toLowerCase() === '현금' ? 'cash' :
                                paymentMethod.toLowerCase() === '토스페이' ? 'card' : 'cash',
                        customer_name: `Test User ${getRandomInt(1, 100)}`,
                        phone: `010${getRandomInt(1000, 9999)}${getRandomInt(1000, 9999)}`
                    };

                    try {
                        const payRes = await axios.post(`${API_URL}/payments`, payload);
                        const data = payRes.data.data || payRes.data;
                        const orderId = data.order_id;

                        // 2. 주문 상태 시뮬레이션 (랜덤 상태 업데이트)
                        if (orderStatus !== 'pending') {
                            await axios.put(`${API_URL}/orders/${orderId}/status`, { status: orderStatus }, { headers: authHeaders });
                        }
                    } catch (payErr) {
                        console.error(`[SEED] Order creation failed for ${storeName}:`, payErr.response?.data || payErr.message);
                    }
                }

            } catch (err) {
                console.error(`[SEED] Failed for store ${storeName}:`, err.response?.data || err.message);
            }
        }

        console.log('[SEED] All Finished!');

    } catch (error) {
        console.error('[SEED] Fatal Error:', error.response?.data || error.message);
    }
}

seed();
