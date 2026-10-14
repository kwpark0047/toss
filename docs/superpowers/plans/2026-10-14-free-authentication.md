# Free Authentication Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task-by-task; one fresh security review at the end.

**Goal:** Add Google, Kakao and email passwordless authentication without deleting legacy phone/password accounts.
**Architecture:** Express remains the session authority. Private PostgreSQL flow/challenge state, SMTP transport and server Turnstile verification are bounded dependencies. Existing IDs/FKs and JWT keys stay intact.
**Tech Stack:** React/Vite, Express, Prisma/PostgreSQL, jose, Nodemailer, Turnstile.
**Spec:** reports/FREE_AUTHENTICATION_PLAN_2026-10-14.md (user approved).

## Global constraints

- No actual SMS/payment/user-data mutations, production schema changes or deployments in this implementation stage.
- Keep legacy API contracts; private new auth defaults disabled until explicit configuration.
- No email-only automatic linking, client-selected role or MFA bypass.
- SMTP/provider acceptance is not delivery; uncertain mail requests are not blindly repeated.

## Review focus

- Concurrent callbacks/challenge consumption must create one identity/session result.
- Email collision with legacy unverified address must require existing account reauthentication.
- OAuth state must bind to initiating browser and PKCE/nonce, not a provider token alone.
- Deletion/linking must require recent proof and never delete financial/tenant records.
- Unconfigured providers, quota exhaustion and timeouts must fail safely without blocking orders.

## Tasks

- [ ] 1. Write RED tests for provider validation, single-use email proof and abuse limits; add private migration and typed policy helpers. Run node tests and isolated PostgreSQL.
- [ ] 2. Implement SMTP transport and email challenge/dispatch/expiry/attempt/CAS transactions. Run fault/concurrency tests against real PostgreSQL and Prisma.
- [ ] 3. Implement Google then Kakao server authorization-code flows and explicit linking; migrate legacy social issuance to existing session service. Test issuer/audience/state/nonce/unknown subject and collision failures.
- [ ] 4. Add session account status, recent reauthentication, unlink-last-method guard, passwordless MFA completion and deletion orchestration. Test revocation and tenancy preservation.
- [ ] 5. Add Turnstile/server configuration endpoint and React email/OAuth/callback/account controls. Test cold-start readiness, no POST replay and no secret exposure.
- [ ] 6. Run baseline/regression/build/Prisma validation and independent review. Document environment/migration/staging gates and actual unverified provider work.

Each task uses a failing executable test before product edits, minimal safe code, green regression, then ledger update. Checkpoint commands: node --test tests/saas/free-auth*.test.cjs; node scripts/test-free-auth-postgres.cjs; npm --prefix frontend test -- src/test/free-auth.test.jsx; npm --prefix frontend run build; npx prisma validate.

## Execution ledger

- Implementation: tasks 1–5 local code and tests implemented; actual provider validation is a separate gate, not complete.
- Verification: backend 177 suites/1357 tests, SaaS92, frontend49 files/201, additional recovery4 files/14; real isolated PostgreSQL and production build pass. See reports/FREE_AUTHENTICATION_IMPLEMENTATION_2026-10-14.md for commands and limits.
- Independent final review found stale identity/unlink race and legacy social MFA incompatibility. Rechecked identity under user lock; added PG interleaving test. Wired old frontend social response into browser-bound MFA and moved MFA completion before enrollment flag gate. Additional UI recovery defects corrected.
- Ruling: FREE_AUTH_ENABLED=false does not remove schema dependency. Schema-first deployment mandatory; no production migration/deployment in this task.
- Ruling: origin-wide random browser proof permits same-browser email link in a new tab; proof alone cannot authenticate. External domain/app details remain unprovided; no fabricated provider success.
- Remaining operational gates: SMTP/OAuth/Turnstile setup, real staging E2E, migration approval/application, rollout/rollback rehearsal and provider consent/retention policy review.

- BASE cac2afa328747869b5f26b341634e824a643acf3. Existing modified release reports preserved.
- Ruling: work in existing codex/ RC checkout, no branch reset or auto publication. Keep changes reviewable; schema approval/external credentials remain deployment gates.
- Ruling: add users auth_status/password_login_enabled/email_verified_at with additive schema; default legacy active/password enabled. Feature requires schema before enable; no production application now.
- Ruling: Turnstile Spin stock Worker workflow is unsuitable for existing Express auth; use official server Siteverify in Express as explicitly approved design, without provisioning another Worker.

