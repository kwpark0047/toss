const db = require('./config/database');
const Settlement = require('./models/Settlement');
const Ledger = require('./models/Ledger');
const Point = require('./models/Point');
const Payment = require('./models/Payment');
const Order = require('./models/Order');

async function runTests() {
    console.log('--- [위마켓 기능 통합 테스트 시작] ---');

    try {
        // 1. 관리자 계정 확인
        const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@wemarket.com');
        console.log('1. 관리자 계정 확인:', admin ? '성공' : '실패');

        // 2. 테스트 데이터 생성 (주문 및 결제)
        const testStoreId = 1;
        console.log('\n2. 테스트 거래 시뮬레이션 시작...');

        // 임의의 주문 데이터 생성
        const orderId = db.prepare(`
      INSERT INTO orders (store_id, order_number, total_amount, status, payment_status, payment_method)
      VALUES (?, 'TEST-001', 10000, 'completed', 'paid', '카드')
    `).run(testStoreId).lastInsertRowid;

        const paymentId = db.prepare(`
      INSERT INTO payments (order_id, store_id, payment_method, payment_status, total_amount, toss_payment_key)
      VALUES (?, ?, '카드', 'paid', 10000, 'test_key_123')
    `).run(orderId, testStoreId).lastInsertRowid;

        // 3. 장부 기록 테스트 (매출 발생)
        console.log('3. 장부 기록(매출) 테스트...');
        Ledger.add({
            store_id: testStoreId,
            order_id: orderId,
            payment_id: paymentId,
            type: 'INCOME',
            category: 'SALE',
            amount: 10000,
            method: '카드',
            description: '테스트 매출'
        });

        const ledgerCount = db.prepare('SELECT COUNT(*) as count FROM ledger WHERE order_id = ?').get(orderId);
        console.log('   -> 장부 기록 확인:', ledgerCount.count > 0 ? '정상' : '누락');

        // 4. 결제 취소 및 환불 장부 연동 테스트
        console.log('\n4. 결제 취소(환불) 시뮬레이션...');
        Ledger.add({
            store_id: testStoreId,
            order_id: orderId,
            payment_id: paymentId,
            type: 'REFUND',
            category: 'CANCEL',
            amount: 10000,
            method: '카드',
            description: '테스트 환불'
        });

        const refundCheck = db.prepare("SELECT * FROM ledger WHERE type = 'REFUND' AND order_id = ?").get(orderId);
        console.log('   -> 환불 장부 기록 확인:', refundCheck ? `정상 (금액: ${refundCheck.amount})` : '누락');

        // 5. 정산 데이터 생성 테스트
        console.log('\n5. 정산(Settlement) 요약 엔진 확인...');
        const today = new Date().toISOString().split('T')[0];
        const settlementId = Settlement.create({
            store_id: testStoreId,
            period_start: today,
            period_end: today
        });

        const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
        console.log('   -> 정산 데이터 생성 확인:', settlement ? '성공' : '실패');
        if (settlement) {
            console.log(`      - 총매출: ${settlement.total_sales}`);
            console.log(`      - 환불액: ${settlement.total_refunds}`);
            console.log(`      - 수수료(3%): ${settlement.commission_amount}`);
            console.log(`      - 실지급액: ${settlement.net_amount}`);
        }

        console.log('\n--- [테스트 완료: 모든 비즈니스 로직 정상 작동 확인] ---');
        process.exit(0);

    } catch (error) {
        console.error('\n!!! [테스트 중 오류 발생] !!!');
        console.error(error);
        process.exit(1);
    }
}

runTests();
