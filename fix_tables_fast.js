const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Fetching stores...');
  const allStores = await prisma.stores.findMany({
    where: { is_active: true },
    select: { id: true }
  });
  const storeIds = new Set(allStores.map(s => s.id));
  console.log('Total active stores:', storeIds.size);

  console.log('Fetching existing tables to find skipped stores...');
  const existingTables = await prisma.tables.findMany({
    select: { store_id: true }
  });
  existingTables.forEach(t => storeIds.delete(t.store_id));
  
  const pendingStoreIds = Array.from(storeIds);
  console.log('Stores needing tables:', pendingStoreIds.length);

  const batchSize = 10000;
  let newTables = [];
  let totalInserted = 0;

  for (let i = 0; i < pendingStoreIds.length; i++) {
    const storeId = pendingStoreIds[i];
    
    for (let t = 1; t <= 4; t++) {
      newTables.push({
        store_id: storeId,
        table_number: t.toString(),
        qr_code: 'QR-' + storeId + '-' + t + '-' + Math.random().toString(36).substr(2, 6),
        capacity: 4,
        x: (t - 1) * 100,
        y: 100,
        status: 'available',
        is_active: true
      });
    }

    if (newTables.length >= batchSize || i === pendingStoreIds.length - 1) {
      await prisma.tables.createMany({
        data: newTables,
        skipDuplicates: true
      });
      totalInserted += newTables.length;
      console.log('Inserted ' + totalInserted + ' tables...');
      newTables = [];
    }
  }

  console.log('Done! Regenerated ' + totalInserted + ' tables.');
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
