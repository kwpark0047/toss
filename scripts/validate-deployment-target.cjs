const expected = require('../config/deployment-targets.json').production;
if (process.env.VERCEL_PROJECT_ID !== expected.vercelProjectId || process.env.VERCEL_ORG_ID !== expected.vercelOrgId) {
  console.error('Production Vercel target is missing or differs from config/deployment-targets.json. Deployment refused.');
  process.exitCode = 1;
}
