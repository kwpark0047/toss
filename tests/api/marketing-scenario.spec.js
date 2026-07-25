const { test, expect, request } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

test.describe('Marketing & Coupon Automation Scenario (API + DB)', () => {
    let adminToken;
    let createdCouponId;
    let createdCampaignId;
    let issuedCouponId;

    // 테스트용 데이터
    const TEST_STORE_ID = 1;
    const TEST_PHONE = `010-9${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
    const COUPON_AMOUNT = 3000;

    test.beforeAll(async ({ request }) => {
        // 1. 관리자 로그인
        const loginRes = await request.post('http://localhost:3000/api/auth/login', {
            data: { email: 'admin@example.com', password: 'password123' }
        });
        const loginData = await loginRes.json();
        adminToken = loginData.token;
        expect(loginRes.ok()).toBeTruthy();
    });

    test('1. Admin: Create Welcome Coupon & Campaign', async ({ request }) => {
        // 1-1. 쿠폰 생성
        const couponRes = await request.post(`http://localhost:3000/api/coupons/stores/${TEST_STORE_ID}/coupons`, {
            headers: { Authorization: `Bearer ${adminToken}` },
            data: {
                name: 'Auto Welcome Coupon',
                amount: COUPON_AMOUNT,
                type: 'FIXED',
                valid_days: 30,
                min_order_amount: 5000,
                is_active: 1
            }
        });
        expect(couponRes.ok()).toBeTruthy();
        const couponData = await couponRes.json();
        createdCouponId = couponData.data.id;
        console.log('Created Coupon ID:', createdCouponId);

        // 1-2. 캠페인 설정 (WELCOME 트리거)
        const campaignRes = await request.post(`http://localhost:3000/api/coupons/stores/${TEST_STORE_ID}/campaigns`, {
            headers: { Authorization: `Bearer ${adminToken}` },
            data: {
                trigger_type: 'WELCOME',
                target_tier: null,
                coupon_id: createdCouponId,
                is_active: 1
            }
        });
        expect(campaignRes.ok()).toBeTruthy();
        const campaignData = await campaignRes.json();
        createdCampaignId = campaignData.data.id;
    });

    test('2. Guest: Process Payment & Verify Coupon Issuance', async ({ request }) => {
        // 2-1. 비회원 결제 (첫 방문) -> CampaignService.handleWelcome() -> Coupon.issueToCustomer()
        const paymentRes = await request.post('http://localhost:3000/api/payments', {
            data: {
                store_id: TEST_STORE_ID,
                items: [{ product_id: 1, product_name: 'Test Coffee', quantity: 1, price: 5000 }],
                total_amount: 5000,
                payment_method: 'card',
                phone: TEST_PHONE,
                customer_name: 'New Customer'
            }
        });
        expect(paymentRes.ok()).toBeTruthy();

        // 2-2. DB 검증 (비동기 처리 대기)
        await expect.poll(async () => {
            const userCoupon = await prisma.user_coupons.findFirst({
                where: {
                    customer_phone: TEST_PHONE,
                    coupon_id: createdCouponId
                }
            });
            return userCoupon;
        }, {
            message: 'Coupon should be issued to the customer phone',
            timeout: 5000,
        }).not.toBeNull();

        // 발급된 ID 저장
        const userCoupon = await prisma.user_coupons.findFirst({
            where: { customer_phone: TEST_PHONE, coupon_id: createdCouponId }
        });
        issuedCouponId = userCoupon.id;
        console.log('Issued UserCoupon ID:', issuedCouponId);
    });

    test('3. Guest: Use Coupon on Next Order', async ({ request }) => {
        // 3-1. 쿠폰 사용하여 주문 생성
        // routes/orders.js create API는 user_coupon_id를 받음
        const orderRes = await request.post('http://localhost:3000/api/orders', {
            data: {
                store_id: TEST_STORE_ID,
                items: [{ product_id: 1, product_name: 'Second Coffee', quantity: 1, price: 10000 }],
                total_amount: 10000, // 원래 금액
                payment_method: 'card',
                customer_phone: TEST_PHONE,
                user_coupon_id: issuedCouponId // 쿠폰 적용
            }
        });

        expect(orderRes.ok()).toBeTruthy();
        const orderData = await orderRes.json();

        // 검증: 할인이 적용되었는지 확인 (10000 - 3000 = 7000)
        expect(orderData.order.total_amount).toBe(10000 - COUPON_AMOUNT);
        expect(orderData.order.discount_amount).toBe(COUPON_AMOUNT);

        // 3-2. DB 검증: 쿠폰 상태가 USED로 변경되었는지
        const usedCoupon = await prisma.user_coupons.findUnique({
            where: { id: issuedCouponId }
        });
        expect(usedCoupon.status).toBe('USED');
    });

    test.afterAll(async () => {
        // 클린업
        await prisma.campaign_settings.deleteMany({ where: { id: createdCampaignId } });
        await prisma.coupons.deleteMany({ where: { id: createdCouponId } });
        await prisma.$disconnect();
    });
});
