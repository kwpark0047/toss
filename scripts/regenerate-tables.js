const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function run() {
  console.log('남은 테이블 재생성 시작...');

  try {
    // 1. 활성 매장 목록 가져오기
    const stores = await prisma.stores.findMany({ 
      where: { is_active: true },
      select: { id: true }
    });
    console.log(`활성 매장 ${stores.length}개를 찾았습니다.`);

    // 2. 이미 테이블이 있는 매장 제외
    const existingTables = await prisma.tables.groupBy({
      by: ['store_id'],
      _count: { store_id: true }
    });
    
    const storeIdsWithTables = new Set(existingTables.map(t => t.store_id));
    
    const storesToProcess = stores.filter(store => !storeIdsWithTables.has(store.id));
    console.log(`테이블 생성이 필요한 매장 수: ${storesToProcess.length}개`);

    // 3. 각 매장별로 테이블 4개씩 일괄 생성 (배치 처리)
    if (storesToProcess.length > 0) {
      console.log('새로운 테이블 생성을 시작합니다 (배치 처리)...');
      
      const BATCH_SIZE = 5000;
      let newTables = [];
      let totalCreated = 0;

      for (let i = 0; i < storesToProcess.length; i++) {
        const store = storesToProcess[i];
        for (let j = 1; j <= 4; j++) {
          const randomString = crypto.randomUUID().replace(/-/g, '').substring(0, 6);
          const qrCode = `QR-${store.id}-${j}-${randomString}`;
          
          newTables.push({
            store_id: store.id,
            table_number: `${j}번`,
            capacity: 4,
            qr_code: qrCode,
            is_active: true,
            status: 'available',
            x: (j - 1) * 150,
            y: 100
          });
        }

        if (newTables.length >= BATCH_SIZE || i === storesToProcess.length - 1) {
          await prisma.tables.createMany({
            data: newTables
          });
          totalCreated += newTables.length;
          console.log(`... 추가로 ${totalCreated}개 테이블 생성 완료`);
          newTables = [];
        }
      }
      console.log(`총 ${totalCreated}개의 새로운 테이블이 성공적으로 추가 생성되었습니다.`);
    } else {
      console.log('모든 매장에 이미 테이블이 생성되어 있습니다.');
    }
  } catch (error) {
    console.error('테이블 재생성 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();