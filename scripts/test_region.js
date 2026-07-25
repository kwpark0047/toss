const { PrismaClient } = require('@prisma/client');

const ref = 'bvdtomzczxxbkwfmlcgy';
const pass = process.env.TEST_PASS || 'pkw009800';
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
        const url = `postgresql://postgres.${ref}:${pass}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=5`;
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
