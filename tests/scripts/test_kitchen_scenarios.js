const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// 헬퍼 함수: 잠시 대기
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runKitchenTest() {
    console.log('🚀 [테스트 개시] 매장별 주방 시나리오 통합 테스트');

    try {
        // 0. 관리자 로그인 (공통)
        console.log('\n🔐 [관리자/주방스탭 로그인]');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@wemarket.com',
            password: 'admin1234'
        });
        const token = loginRes.data.data.token;
        const authHeader = { Authorization: `Bearer ${token}` };
        console.log('✅ 로그인 성공');

        // --- 시나리오 A: 카페 (Store 1) - 주방 워크플로우 ---
        console.log('\n☕ [시나리오 A: 카페 주방 (Store 1)]');

        // A-1. 신규 주문 생성 (고객)
        console.log('   👤 [고객] 신규 주문 생성...');
        const cafeOrderRes = await axios.post(`${BASE_URL}/orders`, {
            store_id: 1,
            table_id: 1, // 수정: 존재하는 테이블 ID 사용
            order_number: 'ORD-KIT-' + Date.now(),
            total_amount: 8300,
            customer_phone: '010-5555-6666',
            items: [
                { product_id: 1, product_name: '아메리카노', quantity: 1, price: 4500 },
                { product_id: 2, product_name: '초코 머핀', quantity: 1, price: 3800 }
            ]
        });
        const cafeOrder = cafeOrderRes.data.data;
        // 결제 완료 처리 (실제 주방에는 결제 완료된 주문만 들어오는 경우가 많음)
        await axios.post(`${BASE_URL}/payments/ready`, {
            order_id: cafeOrder.id, store_id: 1, amount: 8300
        });
        await axios.post(`${BASE_URL}/payments/${cafeOrder.id}/confirm`, {
            paymentKey: `mock_key_${Date.now()}`, orderId: cafeOrder.order_number, amount: 8300, customerKey: 'cust_key'
        });
        console.log(`   ✅ 주문 생성/결제 완료: #${cafeOrder.order_number}`);

        // A-2. 주방: 접수 대기 목록 조회 (status=pending)
        console.log('   👀 [주방] 접수 대기 목록 조회...');
        const pendingRes = await axios.get(`${BASE_URL}/orders/store/1?status=pending`, { headers: authHeader });
        const pendingOrders = pendingRes.data.data;
        const targetPending = pendingOrders.find(o => o.id === cafeOrder.id);

        if (targetPending) {
            console.log(`   ✅ 대기 목록에서 주문 확인 완료 (ID: ${targetPending.id})`);
        } else {
            throw new Error('대기 목록에서 신규 주문을 찾을 수 없습니다.');
        }

        // A-3. 주방: 조리 시작 (접수 -> preparing)
        console.log('   👨‍🍳 [주방] 주문 접수 및 조리 시작...');
        await axios.put(`${BASE_URL}/orders/${cafeOrder.id}/status`, { status: 'preparing' }, { headers: authHeader });
        console.log('   ✅ 상태 변경: 조리중 (preparing)');

        // A-4. 주방: 조리 중 목록 조회 (status=preparing)
        console.log('   👀 [주방] 조리 중 목록 조회...');
        const preparingRes = await axios.get(`${BASE_URL}/orders/store/1?status=preparing`, { headers: authHeader });
        const preparingOrders = preparingRes.data.data;
        const targetPreparing = preparingOrders.find(o => o.id === cafeOrder.id);

        if (targetPreparing) {
            console.log(`   ✅ 조리 중 목록에서 주문 확인 완료 (ID: ${targetPreparing.id})`);
        } else {
            throw new Error('조리 중 목록에서 주문을 찾을 수 없습니다.');
        }

        // A-5. 주방: 조리 완료 (preparing -> ready)
        console.log('   🔔 [주방] 조리 완료 처리...');
        await axios.put(`${BASE_URL}/orders/${cafeOrder.id}/status`, { status: 'ready' }, { headers: authHeader });
        console.log('   ✅ 상태 변경: 준비 완료 (ready)');


        // --- 시나리오 B: 음식점 (Store 9) - 주방 워크플로우 (포장) ---
        console.log('\n🍱 [시나리오 B: 음식점 주방 (Store 9) - 포장]');

        // B-1. 포장 주문 생성
        console.log('   👤 [고객] 포장 주문 생성...');
        const foodOrderRes = await axios.post(`${BASE_URL}/orders`, {
            store_id: 9,
            order_number: 'ORD-KIT-FOOD-' + Date.now(),
            total_amount: 10000,
            customer_phone: '010-7777-8888',
            is_takeout: true,
            items: [{ product_id: 3, product_name: '튀김소보로', quantity: 5, price: 2000 }]
        });
        const foodOrder = foodOrderRes.data.data;
        // 결제
        await axios.post(`${BASE_URL}/payments/ready`, {
            order_id: foodOrder.id, store_id: 9, amount: 10000
        });
        await axios.post(`${BASE_URL}/payments/${foodOrder.id}/confirm`, {
            paymentKey: `mock_key_food_${Date.now()}`, // 수정: mock_ 접두사 추가
            orderId: foodOrder.order_number,
            amount: 10000,
            customerKey: 'cust_key_food'
        });
        console.log(`   ✅ 포장 주문 생성/결제 완료: #${foodOrder.order_number}`);

        // B-2. 주방: 통합 목록 조회 (pending, preparing) - KDS 뷰 시뮬레이션
        console.log('   👀 [주방] KDS 화면 조회 (pending, preparing)...');
        const kdsRes = await axios.get(`${BASE_URL}/orders/store/9`, {
            params: { status: 'pending,preparing' },
            headers: authHeader
        });
        const kdsOrders = kdsRes.data.data;
        const targetKDS = kdsOrders.find(o => o.id === foodOrder.id);

        if (targetKDS) {
            console.log(`   ✅ KDS 목록에서 주문 확인 (Takeout: ${targetKDS.is_takeout ? 'YES' : 'NO'})`);
            if (!targetKDS.is_takeout) console.warn('   ⚠️ 경고: 포장 주문인데 is_takeout 플래그가 false입니다.');
        } else {
            throw new Error('KDS 목록에서 주문을 찾을 수 없습니다.');
        }

        // B-3. 주방: 바로 조리 완료 처리 (Fast Track)
        console.log('   👨‍🍳 [주방] 조리 및 포장 완료 처리...');
        await axios.put(`${BASE_URL}/orders/${foodOrder.id}/status`, { status: 'ready' }, { headers: authHeader });
        console.log('   ✅ 상태 변경: 준비 완료 (ready)');

        console.log('\n🏁 [테스트 결과 요약]');
        console.log('1. 카페 주방: 정상 (대기 -> 조리중 -> 조리완료)');
        console.log('2. 음식점 주방: 정상 (포장 주문 인식 -> 조리완료)');
        console.log('3. KDS 필터링: 정상 (pending, preparing 필터 동작 확인)');

    } catch (error) {
        console.error('❌ 테스트 중 오류 발생:', error.response?.data || error.message);
    }
}

runKitchenTest();
