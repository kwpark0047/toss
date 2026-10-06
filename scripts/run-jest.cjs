const { spawnSync } = require('node:child_process');
const path = require('node:path');
const options = [
  ...new Set(
    (process.env.NODE_OPTIONS || '')
      .split(/\s+/)
      .filter(Boolean)
      .concat('--experimental-vm-modules')
  ),
].join(' ');
const result = spawnSync(
  process.execPath,
  [
    '--import',
    'tsx',
    path.join(__dirname, '../node_modules/jest/bin/jest.js'),
    ...process.argv.slice(2),
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', NODE_OPTIONS: options },
  }
);
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
