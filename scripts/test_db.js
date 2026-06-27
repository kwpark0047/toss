require('dotenv').config();
const prisma = require('../config/prisma');

async function test() {
    try {
        const stores    = await prisma.stores.count();
        const notifs    = await prisma.notifications.count();
        const stocks    = await prisma.stock_history.count();
        const products  = await prisma.products.count();

        console.log('✅ DB 연결 성공!');
        console.log('  stores         :', stores, '개');
        console.log('  products       :', products, '개');
        console.log('  notifications  :', notifs, '개');
        console.log('  stock_history  :', stocks, '개');
    } catch (e) {
        console.error('❌ 오류:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

test();
