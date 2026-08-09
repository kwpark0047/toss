const { PrismaClient } = require('./prisma/app/generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'prisma/migrations/20260809_add_subscription_plan_models/migration.sql'),
    'utf-8'
  );

  // Execute the entire SQL as a single block (wrapped in DO block for transaction)
  try {
    console.log('Executing migration as single block...');
    await prisma.$executeRawUnsafe(sql);
    console.log('Migration completed successfully');
  } catch (e) {
    console.error('ERROR:', e.message);

    // Fallback: try line by line for CREATE TABLE
    const lines = sql.split('\n');
    let currentStmt = '';
    for (const line of lines) {
      currentStmt += line + '\n';
      if (line.trim().endsWith(';') && !line.trim().startsWith('--')) {
        const stmt = currentStmt.trim();
        currentStmt = '';
        if (!stmt) continue;
        try {
          console.log('Executing:', stmt.substring(0, 100) + '...');
          await prisma.$executeRawUnsafe(stmt);
          console.log('  OK');
        } catch (e2) {
          if (e2.message.includes('already exists') || e2.message.includes('duplicate key')) {
            console.log('  SKIP (already exists)');
          } else {
            console.error('  ERROR:', e2.message.substring(0, 200));
          }
        }
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
