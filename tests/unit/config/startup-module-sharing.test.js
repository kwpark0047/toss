const { spawnSync } = require('node:child_process');
const path = require('node:path');
test.each([[[]], [['--ts-first']], [['--replica']], [['--ts-first', '--replica']]])(
  'tsx and CommonJS share canonical modules %j',
  (args) => {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        path.resolve(__dirname, '../../fixtures/startup-module-sharing.cjs'),
        ...args,
      ],
      {
        cwd: path.resolve(__dirname, '../../..'),
        env: { ...process.env, NODE_OPTIONS: '' },
        encoding: 'utf8',
        timeout: 15000,
      }
    );
    expect({ status: result.status, stderr: result.stderr, error: result.error?.message }).toEqual({
      status: 0,
      stderr: '',
      error: undefined,
    });
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout).networkCalls).toBe(0);
  }
);
