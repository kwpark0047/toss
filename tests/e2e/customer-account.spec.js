// 이용자(Customer) 계정 전체 기능 E2E 테스트
// 시나리오: 회원가입 → 로그인 → 주문 → 주문이력 → 포인트 → 리뷰 → 예약 → 대기열 → 유효성검증
const { test, expect } = require('@playwright/test');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// 백엔드 DB 경로
const DB_PATH = path.join(__dirname, '..', '..', 'wemarket.db');
const BASE = 'http://localhost:3000/api';

test.describe.serial('Customer Account Features', () => {
    let customerToken;     // 이용자 인증 토큰
    let ownerToken;        // 점주 인증 토큰
    let storeId;           // 테스트 매장 ID
    let productId1;        // 상품 ID
    let productId2;        // 상품 ID
    let orderId;           // 주문 ID
    let reviewId;          // 리뷰 ID
    let reservationId;     // 예약 ID
    let waitingId;         // 대기 ID
    let db;

    // 고유 테스트 데이터
    const TS = Date.now();
    const CUSTOMER_EMAIL = `cust_${TS}@test.com`;
    const CUSTOMER_NAME = `TestCustomer_${TS}`;
    const CUSTOMER_PHONE = `010-${String(TS).slice(-4)}-${String(TS).slice(-8, -4)}`;
    const OWNER_EMAIL = `cust_owner_${TS}@test.com`;
    const PASSWORD = 'password123';

    // ─── 사전 준비: 점주 계정 + 매장 + 상품 ───
    test.beforeAll(async () => {
        db = new Database(DB_PATH);
        const hashed = bcrypt.hashSync(PASSWORD, 10);

        // 점주 계정 생성 (better-sqlite3)
        db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
            .run('Cust Test Owner', OWNER_EMAIL, hashed, 'manager');
        console.log(`[Setup] 점주 생성: ${OWNER_EMAIL}`);
    });

    // ───────────────────────────────
    // 테스트 1: 회원가입 + 로그인 + 내 정보 조회
    // ───────────────────────────────
    test('1. 회원가입 + 로그인 + 내 정보 조회', async ({ request }) => {
        // 1-1. 점주 로그인 (매장 생성에 필요)
        const ownerLogin = await request.post(`${BASE}/auth/login`, {
            data: { email: OWNER_EMAIL, password: PASSWORD }
        });
        expect(ownerLogin.ok()).toBeTruthy();
        ownerToken = (await ownerLogin.json()).data.token;

        // 1-2. 매장 생성
        const storeRes = await request.post(`${BASE}/stores`, {
            headers: { Authorization: `Bearer ${ownerToken}` },
            data: { name: `Customer Test Cafe ${TS}`, address: 'Seoul Test', phone: '010-0000-0000', business_type: 'cafe' }
        });
        expect(storeRes.ok()).toBeTruthy();
        storeId = (await storeRes.json()).data.id;
        console.log(`[Store] 매장 생성: ID=${storeId} ✅`);

        // 1-3. 카테고리 + 상품 생성 (DB 직접 삽입)
        const cat = db.prepare('INSERT INTO categories (store_id, name, sort_order) VALUES (?, ?, ?)').run(storeId, '음료', 1);
        const catId = cat.lastInsertRowid;
        productId1 = Number(db.prepare('INSERT INTO products (store_id, category_id, name, price, is_active, is_sold_out) VALUES (?, ?, ?, ?, 1, 0)').run(storeId, catId, '아메리카노', 4500).lastInsertRowid);
        productId2 = Number(db.prepare('INSERT INTO products (store_id, category_id, name, price, is_active, is_sold_out) VALUES (?, ?, ?, ?, 1, 0)').run(storeId, catId, '카페라떼', 5000).lastInsertRowid);
        console.log(`[Setup] 상품 생성: ${productId1}, ${productId2} ✅`);

        // 1-4. 이용자 회원가입 (API)
        const registerRes = await request.post(`${BASE}/auth/register`, {
            data: { name: CUSTOMER_NAME, email: CUSTOMER_EMAIL, password: PASSWORD }
        });
        if (!registerRes.ok()) {
            console.log('[Register] Failed:', registerRes.status(), await registerRes.text());
        }
        expect(registerRes.ok()).toBeTruthy();
        const regData = await registerRes.json();
        expect(regData.data.email).toBe(CUSTOMER_EMAIL);
        console.log('[Auth] 회원가입 성공 ✅');

        // 1-5. 이용자 로그인
        const loginRes = await request.post(`${BASE}/auth/login`, {
            data: { email: CUSTOMER_EMAIL, password: PASSWORD }
        });
        expect(loginRes.ok()).toBeTruthy();
        const loginData = await loginRes.json();
        customerToken = loginData.data.token;
        expect(loginData.data.user.email).toBe(CUSTOMER_EMAIL);
        console.log('[Auth] 로그인 성공 ✅');

        // 1-6. 내 정보 조회
        const meRes = await request.get(`${BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });
        expect(meRes.ok()).toBeTruthy();
        const meData = await meRes.json();
        expect(meData.data.email).toBe(CUSTOMER_EMAIL);
        console.log('[Auth] 내 정보 조회 성공 ✅');
    });

    // ───────────────────────────────
    // 테스트 2: 주문 생성
    // ───────────────────────────────
    test('2. 주문 생성', async ({ request }) => {
        // 주문 생성 (공개 API — 인증 불필요)
        const orderRes = await request.post(`${BASE}/orders`, {
            data: {
                store_id: storeId,
                total_amount: 14000,  // 아메리카노(4500×2) + 카페라떼(5000×1) = 14000
                payment_method: 'card',
                customer_name: CUSTOMER_NAME,
                phone: CUSTOMER_PHONE,
                items: [
                    { product_id: productId1, product_name: '아메리카노', quantity: 2, price: 4500 },
                    { product_id: productId2, product_name: '카페라떼', quantity: 1, price: 5000 }
                ]
            }
        });
        if (!orderRes.ok()) {
            console.log('[Order] Create Failed:', orderRes.status(), await orderRes.text());
        }
        expect(orderRes.ok()).toBeTruthy();
        const orderData = await orderRes.json();
        orderId = orderData.order?.id || orderData.data?.id;
        expect(orderId).toBeTruthy();
        console.log(`[Order] 주문 생성 성공: ID=${orderId} ✅`);
    });

    // ───────────────────────────────
    // 테스트 3: 주문 이력/상세 조회
    // ───────────────────────────────
    test('3. 주문 이력 및 상세 조회', async ({ request }) => {
        // 3-1. 고객 주문 이력 조회 (전화번호 기반)
        const histRes = await request.get(`${BASE}/orders/customer/history?phone=${encodeURIComponent(CUSTOMER_PHONE)}`);
        if (!histRes.ok()) {
            console.log('[History] Failed:', histRes.status(), await histRes.text());
        }
        expect(histRes.ok()).toBeTruthy();
        const histData = await histRes.json();
        const orders = histData.data || histData;
        expect(Array.isArray(orders)).toBeTruthy();
        console.log(`[Order] 주문 이력 조회: ${orders.length}건 ✅`);

        // 3-2. 주문 상세 조회
        const detailRes = await request.get(`${BASE}/orders/${orderId}`);
        if (!detailRes.ok()) {
            console.log('[Detail] Failed:', detailRes.status(), await detailRes.text());
        }
        expect(detailRes.ok()).toBeTruthy();
        const detailData = await detailRes.json();
        const order = detailData.data || detailData;
        expect(order.id).toBe(orderId);
        console.log(`[Order] 주문 상세 조회 성공: 금액=${order.total_amount} ✅`);
    });

    // ───────────────────────────────
    // 테스트 4: 포인트 조회 (잔액, 이력, 월렛)
    // ───────────────────────────────
    test('4. 포인트 잔액/이력/월렛 조회', async ({ request }) => {
        // 4-1. 포인트 잔액 조회 (인증 필요)
        const balRes = await request.get(`${BASE}/points/balance`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });
        if (!balRes.ok()) {
            console.log('[Points Balance] Failed:', balRes.status(), await balRes.text());
        }
        expect(balRes.ok()).toBeTruthy();
        const balData = await balRes.json();
        console.log(`[Points] 잔액 조회: ${JSON.stringify(balData).substring(0, 100)} ✅`);

        // 4-2. 포인트 이력 조회 (인증 필요)
        const histRes = await request.get(`${BASE}/points/history`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });
        if (!histRes.ok()) {
            console.log('[Points History] Failed:', histRes.status(), await histRes.text());
        }
        expect(histRes.ok()).toBeTruthy();
        console.log('[Points] 이력 조회 성공 ✅');

        // 4-3. 월렛 조회 (비로그인 — 전화번호 기반)
        const walletRes = await request.get(`${BASE}/points/wallet-lookup?phone=${encodeURIComponent(CUSTOMER_PHONE)}`);
        if (!walletRes.ok()) {
            console.log('[Wallet] Failed:', walletRes.status(), await walletRes.text());
        }
        expect(walletRes.ok()).toBeTruthy();
        console.log('[Points] 월렛 조회 성공 ✅');

        // 4-4. 포인트 설정 조회 (공개)
        const settingsRes = await request.get(`${BASE}/points/settings/${storeId}`);
        if (!settingsRes.ok()) {
            console.log('[Points Settings] Failed:', settingsRes.status(), await settingsRes.text());
        }
        expect(settingsRes.ok()).toBeTruthy();
        console.log('[Points] 매장 포인트 설정 조회 성공 ✅');
    });

    // ───────────────────────────────
    // 테스트 5: 리뷰 등록 + 좋아요 + 피드
    // ───────────────────────────────
    test('5. 리뷰 등록 + 좋아요 + 피드 조회', async ({ request }) => {
        // 5-1. 리뷰 등록 (공개 API)
        const reviewRes = await request.post(`${BASE}/reviews`, {
            data: {
                store_id: storeId,
                order_id: orderId,
                customer_name: CUSTOMER_NAME,
                customer_phone: CUSTOMER_PHONE,
                rating: 5,
                content: '정말 맛있는 커피였습니다! 추천합니다.'
            }
        });
        if (!reviewRes.ok()) {
            console.log('[Review] Create Failed:', reviewRes.status(), await reviewRes.text());
        }
        expect(reviewRes.ok()).toBeTruthy();
        const reviewData = await reviewRes.json();
        reviewId = reviewData.data.id;
        console.log(`[Review] 리뷰 등록 성공: ID=${reviewId} ✅`);

        // 5-2. 리뷰 좋아요
        const likeRes = await request.post(`${BASE}/reviews/${reviewId}/like`, {
            data: { user_phone: CUSTOMER_PHONE }
        });
        expect(likeRes.ok()).toBeTruthy();
        const likeData = await likeRes.json();
        expect(likeData.action).toBe('liked');
        console.log('[Review] 좋아요 성공 ✅');

        // 5-3. 좋아요 취소 (토글)
        const unlikeRes = await request.post(`${BASE}/reviews/${reviewId}/like`, {
            data: { user_phone: CUSTOMER_PHONE }
        });
        expect(unlikeRes.ok()).toBeTruthy();
        const unlikeData = await unlikeRes.json();
        expect(unlikeData.action).toBe('unliked');
        console.log('[Review] 좋아요 취소 (토글) 성공 ✅');

        // 5-4. 매장 리뷰 목록 조회
        const storeReviewRes = await request.get(`${BASE}/reviews/store/${storeId}`);
        expect(storeReviewRes.ok()).toBeTruthy();
        const storeReviews = await storeReviewRes.json();
        expect(storeReviews.data.length).toBeGreaterThan(0);
        console.log(`[Review] 매장 리뷰 조회: ${storeReviews.data.length}건 ✅`);

        // 5-5. 소셜 피드 조회
        const feedRes = await request.get(`${BASE}/reviews/feed`);
        expect(feedRes.ok()).toBeTruthy();
        console.log('[Review] 소셜 피드 조회 성공 ✅');
    });

    // ───────────────────────────────
    // 테스트 6: 예약 신청 + 조회
    // ───────────────────────────────
    test('6. 예약 신청 + 내 예약 조회', async ({ request }) => {
        // 6-1. 예약 신청 (공개 API)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(18, 0, 0, 0);

        const resRes = await request.post(`${BASE}/reservations/register`, {
            data: {
                store_id: storeId,
                customer_name: CUSTOMER_NAME,
                customer_phone: CUSTOMER_PHONE,
                party_size: 4,
                reservation_time: tomorrow.toISOString(),
                notes: '창가 좌석 요청'
            }
        });
        if (!resRes.ok()) {
            console.log('[Reservation] Register Failed:', resRes.status(), await resRes.text());
        }
        expect(resRes.ok()).toBeTruthy();
        const resData = await resRes.json();
        reservationId = resData.data.id;
        expect(resData.data.status).toBe('PENDING');
        console.log(`[Reservation] 예약 신청 성공: ID=${reservationId} ✅`);

        // 6-2. 내 예약 조회
        const myRes = await request.get(`${BASE}/reservations/my/${encodeURIComponent(CUSTOMER_PHONE)}`);
        expect(myRes.ok()).toBeTruthy();
        const myData = await myRes.json();
        const found = myData.data.find(r => r.id === reservationId);
        expect(found).toBeTruthy();
        expect(found.status).toBe('PENDING');
        console.log(`[Reservation] 내 예약 조회: ${myData.data.length}건 ✅`);
    });

    // ───────────────────────────────
    // 테스트 7: 대기열 등록 + 조회 + 취소
    // ───────────────────────────────
    test('7. 대기열 등록 + 조회 + 취소', async ({ request }) => {
        // 7-1. 대기 등록 (공개 API)
        const waitRes = await request.post(`${BASE}/waiting/register`, {
            data: {
                store_id: storeId,
                customer_name: CUSTOMER_NAME,
                customer_phone: CUSTOMER_PHONE,
                party_size: 2
            }
        });
        if (!waitRes.ok()) {
            console.log('[Waiting] Register Failed:', waitRes.status(), await waitRes.text());
        }
        expect(waitRes.ok()).toBeTruthy();
        const waitData = await waitRes.json();
        waitingId = waitData.data.id;
        expect(waitData.data.status).toBe('waiting');
        console.log(`[Waiting] 대기 등록 성공: 번호=${waitData.data.queue_number} ✅`);

        // 7-2. 내 대기 상태 조회
        const myWaitRes = await request.get(`${BASE}/waiting/my/${encodeURIComponent(CUSTOMER_PHONE)}`);
        expect(myWaitRes.ok()).toBeTruthy();
        const myWaitData = await myWaitRes.json();
        const myWait = myWaitData.data.find(w => w.id === waitingId);
        expect(myWait).toBeTruthy();
        expect(myWait.ahead_count >= 0).toBeTruthy();
        console.log(`[Waiting] 내 대기 조회: 앞에 ${myWait.ahead_count}팀 ✅`);

        // 7-3. 대기 현황 조회 (공개)
        const statusRes = await request.get(`${BASE}/waiting/store/${storeId}/status`);
        expect(statusRes.ok()).toBeTruthy();
        const statusData = await statusRes.json();
        expect(statusData.waiting_teams).toBeGreaterThanOrEqual(1);
        console.log(`[Waiting] 매장 대기 현황: ${statusData.waiting_teams}팀 ✅`);

        // 7-4. 대기 취소 (고객)
        const cancelRes = await request.patch(`${BASE}/waiting/${waitingId}/status`, {
            data: { status: 'cancelled' }
        });
        expect(cancelRes.ok()).toBeTruthy();
        const cancelData = await cancelRes.json();
        expect(cancelData.data.status).toBe('cancelled');
        console.log('[Waiting] 대기 취소 성공 ✅');
    });

    // ───────────────────────────────
    // 테스트 8: 회원가입 유효성 검증
    // ───────────────────────────────
    test('8. 회원가입 유효성 검증 (중복/짧은 비밀번호/필수 누락)', async ({ request }) => {
        // 8-1. 이메일 중복
        const dupRes = await request.post(`${BASE}/auth/register`, {
            data: { name: 'Dup User', email: CUSTOMER_EMAIL, password: PASSWORD }
        });
        expect(dupRes.ok()).toBeFalsy();
        expect(dupRes.status()).toBe(409);
        console.log('[Validation] 이메일 중복 거부 (409) ✅');

        // 8-2. 짧은 비밀번호
        const shortPwRes = await request.post(`${BASE}/auth/register`, {
            data: { name: 'Short PW', email: `short_${TS}@test.com`, password: '123' }
        });
        expect(shortPwRes.ok()).toBeFalsy();
        console.log(`[Validation] 짧은 비밀번호 거부 (${shortPwRes.status()}) ✅`);

        // 8-3. 필수 필드 누락 (이름 없음)
        const noNameRes = await request.post(`${BASE}/auth/register`, {
            data: { email: `noname_${TS}@test.com`, password: PASSWORD }
        });
        expect(noNameRes.ok()).toBeFalsy();
        console.log(`[Validation] 이름 누락 거부 (${noNameRes.status()}) ✅`);

        // 8-4. 인증 없이 보호 API 접근
        const noAuthRes = await request.get(`${BASE}/auth/me`);
        expect(noAuthRes.ok()).toBeFalsy();
        expect(noAuthRes.status()).toBe(401);
        console.log('[Validation] 미인증 접근 거부 (401) ✅');

        // 8-5. 중복 리뷰 등록 검증
        const dupReviewRes = await request.post(`${BASE}/reviews`, {
            data: {
                store_id: storeId,
                order_id: orderId,
                customer_name: CUSTOMER_NAME,
                customer_phone: CUSTOMER_PHONE,
                rating: 3,
                content: '중복 리뷰 시도'
            }
        });
        expect(dupReviewRes.status()).toBe(400);
        console.log('[Validation] 중복 리뷰 거부 (400) ✅');
    });

    // ─── 정리 ───
    test.afterAll(async () => {
        if (db) {
            try { db.prepare('DELETE FROM review_likes WHERE review_id IN (SELECT id FROM reviews WHERE store_id = ?)').run(storeId); } catch (e) { /* 무시 */ }
            try { db.prepare('DELETE FROM reviews WHERE store_id = ?').run(storeId); } catch (e) { /* 무시 */ }
            try { db.prepare('DELETE FROM reservations WHERE store_id = ?').run(storeId); } catch (e) { /* 무시 */ }
            try { db.prepare('DELETE FROM waiting_list WHERE store_id = ?').run(storeId); } catch (e) { /* 무시 */ }
            try { db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE store_id = ?)').run(storeId); } catch (e) { /* 무시 */ }
            try { db.prepare('DELETE FROM orders WHERE store_id = ?').run(storeId); } catch (e) { /* 무시 */ }
            try { db.prepare('DELETE FROM products WHERE store_id = ?').run(storeId); } catch (e) { /* 무시 */ }
            try { db.prepare('DELETE FROM categories WHERE store_id = ?').run(storeId); } catch (e) { /* 무시 */ }
            try { db.prepare('DELETE FROM stores WHERE id = ?').run(storeId); } catch (e) { /* 무시 */ }
            try { db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(CUSTOMER_EMAIL, OWNER_EMAIL); } catch (e) { /* 무시 */ }
            db.close();
            console.log('[Cleanup] 테스트 데이터 정리 완료 ✅');
        }
    });
});
