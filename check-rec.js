const { PrismaClient } = require('./prisma/app/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const tables = [
    'recommendation_impressions',
    'recommendation_clicks',
    'recommendation_conversions',
    'recommendation_daily_stats',
  ];

  for (const table of tables) {
    try {
      const result = await prisma.$executeRawUnsafe(`SELECT COUNT(*) FROM "${table}"`);
      console.log(`${table}:`, result);
    } catch (e) {
      console.error(`${table} error:`, e.message);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => console.error(e));
