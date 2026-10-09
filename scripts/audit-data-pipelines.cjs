// Read-only operating DB audit; aggregates only, never exports keys or customer records.
const fs = require('node:fs');
const { Client } = require('pg');
const env = require('dotenv').parse(fs.readFileSync('.env.production'));
async function main() {
  const client = new Client({ connectionString: env.DIRECT_URL || env.DATABASE_URL });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout='15s'");
    const query = async (sql, args = [3]) => (await client.query(sql, args)).rows;
    const result = {
      checkedAt: new Date().toISOString(), storeId: 3, mode: 'read-only',
      connections: await query('SELECT channel,method,enabled,COUNT(*)::int AS count,MAX(last_ingested_at) AS last_ingested_at FROM public.integration_connections WHERE store_id=$1 GROUP BY channel,method,enabled'),
      ingestion: await query('SELECT kind,COUNT(*)::int AS count,MAX(created_at) AS latest FROM public.integration_events WHERE store_id=$1 GROUP BY kind'),
      apiKeys: await query('SELECT revoked,COUNT(*)::int AS count,MAX(last_used_at) AS last_used_at FROM public.api_keys WHERE store_id=$1 GROUP BY revoked'),
      webhooks: await query('SELECT active,COUNT(*)::int AS count FROM public.webhook_endpoints WHERE store_id=$1 GROUP BY active'),
      deliveries: await query('SELECT d.status,COUNT(*)::int AS count FROM public.webhook_deliveries d JOIN public.webhook_endpoints e ON e.id=d.endpoint_id WHERE e.store_id=$1 GROUP BY d.status'),
      nativeOrders: await query('SELECT method,order_type,COUNT(*)::int AS count FROM public.orders WHERE store_id=$1 GROUP BY method,order_type'),
      reviews: await query('SELECT COUNT(*)::int AS count,MAX(created_at) AS latest FROM public.reviews WHERE store_id=$1'),
      webhookColumns: (await query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='webhook_deliveries' AND column_name IN ('attempt','attempts','delivered_at','next_retry_at')", [])).map(row => row.column_name),
      localProductionConfigOnly: Object.fromEntries(['NAVER_CLIENT_ID','NAVER_CLIENT_SECRET','SEOUL_OPENAPI_KEYS','KMA_API_KEY'].map(key => [key, Boolean(env[key]?.trim())])),
    };
    await client.query('COMMIT');
    fs.writeFileSync('reports/DATA_PIPELINE_AUDIT_2026-10-07.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await client.end(); }
}
main().catch(error => { console.error(JSON.stringify({ code: error.code, message: error.message })); process.exitCode = 1; });
