const expected = require('../config/deployment-targets.json').production;
if (process.env.RENDER_DEPLOY_HOOK_URL) {
  try {
    const hook = new URL(process.env.RENDER_DEPLOY_HOOK_URL);
    if (
      hook.origin !== 'https://api.render.com' ||
      hook.pathname !== '/deploy/' + expected.renderServiceId ||
      !hook.searchParams.get('key') ||
      hook.username ||
      hook.password ||
      hook.hash
    )
      throw new Error();
  } catch {
    console.error('Render deployment target is invalid. Deployment refused.');
    process.exitCode = 1;
  }
}
for (const [key, value] of Object.entries({
  VITE_API_URL: expected.backendUrl + '/api',
  VITE_SOCKET_URL: expected.backendUrl,
  BACKEND_URL: expected.backendUrl,
})) {
  if (process.env[key] && process.env[key] !== value) {
    console.error('Production backend target mismatch: ' + key + '. Deployment refused.');
    process.exitCode = 1;
  }
}
if (
  process.env.VERCEL_PROJECT_ID !== expected.vercelProjectId ||
  process.env.VERCEL_ORG_ID !== expected.vercelOrgId
) {
  console.error(
    'Production Vercel target is missing or differs from config/deployment-targets.json. Deployment refused.'
  );
  process.exitCode = 1;
}
