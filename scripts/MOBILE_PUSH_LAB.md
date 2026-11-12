# Isolated mobile Web Push lab

`mobile-push-lab.cjs` is a manually launched QA gateway, not an application route or production worker. Each successful anonymous cash test order is scheduled for ready after 30 seconds. The timer runs on the QA server even after all customer pages close. Its page banner is injected only into the lab's private copy of the built frontend; `frontend/src` and `frontend/public` are unchanged.

## Production boundary

- Launch requires `--isolated-test-only`. Production NODE_ENV, Render, Vercel, Cloudflare Pages, and inherited non-lab database URLs are rejected before reading fixtures, opening listeners or starting children.
- Database URL is fixed to the synthetic PostgreSQL database on `127.0.0.1:15438`; Redis is fixed to loopback port 6399. There is no remote database override.
- Preflight requires the synthetic owner email, exact fixture ownership, no other stores, no orders with customer names/phones, and the 10,000-won QA menu.
- The API child gets a minimal environment and independent QA VAPID/JWT/encryption values. It runs from an empty private working directory; production/staging dotenv files are not loaded.
- Public APIs allow only the single store, session-created order IDs and capability-authorized subscriptions. Card/Toss confirmation, staff login, billing and webhooks are blocked. Cash only registers READY; order payment remains pending.
- Each timer calls the loopback operator tool, which rechecks the session order, test store, missing PII and unpaid status before using normal status transitions. It never confirms payment.
- Production entry points, orders service and push worker do not import the lab. Docker excludes the launchers and private files. CI executes production-refusal and allowlist tests; it does not start a tunnel.

## Setup on a test workstation

Requires Node 22+, Docker, installed project dependencies, and an official `cloudflared` executable at `.tmp/order-completion-sandbox/tools/cloudflared.exe` (the current launcher is Windows-oriented). Download only from [Cloudflare's official downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) and verify its published digest. No Cloudflare account or paid subscription is needed for a temporary quick tunnel.

Provision an **empty disposable** PostgreSQL database with loopback binding 15438 and Redis with loopback binding 6399. Do not reuse a non-test database. Existing port bindings must be inspected first; do not overwrite another container. Example for unused ports:

```powershell
docker run -d --name mobile-push-qa-db -p 127.0.0.1:15438:5432 -e POSTGRES_USER=qa -e POSTGRES_PASSWORD=synthetic-local-only -e POSTGRES_DB=order_completion_qa postgres:16-alpine
docker run -d --name mobile-push-qa-redis -p 127.0.0.1:6399:6379 redis:7-alpine
$env:DATABASE_URL='postgresql://qa:synthetic-local-only@127.0.0.1:15438/order_completion_qa'
$env:DIRECT_URL=$env:DATABASE_URL
npx prisma db push
node scripts/prepare-mobile-push-lab.cjs --isolated-test-only
```

Do not set NODE_ENV=production in the parent shell. Build the customer frontend with relative lab API/socket URLs and the exact current commit, then launch:

```powershell
$env:VITE_API_URL='/api'
$env:VITE_SOCKET_URL='/'
$env:VITE_TOSS_CLIENT_KEY=''
$env:VITE_HTTPONLY_COOKIE='false'
$env:APP_COMMIT_SHA=git rev-parse HEAD
npm --prefix frontend run build
node scripts/mobile-push-lab.cjs --isolated-test-only
```

The launcher prints a temporary HTTPS `/lab` URL and a four-hour expiry. Android uses ordinary Chrome. On iOS 16.4+, add `/lab` to Home Screen and create the order inside that installed web app. Create one cash QA order, enable server notifications, confirm the enabled message and close all customer pages **before the 30-second countdown ends**. Tap the real OS notification and verify the same order number, amount and ready state. Use a new order when the deadline was missed. No customer login/contact information/card data is required.

## Checks and evidence

```powershell
node scripts/test-mobile-push-lab-policy.cjs
node scripts/test-mobile-push-lab-isolation.cjs
node scripts/verify-mobile-push-lab.cjs
```

The last command requires Windows Edge with native push connectivity and the running lab. It checks real WNS delivery after closing customer pages, auto-ready timing, API denials and direct-URL order recovery. It **does not click an OS notification and is not Android/iPhone evidence**. Historical physical-device attempts and evidence are in `reports/physical-mobile-push-2026-11-12/`. Temporary links/QRs there expire; use the URL printed by a new launcher run.

`node scripts/mobile-push-lab-control.cjs status` prints redacted state. `stop` shuts down only this lab. Timers are in-memory and are cleared on shutdown; orders are not rescheduled across restarts. Runtime files, synthetic passwords, tokens, private VAPID keys and browser profiles stay ignored under `.tmp/order-completion-sandbox/` and must never be committed.
