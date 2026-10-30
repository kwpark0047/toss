import { describe, it, expect } from 'vitest';
import { isStoreOpenAt, getTodayHoursAt, getNextOpenAt } from '@/utils/businessHours';

const all = (open, close) =>
  Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
      d,
      { open, close, closed: false },
    ])
  );
const closed = { open: '09:00', close: '22:00', closed: true };

// 2026-10-22는 목요일. UTC+9 기준 시각으로 만든다.
const kst = (day, hhmm) => new Date(`2026-10-${day}T${hhmm}:00+09:00`);

describe('isStoreOpenAt', () => {
  it('영업시간 안이면 영업 중 (객체)', () => {
    expect(isStoreOpenAt({ businessHours: all('10:00', '22:00') }, kst(22, '14:00'))).toBe(true);
  });

  it('JSON 문자열로 저장된 영업시간도 읽는다', () => {
    expect(
      isStoreOpenAt({ businessHours: JSON.stringify(all('10:30', '19:20')) }, kst(22, '19:19'))
    ).toBe(true);
    expect(
      isStoreOpenAt({ businessHours: JSON.stringify(all('10:30', '19:20')) }, kst(22, '19:20'))
    ).toBe(false);
  });

  it('휴무일은 닫힘', () => {
    const hours = { ...all('11:00', '21:00'), sat: closed, sun: closed };
    expect(isStoreOpenAt({ businessHours: hours }, kst(24, '12:00'))).toBe(false); // 토
  });

  it('자정을 넘는 영업: 시작일 저녁과 다음날 새벽 모두 영업 중', () => {
    const hours = { ...all('16:00', '02:00'), sat: closed };
    expect(isStoreOpenAt({ businessHours: hours }, kst(23, '23:00'))).toBe(true); // 금 23시
    expect(isStoreOpenAt({ businessHours: hours }, kst(24, '01:30'))).toBe(true); // 토 새벽(금요일 영업분)
    expect(isStoreOpenAt({ businessHours: hours }, kst(24, '02:00'))).toBe(false);
    expect(isStoreOpenAt({ businessHours: hours }, kst(23, '15:00'))).toBe(false);
  });

  it('요일 정보가 없으면 open_time/close_time 사용, 그것도 없으면 영업 중', () => {
    expect(isStoreOpenAt({ openTime: '09:00', closeTime: '18:00' }, kst(22, '20:00'))).toBe(false);
    expect(isStoreOpenAt({}, kst(22, '03:00'))).toBe(true);
  });
});

describe('getTodayHoursAt', () => {
  it('오늘 요일 영업시간을 돌려준다', () => {
    expect(
      getTodayHoursAt({ businessHours: JSON.stringify(all('11:00', '21:00')) }, kst(22, '09:00'))
    ).toEqual({
      open: '11:00',
      close: '21:00',
      closed: false,
    });
  });
});

describe('getNextOpenAt', () => {
  it('returns the next scheduled opening in Seoul time, including the next day', () => {
    const hours = { ...all('10:00', '22:00'), sat: closed };
    const next = getNextOpenAt({ businessHours: hours }, kst(24, '23:00'));
    expect(next?.toISOString()).toBe('2026-10-25T01:00:00.000Z'); // 일요일 10:00 KST
  });

  it('returns today opening when it is still ahead', () => {
    const next = getNextOpenAt({ businessHours: all('10:00', '22:00') }, kst(22, '09:15'));
    expect(next?.toISOString()).toBe('2026-10-22T01:00:00.000Z');
  });

  it('returns null when no usable schedule is configured', () => {
    expect(getNextOpenAt({ businessHours: { mon: closed } }, kst(22, '12:00'))).toBeNull();
  });
});
