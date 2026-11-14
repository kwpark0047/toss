const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { CameraFrames } = require('../../services/ai/live/CameraFrames');
const frame = require('../fixtures/live-camera-frame.json').data;
test('provider encodes a frame as SDK video JPEG without a paid network call', async () => {
  const sent = [];
  const { GeminiLiveProvider } = require('../../services/ai/live/GeminiLiveProvider');
  const provider = new GeminiLiveProvider({
    allowPaid: true,
    client: {
      live: {
        connect: async () => ({ sendRealtimeInput: (value) => sent.push(value), close() {} }),
      },
    },
  });
  await provider.connect({ model: 'fixture', tools: [] }, () => {});
  provider.sendImage(frame);
  assert.deepEqual(sent, [{ video: { data: frame, mimeType: 'image/jpeg' } }]);
  provider.close();
});
test('Vision requires an explicit server gate and both priced image modalities', () => {
  const { loadPolicy } = require('../../services/ai/live/LivePolicy');
  const model = 'gemini-3.1-flash-live-preview';
  const pricing = {
    model,
    version: 'fake',
    input: { TEXT: 1, VIDEO: 1, IMAGE: 1 },
    output: { AUDIO: 1 },
  };
  const env = {
    AI_LIVE_ENABLED: 'true',
    AI_LIVE_ALLOW_PAID: 'false',
    AI_LIVE_CAMERA_ENABLED: 'true',
    AI_LIVE_MODEL: model,
    AI_LIVE_TICKET_SECRET: 'x'.repeat(32),
    AI_LIVE_ALLOWED_ORIGINS: '["https://fixture.invalid"]',
    AI_LIVE_STORE_POLICIES: JSON.stringify({
      3: {
        enabled: true,
        monthlyLimitMicros: 100,
        reservationMicros: 10,
        dailySeconds: 100,
        sessionSeconds: 10,
        concurrency: 1,
      },
    }),
    AI_LIVE_PRICING_JSON: JSON.stringify(pricing),
  };
  assert.equal(loadPolicy(env).cameraEnabled, true);
  assert.equal(loadPolicy({ ...env, AI_LIVE_CAMERA_ENABLED: 'false' }).cameraEnabled, false);
  delete pricing.input.IMAGE;
  assert.equal(
    loadPolicy({ ...env, AI_LIVE_PRICING_JSON: JSON.stringify(pricing) }).cameraEnabled,
    false
  );
});
test('camera requires session permission and explicit consent; valid JPEG is limited to 1fps and 30 frames', () => {
  let now = 0;
  const camera = new CameraFrames(true, () => now);
  assert.throws(() => camera.accept(frame));
  camera.consent(true);
  assert.equal(camera.accept(frame).width, 320);
  assert.throws(() => camera.accept(frame), /rate/);
  now = 1000;
  camera.accept(frame);
  camera.consent(false);
  assert.throws(() => camera.accept(frame));
  camera.consent(true);
  for (let i = 2; i < 30; i++) {
    now = i * 1000;
    camera.accept(frame);
  }
  now = 30000;
  assert.throws(() => camera.accept(frame), /limit/);
  const denied = new CameraFrames(false);
  assert.throws(() => denied.consent(true));
});
test('camera rejects oversized, non-JPEG, metadata-bearing and forged-size frames', () => {
  const send = (data) => {
    const camera = new CameraFrames(true);
    camera.consent(true);
    return camera.accept(data);
  };
  for (const data of ['not-a-jpeg', Buffer.alloc(17000).toString('base64')])
    assert.throws(() => send(data));
  const b = Buffer.from(frame, 'base64'),
    index = b.indexOf(Buffer.from([255, 192]));
  assert.ok(index > 0);
  b.writeUInt16BE(10000, index + 7);
  assert.throws(() => send(b.toString('base64')));
  const exif = Buffer.concat([
    Buffer.from([255, 216, 255, 225, 0, 4, 0, 0]),
    Buffer.from(frame, 'base64').subarray(2),
  ]);
  assert.throws(() => send(exif.toString('base64')));
});
