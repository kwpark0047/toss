const prisma = require('../config/prisma');

async function testConnection() {
    try {
        console.log('Supabase DB 연결 시도 중...');
        // 간단한 쿼리로 연결 확인
        const userCount = await prisma.users.count();
        console.log(`연결 성공! 현재 등록된 사용자 수: ${userCount}`);

        // 첫 번째 사용자 정보 살짝 확인 (보안상 상세 정보 제외)
        const users = await prisma.users.findMany({
            select: { id: true, email: true, role: true }
        });
        console.log('등록된 모든 사용자 목록:');
        users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`));
    } catch (error) {
        console.error('DB 연결 실패:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
