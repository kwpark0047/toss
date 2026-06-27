// 주방 계정 기능 E2E 테스트
// store_staff 테이블(better-sqlite3)에 kitchen 역할 등록 → 주문 조회/상태 변경 테스트
const { test, expect } = require('@playwright/test');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'wemarket.db');

test.describe.serial('Kitchen Account Features', () => {
    let ownerToken;
    let kitchenToken;
    let storeId;
    let orderId;
    let productId1;
    let productId2;
    let productId3;
    let db;

    // 고유한 테스트 데이터 (타임스탬프로 충돌 방지)
    const TS = Date.now();
    const OWNER_EMAIL = `kitchen_owner_${TS}@test.com`;
    const KITCHEN_EMAIL = `kitchen_staff_${TS}@test.com`;
    const PASSWORD = 'password123';

    test.beforeAll(async () => {
        // DB 직접 연결
        db = new Database(DB_PATH);
        const hashedPassword = bcrypt.hashSync(PASSWORD, 10);

        // 점주 계정 생성
        db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
            .run('Kitchen Test Owner', OWNER_EMAIL, hashedPassword, 'manager');
        console.log(`[Setup] 점주 생성: ${OWNER_EMAIL}`);

        // 주방 직원 계정 생성
        db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
            .run('Kitchen Staff', KITCHEN_EMAIL, hashedPassword, 'staff');
        console.log(`[Setup] 주방 직원 생성: ${KITCHEN_EMAIL}`);
    });

    test('1. 점주 로그인 및 매장 생성', async ({ request }) => {
        // 1-1. 점주 로그인
        const ownerLogin = await request.post('http://localhost:3000/api/auth/login', {
            data: { email: OWNER_EMAIL, password: PASSWORD }
        });
        if (!ownerLogin.ok()) {
            console.log('[Auth] Owner Login Failed:', ownerLogin.status(), await ownerLogin.text());
        }
        expect(ownerLogin.ok()).toBeTruthy();
        const ownerData = await ownerLogin.json();
        ownerToken = ownerData.data.token;
        console.log('[Auth] 점주 로그인 성공 ✅');

        // 1-2. 매장 생성 (API 통해 — Prisma + better-sqlite3 모두에 반영됨)
        const createRes = await request.post('http://localhost:3000/api/stores', {
            headers: { Authorization: `Bearer ${ownerToken}` },
            data: {
                name: `Kitchen Test Cafe ${TS}`,
                address: 'Seoul Kitchen Test',
                phone: '010-8888-0000',
                business_type: 'cafe'
            }
        });
        if (!createRes.ok()) {
            console.log('[Store] Create Failed:', createRes.status(), await createRes.text());
        }
        expect(createRes.ok()).toBeTruthy();
        const storeData = await createRes.json();
        storeId = storeData.data.id;
        console.log(`[Store] 매장 생성 완료: ID=${storeId} ✅`);

        // 1-3. store_staff 테이블에 주방 직원 등록 (권한 체크용)
        const kitchenUser = db.prepare('SELECT id FROM users WHERE email = ?').get(KITCHEN_EMAIL);
        db.prepare('INSERT INTO store_staff (store_id, user_id, name, role, is_active) VALUES (?, ?, ?, ?, ?)')
            .run(storeId, kitchenUser.id, 'Kitchen Staff', 'kitchen', 1);
        console.log(`[Staff] 주방 직원 store_staff 등록 완료 (user_id=${kitchenUser.id}) ✅`);

        // 1-4. 카테고리 및 상품 생성 (better-sqlite3 직접 삽입)
        const catResult = db.prepare('INSERT INTO categories (store_id, name, sort_order) VALUES (?, ?, ?)').run(storeId, '음료', 1);
        const categoryId = catResult.lastInsertRowid;

        const prod1 = db.prepare('INSERT INTO products (store_id, category_id, name, price, is_active, is_sold_out) VALUES (?, ?, ?, ?, 1, 0)').run(storeId, categoryId, '아메리카노', 4500);
        productId1 = Number(prod1.lastInsertRowid);

        const prod2 = db.prepare('INSERT INTO products (store_id, category_id, name, price, is_active, is_sold_out) VALUES (?, ?, ?, ?, 1, 0)').run(storeId, categoryId, '바닐라라떼', 5000);
        productId2 = Number(prod2.lastInsertRowid);

        const prod3 = db.prepare('INSERT INTO products (store_id, category_id, name, price, is_active, is_sold_out) VALUES (?, ?, ?, ?, 1, 0)').run(storeId, categoryId, '카페라떼', 5000);
        productId3 = Number(prod3.lastInsertRowid);

        console.log(`[Setup] 카테고리+상품 생성 완료: ${productId1}, ${productId2}, ${productId3} ✅`);
    });

    test('2. 주방 직원 로그인 및 주문 조회', async ({ request }) => {
        // 2-1. 주방 직원 로그인
        const kitchenLogin = await request.post('http://localhost:3000/api/auth/login', {
            data: { email: KITCHEN_EMAIL, password: PASSWORD }
        });
        if (!kitchenLogin.ok()) {
            console.log('[Auth] Kitchen Login Failed:', kitchenLogin.status(), await kitchenLogin.text());
        }
        expect(kitchenLogin.ok()).toBeTruthy();
        const kitchenData = await kitchenLogin.json();
        kitchenToken = kitchenData.data.token;
        console.log('[Auth] 주방 직원 로그인 성공 ✅');

        // 2-2. 테스트용 주문 생성 (인증 불필요 — 공개 API)
        const orderRes = await request.post('http://localhost:3000/api/orders', {
            data: {
                store_id: storeId,
                order_number: `ORD-KIT-${TS}`,
                total_amount: 14000,
                payment_method: 'card',
                customer_phone: '010-1234-0000',
                items: [
                    { product_id: productId1, product_name: '아메리카노', quantity: 2, price: 4500 },
                    { product_id: productId2, product_name: '바닐라라떼', quantity: 1, price: 5000 }
                ]
            }
        });
        if (!orderRes.ok()) {
            console.log('[Order] Create Failed:', orderRes.status(), await orderRes.text());
        }
        expect(orderRes.ok()).toBeTruthy();
        const orderData = await orderRes.json();
        // 응답 구조에 따라 orderId 추출
        orderId = orderData.order?.id || orderData.data?.id;
        console.log(`[Order] 테스트 주문 생성: ID=${orderId} ✅`);

        // 2-3. 주방 직원으로 매장 주문 목록 조회
        const listRes = await request.get(`http://localhost:3000/api/orders/store/${storeId}`, {
            headers: { Authorization: `Bearer ${kitchenToken}` }
        });
        if (!listRes.ok()) {
            console.log('[Kitchen] Order List Failed:', listRes.status(), await listRes.text());
        }
        expect(listRes.ok()).toBeTruthy();
        const listData = await listRes.json();
        const orders = listData.data || listData;
        expect(Array.isArray(orders)).toBeTruthy();
        const found = orders.find(o => o.id === orderId);
        expect(found).toBeTruthy();
        console.log(`[Kitchen] 주문 목록 조회 성공: ${orders.length}건 (테스트 주문 확인) ✅`);
    });

    test('3. 주문 상태 변경 워크플로우 (pending → preparing → ready)', async ({ request }) => {
        // 3-1. pending → preparing (조리 시작)
        const prepRes = await request.put(`http://localhost:3000/api/orders/${orderId}/status`, {
            headers: { Authorization: `Bearer ${kitchenToken}` },
            data: { status: 'preparing' }
        });
        if (!prepRes.ok()) {
            console.log('[Kitchen] Status->preparing Failed:', prepRes.status(), await prepRes.text());
        }
        expect(prepRes.ok()).toBeTruthy();
        const prepData = await prepRes.json();
        expect(prepData.order.status).toBe('preparing');
        console.log('[Kitchen] 주문 상태 → preparing (조리 시작) ✅');

        // 3-2. preparing → ready (조리 완료)
        const readyRes = await request.put(`http://localhost:3000/api/orders/${orderId}/status`, {
            headers: { Authorization: `Bearer ${kitchenToken}` },
            data: { status: 'ready' }
        });
        if (!readyRes.ok()) {
            console.log('[Kitchen] Status->ready Failed:', readyRes.status(), await readyRes.text());
        }
        expect(readyRes.ok()).toBeTruthy();
        const readyData = await readyRes.json();
        expect(readyData.order.status).toBe('ready');
        console.log('[Kitchen] 주문 상태 → ready (조리 완료) ✅');

        // 3-3. DB에서 직접 확인
        const dbOrder = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
        expect(dbOrder.status).toBe('ready');
        console.log('[Kitchen] DB 상태 검증: ready ✅');
    });

    test('4. 권한 제한 검증 (통계 접근 불가)', async ({ request }) => {
        // 4-1. 통계 API 접근 시 403 거부
        const statsRes = await request.get(`http://localhost:3000/api/orders/store/${storeId}/stats`, {
            headers: { Authorization: `Bearer ${kitchenToken}` }
        });
        // kitchen 역할은 stats:read 권한 없음 → 403 예상
        expect(statsRes.status()).toBe(403);
        console.log('[Kitchen] 통계 접근 거부 (403) ✅');

        // 4-2. 다른 매장 주문 조회 시 403 거부
        const otherRes = await request.get('http://localhost:3000/api/orders/store/99999', {
            headers: { Authorization: `Bearer ${kitchenToken}` }
        });
        expect(otherRes.status()).toBe(403);
        console.log('[Kitchen] 다른 매장 접근 거부 (403) ✅');
    });

    test('5. 주문 필터링 (status 파라미터)', async ({ request }) => {
        // 5-1. 추가 주문 생성 (pending 상태)
        const order2Res = await request.post('http://localhost:3000/api/orders', {
            data: {
                store_id: storeId,
                order_number: `ORD-KIT2-${TS}`,
                total_amount: 5000,
                payment_method: 'card',
                customer_phone: '010-5555-0000',
                items: [
                    { product_id: productId3, product_name: '카페라떼', quantity: 1, price: 5000 }
                ]
            }
        });
        expect(order2Res.ok()).toBeTruthy();
        const order2Data = await order2Res.json();
        const order2Id = order2Data.order?.id || order2Data.data?.id;
        console.log(`[Order] 추가 주문 생성: ID=${order2Id} ✅`);

        // 5-2. pending 상태만 필터링
        const pendingRes = await request.get(`http://localhost:3000/api/orders/store/${storeId}?status=pending`, {
            headers: { Authorization: `Bearer ${kitchenToken}` }
        });
        expect(pendingRes.ok()).toBeTruthy();
        const pendingData = await pendingRes.json();
        const pendingOrders = pendingData.data || pendingData;
        // 모든 주문이 pending인지 확인
        for (const o of pendingOrders) {
            expect(o.status).toBe('pending');
        }
        console.log(`[Kitchen] pending 필터: ${pendingOrders.length}건 ✅`);

        // 5-3. ready 상태만 필터링
        const readyRes = await request.get(`http://localhost:3000/api/orders/store/${storeId}?status=ready`, {
            headers: { Authorization: `Bearer ${kitchenToken}` }
        });
        expect(readyRes.ok()).toBeTruthy();
        const readyData = await readyRes.json();
        const readyOrders = readyData.data || readyData;
        for (const o of readyOrders) {
            expect(o.status).toBe('ready');
        }
        console.log(`[Kitchen] ready 필터: ${readyOrders.length}건 ✅`);

        // 5-4. KDS 뷰 (pending,preparing 복합 필터)
        const kdsRes = await request.get(`http://localhost:3000/api/orders/store/${storeId}?status=pending,preparing`, {
            headers: { Authorization: `Bearer ${kitchenToken}` }
        });
        expect(kdsRes.ok()).toBeTruthy();
        const kdsData = await kdsRes.json();
        const kdsOrders = kdsData.data || kdsData;
        for (const o of kdsOrders) {
            expect(['pending', 'preparing']).toContain(o.status);
        }
        console.log(`[Kitchen] KDS 뷰 (pending+preparing): ${kdsOrders.length}건 ✅`);
    });

    test.afterAll(async () => {
        if (db) {
            try {
                db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE store_id = ?)').run(storeId);
                db.prepare('DELETE FROM orders WHERE store_id = ?').run(storeId);
            } catch (e) { console.log('[Cleanup] orders:', e.message); }
            try {
                db.prepare('DELETE FROM products WHERE store_id = ?').run(storeId);
                db.prepare('DELETE FROM categories WHERE store_id = ?').run(storeId);
            } catch (e) { console.log('[Cleanup] products/categories:', e.message); }
            try {
                db.prepare('DELETE FROM store_staff WHERE store_id = ?').run(storeId);
            } catch (e) { console.log('[Cleanup] store_staff:', e.message); }
            try {
                db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
            } catch (e) { console.log('[Cleanup] stores:', e.message); }
            try {
                db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(OWNER_EMAIL, KITCHEN_EMAIL);
            } catch (e) { console.log('[Cleanup] users:', e.message); }
            db.close();
            console.log('[Cleanup] 테스트 데이터 정리 완료 ✅');
        }
    });
});
