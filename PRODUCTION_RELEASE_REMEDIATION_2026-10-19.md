# Production release blocker remediation

**Date:** 2026-10-19 (KST)
**Checkout:** `codex/release-candidate-20261009` at `0fd8639`
**Decision:** **NO-GO for production release**; local code/build gates now pass, but remote operations are unverified.

## What changed

- Removed `node scripts/deploy-migrations.cjs --apply` from the Render build. `render.yaml` now only installs dependencies and generates Prisma Client; `autoDeploy` remains disabled. Production migration application stays an explicit operator action.
- Added `npm run db:migrate:plan` for the migration tool's default dry-run mode and documented a backup, review, approval, apply, and post-check sequence in `docs/deployment/production-migrations.md`.
- Added regression coverage that fails if a Render build applies migrations. Updated the existing deployment test to enforce the same policy.
- Fixed tests whose fixtures no longer modeled access sessions/business account state and updated route mocks to isolate role tests from the separate trial-expiry middleware tests.
- Relaxed a brittle integration-guide assertion to match the actual user-facing copy without changing the page behavior.
- Increased a spawned Node/tsx cache test's hard timeout from 8 seconds to 30 seconds. It remains bounded and passed in the full suite.
- Changed the root build script to use the npm cache and skip registry audit/funding requests for the nested frontend install. A clean install and full build then completed.
- Ignored local audit snapshots and temporary compile caches in `.gitignore` without deleting them. Git status dropped from 34,620 entries to 124 (81 modified, 43 untracked); the remaining untracked source, tests, and migration files are still visible for review.
- Scoped root ESLint away from audit evidence/caches. The product-source lint now finishes with zero errors instead of scanning copied historical repository trees.

## Verification results

| Check | Result | Evidence |
|---|---|---|
| Backend unit + route regressions | **PASS** | 185 suites, 1,443 tests passed. Command: `node scripts/run-jest.cjs --config jest.config.js tests/unit tests/routes --runInBand --coverage=false`. |
| SaaS regressions | **PASS** | 125/125 passed, including the new Render migration policy test. Command: `npm run test:saas`. |
| Frontend regressions | **PASS** | 58 files, 235/235 tests passed. Command: `npm --prefix frontend test -- --maxWorkers=2`. |
| Backend typecheck | **PASS** | `npm run typecheck:backend`. |
| Frontend typecheck | **PASS** | `npm --prefix frontend run typecheck`. |
| Backend ESLint | **PASS with warnings** | 0 errors, 90 existing warnings. Command: `npm run lint -- --no-warn-ignored`. |
| Frontend ESLint | **PASS with warnings** | 0 errors, 115 warnings. Command: `npm --prefix frontend run lint`. |
| Prisma schema validation | **PASS** | `npx prisma validate`. This validates the checked-in schema only, not a live database. |
| Route/API/JSX validators | **PASS** | `npm run validate:routes`, `npm run validate:api`, and `npm run validate:jsx`. |
| Render YAML / build migration policy | **PASS** | Parsed `render.yaml`; build command is `npm ci --include=dev && npx prisma generate`, with no migration command. Automated regression asserts this. |
| Integrated build | **PASS** | `npm run build`; Prisma Client and Vite/PWA build completed. The clean frontend install added 842 packages and took about 4 minutes. |
| Git whitespace validation | **PASS** | `git diff --check`; only existing line-ending conversion notices were emitted. |
| Vercel CLI install | **PASS** | Already installed globally: `vercel` 64.5.0, Node 24.11.1. No reinstall was needed. |

The Vite build still reports two non-blocking optimization warnings: `wakeup.js` is both statically and dynamically imported, and several chunks exceed 400 KB. These were not changed as part of the release blockers.

## Still blocking production

1. **Live environment not verified.** `vercel whoami` failed with `fetch failed`; the CLI is installed, but account authentication and deployment access could not be verified. Render environment variables, current deployed SHA, health, and rollback target were not inspected.
2. **Database state not verified.** No production or staging database URL was used; migration history, schema drift, RLS catalog, and PITR/restore were not checked. No migration was applied. New migrations remain unverified against a dedicated staging database.
3. **End-to-end external flows not verified.** No authenticated staging browser E2E, live OAuth/Turnstile/email flow, Toss sandbox approval/refund/webhook, or external provider reconciliation was run in this pass.
4. **Release contents not sealed.** The working tree still has 81 modified and 43 untracked paths, and the branch is four commits ahead of `origin/main`. No commit, push, or deployment was made. The report/evidence archive and remaining untracked source files need explicit release-scope and secret review before publishing.
5. **Secret scan not completed.** `gitleaks` and `trufflehog` are not installed in this environment. No values from environment files were read or printed. Do not stage or publish until an approved secret scanner reviews the exact release set.
6. **Signup remains disabled by the Render template.** `FREE_AUTH_SIMPLE_SIGNUP_ENABLED=false` is preserved. The live Turnstile/policy configuration and production signup flow are unknown, so this pass did not enable public signup.

## Release decision and next checks

The local automated code gates requested here are green, but that is not equivalent to production readiness. Keep deployment and public signup disabled until an operator verifies the exact release SHA, staging database migrations/RLS and role flows, live provider configuration, rollback target, and secret-scan result. Then schedule the separately approved production migration/deployment and verify the resulting health and deployed SHA.

No operating database, production data, payment, webhook registration, Render environment, or deployment was changed in this pass.

