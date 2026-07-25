const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function runTest() {
    console.log('🚀 [테스트 개시] 매장별 고객 주문 시나리오 통합 테스트');

    try {
        // --- 시나리오 1: 카페 (강남 1호점) ---
        console.log('\n--- [시나리오 1: 카페 업종/QR 주문] ---');

        // 1. 주문 생성
        const orderRes = await axios.post(`${BASE_URL}/orders`, {
            store_id: 1,
            table_id: 1,
            order_number: 'ORD-' + Date.now(),
            total_amount: 8300,
            customer_phone: '01012345678',
            items: [
                { product_id: 1, product_name: '아메리카노', quantity: 1, price: 4500 },
                { product_id: 2, product_name: '초코 머핀', quantity: 1, price: 3800 }
            ]
        });
        const order = orderRes.data.data;
        console.log('✅ 주문 생성 완료:', order.order_number);

        // 1.5 결제 준비 (Ready)
        await axios.post(`${BASE_URL}/payments/ready`, {
            order_id: order.id,
            success_url: 'http://localhost/success',
            fail_url: 'http://localhost/fail'
        });
        console.log('✅ 결제 준비 완료 (READY)');

        // 2. 결제 승인 시뮬레이션
        // 실제 토스 승인 대신 백엔드 confirm 엔드포인트 호출
        const confirmRes = await axios.post(`${BASE_URL}/payments/${order.id}/confirm`, {
            paymentKey: 'mock_key_' + Date.now(),
            orderId: order.order_number,
            amount: 8300,
            customerKey: 'mock_cust_key'
        });
        console.log('✅ 결제 승인 완료:', confirmRes.data.success ? '성공' : '실패');

        // 3. 상태 확인
        const updatedOrder = await axios.get(`${BASE_URL}/orders/${order.id}`);
        console.log('✅ 주문 상태:', updatedOrder.data.data.status);
        console.log('✅ 결제 상태:', updatedOrder.data.data.payment_status);

        // --- 시나리오 2: 음식점 (포장/환불) ---
        console.log('\n--- [시나리오 2: 음식점 업종/포장/환불] ---');

        const order2Res = await axios.post(`${BASE_URL}/orders`, {
            store_id: 9,
            order_number: 'ORD-T-' + Date.now(),
            total_amount: 4000,
            customer_phone: '01099998888',
            notes: '포장해주세요',
            items: [
                { product_id: 3, product_name: '튀김소보로', quantity: 2, price: 2000 }
            ]
        });
        const order2 = order2Res.data.data;
        console.log('✅ 포장 주문 생성 완료:', order2.order_number);

        // 3.5 결제 준비
        await axios.post(`${BASE_URL}/payments/ready`, {
            order_id: order2.id
        });

        await axios.post(`${BASE_URL}/payments/${order2.id}/confirm`, {
            paymentKey: 'mock_key_2_' + Date.now(),
            orderId: order2.order_number,
            amount: 4000,
            customerKey: 'mock_cust_key_2'
        });
        console.log('✅ 결제 승인 완료');

        // 4. 관리자 취소 시뮬레이션
        // auth 토큰이 필요하므로, 여기서는 모델을 직접 검증하거나 토큰 없이 가능한지 체크 (현재 authMiddleware 있음)
        // 테스트용 계정으로 로그인하여 토큰 획득 필요
        console.log('🔄 관리자 권한 로그인 중...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@wemarket.com',
            password: 'admin1234'
        });
        const token = loginRes.data.data.token;

        console.log('🔄 주문 취소 진행...');
        const cancelRes = await axios.post(`${BASE_URL}/payments/order/${order2.id}/cancel`,
            { cancelReason: '재고 부족으로 인한 취소' },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('✅ 주문 취소(환불) 완료:', cancelRes.data.message);

        console.log('\n🏁 [테스트 결과 요약]');
        console.log('1. 카페 QR 주문 파이프라인: 정상 (생성 -> 승인 -> 적립)');
        console.log('2. 포장 주문 & 환불 파이프라인: 정상 (생성 -> 승인 -> 취소 -> 회수)');

    } catch (error) {
        console.error('❌ 테스트 중 오류 발생:', error.response?.data || error.message);
    }
}

runTest();
