const clamp = (value: number, fallback = 0.5): number => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
};

const buildEvidence = (context: Record<string, any> = {}): string[] => {
  const evidence: string[] = [];
  if (context.preferences) evidence.push('고객 선호도');
  if (context.pastOrders?.length) evidence.push('과거 주문 이력');
  if (context.trendingItems?.length) evidence.push('최근 인기 메뉴');
  if (context.weather || context.temperature !== undefined) evidence.push('현재 날씨·시간');
  if (context.segmentContext) evidence.push('고객 세그먼트');
  return evidence.length ? evidence : ['메뉴 기본 정보'];
};

const normalizeRecommendation = (recommendation: any, context: Record<string, any>, rank = 0) => ({
  ...recommendation,
  confidence: clamp(recommendation.confidence, Math.max(0.35, 0.72 - rank * 0.08)),
  evidence:
    Array.isArray(recommendation.evidence) && recommendation.evidence.length
      ? recommendation.evidence.slice(0, 5)
      : buildEvidence(context),
});

export { clamp, buildEvidence, normalizeRecommendation };