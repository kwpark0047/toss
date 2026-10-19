# Production database migrations

Render builds are deliberately side-effect free: `render.yaml` installs the
locked dependencies and generates Prisma Client, but never connects to or
changes PostgreSQL.

For a production schema change:

1. Confirm the candidate commit and reviewed SQL migrations.
2. Verify the target is the intended production database without printing its
   connection string; take/confirm a recoverable backup first.
3. Run `npm run db:migrate:plan` against the intended database and review the
   summary. This command does not apply Prisma migrations.
4. Obtain the required production change approval, then run
   `npm run db:migrate:prod` as a separate operator action.
5. Verify migration status and application health before promoting the build.

Never add `--apply` to a build, deploy hook, or automatic startup command. A
build retry must not mutate production data or schema. This document describes
the release procedure; it does not assert that any live database was inspected
or migrated.

