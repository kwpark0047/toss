// Supabase pooler 리전 탐색 스크립트.
// 자격 증명은 코드에 두지 않는다. 실행 예:
//   SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<password> node scripts/test_region.js
const { PrismaClient } = require('@prisma/client');

const ref = process.env.SUPABASE_PROJECT_REF;
const pass = process.env.SUPABASE_DB_PASSWORD;

if (!ref || !pass) {
    console.error('SUPABASE_PROJECT_REF 와 SUPABASE_DB_PASSWORD 환경 변수가 필요합니다.');
    process.exit(1);
}

const regions = [
    'ap-northeast-2',
    'ap-northeast-1',
    'ap-southeast-1',
    'us-east-1',
    'eu-west-1',
    'eu-central-1',
];

(async () => {
    for (const region of regions) {
        const url = `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=5`;
        const prisma = new PrismaClient({ datasources: { db: { url } } });
        try {
            await prisma.$queryRaw`SELECT 1`;
            console.log(`✅ ${region} : 연결 성공!`);
            await prisma.$disconnect();
            break;
        } catch (e) {
            const lines = e.message.split('\n').filter(l => l.trim() && !l.includes('prisma.$queryRaw'));
            const msg = lines[0] || e.message;
            console.log(`❌ ${region} : ${msg.trim()}`);
            await prisma.$disconnect();
        }
    }
})();
