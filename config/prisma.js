const { PrismaClient } = require('@prisma/client');

// Supabase free tier: connection_limit=1 → 5, pool_timeout 10s → 30s 강제 교체
const buildDatabaseUrl = () => {
    let url = process.env.DATABASE_URL || '';
    if (!url) return url;
    // 기존 값 교체 (append 시 중복 파라미터 충돌 방지)
    url = url.includes('connection_limit=')
        ? url.replace(/connection_limit=\d+/, 'connection_limit=5')
        : url + (url.includes('?') ? '&' : '?') + 'connection_limit=5';
    url = url.includes('pool_timeout=')
        ? url.replace(/pool_timeout=\d+/, 'pool_timeout=30')
        : url + '&pool_timeout=30';
    return url;
};

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: buildDatabaseUrl() } },
});

module.exports = prisma;
