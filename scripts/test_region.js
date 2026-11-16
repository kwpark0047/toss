// Manual read-only diagnostic. Importing this module never creates a DB client.
function buildProbeConfig(env) {
  if (
    env.ALLOW_REGION_PROBE !== 'true' ||
    !/^[a-z0-9]{20}$/.test(env.SUPABASE_PROJECT_REF || '') ||
    !env.SUPABASE_DB_PASSWORD ||
    !/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(env.SUPABASE_POOLER_HOST || '')
  )
    throw Error('REGION_PROBE_CONFIGURATION_REQUIRED');
  const url = `postgresql://postgres.${env.SUPABASE_PROJECT_REF}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@${env.SUPABASE_POOLER_HOST}:6543/postgres?pgbouncer=true&connect_timeout=5&sslmode=require`;
  return { datasources: { db: { url } } };
}
async function runProbe({ env = process.env, createClient, log = console.log } = {}) {
  const config = buildProbeConfig(env);
  const factory =
    createClient ||
    ((options) => new (require('../prisma/app/generated/prisma').PrismaClient)(options));
  let client;
  try {
    client = factory(config);
    await client.$queryRaw`SELECT 1`;
    log('connection succeeded');
    return true;
  } catch {
    // SDK errors may contain connection URLs or credentials: never log them.
    log('connection failed');
    return false;
  } finally {
    if (client) await client.$disconnect().catch(() => {});
  }
}
module.exports = { buildProbeConfig, runProbe };
if (require.main === module) {
  runProbe()
    .then((ok) => {
      if (!ok) process.exitCode = 1;
    })
    .catch(() => {
      console.error('REGION_PROBE_CONFIGURATION_REQUIRED');
      process.exitCode = 1;
    });
}
