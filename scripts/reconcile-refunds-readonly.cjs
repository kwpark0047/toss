// Explicit, read-only evidence collection. No PG call, repair, migration or .env fallback.
const fs = require('node:fs');
const path = require('node:path');
const connection = process.env.P0_RECONCILE_DATABASE_URL;
if (!connection) throw new Error('P0_RECONCILE_DATABASE_URL is required; no default DB is allowed');
const { PrismaClient } = require('../prisma/app/generated/prisma');
const db = new PrismaClient({ datasources: { db: { url: connection } } });
async function main() {
  const rows = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return tx.$queryRawUnsafe(`SELECT p.id AS payment_id, p.store_id, p.order_id, p.status, p.amount,
      COALESCE(SUM(ABS(l.amount)) FILTER (WHERE l.type='REFUND'),0)::bigint AS confirmed_refunds,
      COUNT(*) FILTER (WHERE l.type='REFUND' AND l.amount<0)::integer AS legacy_negative_rows,
      COALESCE(SUM(l.amount) FILTER (WHERE l.type='INCOME'),0)::bigint AS ledger_income,
      (p.store_id<>o.store_id) AS tenant_mismatch
      FROM public.payments p JOIN public.orders o ON o.id=p.order_id
      LEFT JOIN public.ledger l ON l.payment_id=p.id
      GROUP BY p.id,o.store_id ORDER BY p.id`);
  });
  const report = { generated_at: new Date().toISOString(), mode: 'read_only', pg_verified: false,
    scope: 'local ledger/payment reconciliation; provider evidence required before corrections',
    payments: rows.map(row => {
      const refunds = Number(row.confirmed_refunds), income = Number(row.ledger_income);
      return { ...row, confirmed_refunds: refunds, ledger_income: income,
        local_remaining: row.amount-refunds, ledger_net: income-refunds,
        issues: [row.tenant_mismatch && 'tenant_mismatch', refunds>row.amount && 'over_refund',
          income!==row.amount && 'income_requires_reconciliation',
          row.status==='CANCELED' && refunds!==row.amount && 'canceled_balance_mismatch'].filter(Boolean) };
    }) };
  const output = path.resolve('reports/p0-refund-reconciliation-dry-run.json');
  fs.writeFileSync(output, JSON.stringify(report,null,2));
  console.log(JSON.stringify({ mode: report.mode, payments: rows.length,
    flagged: report.payments.filter(p => p.issues.length).length, output }));
}
main().catch(() => { console.error('Read-only reconciliation failed; no repair was performed'); process.exitCode=1; }).finally(() => db.$disconnect());
