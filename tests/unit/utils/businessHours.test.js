const { isStoreOpenAt } = require('../../../utils/businessHours');

const all = (open, close) =>
  Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
      d,
      { open, close, closed: false },
    ])
  );
const kst = (day, hhmm) => new Date(`2026-10-${day}T${hhmm}:00+09:00`); // 22일 = 목요일

describe('isStoreOpenAt (서버)', () => {
  test('JSON 문자열 영업시간을 한국 시간으로 판단한다', () => {
    const hours = JSON.stringify(all('10:00', '22:00'));
    expect(isStoreOpenAt({ businessHours: hours }, kst(22, '14:00'))).toBe(true);
    expect(isStoreOpenAt({ businessHours: hours }, kst(22, '22:30'))).toBe(false);
  });

  test('휴무일에는 닫혀 있다', () => {
    const hours = { ...all('11:00', '21:00'), sat: { closed: true } };
    expect(isStoreOpenAt({ businessHours: hours }, kst(24, '12:00'))).toBe(false);
  });

  test('자정을 넘는 영업은 다음날 새벽까지 열려 있다', () => {
    const hours = { ...all('16:00', '02:00'), sat: { closed: true } };
    expect(isStoreOpenAt({ businessHours: hours }, kst(24, '01:30'))).toBe(true);
    expect(isStoreOpenAt({ businessHours: hours }, kst(24, '02:30'))).toBe(false);
  });

  test('영업시간이 없으면 항상 영업 중', () => {
    expect(isStoreOpenAt({}, kst(22, '04:00'))).toBe(true);
  });
});
