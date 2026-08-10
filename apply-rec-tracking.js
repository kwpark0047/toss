const { PrismaClient } = require('./prisma/app/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  // Execute CREATE TABLE statements one by one
  const tables = [
    // recommendation_impressions
    `CREATE TABLE IF NOT EXISTS "recommendation_impressions" (
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
    )`,

    // recommendation_clicks
    `CREATE TABLE IF NOT EXISTS "recommendation_clicks" (
      "id" TEXT NOT NULL,
      "impression_id" TEXT NOT NULL,
      "store_id" INTEGER NOT NULL,
      "session_id" TEXT NOT NULL,
      "user_id" INTEGER,
      "phone" TEXT,
      "menu_id" INTEGER NOT NULL,
      "recommendation_type" TEXT NOT NULL,
      "time_to_click_ms" INTEGER,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "recommendation_clicks_pkey" PRIMARY KEY ("id")
    )`,

    // recommendation_conversions
    `CREATE TABLE IF NOT EXISTS "recommendation_conversions" (
      "id" TEXT NOT NULL,
      "impression_id" TEXT,
      "click_id" TEXT,
      "store_id" INTEGER NOT NULL,
      "session_id" TEXT NOT NULL,
      "user_id" INTEGER,
      "phone" TEXT,
      "order_id" INTEGER NOT NULL,
      "menu_id" INTEGER NOT NULL,
      "recommendation_type" TEXT NOT NULL,
      "conversion_value" INTEGER NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "time_to_conversion_ms" BIGINT,
      "attributed" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "recommendation_conversions_pkey" PRIMARY KEY ("id")
    )`,

    // recommendation_daily_stats
    `CREATE TABLE IF NOT EXISTS "recommendation_daily_stats" (
      "id" TEXT NOT NULL,
      "store_id" INTEGER NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "recommendation_type" TEXT NOT NULL,
      "impressions" INTEGER NOT NULL DEFAULT 0,
      "clicks" INTEGER NOT NULL DEFAULT 0,
      "conversions" INTEGER NOT NULL DEFAULT 0,
      "revenue" INTEGER NOT NULL DEFAULT 0,
      "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "cvr" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "avg_order_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "recommendation_daily_stats_pkey" PRIMARY KEY ("id")
    )`,
  ];

  for (const sql of tables) {
    try {
      console.log('Creating table...');
      await prisma.$executeRawUnsafe(sql);
      console.log('  OK');
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate key')) {
        console.log('  SKIP (already exists)');
      } else {
        console.error('  ERROR:', e.message.substring(0, 200));
      }
    }
  }

  // Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS "idx_rec_imp_store_time" ON "recommendation_impressions"("store_id", "created_at")',
    'CREATE INDEX IF NOT EXISTS "idx_rec_imp_session" ON "recommendation_impressions"("session_id")',
    'CREATE INDEX IF NOT EXISTS "idx_rec_imp_menu" ON "recommendation_impressions"("menu_id")',
    'CREATE INDEX IF NOT EXISTS "idx_rec_imp_type" ON "recommendation_impressions"("recommendation_type")',

    'CREATE UNIQUE INDEX IF NOT EXISTS "uq_rec_click_impression" ON "recommendation_clicks"("impression_id")',
    'CREATE INDEX IF NOT EXISTS "idx_rec_click_store_time" ON "recommendation_clicks"("store_id", "created_at")',
    'CREATE INDEX IF NOT EXISTS "idx_rec_click_imp" ON "recommendation_clicks"("impression_id")',

    'CREATE INDEX IF NOT EXISTS "idx_rec_conv_store_time" ON "recommendation_conversions"("store_id", "created_at")',
    'CREATE INDEX IF NOT EXISTS "idx_rec_conv_session" ON "recommendation_conversions"("session_id")',
    'CREATE INDEX IF NOT EXISTS "idx_rec_conv_order" ON "recommendation_conversions"("order_id")',
    'CREATE INDEX IF NOT EXISTS "idx_rec_conv_menu" ON "recommendation_conversions"("menu_id")',

    'CREATE UNIQUE INDEX IF NOT EXISTS "uq_rec_daily_stats" ON "recommendation_daily_stats"("store_id", "date", "recommendation_type")',
    'CREATE INDEX IF NOT EXISTS "idx_rec_daily_store_date" ON "recommendation_daily_stats"("store_id", "date")',
  ];

  for (const sql of indexes) {
    try {
      console.log('Creating index...');
      await prisma.$executeRawUnsafe(sql);
      console.log('  OK');
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate key')) {
        console.log('  SKIP (already exists)');
      } else {
        console.error('  ERROR:', e.message.substring(0, 200));
      }
    }
  }

  console.log('Migration completed');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
