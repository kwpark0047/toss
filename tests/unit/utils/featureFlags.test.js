const featureFlags = require('../../../utils/featureFlags');

describe('featureFlags', () => {
  const original = process.env.FEATURE_FLAGS_JSON;

  afterEach(() => {
    if (original === undefined) delete process.env.FEATURE_FLAGS_JSON;
    else process.env.FEATURE_FLAGS_JSON = original;
  });

  it('boolean flag를 평가한다', () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({ new_kds: true, old_menu: false });
    expect(featureFlags.isEnabled('new_kds')).toBe(true);
    expect(featureFlags.isEnabled('old_menu')).toBe(false);
  });

  it('rollout percentage를 결정적으로 평가한다', () => {
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      experiment: { enabled: true, rollout_percent: 50 },
    });
    const first = featureFlags.isEnabled('experiment', { userId: 7, storeId: 3 });
    expect(featureFlags.isEnabled('experiment', { userId: 7, storeId: 3 })).toBe(first);
  });

  it('잘못된 JSON이나 알 수 없는 flag는 비활성으로 처리한다', () => {
    process.env.FEATURE_FLAGS_JSON = '{bad';
    expect(featureFlags.isEnabled('missing')).toBe(false);
  });
});
