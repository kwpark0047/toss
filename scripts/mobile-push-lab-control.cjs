const fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  dir = path.join(root, '.tmp/order-completion-sandbox');
(async () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(dir, 'fixture.json'))),
    state = JSON.parse(fs.readFileSync(path.join(dir, 'mobile-lab/runtime.json')));
  if (
    fixture.dbUrl !== require('./mobile-push-lab-guard.cjs').DATABASE_URL ||
    !fixture.email.endsWith('@example.invalid') ||
    state.apiPort !== 5310 ||
    state.controlPort !== 5324 ||
    (state.labMode && state.labMode !== 'isolated-mobile-push') ||
    state.autoReadyAfterMs !== 30000
  )
    throw Error('TEST_LAB_ONLY');
  const command = process.argv[2] || 'status';
  if (['status', 'list', 'stop'].includes(command)) {
    const response = await fetch(
      `http://127.0.0.1:${state.controlPort}/${command === 'stop' ? 'stop' : 'status'}`,
      {
        method: command === 'stop' ? 'POST' : 'GET',
        headers: { 'x-lab-operator': state.operatorToken },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!response.ok) throw Error('LOCAL_OPERATOR_NOT_READY');
    const value = await response.json();
    console.log(JSON.stringify(command === 'list' ? value.orders : value, null, 2));
    return;
  }
  if (command !== 'ready') throw Error('Use: status | list | ready <order id or number> | stop');
  const selected = state.orders.find(
    (o) => String(o.id) === process.argv[3] || o.number === process.argv[3]
  );
  if (!selected) throw Error('ORDER_NOT_CREATED_IN_THIS_LAB');
  const api = `http://127.0.0.1:${state.apiPort}/api`;
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: fixture.email, password: fixture.password }),
    signal: AbortSignal.timeout(15000),
  });
  if (!login.ok) throw Error('TEST_OWNER_LOGIN_FAILED');
  const payload = await login.json(),
    token = (payload.data || payload).token;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const get = await fetch(`${api}/orders/${selected.id}`, { headers });
  const raw = await get.json(),
    order = raw.data || raw;
  if (
    !get.ok ||
    Number(order.store_id) !== fixture.storeId ||
    order.payment_status !== 'pending' ||
    order.customer_name ||
    order.customer_phone
  )
    throw Error('SYNTHETIC_UNPAID_ORDER_REQUIRED');
  const steps = ['pending', 'confirmed', 'preparing', 'ready'];
  const current = steps.indexOf(order.status);
  if (current < 0) throw Error('ORDER_ALREADY_ENDED');
  for (const status of steps.slice(current + 1)) {
    const response = await fetch(`${api}/orders/${selected.id}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error('TEST_STATUS_UPDATE_FAILED');
  }
  const event = {
    orderId: selected.id,
    number: selected.number,
    amount: selected.amount,
    status: 'ready',
    paymentStatus: 'pending',
    readyAt: new Date().toISOString(),
  };
  fs.appendFileSync(
    path.join(dir, 'mobile-lab/operator-events.jsonl'),
    JSON.stringify(event) + '\n'
  );
  console.log(JSON.stringify(event));
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
