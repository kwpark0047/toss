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

// Render 빌드(npm ci + 마이그레이션 + prisma generate)는 보통 2~3분, 길게는 7분 이상 걸린다.
// 새 리비전이 올라올 때까지 기본 10분 기다린다. 환경변수로 조정할 수 있다.
const DEFAULT_WAIT_MS = 10 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 10 * 1000;
function durationFromEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}
const shortRevision = (value) =>
  typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value) ? value.slice(0, 7) : 'unknown';

if (!backendUrl) {
  console.error('BACKEND_URL 또는 --backend=<url>가 필요합니다.');
  process.exit(2);
}

async function check(url, expected) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  const ok = response.status >= 200 && response.status < 300 && (!expected || expected(body));
  console.log(`${ok ? 'PASS' : 'FAIL'} ${url} → HTTP ${response.status}`);
  return ok;
}

async function main(options = {}) {
  const normalizedBackendUrl = backendUrl.replace(/\/$/, '');
  const waitMs =
    options.waitMs ??
    durationFromEnv('SMOKE_BACKEND_WAIT_MS', DEFAULT_WAIT_MS, 10000, 30 * 60 * 1000);
  const intervalMs =
    options.intervalMs ??
    durationFromEnv('SMOKE_POLL_INTERVAL_MS', DEFAULT_INTERVAL_MS, 1000, 60000);
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const started = Date.now();
  const deadline = started + waitMs;
  let backendOk = false;
  let lastRevision;
  while (!backendOk && Date.now() < deadline) {
    try {
      backendOk = await check(`${normalizedBackendUrl}/api/health`, (body) => {
        try {
          const payload = JSON.parse(body);
          lastRevision = payload.revision;
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
    if (!backendOk) {
      if (expectedRevision) {
        const elapsed = Math.round((Date.now() - started) / 1000);
        console.log(
          `WAIT backend revision ${shortRevision(lastRevision)} → expected ${shortRevision(expectedRevision)} (${elapsed}s / ${Math.round(waitMs / 1000)}s)`
        );
      }
      await sleep(intervalMs);
    }
  }
  if (!backendOk)
    console.log(
      `FAIL backend did not report the expected revision within ${Math.round(waitMs / 1000)}s`
    );

  const deepHealthOk = await check(`${normalizedBackendUrl}/api/health/deep`, (body) => {
    try {
      const payload = JSON.parse(body);
      const statusOk = payload.status === 'ok';
      const checks = payload.checks || {};
      return Boolean(
        statusOk && checks.database?.status === 'ok' && checks.operationalConfig?.status === 'ok'
      );
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

module.exports = { check, main };

if (require.main === module)
  main().catch(() => {
    console.error('FAIL smoke test: response unavailable or invalid; details suppressed');
    process.exitCode = 1;
  });
