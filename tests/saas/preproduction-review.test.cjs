const test = require('node:test'),
  assert = require('node:assert/strict');
const p = require('../../config/ai/preproduction-review.json'),
  env = p.serverEnv;
const { loadPolicy, usageCost } = require('../../services/ai/live/LivePolicy');
const { LiveGateway } = require('../../services/ai/live/LiveGateway');
const { MarketingDraftService } = require('../../services/MarketingDraftService');
const { MenuPhotoDraftService } = require('../../services/MenuPhotoDraftService');
const { SharedGenerationBudget } = require('../../services/ai/SharedGenerationBudget');
const { buildReview, assertReview } = require('../../scripts/generate-ai-preproduction-review.cjs');
const facts = { store: { id: 3, name: 'QA' }, products: [{ id: 7, name: 'QA 메뉴', price: 1000 }] };
test('generator detects stored review drift and refuses any activation', () => {
  assertReview(p);
  assert.deepEqual(buildReview(), p);
  for (const mutate of [
    (v) => {
      v.serverEnv.AI_LIVE_ALLOW_PAID = 'true';
    },
    (v) => {
      v.frontendEnv.VITE_AI_LIVE_UI_ENABLED = 'true';
    },
    (v) => {
      const s = JSON.parse(v.serverEnv.AI_LIVE_STORE_POLICIES);
      s[3].enabled = true;
      v.serverEnv.AI_LIVE_STORE_POLICIES = JSON.stringify(s);
    },
  ]) {
    const changed = structuredClone(p);
    mutate(changed);
    assert.throws(() => assertReview(changed));
  }
  const changed = buildReview();
  changed.serverEnv.AI_MARKETING_ALLOW_PAID = 'true';
  assert.equal(buildReview().serverEnv.AI_MARKETING_ALLOW_PAID, 'false');
});
test('CLI check is read-only from any cwd and rejects apply commands', () => {
  const fs = require('node:fs'),
    path = require('node:path'),
    os = require('node:os'),
    { spawnSync } = require('node:child_process');
  const script = path.resolve(__dirname, '../../scripts/generate-ai-preproduction-review.cjs'),
    file = path.resolve(__dirname, '../../config/ai/preproduction-review.json');
  const before = fs.readFileSync(file, 'utf8'),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-review-check-'));
  try {
    const checked = spawnSync(process.execPath, [script, '--check'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(checked.status, 0, checked.stderr);
    const denied = spawnSync(process.execPath, [script, '--apply'], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(denied.status, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    fs.rmdirSync(dir);
  }
});
test('review artifact is disabled for every feature/store and uses supported policy shape', () => {
  assert.equal(p.status, 'REVIEW_ONLY_NOT_APPLIED');
  for (const key of [
    'AI_LIVE_ENABLED',
    'AI_LIVE_ALLOW_PAID',
    'AI_LIVE_CAMERA_ENABLED',
    'AI_MENU_DRAFT_ENABLED',
    'AI_MENU_DRAFT_ALLOW_PAID',
    'AI_MARKETING_ENABLED',
    'AI_MARKETING_ALLOW_PAID',
  ])
    assert.equal(env[key], 'false');
  for (const value of Object.values(p.frontendEnv)) assert.equal(value, 'false');
  const stores = JSON.parse(env.AI_LIVE_STORE_POLICIES);
  assert.equal(Object.keys(stores).length, 13);
  for (const s of Object.values(stores)) {
    assert.equal(s.enabled, false);
    assert.equal(s.cameraEnabled, false);
    assert.equal(s.monthlyLimitMicros, 10000000);
    for (const k of ['reservationMicros', 'photoReservationMicros', 'marketingReservationMicros'])
      assert.ok(s[k] > 0 && s[k] <= s.monthlyLimitMicros);
  }
  const policy = loadPolicy({
    ...env,
    AI_LIVE_ENABLED: 'true',
    AI_LIVE_TICKET_SECRET: 'fixture-only-secret-'.repeat(3),
    NODE_ENV: 'test',
  });
  assert.equal(policy.allowPaid, false);
  assert.equal(policy.cameraEnabled, false);
  assert.equal(policy.model, 'gemini-3.8-live');
});
test('published rates use micro-USD per million tokens without accidental million-fold conversion', () => {
  const live = JSON.parse(env.AI_LIVE_PRICING_JSON),
    gen = JSON.parse(env.AI_GENERATION_PRICING_JSON).models['gemini-3.5-flash-lite'];
  assert.equal(
    usageCost(
      {
        promptTokensDetails: [
          { modality: 'TEXT', tokenCount: 1000 },
          { modality: 'AUDIO', tokenCount: 1000 },
        ],
        responseTokensDetails: [{ modality: 'AUDIO', tokenCount: 1000 }],
        totalTokenCount: 3000,
      },
      live
    ),
    15750
  );
  assert.equal(
    usageCost(
      {
        promptTokensDetails: [
          { modality: 'TEXT', tokenCount: 1000 },
          { modality: 'IMAGE', tokenCount: 1000 },
        ],
        responseTokensDetails: [{ modality: 'TEXT', tokenCount: 1000 }],
        totalTokenCount: 3000,
      },
      gen
    ),
    3100
  );
  assert.equal(
    usageCost(
      { promptTokensDetails: [{ modality: 'TEXT', tokenCount: 1 }], totalTokenCount: 1 },
      gen
    ),
    1
  );
});
test('proposal denies paid calls and keeps the free marketing fallback with no credentials or Redis', async () => {
  let calls = 0;
  const client = {
    models: {
      generateContent: async () => {
        calls++;
        assert.fail('paid call forbidden');
      },
    },
  };
  const marketing = new MarketingDraftService({ env, client }),
    photo = new MenuPhotoDraftService({ env, client });
  const input = {
    product_ids: [7],
    channel: 'instagram',
    tone: 'friendly',
    use_ai: true,
    consent: true,
  };
  await assert.rejects(marketing.generate(facts, input), { statusCode: 503 });
  await assert.rejects(photo.analyze({ store_id: 3, consent: true, mimeType: 'image/jpeg' }), {
    statusCode: 503,
  });
  assert.equal((await marketing.generate(facts, { ...input, use_ai: false })).source, 'template');
  const policy = loadPolicy({
    ...env,
    AI_LIVE_ENABLED: 'true',
    AI_LIVE_TICKET_SECRET: 'fixture-only-secret-'.repeat(3),
    NODE_ENV: 'test',
  });
  let reservations = 0;
  const store = {
    reserve: async (s) => {
      reservations++;
      return s;
    },
    finish: async () => {},
  };
  const gateway = new LiveGateway({
    policy: { ...policy, stores: { ...policy.stores, 3: { ...policy.stores[3], enabled: true } } },
    store,
    authorize: async () => {},
    providerFactory: () => {
      calls++;
      assert.fail('paid Live forbidden');
    },
  });
  const ticketRequest = {
    storeId: 3,
    purpose: 'customer',
    consent: true,
    origin: 'https://wemarket-saas.vercel.app',
    ip: '127.0.0.1',
    idempotencyKey: 'fixture-proposal-request-0001',
  };
  await assert.rejects(gateway.issue(ticketRequest));
  gateway.policy = { ...policy, allowPaid: true };
  await assert.rejects(gateway.issue(ticketRequest));
  await assert.rejects(
    new SharedGenerationBudget({ env, store }).run(
      { storeId: 3, feature: 'marketing', model: env.AI_MARKETING_MODEL },
      () => {
        calls++;
        return { usageMetadata: {} };
      }
    ),
    { statusCode: 503 }
  );
  assert.equal(reservations, 0);
  assert.equal(calls, 0);
});
