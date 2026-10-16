# Toss webhook and GitHub deployment recovery

## Verified production baseline

- Production revision: `69bc3cffb1c389ea6d8d0f31bdfb2802e4bf954d` on frontend and backend.
- Public `/api/health`: HTTP 200, database connected.
- Public `/api/auth/free/config`: HTTP 200, `enabled=false`; production free authentication remains disabled.
- Frontend `/`, `/auth`, `/register`: HTTP 200 with the expected commit metadata.
- `/api/health/deep`: HTTP 503. Webhook verification configuration is still missing. This failure has not been suppressed.

## Confirmed deployment defects and changes

1. GitHub Actions lacked Vercel token, organization ID, and project ID. The verified production organization and project IDs were registered as Actions secrets. The owner approved a non-expiring token; it was further restricted to the `wemarket-saas` project and stored as `VERCEL_TOKEN`. The first unused token, whose clipboard transfer did not persist, was deleted with separate approval. No existing personal CLI credential was exported.
2. The deploy job ran Vercel from `frontend`, although the linked production project and root `vercel.json` require the repository root. Removed the directory change.
3. The Render hook deployed the latest branch head instead of the tested commit. It now uses the officially supported `ref` query parameter with `GITHUB_SHA` and a 60-second transport deadline. No automatic POST retry was introduced.
4. Vercel CLI was unpinned. CI now uses version `64.0.2`, matching the previously successful remote deployment version, and records commit/ref metadata.

## Tests actually executed

- Before correction: `node --test tests/saas/production-deploy-workflow.test.cjs` — 2 failed, reproducing root-directory and unpinned-commit defects.
- After correction: same command — 2 passed, 0 skipped.
- `node scripts/run-jest.cjs --config jest.config.js tests/unit/scripts/deploymentTarget.test.js --runInBand` — 6 passed.
- Webhook query redaction regression: 2 failing tests before correction; after correction, 5 Node tests passed including existing OAuth URL privacy and deployment configuration regressions.
- Webhook middleware, raw-body routes, query privacy routes, and deployment-target Jest tests: 32 passed. Initial restricted local socket execution failed with EACCES; the same suites passed with local networking permitted, without skips or production payment calls.
- `node reports/verify-auth-release-production-69bc3cf.cjs` — 5/6 production probes passed; deep health failed as described above.

## Toss provider verification

Official sources inspected on 2026-10-16:

- https://docs.tosspayments.com/guides/v2/webhook
- https://docs.tosspayments.com/reference/using-api/security
- https://render.com/docs/deploy-hooks

Toss officially documents webhook registration per MID and ten inbound IP addresses. IP configuration alone cannot be declared operational: the Express application currently does not explicitly establish Render proxy trust, so `req.ip` may represent the proxy. No arbitrary secret, permissive CIDR, unsigned bypass, or unverified signature setting was applied to turn health green.

After owner sign-in, the selected account is `개발 연동 체험 상점`, account `1905024`; both test and live webhook lists were empty. Owner approved a generated shared key in Render and the matching HTTPS query credential in Toss for payment/cancellation status events. The new early URL redaction removes the credential before application logging/tracing and preserves it as a non-enumerable request property for authentication. Duplicate query credentials are rejected. Provider registration waits for this privacy correction to deploy; successful real merchant delivery remains unverified. No payment, refund, or order state was changed.

## Pending gates

- Confirm all four deployment secrets through metadata and the actual CI deployment.
- Complete the approved shared-secret provider registration after the URL privacy correction is live.
- Commit/push the reviewed CI changes, execute the automatic deployment, and verify matching frontend/backend SHA, deep health, and `enabled=false` again.

Code correction, credential configuration, automatic deployment success, and real Toss delivery are separate states. Neither automatic deployment nor webhook operation is reported as complete at this point.
