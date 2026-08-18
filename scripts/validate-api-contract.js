const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const CRITICAL_CONTRACTS = [
  {
    file: 'customers.js',
    mount: 'customers',
    paths: ['/phone-join', '/update-location', '/fcm-token'],
  },
  { file: 'orders.js', mount: 'orders', paths: ['/customer/history', '/:id/status'] },
  { file: 'staff.js', mount: 'staff', paths: ['/store/:storeId/role', '/:id/clock-in'] },
  { file: 'kds.js', mount: 'kds', paths: ['/stores/:storeId/orders'] },
  { file: 'auditLogs.js', mount: 'admin', paths: ['/audit-logs'] },
  { file: 'featureFlags.js', mount: 'admin', paths: ['/feature-flags'] },
];

const validateApiContract = ({ root = ROOT } = {}) => {
  const appContent = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const failures = [];

  for (const contract of CRITICAL_CONTRACTS) {
    const routePath = path.join(root, 'routes', contract.file);
    if (!fs.existsSync(routePath)) {
      failures.push(`missing route file: routes/${contract.file}`);
      continue;
    }

    const routeContent = fs.readFileSync(routePath, 'utf8');
    if (
      !appContent.includes(`routes.${path.basename(contract.file, '.js')}`) ||
      !appContent.includes(`\${API_PREFIX}/${contract.mount}`)
    ) {
      failures.push(`route is not mounted: /api/${contract.mount} (${contract.file})`);
    }
    for (const endpoint of contract.paths) {
      if (!routeContent.includes(endpoint))
        failures.push(`missing endpoint ${contract.file}: ${endpoint}`);
    }
  }

  return failures;
};

if (require.main === module) {
  const failures = validateApiContract();
  if (failures.length) {
    console.error('API contract validation failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log(
    `API contract validation passed (${CRITICAL_CONTRACTS.length} critical route groups).`
  );
}

module.exports = { CRITICAL_CONTRACTS, validateApiContract };
