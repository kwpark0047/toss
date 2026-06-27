// Super Admin 기능 E2E 테스트
// better-sqlite3: 사용자 생성 (authController와 동일 DB 사용)
// API: 매장 생성, 신청, 승인 (서버 라우트 통해 실행)
const { test, expect } = require('@playwright/test');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// 백엔드와 동일한 DB 파일 경로
const DB_PATH = path.join(__dirname, '..', '..', 'wemarket.db');

test.describe.serial('Super Admin Features Scenario', () => {
    let superAdminToken;
    let normalOwnerToken;
    let storeId;
    let planRequestId;
    let staffRequestId;
    let db;

    // 고유한 테스트 데이터 (타임스탬프로 충돌 방지)
    const TS = Date.now();
    const SUPER_ADMIN_EMAIL = `sa_${TS}@test.com`;
    const NORMAL_OWNER_EMAIL = `owner_${TS}@test.com`;
    const PASSWORD = 'password123';

    test.beforeAll(async () => {
        // DB 직접 연결하여 사용자 생성 (authController가 better-sqlite3 사용)
        db = new Database(DB_PATH);
        const hashedPassword = bcrypt.hashSync(PASSWORD, 10);

        // Super Admin 계정 생성
        db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
            .run('Super Admin', SUPER_ADMIN_EMAIL, hashedPassword, 'super_admin');
        console.log(`[Setup] Super Admin 생성: ${SUPER_ADMIN_EMAIL}`);

        // Normal Owner 계정 생성
        db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
            .run('Normal Owner', NORMAL_OWNER_EMAIL, hashedPassword, 'manager');
        console.log(`[Setup] Normal Owner 생성: ${NORMAL_OWNER_EMAIL}`);
    });

    test('1. Authentication (인증 테스트)', async ({ request }) => {
        // Super Admin 로그인
        const saLogin = await request.post('http://localhost:3000/api/auth/login', {
            data: { email: SUPER_ADMIN_EMAIL, password: PASSWORD }
        });
        if (!saLogin.ok()) {
            console.log('[Auth] SA Login Failed:', saLogin.status(), await saLogin.text());
        }
        expect(saLogin.ok()).toBeTruthy();
        const saData = await saLogin.json();
        superAdminToken = saData.data.token;
        expect(saData.data.user.role).toBe('super_admin');
        console.log('[Auth] Super Admin 로그인 성공 ✅');

        // Normal Owner 로그인
        const noLogin = await request.post('http://localhost:3000/api/auth/login', {
            data: { email: NORMAL_OWNER_EMAIL, password: PASSWORD }
        });
        if (!noLogin.ok()) {
            console.log('[Auth] Owner Login Failed:', noLogin.status(), await noLogin.text());
        }
        expect(noLogin.ok()).toBeTruthy();
        const noData = await noLogin.json();
        normalOwnerToken = noData.data.token;
        console.log('[Auth] Normal Owner 로그인 성공 ✅');
    });

    test('2. Store Setup & Multi-Store Analytics (매장 생성 및 통합 분석)', async ({ request }) => {
        // 2-1. API를 통해 매장 생성 (Prisma를 통해 stores 테이블에 삽입됨)
        const createStoreRes = await request.post('http://localhost:3000/api/stores', {
            headers: { Authorization: `Bearer ${normalOwnerToken}` },
            data: {
                name: `Test Store ${TS}`,
                address: 'Seoul Test',
                phone: '010-9999-0000',
                business_type: 'cafe'
            }
        });
        if (!createStoreRes.ok()) {
            console.log('[Store] Create Failed:', createStoreRes.status(), await createStoreRes.text());
        }
        expect(createStoreRes.ok()).toBeTruthy();
        const storeData = await createStoreRes.json();
        storeId = storeData.data.id;
        console.log(`[Store] 매장 생성 완료: ID=${storeId} ✅`);

        // 2-2. Super Admin: 다점포 통합 분석 조회
        const today = new Date().toISOString().split('T')[0];
        const analyticsRes = await request.get(
            `http://localhost:3000/api/analytics/multi-store?start_date=${today}&end_date=${today}`,
            { headers: { Authorization: `Bearer ${superAdminToken}` } }
        );
        if (!analyticsRes.ok()) {
            console.log('[Analytics] Failed:', analyticsRes.status(), await analyticsRes.text());
        }
        expect(analyticsRes.ok()).toBeTruthy();
        const analyticsData = await analyticsRes.json();
        expect(analyticsData.data).toHaveProperty('summary');
        expect(analyticsData.data).toHaveProperty('stores');
        console.log('[Analytics] Multi-Store 통계:', JSON.stringify(analyticsData.data.summary), '✅');
    });

    test('3. Plan Upgrade Request & Approval (플랜 업그레이드 신청 및 승인)', async ({ request }) => {
        // 3-1. 점주: 플랜 업그레이드 신청
        const reqRes = await request.post('http://localhost:3000/api/plan-requests', {
            headers: { Authorization: `Bearer ${normalOwnerToken}` },
            data: { store_id: storeId, requested_plan: 'pro', reason: 'Need more features' }
        });
        if (!reqRes.ok()) {
            console.log('[Plan] Request Failed:', reqRes.status(), await reqRes.text());
        }
        expect(reqRes.ok()).toBeTruthy();
        const reqData = await reqRes.json();
        planRequestId = reqData.data.id;
        console.log(`[Plan] 신청 생성: ID=${planRequestId} ✅`);

        // 3-2. Super Admin: pending 신청 목록 조회
        const listRes = await request.get('http://localhost:3000/api/plan-requests?status=pending', {
            headers: { Authorization: `Bearer ${superAdminToken}` }
        });
        expect(listRes.ok()).toBeTruthy();
        const listData = await listRes.json();
        const found = listData.data.find(r => r.id === planRequestId);
        expect(found).toBeTruthy();
        console.log('[Plan] 신청 목록에서 확인 ✅');

        // 3-3. Super Admin: 승인
        const approveRes = await request.post(
            `http://localhost:3000/api/plan-requests/${planRequestId}/approve`,
            {
                headers: { Authorization: `Bearer ${superAdminToken}` },
                data: { admin_note: 'Approved by E2E test' }
            }
        );
        if (!approveRes.ok()) {
            console.log('[Plan] Approve Failed:', approveRes.status(), await approveRes.text());
        }
        expect(approveRes.ok()).toBeTruthy();

        // 3-4. 검증: 매장 플랜 업데이트 확인
        const store = db.prepare('SELECT plan FROM stores WHERE id = ?').get(storeId);
        expect(store.plan).toBe('pro');
        console.log('[Plan] 매장 플랜 업데이트:', store.plan, '✅');
    });

    test('4. Staff Account Request & Approval (직원 계정 신청 및 승인)', async ({ request }) => {
        // 4-1. 점주: 매니저 계정 신청
        const reqRes = await request.post('http://localhost:3000/api/staff-requests', {
            headers: { Authorization: `Bearer ${normalOwnerToken}` },
            data: { store_id: storeId, role: 'manager', count: 1, reason: 'Hiring new staff' }
        });
        if (!reqRes.ok()) {
            console.log('[Staff] Request Failed:', reqRes.status(), await reqRes.text());
        }
        expect(reqRes.ok()).toBeTruthy();
        const reqData = await reqRes.json();
        staffRequestId = reqData.data.id;
        console.log(`[Staff] 신청 생성: ID=${staffRequestId} ✅`);

        // 4-2. Super Admin: 신청 목록 조회
        const listRes = await request.get('http://localhost:3000/api/staff-requests?status=pending', {
            headers: { Authorization: `Bearer ${superAdminToken}` }
        });
        expect(listRes.ok()).toBeTruthy();
        const listData = await listRes.json();
        const found = listData.data.find(r => r.id === staffRequestId);
        expect(found).toBeTruthy();
        console.log('[Staff] 신청 목록에서 확인 ✅');

        // 4-3. Super Admin: 승인
        const approveRes = await request.post(
            `http://localhost:3000/api/staff-requests/${staffRequestId}/approve`,
            {
                headers: { Authorization: `Bearer ${superAdminToken}` },
                data: { admin_note: 'Approved staff request' }
            }
        );
        if (!approveRes.ok()) {
            console.log('[Staff] Approve Failed:', approveRes.status(), await approveRes.text());
        }
        expect(approveRes.ok()).toBeTruthy();

        // 4-4. 검증: 신청 상태 확인
        const req2 = db.prepare('SELECT status FROM staff_account_requests WHERE id = ?').get(staffRequestId);
        expect(req2.status).toBe('approved');
        console.log('[Staff] 신청 상태:', req2.status, '✅');
    });

    test.afterAll(async () => {
        // DB 직접 정리
        if (db) {
            try {
                db.prepare('DELETE FROM plan_requests WHERE store_id = ?').run(storeId);
            } catch (e) { console.log('[Cleanup] plan_requests:', e.message); }
            try {
                db.prepare('DELETE FROM staff_account_requests WHERE store_id = ?').run(storeId);
            } catch (e) { console.log('[Cleanup] staff_account_requests:', e.message); }
            try {
                db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
            } catch (e) { console.log('[Cleanup] stores:', e.message); }
            try {
                db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(SUPER_ADMIN_EMAIL, NORMAL_OWNER_EMAIL);
            } catch (e) { console.log('[Cleanup] users:', e.message); }
            db.close();
            console.log('[Cleanup] 테스트 데이터 정리 완료 ✅');
        }
    });
});
