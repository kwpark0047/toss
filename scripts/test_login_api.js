const request = require('supertest');
const { app } = require('../app');
const prisma = require('../config/prisma');

async function testLogin() {
    console.log('로그인 API 테스트 시작...');

    const loginData = {
        email: 'superadmin@wemarket.com',
        password: 'password123'
    };

    try {
        const response = await request(app)
            .post('/api/auth/login')
            .send(loginData)
            .set('Accept', 'application/json');

        console.log('응답 상태 코드:', response.status);

        if (response.status === 200) {
            console.log('로그인 성공!');
            console.log('반환된 데이터 요약:', {
                success: response.body.success,
                message: response.body.message,
                hasToken: !!response.body.data.token,
                hasRefreshToken: !!response.body.data.refreshToken,
                user: response.body.data.user
            });
        } else {
            console.log('로그인 실패:', response.body);
        }
    } catch (error) {
        console.error('테스트 중 오류 발생:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testLogin();
