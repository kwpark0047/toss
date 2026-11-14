import { describe, expect, it } from 'vitest';
import { buildWeatherAnnouncement, getLiveWeatherKind } from '@/utils/tinkerbellWeather';

const menu = [
  { id: 1, name: '아이스 아메리카노', isCold: true, category_id: 'coffee' },
  { id: 2, name: '따뜻한 라떼', isHot: true, category_id: 'coffee' },
  { id: 3, name: { ko: '레몬에이드', en: 'Lemon ade' }, isCold: true, category_id: 'ade' },
  { id: 4, name: '품절 라떼', isHot: true, isSoldOut: true },
];
const fresh = { fetched_at: new Date().toISOString(), is_fallback: false, source: 'kma' };

describe('Tinkerbell current weather announcement', () => {
  it('매장 날씨의 현재 기온과 강수 정보를 바탕으로 따뜻한 메뉴를 안내한다', () => {
    const result = buildWeatherAnnouncement(
      { ...fresh, temp: 7, rain: 0, isRaining: false, condition: '강수 없음' },
      menu
    );

    expect(result.kind).toBe('cold');
    expect(result.recommendation.id).toBe(2);
    expect(result.text).toContain('7°C');
    expect(result.text).toContain('따뜻한 라떼');
    expect(result.text).not.toContain('맑은');
  });

  it('비가 관측되면 기온이 높아도 비 문구와 비가 오지 않는 메뉴를 우선 안내한다', () => {
    const result = buildWeatherAnnouncement(
      { ...fresh, temp: 30, rain: 1, isRaining: true, condition: '비' },
      menu
    );

    expect(result.kind).toBe('rain');
    expect(result.text).toContain('비가 내리고');
    expect(result.recommendation.id).toBe(2);
  });

  it('fallback·오래된 값·메뉴 없음에는 현재 날씨 추천을 만들지 않는다', () => {
    expect(buildWeatherAnnouncement({ ...fresh, temp: 20, is_fallback: true }, menu)).toBeNull();
    expect(
      buildWeatherAnnouncement({ ...fresh, temp: 20, fetched_at: 'invalid' }, menu)
    ).toBeNull();
    expect(
      buildWeatherAnnouncement({ ...fresh, temp: 20, fetched_at: '2001-01-01T00:00:00.000Z' }, menu)
    ).toBeNull();
    expect(buildWeatherAnnouncement({ ...fresh, temp: null }, menu)).toBeNull();
    expect(buildWeatherAnnouncement({ fetched_at: fresh.fetched_at, temp: 20 }, menu)).toBeNull();
    expect(buildWeatherAnnouncement({ ...fresh, temp: 20 }, [])).toBeNull();
  });

  it('온화하고 강수 없는 날은 맑다고 단정하지 않고 관측된 사실만 말한다', () => {
    const result = buildWeatherAnnouncement(
      { ...fresh, temp: 21, rain: 0, isRaining: false, condition: '강수 없음' },
      menu
    );

    expect(result.kind).toBe('mild');
    expect(result.text).toContain('강수는 관측되지');
    expect(result.text).not.toContain('맑');
  });

  it('한국어가 아닌 고객 언어에도 해당 언어 문장을 제공한다', () => {
    const result = buildWeatherAnnouncement(
      { ...fresh, temp: 31, rain: 0, isRaining: false, condition: '강수 없음' },
      [menu[2]],
      'en'
    );

    expect(result.text).toContain('31°C');
    expect(result.text).toContain('Lemon ade');
  });

  it('기상 상태 분류는 fallback 응답을 무시한다', () => {
    expect(
      getLiveWeatherKind({ ...fresh, temp: 18, isRaining: true, is_fallback: true })
    ).toBeNull();
  });
});
