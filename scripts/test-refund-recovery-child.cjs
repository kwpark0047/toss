// Child-process test harness: dedicated local DB and persisted mock PG evidence only.
const url = new URL(process.env.P0_TEST_DATABASE_URL || 'http://missing');
if (url.hostname !== '127.0.0.1' || url.port !== '55438' || url.pathname !== '/wemarket_p0_schema_test')
  throw new Error('Dedicated isolated P0 database required');
const { PrismaClient } = require('../prisma/app/generated/prisma');
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
const RefundService = require('../services/RefundService');
const ledger = require('../services/LedgerService');
async function main() {
  const op = await db.refund_operations.findUnique({ where: { operation_key: process.env.P0_TEST_OPERATION_KEY } });
  if (!op?.provider_result) throw new Error('Persisted controlled PG evidence required');
  const provider = { getPayment: async () => op.provider_result,
    cancelPayment: async () => { throw new Error('Recovery must not execute another provider cancel'); } };
  const service = new RefundService({ db, provider, ledger, points: { revertOnCancel: async () => {} } });
  await service.refund(op.payment_id, { amount: op.amount,
    key: op.operation_key.slice(`refund:${op.payment_id}:`.length), reason: op.reason });
  console.log('RECOVERY_CONFIRMED');
}
main().catch(() => { console.error('Child recovery failed'); process.exitCode=1; })
  .finally(async () => { await db.$disconnect(); await require('../config/prisma').disconnectAll(); });
