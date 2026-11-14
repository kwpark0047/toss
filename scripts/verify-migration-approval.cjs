// Read-only GitHub preflight; no application or DB imports.
function validateEnvironment(environment, target) {
  const rule = environment?.protection_rules?.find((item) => item.type === 'required_reviewers');
  if (
    environment?.name !== target ||
    environment?.can_admins_bypass !== false ||
    rule?.prevent_self_review !== true ||
    !Array.isArray(rule.reviewers) ||
    !rule.reviewers.length ||
    !rule.reviewers.every(
      (entry) =>
        ['User', 'Team'].includes(entry.type) &&
        Number.isSafeInteger(entry.reviewer?.id) &&
        entry.reviewer.id > 0
    )
  )
    throw Error('MIGRATION_ENVIRONMENT_REQUIRES_NON_BYPASSABLE_REVIEW');
}
async function verifyApproval(config, fetcher = fetch) {
  const { enabled, target, ref, repository, token } = config;
  if (
    enabled !== 'true' ||
    !['staging', 'production'].includes(target) ||
    ref !== 'refs/heads/main' ||
    !/^[\w.-]+\/[\w.-]+$/.test(repository || '') ||
    !token
  )
    throw Error('MIGRATION_APPROVAL_PREFLIGHT_DISABLED_OR_INVALID');
  const response = await fetcher(
    `https://api.github.com/repos/${repository}/environments/${target}`,
    {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  if (!response.ok) throw Error('MIGRATION_ENVIRONMENT_UNVERIFIABLE');
  validateEnvironment(await response.json(), target);
}
module.exports = { validateEnvironment, verifyApproval };
if (require.main === module) {
  verifyApproval({
    enabled: process.env.ENABLE_APPROVED_DB_MIGRATIONS,
    target: process.env.MIGRATION_TARGET,
    ref: process.env.GITHUB_REF,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GH_TOKEN,
  })
    .then(() => console.log('Protected environment verified; platform approval is still required.'))
    .catch(() => {
      console.error('MIGRATION_APPROVAL_PREFLIGHT_FAILED');
      process.exitCode = 1;
    });
}
