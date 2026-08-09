const { PrismaClient } = require('./prisma/app/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  // Check if tables exist
  const planCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "Plan"`;
  const subCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "Subscription"`;
  console.log('Plan count:', planCount);
  console.log('Subscription count:', subCount);

  // Check Plan table structure
  const planCols = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'Plan'
    ORDER BY ordinal_position
  `;
  console.log('Plan columns:', planCols);

  // Check Subscription table structure
  const subCols = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'Subscription'
    ORDER BY ordinal_position
  `;
  console.log('Subscription columns:', subCols);

  // Check stores new columns
  const storeCols = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'stores' 
    AND column_name IN ('subscription_id', 'billing_cycle', 'trial_ends_at', 'plan_expires_at', 'auto_renew', 'payment_method_id', 'last_payment_at', 'next_payment_at')
    ORDER BY ordinal_position
  `;
  console.log('Stores new columns:', storeCols);

  await prisma.$disconnect();
}

main().catch((e) => console.error(e));
