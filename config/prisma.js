const { PrismaClient } = require('@prisma/client');

// Supabase free tier: 커넥션 풀 타임아웃 연장 + 동시 커넥션 수 증가
// DATABASE_URL에 이미 pool_timeout이 있으면 그대로 사용, 없으면 추가
const buildDatabaseUrl = () => {
    const url = process.env.DATABASE_URL || '';
    if (!url || url.includes('pool_timeout')) return url;
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + 'pool_timeout=30&connection_limit=5';
};

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: buildDatabaseUrl() } },
});

module.exports = prisma;
