// Native process ownership spans ESM/CJS wrappers and test module contexts.
const runtimeProcess = require('node:process');
const key = Symbol.for('wemarket.runtime.resourceClosers');
const closers = runtimeProcess[key] || (runtimeProcess[key] = new Set());
function registerResource(close) {
  closers.add(close);
  return () => closers.delete(close);
}
async function closeRuntimeResources() {
  const pending = [...closers];
  const outcomes = await Promise.allSettled(pending.map((close) => close()));
  pending.forEach((close) => closers.delete(close));
  if (outcomes.some((result) => result.status === 'rejected'))
    throw new Error('RESOURCE_CLOSE_FAILED');
}
module.exports = { registerResource, closeRuntimeResources };
