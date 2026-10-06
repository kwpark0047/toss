const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const legacy = require('../../config/domain.js');
const moduleScope = { exports: {} };
const source = fs.readFileSync(path.resolve(__dirname, '../../config/domain.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(compiled, { exports: moduleScope.exports, module: moduleScope, process, URL });
const runtime = moduleScope.exports;

test('both domain runtimes permit the owned SaaS production origins and reject unrelated deployments', () => {
  for (const config of [legacy, runtime]) {
    assert.equal(config.isOriginAllowed('https://wemarket-saas.vercel.app'), true);
    assert.equal(config.isOriginAllowed('https://wemarket-saas-kwpark0047-8227s-projects.vercel.app'), true);
    assert.equal(config.isOriginAllowed('https://attacker.vercel.app'), false);
    assert.equal(config.isOriginAllowed('https://wemarket-saas.vercel.app.attacker.example'), false);
  }
});

test('CommonJS and TypeScript entry points expose the same allowed origins', () => {
  assert.deepEqual([...legacy.getAllowedOrigins()].sort(), [...runtime.getAllowedOrigins()].sort());
});
