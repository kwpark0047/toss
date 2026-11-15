// Independent operational opt-in; never loads application, DB or AI modules.
async function runKeepWarm({ enabled, ref, fetcher = fetch } = {}) {
  if (enabled !== 'true' || ref !== 'refs/heads/main') return { skipped: true };
  const response = await fetcher('https://wemarket-eiw4.onrender.com/api/health/live', {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'wemarket-keep-warm' },
  });
  if (!response.ok) throw Error('KEEP_WARM_HEALTH_FAILED');
  await response.body?.cancel();
  return { skipped: false };
}
module.exports = { runKeepWarm };
if (require.main === module) {
  runKeepWarm({ enabled: process.env.ENABLE_RENDER_KEEP_WARM, ref: process.env.GITHUB_REF })
    .then(({ skipped }) =>
      console.log(skipped ? 'Keep-warm OFF; no request sent.' : 'Liveness read completed.')
    )
    .catch(() => {
      console.error('KEEP_WARM_HEALTH_FAILED');
      process.exitCode = 1;
    });
}
