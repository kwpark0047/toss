const request = require('supertest');
const { app } = require('../app');
const prisma = require('../config/prisma');

async function testRegistrationAndLogin() {
    console.log('등록 및 로그인 통합 테스트 시작...');

    const testUser = {
        name: '테스트 유저',
        email: `test_${Date.now()}@example.com`,
        password: 'password123'
    };

    try {
        // 1. 회원가입 테스트
        console.log('1. 회원가입 시도:', testUser.email);
        const regResponse = await request(app)
            .post('/api/auth/register')
            .send(testUser);

        console.log('회원가입 응답 상태:', regResponse.status);
        if (regResponse.status !== 201) {
            console.error('회원가입 실패:', regResponse.body);
            return;
        }
        console.log('회원가입 성공!');

        // 2. 로그인 테스트
        console.log('2. 로그인 시도:', testUser.email);
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            });

        console.log('로그인 응답 상태:', loginResponse.status);
        if (loginResponse.status === 200) {
            console.log('로그인 성공!');
            console.log('반환된 토큰 및 유저 정보:', {
                hasToken: !!loginResponse.body.data.token,
                user: loginResponse.body.data.user
            });
        } else {
            console.error('로그인 실패:', loginResponse.body);
        }

        // 3. 테스트 데이터 삭제 (Clean up)
        console.log('3. 테스트 데이터 정리 중...');
        await prisma.users.delete({
            where: { email: testUser.email }
        });
        console.log('정리 완료.');

    } catch (error) {
        console.error('테스트 중 오류 발생:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testRegistrationAndLogin();
