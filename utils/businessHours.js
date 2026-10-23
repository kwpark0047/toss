/**
 * businessHours.js — 매장 영업시간 판단 (한국 시간 기준)
 * 프론트 frontend/src/utils/businessHours.js 와 같은 규칙을 쓴다.
 * business_hours: { mon: { open: '11:00', close: '21:00', closed: false }, ... } 또는 그 JSON 문자열
 */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const { KST_OFFSET_MS } = require('./kstTime');

const toMinutes = (hhmm) => {
  if (typeof hhmm !== 'string') return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
};

const parseBusinessHours = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const rangeOf = (hours) => {
  if (!hours || hours.closed) return null;
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  if (open === null || close === null) return null;
  return { open, close };
};

const isWithin = ({ open, close }, minutes) =>
  close <= open ? minutes >= open || minutes < close : minutes >= open && minutes < close;

/**
 * @returns {boolean} 영업 중 여부. 영업시간이 설정되지 않은 매장은 항상 영업 중으로 본다.
 */
function isStoreOpenAt({ businessHours, openTime, closeTime }, date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const dayIndex = kst.getUTCDay();
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const hours = parseBusinessHours(businessHours);

  if (hours) {
    // 전날 자정을 넘겨 이어지는 영업(예: 금 16:00~02:00의 토 01:30)
    const yesterday = rangeOf(hours[DAY_KEYS[(dayIndex + 6) % 7]]);
    if (yesterday && yesterday.close <= yesterday.open && minutes < yesterday.close) return true;
    const todayHours = hours[DAY_KEYS[dayIndex]];
    if (todayHours) {
      const today = rangeOf(todayHours);
      if (!today) return false;
      return today.close <= today.open ? minutes >= today.open : isWithin(today, minutes);
    }
  }

  const fallback = rangeOf({ open: openTime, close: closeTime });
  if (!fallback) return true;
  return isWithin(fallback, minutes);
}

module.exports = { isStoreOpenAt, parseBusinessHours };
