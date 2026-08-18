const {
  normalizeRecommendation,
  buildEvidence,
} = require('../../../utils/recommendationExplainability');

describe('recommendation explainability', () => {
  it('추천 결과에 confidence와 근거를 보강한다', () => {
    const result = normalizeRecommendation(
      { id: 1, reason: '인기 메뉴' },
      {
        pastOrders: ['아메리카노'],
        weather: '비',
        preferences: '담백',
      }
    );

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.evidence).toEqual(expect.arrayContaining(['과거 주문 이력', '현재 날씨·시간']));
  });

  it('근거가 없으면 기본 근거를 반환한다', () => {
    expect(buildEvidence()).toEqual(['메뉴 기본 정보']);
  });
});
