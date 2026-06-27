const { PrismaClient } = require('../generated/prisma');

/**
 * Prisma Client 싱글톤 인스턴스
 * 애플리케이션 전체에서 하나의 데이터베이스 연결 풀을 공유합니다.
 */
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = prisma;
