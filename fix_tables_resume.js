const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Resuming table regeneration...');
  
  const stores = await prisma.stores.findMany({
    where: { 
      is_active: true,
      tables: { none: {} } 
    },
    select: { id: true }
  });
  console.log('Found ' + stores.length + ' active stores without tables.');

  const batchSize = 10000;
  let newTables = [];
  let totalInserted = 0;

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    
    for (let t = 1; t <= 4; t++) {
      newTables.push({
        store_id: store.id,
        table_number: t.toString(),
        qr_code: 'QR-' + store.id + '-' + t + '-' + Math.random().toString(36).substr(2, 6),
        capacity: 4,
        x: (t - 1) * 100,
        y: 100,
        status: 'available',
        is_active: true
      });
    }

    if (newTables.length >= batchSize || i === stores.length - 1) {
      await prisma.tables.createMany({
        data: newTables,
        skipDuplicates: true
      });
      totalInserted += newTables.length;
      console.log('Inserted ' + totalInserted + ' tables...');
      newTables = [];
    }
  }

  console.log('Done! Regenerated ' + totalInserted + ' tables with clean table_numbers (1, 2, 3, 4).');
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
