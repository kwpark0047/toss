# Authentication release — 2026-10-16

## Changes
- Refresh expired sessions once for account-bound free-auth requests. Anonymous authentication, invalid OTPs, MFA and OAuth exchange remain excluded from automatic retry.
- Clear consumed email challenges after successful reauthentication/linking.
- Reject unsupported Google recent-auth requests before redirect: the actual staging response did not contain auth_time. Preserve strict recent-auth checks and Google login/linking; direct users to supported reauthentication methods.
- Accept completed empty-store loading without a dashboard refetch loop.

## Verification
- Actual isolated staging: Google and Kakao account linking and regular login; Kakao recent authentication; real SMTP email OTP and email recent authentication. Real email-link validation was completed in the preceding staging session.
- Turnstile server validation succeeded with manual browser assistance; automated browser challenges intermittently returned 300030.
- Backend authentication/preflight: 15 tests passed.
- Focused frontend authentication/session regression: 23 tests passed.
- Full frontend: 215 tests passed across 52 files with maxWorkers=2. The initial default-worker run had one dynamic-import timeout; no timeout or skip was changed.

## Release constraints
Production FREE_AUTH_ENABLED remains false. No operational credentials, staging environments, legal drafts or browser screenshots are included in this commit. No DB migration or production account change is required. Real production OAuth/signup activation is outside this release. Provider configuration completed in staging does not establish production readiness.

Deploy the same immutable commit to existing Render and Vercel projects and verify health/version plus disabled free-auth configuration. Previous release is adb0b70a1594685339ac7df5651127463f5797d1; rollback may redeploy that commit without a DB migration.
