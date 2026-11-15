const {
  validateEnvironment,
  verifyApproval,
} = require('../../../scripts/verify-migration-approval.cjs');
const protectedEnvironment = () => ({
  name: 'production',
  can_admins_bypass: false,
  protection_rules: [
    {
      type: 'required_reviewers',
      prevent_self_review: true,
      reviewers: [{ type: 'Team', reviewer: { id: 123 } }],
    },
  ],
});
const config = () => ({
  enabled: 'true',
  target: 'production',
  ref: 'refs/heads/main',
  repository: 'owner/repo',
  token: 'fixture-token',
});
test('accepts an existing exact protected environment without changing it', () =>
  expect(validateEnvironment(protectedEnvironment(), 'production')).toBeUndefined());
test.each([
  ['missing', () => null],
  ['wrong case', () => ({ ...protectedEnvironment(), name: 'Production' })],
  ['no reviewers', () => ({ ...protectedEnvironment(), protection_rules: [] })],
  [
    'empty reviewers',
    () => ({
      ...protectedEnvironment(),
      protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [] }],
    }),
  ],
  [
    'self approval',
    () => ({
      ...protectedEnvironment(),
      protection_rules: [
        { ...protectedEnvironment().protection_rules[0], prevent_self_review: false },
      ],
    }),
  ],
  ['admin bypass', () => ({ ...protectedEnvironment(), can_admins_bypass: true })],
])('fails closed for %s', (_name, make) =>
  expect(() => validateEnvironment(make(), 'production')).toThrow()
);
test.each([
  { enabled: 'false' },
  { target: 'preview' },
  { ref: 'refs/heads/feature' },
  { token: '' },
])('rejects unsafe invocation before network access %j', async (override) => {
  const fetcher = jest.fn();
  await expect(verifyApproval({ ...config(), ...override }, fetcher)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([403, 404, 500])('blocks inaccessible environment HTTP %s', async (status) => {
  await expect(verifyApproval(config(), async () => ({ ok: false, status }))).rejects.toThrow();
});
test('performs only authenticated read against the exact environment endpoint', async () => {
  const fetcher = jest.fn(async () => ({ ok: true, json: async () => protectedEnvironment() }));
  await verifyApproval(config(), fetcher);
  expect(fetcher).toHaveBeenCalledWith(
    'https://api.github.com/repos/owner/repo/environments/production',
    expect.objectContaining({ method: 'GET', redirect: 'error' })
  );
});
test('network or malformed responses cannot authorize application', async () => {
  await expect(
    verifyApproval(config(), async () => {
      throw Error('offline');
    })
  ).rejects.toThrow();
  await expect(
    verifyApproval(config(), async () => ({ ok: true, json: async () => ({}) }))
  ).rejects.toThrow();
});
