const MODELS = Object.freeze({
  'gemini-3.1-flash-live-preview': { synchronous: true },
  'gemini-3.8-live': { synchronous: true },
  'gemini-2.5-flash-native-audio-preview-12-2025': { synchronous: true },
});
function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error('Invalid Live configuration');
  return value;
}
function loadPolicy(env = process.env) {
  if (env.AI_LIVE_ENABLED !== 'true') return { enabled: false };
  try {
    const stores = JSON.parse(env.AI_LIVE_STORE_POLICIES);
    const pricing = JSON.parse(env.AI_LIVE_PRICING_JSON);
    const model = env.AI_LIVE_MODEL;
    const origins = JSON.parse(env.AI_LIVE_ALLOWED_ORIGINS);
    if (
      !MODELS[model]?.synchronous ||
      !env.AI_LIVE_TICKET_SECRET ||
      env.AI_LIVE_TICKET_SECRET.length < 32 ||
      !pricing.version ||
      pricing.model !== model ||
      !origins.length ||
      !stores ||
      Array.isArray(stores)
    )
      throw Error();
    for (const origin of origins) {
      const u = new URL(origin);
      if (
        u.origin !== origin ||
        (u.protocol !== 'https:' &&
          !(
            env.NODE_ENV !== 'production' &&
            u.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(u.hostname)
          ))
      )
        throw Error();
    }
    for (const [id, policy] of Object.entries(stores)) {
      integer(Number(id), 1, 2147483647);
      integer(policy.monthlyLimitMicros, 1, 1e12);
      integer(policy.reservationMicros, 1, policy.monthlyLimitMicros);
      integer(policy.dailySeconds, 1, 86400);
      integer(policy.sessionSeconds, 10, Math.min(600, policy.dailySeconds));
      integer(policy.concurrency, 1, 10);
    }
    for (const direction of ['input', 'output']) {
      if (!pricing[direction] || !Object.keys(pricing[direction]).length) throw Error();
      for (const [modality, rate] of Object.entries(pricing[direction])) {
        if (!['TEXT', 'AUDIO', 'VIDEO', 'IMAGE'].includes(modality)) throw Error();
        integer(rate, 1, 1e12);
      }
    }
    return {
      enabled: true,
      model,
      stores,
      pricing,
      origins,
      secret: env.AI_LIVE_TICKET_SECRET,
      allowPaid: env.AI_LIVE_ALLOW_PAID === 'true',
      apiKey: env.GEMINI_API_KEY,
    };
  } catch {
    throw new Error('Invalid Live configuration');
  }
}
function usageCost(usage, prices) {
  const inputs = [
      ...(usage.promptTokensDetails || []),
      ...(usage.toolUsePromptTokensDetails || []),
    ],
    outputs = [...(usage.responseTokensDetails || [])];
  if (usage.thoughtsTokenCount)
    outputs.push({ modality: 'TEXT', tokenCount: usage.thoughtsTokenCount });
  if (!inputs.length && !outputs.length) throw new Error('Live usage breakdown missing');
  let numerator = 0n;
  let counted = 0;
  for (const [details, rates] of [
    [inputs, prices.input],
    [outputs, prices.output],
  ]) {
    for (const detail of details) {
      integer(detail.tokenCount, 0, 1e12);
      counted += detail.tokenCount;
      const rate = rates[detail.modality];
      if (!Number.isSafeInteger(rate) || rate <= 0)
        throw new Error('Live usage has unpriced modality');
      numerator += BigInt(detail.tokenCount) * BigInt(rate);
    }
  }
  if (
    usage.totalTokenCount != null &&
    (!Number.isSafeInteger(usage.totalTokenCount) || usage.totalTokenCount > counted)
  )
    throw Error('Live usage breakdown incomplete');
  const micros = Number((numerator + 999999n) / 1000000n);
  if (!Number.isSafeInteger(micros)) throw new Error('Live usage overflow');
  return micros;
}
module.exports = { loadPolicy, usageCost };
