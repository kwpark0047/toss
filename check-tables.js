const { PrismaClient } = require('./prisma/app/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  // Check if tables exist in information_schema
  const result = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'recommendation_%'
    ORDER BY table_name
  `;
  console.log('Recommendation tables:', result);

  // Try creating one table directly
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "recommendation_impressions" (
        "id" TEXT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "session_id" TEXT NOT NULL,
        "user_id" INTEGER,
        "phone" TEXT,
        "menu_id" INTEGER NOT NULL,
        "recommendation_type" TEXT NOT NULL,
        "source" TEXT NOT NULL,
        "position" INTEGER NOT NULL,
        "weather_context" JSONB,
        "time_period" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "recommendation_impressions_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log('Table created');
  } catch (e) {
    console.error('Create error:', e.message);
  }

  await prisma.$disconnect();
}

main().catch((e) => console.error(e));
