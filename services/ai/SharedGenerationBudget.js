const crypto = require('node:crypto');
const { usageCost } = require('./live/LivePolicy');
const unavailable = () =>
  Object.assign(
    Error(
      '매장 AI 공용 예산 또는 사용량을 확인할 수 없습니다. 기본 초안·수동 등록을 이용해 주세요.'
    ),
    { statusCode: 503 }
  );
class SharedGenerationBudget {
  constructor({ env = process.env, store, clock = Date.now } = {}) {
    Object.assign(this, { env, store, clock });
  }
  async run({ storeId, feature, model }, call) {
    let session,
      store,
      cost = 0;
    try {
      if (
        !Number.isSafeInteger(storeId) ||
        storeId < 1 ||
        storeId > 2147483647 ||
        !['photo', 'marketing'].includes(feature)
      )
        throw Error();
      const policy = JSON.parse(this.env.AI_LIVE_STORE_POLICIES)[storeId];
      const pricing = JSON.parse(this.env.AI_GENERATION_PRICING_JSON).models[model];
      const reservation = policy?.[`${feature}ReservationMicros`];
      if (
        policy?.enabled !== true ||
        typeof pricing?.version !== 'string' ||
        !pricing.version ||
        pricing.version.length > 100
      )
        throw Error();
      for (const [value, max] of [
        [policy.monthlyLimitMicros, 1e12],
        [reservation, policy.monthlyLimitMicros],
        [policy.dailySeconds, 86400],
        [policy.concurrency, 10],
      ]) {
        if (!Number.isSafeInteger(value) || value < 1 || value > max) throw Error();
      }
      for (const direction of ['input', 'output']) {
        if (!pricing[direction]?.TEXT) throw Error();
        for (const [modality, rate] of Object.entries(pricing[direction])) {
          if (
            !['TEXT', 'IMAGE', 'AUDIO', 'VIDEO'].includes(modality) ||
            !Number.isSafeInteger(rate) ||
            rate < 1 ||
            rate > 1e12
          )
            throw Error();
        }
      }
      if (feature === 'photo' && !pricing.input.IMAGE) throw Error();
      const now = this.clock(),
        day = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
      const candidate = {
        id: crypto.randomBytes(32).toString('hex'),
        storeId,
        purpose: feature,
        model,
        pricingVersion: pricing.version,
        month: day.slice(0, 7),
        day,
        seconds: 0,
        state: 'active',
        deadline: now + 30000,
        reservation,
        monthLimit: policy.monthlyLimitMicros,
        dayLimit: policy.dailySeconds,
        concurrency: policy.concurrency,
      };
      // The exact Live storage proxy, namespace and atomic Lua ledger are reused.
      store = this.store || require('./live/runtime').getGateway().store;
      session = await store.reserve(candidate);
      const response = await call();
      const raw = response?.usageMetadata;
      if (!raw || !Number.isSafeInteger(raw.totalTokenCount) || raw.totalTokenCount < 0)
        throw Error();
      const usage = {
        promptTokensDetails: raw.promptTokensDetails,
        responseTokensDetails: raw.candidatesTokensDetails,
        thoughtsTokenCount: raw.thoughtsTokenCount,
        totalTokenCount: raw.totalTokenCount,
      };
      // Aggregate-only metadata cannot safely price multimodal input. Never invent a rate.
      cost = usageCost(usage, pricing);
      await store.recordUsage(session, 1, usage, cost);
      await store.finish(session, cost, 'generation-completed');
      return response;
    } catch {
      if (session) {
        try {
          await store.finish(session, cost, 'generation-failed');
        } catch {
          /* Reservation remains charged/held on storage failure. */
        }
      }
      throw unavailable();
    }
  }
}
module.exports = { SharedGenerationBudget };
