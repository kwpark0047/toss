const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDuplicateOrders() {
    console.log('중복 주문 데이터 정리 시작...');
    try {
        // 1. 중복된 order_number 목록 조회
        const duplicates = await prisma.$queryRaw`
      SELECT order_number, COUNT(*) as count 
      FROM orders 
      GROUP BY order_number 
      HAVING count > 1
    `;

        console.log(`중복 발견: ${duplicates.length}개 그룹`);

        for (const dup of duplicates) {
            const orderNumber = dup.order_number;

            // 2. 해당 번호의 모든 주문 조회 (ID 내림차순 - 최신순)
            const orders = await prisma.orders.findMany({
                where: { order_number: orderNumber },
                orderBy: { id: 'desc' },
                select: { id: true }
            });

            // 3. 가장 최신(첫 번째) 주문을 제외한 나머지 삭제
            constidsToDelete = orders.slice(1).map(o => o.id);

            if (constidsToDelete.length > 0) {
                await prisma.orders.deleteMany({
                    where: { id: { in: constidsToDelete } }
                });
                console.log(`주문번호 ${orderNumber}: ${constidsToDelete.length}개 중복 삭제 완료`);
            }
        }

        console.log('중복 데이터 정리가 완료되었습니다.');
    } catch (error) {
        console.error('정리 도중 오류 발생:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanDuplicateOrders();
