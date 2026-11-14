const DATABASE_URL = 'postgresql://qa:synthetic-local-only@127.0.0.1:15438/order_completion_qa';

function assertLabLaunch(args, env) {
  if (!args.includes('--isolated-test-only')) throw Error('ISOLATED_TEST_FLAG_REQUIRED');
  if (env.NODE_ENV === 'production' || env.RENDER || env.VERCEL || env.CF_PAGES) {
    throw Error('HOSTED_OR_PRODUCTION_ENVIRONMENT_FORBIDDEN');
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL', 'REPLICA_URL']) {
    if (env[key] && env[key] !== DATABASE_URL)
      throw Error('NON_LAB_DATABASE_ENVIRONMENT_FORBIDDEN');
  }
}

module.exports = { DATABASE_URL, assertLabLaunch };
