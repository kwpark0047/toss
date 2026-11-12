// Temporary, single-store lab. Never run this against a production database.
require('./mobile-push-lab-guard.cjs').assertLabLaunch(process.argv.slice(2), process.env);
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { Client } = require('pg');
const { Server } = require('socket.io'),
  { io: connect } = require('socket.io-client');
const { cleanOrder, cleanCashRequest, allowRead } = require('./mobile-push-lab-policy.cjs');
const ROOT = path.resolve(__dirname, '..'),
  PRIVATE = path.join(ROOT, '.tmp/order-completion-sandbox/mobile-lab');
const STATE = path.join(PRIVATE, 'runtime.json'),
  API_PORT = 5310,
  GATEWAY_PORT = 5322,
  CONTROL_PORT = 5324;
const DB = require('./mobile-push-lab-guard.cjs').DATABASE_URL;
const MAX_ORDERS = 20,
  TTL = 4 * 60 * 60 * 1000,
  AUTO_READY_MS = 30000;
const readyTimers = new Set();
const children = [];
let closing = false;
const state = {
  startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + TTL).toISOString(),
  publicOrigin: null,
  ready: false,
  apiPort: API_PORT,
  gatewayPort: GATEWAY_PORT,
  controlPort: CONTROL_PORT,
  operatorToken: crypto.randomBytes(32).toString('base64url'),
  orders: [],
  labMode: 'isolated-mobile-push',
  autoReadyAfterMs: AUTO_READY_MS,
  metrics: { blockedPayments: 0, blockedPersonalData: 0 },
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
};
const osEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(path|systemroot|comspec|temp|tmp|userprofile|appdata|localappdata|processor_architecture|number_of_processors)$/i.test(
      key
    )
  )
);
function save() {
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}
function reply(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}
function html(res, value) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(value);
}
async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 32768) throw Error('BODY_LIMIT');
  }
  return data ? JSON.parse(data) : {};
}
function launch(command, args, options, logName) {
  const log = fs.openSync(path.join(PRIVATE, logName), 'a');
  const child = spawn(command, args, {
    ...options,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  children.push(child);
  return child;
}
async function waitApi() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${API_PORT}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error('QA_API_NOT_READY');
}
async function main() {
  fs.mkdirSync(PRIVATE, { recursive: true });
  const fixture = JSON.parse(
    fs.readFileSync(path.join(ROOT, '.tmp/order-completion-sandbox/fixture.json'))
  );
  if (fixture.dbUrl !== DB || !fixture.email.endsWith('@example.invalid'))
    throw Error('ISOLATED_SYNTHETIC_FIXTURE_REQUIRED');
  const db = new Client({ connectionString: DB });
  await db.connect();
  try {
    const rows = (
      await db.query(
        'SELECT p.name,p.price,p.stock_quantity FROM products p JOIN stores s ON s.id=p.store_id JOIN users u ON u.id=s.user_id WHERE p.id=$1 AND s.id=$2 AND u.id=$3 AND u.email=$4',
        [fixture.productId, fixture.storeId, fixture.userId, fixture.email]
      )
    ).rows;
    if (rows.length !== 1 || rows[0].price !== 10000 || rows[0].stock_quantity < 10)
      throw Error('TEST_PRODUCT_PRECHECK_FAILED');
    const check = (
      await db.query(
        'SELECT (SELECT count(*)::int FROM stores WHERE id<>$1) AS other_stores,(SELECT count(*)::int FROM orders WHERE customer_name IS NOT NULL OR customer_phone IS NOT NULL) AS personal_orders',
        [fixture.storeId]
      )
    ).rows[0];
    if (check.other_stores || check.personal_orders) throw Error('SYNTHETIC_DB_ONLY');
    fixture.productName = rows[0].name;
    fixture.price = rows[0].price;
  } finally {
    await db.end();
  }
  const dist = path.join(PRIVATE, 'dist');
  fs.cpSync(path.join(ROOT, 'frontend/dist'), dist, { recursive: true });
  const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  if (!index.includes(state.sourceCommit)) throw Error('BUILD_REVISION_MISMATCH');
  // Prohibit accidental production API dependencies in a supposedly isolated bundle.
  const assets = fs.readdirSync(path.join(dist, 'assets')).filter((n) => n.endsWith('.js'));
  if (!assets.some((n) => fs.readFileSync(path.join(dist, 'assets', n), 'utf8').includes('/api')))
    throw Error('BUILD_MISSING_API');
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  };
  const allowedIds = new Set();
  let creating = 0,
    minute = 0,
    writes = 0;
  function scheduleReady(order) {
    const timer = setTimeout(
      () => {
        readyTimers.delete(timer);
        if (closing || !state.ready) return;
        order.autoReadyTriggeredAt = new Date().toISOString();
        order.autoReadyStatus = 'running';
        save();
        const child = launch(
          process.execPath,
          [path.join(ROOT, 'scripts/mobile-push-lab-control.cjs'), 'ready', String(order.id)],
          { cwd: ROOT, env: osEnv },
          'auto-ready.log'
        );
        child.once('exit', (code) => {
          order.autoReadyStatus = code === 0 ? 'ready' : 'failed';
          order.autoReadyFinishedAt = new Date().toISOString();
          save();
        });
        child.once('error', () => {
          order.autoReadyStatus = 'failed';
          save();
        });
      },
      Math.max(0, Date.parse(order.autoReadyAt) - Date.now())
    );
    timer.unref();
    readyTimers.add(timer);
  }
  const server = http.createServer(async (req, res) => {
    try {
      if (closing || Date.now() > Date.parse(state.expiresAt))
        return reply(res, 410, { error: 'TEST_ENVIRONMENT_EXPIRED' });
      const url = new URL(req.url, 'http://127.0.0.1'),
        p = decodeURIComponent(url.pathname);
      if (p.includes('..') || p.includes('\\') || p.includes('%') || p.includes('\0'))
        return reply(res, 400, { error: 'INVALID_PATH' });
      if (p === '/api/lab/info' && req.method === 'GET')
        return reply(res, 200, {
          testOnly: true,
          ready: state.ready,
          storeId: fixture.storeId,
          amount: fixture.price,
          expiresAt: state.expiresAt,
          autoReadyAfterMs: AUTO_READY_MS,
          cardsBlocked: true,
          personalDataBlocked: true,
          sourceCommit: state.sourceCommit,
        });
      if (p === '/api/health' && req.method === 'GET')
        return reply(res, state.ready ? 200 : 503, {
          status: state.ready ? 'ok' : 'starting',
          testOnly: true,
        });
      if (p === '/api/config/firebase' && req.method === 'GET')
        return reply(res, 200, { apiKey: '', projectId: '', messagingSenderId: '', appId: '' });
      if (p.startsWith('/api/')) {
        const cashRequest = req.method === 'POST' && p === '/api/payments';
        if (!cashRequest && /payment|billing|subscriptions|wallet|webhook/i.test(p)) {
          state.metrics.blockedPayments++;
          save();
          return reply(res, 403, { error: 'PAYMENTS_DISABLED_IN_TEST_LAB' });
        }
        const orderMatch = p.match(/^\/api\/orders\/(\d+)(\/push-subscription)?$/),
          id = Number(orderMatch?.[1]);
        const read =
          req.method === 'GET' &&
          (allowRead(p, fixture) || (orderMatch && !orderMatch[2] && allowedIds.has(id)));
        const create = req.method === 'POST' && p === '/api/orders';
        const subscribe =
          ['POST', 'DELETE'].includes(req.method) && orderMatch?.[2] && allowedIds.has(id);
        if (!read && !create && !subscribe && !cashRequest)
          return reply(res, 403, { error: 'ENDPOINT_NOT_EXPOSED' });
        if (req.method !== 'GET') {
          if (
            ![state.publicOrigin, `http://127.0.0.1:${GATEWAY_PORT}`].includes(req.headers.origin)
          )
            return reply(res, 403, { error: 'TEST_ORIGIN_REQUIRED' });
          const current = Math.floor(Date.now() / 60000);
          if (minute !== current) {
            minute = current;
            writes = 0;
          }
          if (++writes > 30) return reply(res, 429, { error: 'TEST_WRITE_LIMIT' });
        }
        let payload;
        if (create) {
          if (state.orders.length + creating >= MAX_ORDERS)
            return reply(res, 429, { error: 'TEST_ORDER_LIMIT' });
          try {
            payload = cleanOrder(await body(req), fixture);
          } catch {
            state.metrics.blockedPersonalData++;
            save();
            return reply(res, 422, { error: 'ONLY_ANONYMOUS_CASH_TEST_ORDER_ALLOWED' });
          }
        } else if (cashRequest) {
          try {
            payload = cleanCashRequest(await body(req), fixture, state.orders);
          } catch {
            state.metrics.blockedPayments++;
            save();
            return reply(res, 422, { error: 'KNOWN_ANONYMOUS_CASH_REQUEST_ONLY' });
          }
        } else if (subscribe) payload = await body(req);
        const headers = {};
        for (const key of [
          'accept',
          'content-type',
          'x-order-capability',
          'x-customer-history-capability',
          'idempotency-key',
          'x-csrf-token',
          'cookie',
        ])
          if (req.headers[key]) headers[key] = req.headers[key];
        headers.origin = state.publicOrigin;
        if (create) creating++;
        try {
          const response = await fetch(`http://127.0.0.1:${API_PORT}${req.url}`, {
            method: req.method,
            headers,
            ...(payload ? { body: JSON.stringify(payload) } : {}),
            signal: AbortSignal.timeout(25000),
          });
          let bytes = Buffer.from(await response.arrayBuffer());
          if (create && response.status === 201) {
            const envelope = JSON.parse(bytes.toString()),
              order = envelope.data;
            if (!order?.id) throw Error('ORDER_RESPONSE_INVALID');
            allowedIds.add(Number(order.id));
            let tracked = state.orders.find((o) => o.id === Number(order.id));
            if (!tracked) {
              const created = Date.now();
              tracked = {
                id: Number(order.id),
                number: order.order_number,
                amount: order.total_amount,
                paymentStatus: order.payment_status,
                createdAt: new Date(created).toISOString(),
                autoReadyAt: new Date(created + AUTO_READY_MS).toISOString(),
                autoReadyStatus: 'scheduled',
              };
              state.orders.push(tracked);
              save();
              scheduleReady(tracked);
            }
            order.lab_auto_ready_at = tracked.autoReadyAt;
            bytes = Buffer.from(JSON.stringify(envelope));
          }
          const outgoing = {
            'Content-Type': response.headers.get('content-type') || 'application/json',
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
          };
          const cookies = response.headers.getSetCookie();
          if (cookies.length) outgoing['Set-Cookie'] = cookies;
          res.writeHead(response.status, outgoing);
          res.end(bytes);
        } finally {
          if (create) creating--;
        }
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method))
        return reply(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      if (p === '/' || p === '/lab')
        return html(
          res,
          `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="manifest" href="/manifest.json"><title>준비 완료 푸시 테스트</title><style>body{font:17px system-ui;max-width:560px;margin:40px auto;padding:20px;line-height:1.7}a{display:block;padding:16px;margin:14px 0;background:#c2410c;color:white;border-radius:12px;text-decoration:none}small{color:#475569}</style><h1>30초 자동 준비 완료 테스트</h1><p>테스트 전용 매장 · 메뉴 10,000원 · 현금 미결제 주문만 허용합니다. 이름·전화번호·카드정보를 입력하지 마세요.</p><p><strong>주문 접수 30초 후 서버가 자동으로 준비 완료로 바꿉니다. PC 명령은 필요 없습니다.</strong> 주문 후 바로 매장찾기 → 알림 허용 → 활성 문구 확인 → 고객 페이지 종료 순서로 진행하세요. 30초를 넘겼다면 새 주문으로 다시 시험하세요.</p><p>iPhone: 주문 전에 이 페이지를 홈 화면에 추가하고 설치된 아이콘으로 여세요. Android: Chrome 일반 모드를 사용하세요.</p><p>페이지를 닫은 뒤 알림창·알림 센터에서 실제 알림을 탭하고 같은 주문번호·10,000원·준비 완료를 확인하세요. 홈 이동과 앱 종료 결과는 구분해 기록하세요.</p><a href="/menu/${fixture.storeId}">테스트 주문 시작 · 30초 뒤 자동 준비 완료</a><a href="/search">매장찾기 · 주문 진행</a><a href="/lab/diagnostics">기기 환경 확인</a><small>유효기한: ${new Date(state.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국시간). 운영 고객 데이터와 연결되지 않습니다.</small></html>`
        );
      if (p === '/lab/client.js') {
        res.writeHead(200, {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'no-store',
        });
        return res.end(
          `(()=>{const notice=document.createElement('aside');notice.id='lab-auto-ready-notice';notice.setAttribute('aria-label','테스트 자동 준비 완료 안내');notice.style.cssText='position:sticky;top:0;z-index:10000;background:#fff7ed;color:#7c2d12;padding:10px 14px;font:14px/1.5 system-ui;border-bottom:1px solid #fdba74';document.body.prepend(notice);let order;try{order=JSON.parse(localStorage.getItem('lab-auto-ready'));}catch{}function paint(){const seconds=order?Math.ceil((Date.parse(order.at)-Date.now())/1000):0;notice.textContent=!order?'테스트 전용 · 현금 주문 접수 30초 후 자동 준비 완료. 주문 후 바로 알림을 허용하고 페이지를 닫으세요.':seconds>0?'주문 '+order.number+' · '+seconds+'초 후 자동 준비 완료. 알림 활성 문구 확인 후 페이지를 닫으세요.':'예약 시각이 지났습니다. 주문 진행을 확인하세요. 종료 전 수신됐다면 새 주문으로 재시험하세요.';}function capture(value){if(value?.data?.lab_auto_ready_at){order={number:value.data.order_number,at:value.data.lab_auto_ready_at};localStorage.setItem('lab-auto-ready',JSON.stringify(order));paint();}}const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){if(String(method).toUpperCase()==='POST'&&new URL(String(url),location.href).pathname==='/api/orders')this.addEventListener('load',()=>{if(this.status===201)try{capture(this.responseType==='json'?this.response:JSON.parse(this.responseText));}catch{}});return open.call(this,method,url,...args);};const originalFetch=window.fetch;window.fetch=async function(...args){const response=await originalFetch.apply(this,args);if(response.status===201&&new URL(response.url).pathname==='/api/orders')void response.clone().json().then(capture).catch(()=>{});return response;};paint();setInterval(paint,250);})();`
        );
      }
      if (p === '/lab/diagnostics')
        return html(
          res,
          `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA 기기 환경</title><h1>기기 환경 확인</h1><pre id="out"></pre><a href="/lab">테스트 시작 화면</a><script>document.getElementById('out').textContent=JSON.stringify({userAgent:navigator.userAgent,standalone:matchMedia('(display-mode:standalone)').matches||navigator.standalone===true,secureContext:isSecureContext,serviceWorker:'serviceWorker'in navigator,pushManager:'PushManager'in window,notificationPermission:typeof Notification==='undefined'?'unsupported':Notification.permission,checkedAt:new Date().toISOString()},null,2)</script>`
        );
      if (p === '/manifest.json') {
        const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json')));
        Object.assign(manifest, {
          name: '위마켓 푸시 테스트 전용',
          short_name: '푸시 QA',
          id: '/mobile-push-qa',
          start_url: '/lab',
        });
        return reply(res, 200, manifest);
      }
      const spa = p === '/search' || p === '/order-history' || p === `/menu/${fixture.storeId}`;
      const file = spa ? path.join(dist, 'index.html') : path.resolve(dist, '.' + p);
      const safe =
        file.startsWith(dist + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
      const staticAllowed =
        spa ||
        p.startsWith('/assets/') ||
        p.startsWith('/icons/') ||
        [
          '/index.html',
          '/vite.svg',
          '/platform/terms.html',
          '/platform/privacy.html',
          '/images/order-thanks.svg',
          '/sw.js',
          '/sw-sync.js',
          '/registerSW.js',
          '/offline.html',
          '/favicon.ico',
        ].includes(p) ||
        /^\/workbox-[a-zA-Z0-9-]+\.js$/.test(p);
      if (!safe || !staticAllowed || !types[path.extname(file)])
        return reply(res, 404, { error: 'NOT_FOUND' });
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)],
        'Cache-Control': 'no-cache',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      });
      if (spa || p === '/index.html')
        return res.end(
          fs
            .readFileSync(file, 'utf8')
            .replace('<body>', '<body><script src="/lab/client.js"></script>')
        );
      fs.createReadStream(file).pipe(res);
    } catch {
      if (!res.headersSent) reply(res, 502, { error: 'TEST_LAB_REQUEST_FAILED' });
      else res.end();
    }
  });
  const sockets = new Server(server, {
    cors: {
      origin: (origin, callback) =>
        callback(
          null,
          !origin || origin === state.publicOrigin || origin === `http://127.0.0.1:${GATEWAY_PORT}`
        ),
    },
    maxHttpBufferSize: 16384,
  });
  sockets.on('connection', (socket) => {
    if (sockets.engine.clientsCount > 10) {
      socket.disconnect(true);
      return;
    }
    const backend = connect(`http://127.0.0.1:${API_PORT}`, {
      transports: ['websocket'],
      reconnection: true,
    });
    let watch = null,
      count = 0;
    const join = () => {
      if (watch) backend.emit('watch-order-status', watch, () => {});
    };
    backend.on('connect', join);
    backend.on('customer-order-changed', (event) => {
      if (Number(event?.order_id) === Number(watch?.orderId))
        socket.emit('customer-order-changed', event);
    });
    socket.on('watch-order-status', (data, ack) => {
      if (
        ++count > 20 ||
        !allowedIds.has(Number(data?.orderId)) ||
        JSON.stringify(data).length > 8192
      ) {
        if (typeof ack === 'function') ack({ ok: false });
        return;
      }
      watch = {
        orderId: Number(data.orderId),
        capability: data.capability,
        historyCapability: data.historyCapability,
      };
      backend.emit('watch-order-status', watch, (result) => {
        if (typeof ack === 'function') ack(result);
      });
    });
    socket.on('unwatch-order-status', (data) => {
      backend.emit('unwatch-order-status', data);
      watch = null;
    });
    socket.on('disconnect', () => backend.disconnect());
  });
  await new Promise((resolve) => server.listen(GATEWAY_PORT, '127.0.0.1', resolve));
  const control = http.createServer((req, res) => {
    if (req.headers['x-lab-operator'] !== state.operatorToken)
      return reply(res, 403, { error: 'LOCAL_OPERATOR_ONLY' });
    if (req.method === 'GET' && req.url === '/status')
      return reply(res, 200, { ...state, operatorToken: undefined });
    if (req.method === 'POST' && req.url === '/stop') {
      reply(res, 200, { stopping: true });
      void shutdown();
      return;
    }
    reply(res, 404, { error: 'NOT_FOUND' });
  });
  await new Promise((resolve) => control.listen(CONTROL_PORT, '127.0.0.1', resolve));
  const cloud = path.join(ROOT, '.tmp/order-completion-sandbox/tools/cloudflared.exe');
  const empty = path.join(PRIVATE, 'empty.yml');
  fs.writeFileSync(empty, '');
  const tunnel = spawn(
    cloud,
    [
      'tunnel',
      '--config',
      empty,
      '--no-autoupdate',
      '--url',
      `http://127.0.0.1:${GATEWAY_PORT}`,
      '--protocol',
      'http2',
      '--metrics',
      '127.0.0.1:20249',
    ],
    { cwd: PRIVATE, env: osEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  children.push(tunnel);
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('TUNNEL_NOT_READY')), 45000);
    const scan = (chunk) => {
      fs.appendFileSync(path.join(PRIVATE, 'tunnel.log'), chunk);
      const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    tunnel.stdout.on('data', scan);
    tunnel.stderr.on('data', scan);
    tunnel.once('exit', () => {
      clearTimeout(timer);
      reject(Error('TUNNEL_EXITED'));
    });
  });
  state.publicOrigin = origin;
  save();
  const vapid = JSON.parse(
    fs.readFileSync(path.join(ROOT, '.tmp/order-completion-sandbox/web-push-qa.json'))
  );
  const env = {
    ...osEnv,
    NODE_ENV: 'production',
    PORT: String(API_PORT),
    DOTENV_CONFIG_PATH: path.join(PRIVATE, 'no-default-env'),
    DATABASE_URL: DB,
    DIRECT_URL: DB,
    REPLICA_URL: DB,
    JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
    JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('base64url'),
    ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    FRONTEND_URL: origin,
    BACKEND_URL: origin,
    CORS_ORIGIN: origin,
    APP_COMMIT_SHA: state.sourceCommit,
    REDIS_URL: 'redis://127.0.0.1:6399',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6399',
    REDIS_DB: '3',
    TOSS_CLIENT_KEY: 'test_ck_push_lab_disabled',
    TOSS_SECRET_KEY: 'test_sk_push_lab_disabled',
    TOSS_WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex'),
    SMS_API_KEY: '',
    SMS_API_SECRET: '',
    SMS_SENDER: '',
    SMS_ENV: 'dev',
    GEMINI_API_KEY: '',
    FIREBASE_SERVICE_ACCOUNT_PATH: '',
    FIREBASE_API_KEY: '',
    BILLING_SCHEDULER_ENABLED: 'false',
    WEBHOOK_RETRY_ENABLED: 'false',
    FREE_AUTH_ENABLED: 'false',
    FREE_AUTH_MAINTENANCE_ENABLED: 'false',
    ALLOW_MOCK_PAYMENTS: 'false',
    USE_HTTPONLY_COOKIE: 'false',
    ENABLE_DEV_OPS: '',
    WEB_PUSH_PUBLIC_KEY: vapid.publicKey,
    WEB_PUSH_PRIVATE_KEY: vapid.privateKey,
    WEB_PUSH_SUBJECT: 'https://example.invalid',
    SENTRY_DSN: '',
    ALERT_WEBHOOK_URL: '',
  };
  const backend = launch(
    process.execPath,
    ['--import', 'tsx', path.join(ROOT, 'index.mts')],
    { cwd: PRIVATE, env },
    'backend.log'
  );
  backend.once('exit', () => {
    if (!closing) void shutdown();
  });
  await waitApi();
  state.ready = true;
  save();
  console.log(
    JSON.stringify({
      status: 'READY',
      url: origin + '/lab',
      menu: origin + `/menu/${fixture.storeId}`,
      expiresAt: state.expiresAt,
      testOnly: true,
      cardsBlocked: true,
      personalDataBlocked: true,
    })
  );
  const expiry = setTimeout(() => void shutdown(), TTL);
  expiry.unref();
  async function shutdown() {
    if (closing) return;
    closing = true;
    for (const timer of readyTimers) clearTimeout(timer);
    readyTimers.clear();
    state.ready = false;
    save();
    sockets.close();
    server.close();
    control.close();
    children.forEach((child) => child.kill());
    setTimeout(() => process.exit(0), 1000).unref();
  }
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}
main().catch(() => {
  console.error('MOBILE_LAB_START_FAILED: inspect the private lab log; no secrets printed');
  children.forEach((child) => child.kill());
  process.exit(1);
});
