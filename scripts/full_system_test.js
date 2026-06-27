const axios = require('axios');
const io = require('socket.io-client');

const API_URL = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3000';

async function runTests() {
    console.log('🚀 [시스템 통합 테스트] 시작합니다...');

    try {
        // --- [사전 준비: 관리자 로그인] ---
        console.log('\n--- [Step 0] 관리자 인증 테스트 ---');
        const adminLogin = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'admin@wemarket.com',
            password: 'admin1234'
        });

        // [디버그] 로그인 응답 확인
        // console.log('📦 로그인 응답 데이터:', JSON.stringify(adminLogin.data, null, 2));

        const tokenData = adminLogin.data.data || adminLogin.data;
        const token = tokenData.token;
        console.log('✅ 관리자 로그인 성공');

        const config = { headers: { Authorization: `Bearer ${token}` } };


        // --- [환경 초기화: 품절 상태 해제] ---
        console.log('\n--- [Env Setup] 테스트 환경 초기화 (품절 해제) ---');
        const productsInitialResponse = await axios.get(`${API_URL}/api/products/store/1`);
        const initialProducts = productsInitialResponse.data.data || productsInitialResponse.data;

        for (const p of initialProducts) {
            if (p.is_sold_out) {
                await axios.put(`${API_URL}/api/products/${p.id}`, { is_sold_out: false }, config);
                console.log(`🔓 품절 해제: ${p.name}`);
            }
        }

        // --- [시나리오 1: 이용자 - 분할 결제 주문] ---
        console.log('\n--- [Step 1] 이용자 시나리오: 함께 결제하기 ---');

        // 1-0. 테스트용 상품 조회 (DB 데이터와 동기화)
        const productsResponse = await axios.get(`${API_URL}/api/products/store/1`);
        const storeProducts = productsResponse.data.data || productsResponse.data;

        // 활성 상품 필터링
        const activeProducts = storeProducts.filter(p => p.is_active && !p.is_sold_out);

        if (activeProducts.length < 2) {
            throw new Error('테스트를 위한 상품이 부족합니다. 최소 2개 이상의 판매 중인 상품이 필요합니다.');
        }

        const p1 = activeProducts[0];
        const p2 = activeProducts[1];
        console.log(`📡 실상품 데이터 사용: ${p1.name}(${p1.price}원), ${p2.name}(${p2.price}원)`);

        // 1-1. 주문 생성 (분할 결제 모드)
        const orderData = {
            store_id: 1,
            customer_name: '테스트 고객',
            customer_phone: '01012345678',
            payment_method: 'card',
            items: [
                { product_id: p1.id, product_name: p1.name, price: p1.price, quantity: 1, user_phone: '01011112222' },
                { product_id: p2.id, product_name: p2.name, price: p2.price, quantity: 1, user_phone: '01033334444' }
            ],
            total_amount: p1.price + p2.price,
            is_split_payment: true,
            split_type: 'ITEM'
        };

        const orderResponse = await axios.post(`${API_URL}/api/orders`, orderData);
        // console.log('📦 주문 생성 응답 데이터:', JSON.stringify(orderResponse.data, null, 2));

        const order = orderResponse.data.data || orderResponse.data.order;
        if (!order) {
            throw new Error(`주문 생성 실패: 응답에서 주문 정보를 찾을 수 없습니다. (${JSON.stringify(orderResponse.data)})`);
        }
        const orderId = order.id;
        const orderNumber = order.order_number;
        console.log(`✅ 분할 결제 주문 생성 완료 (ID: ${orderId}, 번호: ${orderNumber})`);

        // 1-2. 부분 결제 시뮬레이션
        console.log(`🔄 부분 결제 진행 중 (${p1.price}원)...`);
        const paymentReady = await axios.post(`${API_URL}/api/payments/ready`, {
            order_id: orderId,
            amount: p1.price,
            order_name: `${p1.name} (분할결제)`,
            payer_phone: '01011112222',
            is_partial: true,
            method: 'CARD'
        });

        const paymentData = paymentReady.data.data || paymentReady.data;
        const paymentId = paymentData.paymentId;
        console.log(`✅ 결제 대기 레코드 생성 완료 (ID: ${paymentId})`);

        // 상태 확인
        const checkOrderPartial = await axios.get(`${API_URL}/api/orders/${orderId}`, config);
        const currentOrder = checkOrderPartial.data.data || checkOrderPartial.data.order || checkOrderPartial.data;
        console.log(`✅ 현재 주문 상태: ${currentOrder.payment_status} (확인 완료)`);

        // --- [시나리오 2: 주방 - 조리 상태 변경 및 품절 관리] ---
        console.log('\n--- [Step 2] 주방 시나리오: 주문 처리 및 품절 관리 ---');

        // 2-1. 주문 상태 변경 (Preparing)
        await axios.put(`${API_URL}/api/orders/${orderId}/status`, { status: 'preparing' }, config);
        console.log('✅ 주문 상태 변경 완료: 조리 시작');

        // 2-2. 특정 상품 품절 처리
        const updateProduct = await axios.put(`${API_URL}/api/products/${p1.id}`, { is_sold_out: true }, config);
        const prodData = updateProduct.data.data || updateProduct.data;
        console.log(`✅ 상품 품절 처리 완료: ${prodData.name} (Sold Out)`);

        // --- [시나리오 3: 관리자 - 실시간 알림 및 통계] ---
        console.log('\n--- [Step 3] 관리자 시나리오: 알림 수신 및 데이터 확인 ---');

        // 3-1. 매출 통계 조회
        const today = new Date().toISOString().split('T')[0];
        const statsResponse = await axios.get(`${API_URL}/api/analytics/store/1/sales?start_date=${today}&end_date=${today}`, config);
        const stats = statsResponse.data.data || statsResponse.data;

        // 요약 정보 필드 유연하게 접근
        const summary = stats.summary || stats;
        const totalSales = summary.total_sales !== undefined ? summary.total_sales : summary.today_sales;

        console.log(`✅ 매출 통계 조회 성공 (오늘 매출: ${totalSales}원)`);

        console.log('\n✨ 모든 시나리오 테스트가 성공적으로 완료되었습니다.');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ 테스트 중 오류 발생:');
        if (err.response) {
            console.log('📦 오류 응답 데이터:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err.message);
        }
        process.exit(1);
    }
}

runTests();
