const backendUrl =
  process.env.BACKEND_URL ||
  process.argv.find((arg) => arg.startsWith('--backend='))?.split('=')[1];
const frontendUrl =
  process.env.FRONTEND_URL ||
  process.argv.find((arg) => arg.startsWith('--frontend='))?.split('=')[1];

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
  const backendOk = await check(`${backendUrl.replace(/\/$/, '')}/api/health`, (body) => {
    try {
      const payload = JSON.parse(body);
      return payload.status === 'ok' || payload.status === 'degraded';
    } catch {
      return false;
    }
  });

  const frontendOk = frontendUrl
    ? await check(frontendUrl, (body) => /<html[\s>]/i.test(body))
    : true;

  if (!backendOk || !frontendOk) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`FAIL smoke test: ${error.message}`);
  process.exitCode = 1;
});
