const production = require('../config/deployment-targets.json').production;
const backendUrl =
  process.env.BACKEND_URL ||
  process.argv.find((arg) => arg.startsWith('--backend='))?.split('=')[1] ||
  production.backendUrl;
const frontendUrl =
  process.env.FRONTEND_URL ||
  process.argv.find((arg) => arg.startsWith('--frontend='))?.split('=')[1] ||
  production.frontendUrl;
const expectedRevision = process.env.EXPECTED_COMMIT_SHA;

if (!backendUrl) {
  console.error('BACKEND_URL 또는 --backend=<url>가 필요합니다.');
  process.exit(2);
}

async function check(url, expected) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  const ok = response.status >= 200 && response.status < 300 && (!expected || expected(body));
  console.log(`${ok ? 'PASS' : 'FAIL'} ${url} → HTTP ${response.status}`);
  if (!ok && body) console.log(body.slice(0, 500));
  return ok;
}

async function main() {
  const normalizedBackendUrl = backendUrl.replace(/\/$/, '');
  const deadline = Date.now() + 120000;
  let backendOk = false;
  while (!backendOk && Date.now() < deadline) {
    try {
      backendOk = await check(`${normalizedBackendUrl}/api/health`, (body) => {
        try {
          const payload = JSON.parse(body);
          return (
            payload.status === 'ok' &&
            payload.db === 'connected' &&
            (!expectedRevision || payload.revision === expectedRevision)
          );
        } catch {
          return false;
        }
      });
    } catch {
      /* deployment may still be starting */
    }
    if (!backendOk) await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const deepHealthOk = await check(`${normalizedBackendUrl}/api/health/deep`, (body) => {
    try {
      const payload = JSON.parse(body);
      const statusOk = payload.status === 'ok';
      const checks = payload.checks || {};
      return Boolean(statusOk && checks.database && checks.operationalConfig);
    } catch {
      return false;
    }
  });

  const frontendOk = frontendUrl
    ? await check(
        frontendUrl,
        (body) =>
          /<html[\s>]/i.test(body) &&
          (!expectedRevision || body.includes(`name="app-commit" content="${expectedRevision}"`))
      )
    : true;

  if (!backendOk || !deepHealthOk || !frontendOk) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`FAIL smoke test: ${error.message}`);
  process.exitCode = 1;
});
