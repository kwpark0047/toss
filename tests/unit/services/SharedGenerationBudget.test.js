const { SharedGenerationBudget } = require('../../../services/ai/SharedGenerationBudget');
const env = {
  AI_LIVE_STORE_POLICIES: JSON.stringify({
    3: {
      enabled: true,
      monthlyLimitMicros: 100,
      reservationMicros: 10,
      photoReservationMicros: 20,
      marketingReservationMicros: 10,
      dailySeconds: 100,
      concurrency: 2,
    },
  }),
  AI_GENERATION_PRICING_JSON: JSON.stringify({
    models: {
      fixture: {
        version: 'fixture-v1',
        input: { TEXT: 1000000, IMAGE: 2000000 },
        output: { TEXT: 1000000 },
      },
    },
  }),
};
const usageMetadata = {
  promptTokensDetails: [{ modality: 'TEXT', tokenCount: 2 }],
  candidatesTokensDetails: [{ modality: 'TEXT', tokenCount: 3 }],
  totalTokenCount: 5,
};
const scope = { storeId: 3, feature: 'marketing', model: 'fixture' };
const storage = () => ({
  reserve: jest.fn(async (s) => s),
  recordUsage: jest.fn(async () => {}),
  finish: jest.fn(async () => {}),
});
test('reserves the shared store/month before a call, records token-only usage and settles before returning', async () => {
  const store = storage();
  const budget = new SharedGenerationBudget({
    env,
    store,
    clock: () => Date.parse('2026-11-30T15:01:00Z'),
  });
  const response = await budget.run(scope, async () => {
    expect(store.reserve).toHaveBeenCalledTimes(1);
    return { text: 'private draft', usageMetadata };
  });
  expect(response.text).toBe('private draft');
  const session = store.reserve.mock.calls[0][0];
  expect(session).toMatchObject({
    storeId: 3,
    month: '2026-12',
    reservation: 10,
    monthLimit: 100,
    seconds: 0,
  });
  expect(store.recordUsage).toHaveBeenCalledWith(
    session,
    1,
    expect.objectContaining({ totalTokenCount: 5 }),
    5
  );
  expect(store.finish).toHaveBeenCalledWith(session, 5, 'generation-completed');
  expect(JSON.stringify(store.recordUsage.mock.calls)).not.toContain('private draft');
});
test('missing policy, unknown model, storage rejection and exhausted budgets never invoke a provider', async () => {
  const call = jest.fn();
  await expect(
    new SharedGenerationBudget({ env: {}, store: storage() }).run(scope, call)
  ).rejects.toMatchObject({ statusCode: 503 });
  await expect(
    new SharedGenerationBudget({ env, store: storage() }).run({ ...scope, model: 'unknown' }, call)
  ).rejects.toMatchObject({ statusCode: 503 });
  const store = storage();
  store.reserve.mockRejectedValue(Error('LIVE_LIMIT'));
  await expect(new SharedGenerationBudget({ env, store }).run(scope, call)).rejects.toMatchObject({
    statusCode: 503,
  });
  expect(call).not.toHaveBeenCalled();
});
test.each([
  undefined,
  { totalTokenCount: 4 },
  { promptTokensDetails: [{ modality: 'VIDEO', tokenCount: 1 }], totalTokenCount: 1 },
])('missing or unpriced usage fails closed and retains the reservation: %j', async (usage) => {
  const store = storage();
  await expect(
    new SharedGenerationBudget({ env, store }).run(scope, async () => ({
      text: 'discard',
      usageMetadata: usage,
    }))
  ).rejects.toMatchObject({ statusCode: 503 });
  expect(store.finish).toHaveBeenCalledWith(expect.any(Object), 0, 'generation-failed');
});
test('provider errors and settlement failures cannot return an unaccounted draft', async () => {
  const store = storage(),
    budget = new SharedGenerationBudget({ env, store });
  await expect(
    budget.run(scope, async () => {
      throw Error('private provider error');
    })
  ).rejects.toMatchObject({ statusCode: 503 });
  expect(store.finish).toHaveBeenCalledWith(expect.any(Object), 0, 'generation-failed');
  store.finish.mockRejectedValue(Error('offline'));
  await expect(
    budget.run(scope, async () => ({ text: 'discard', usageMetadata }))
  ).rejects.toMatchObject({ statusCode: 503 });
});

test('usage persistence errors retain the known cost and suppress the draft', async () => {
  const store = storage();
  store.recordUsage.mockRejectedValue(Error('offline'));
  await expect(
    new SharedGenerationBudget({ env, store }).run(scope, async () => ({
      text: 'discard',
      usageMetadata,
    }))
  ).rejects.toMatchObject({ statusCode: 503 });
  expect(store.finish).toHaveBeenCalledWith(expect.any(Object), 5, 'generation-failed');
});
test('reported cost above the reservation is settled in full rather than truncated', async () => {
  const store = storage();
  const usage = {
    promptTokensDetails: [{ modality: 'TEXT', tokenCount: 25 }],
    totalTokenCount: 25,
  };
  await new SharedGenerationBudget({ env, store }).run(scope, async () => ({
    usageMetadata: usage,
  }));
  expect(store.finish).toHaveBeenCalledWith(expect.any(Object), 25, 'generation-completed');
});
