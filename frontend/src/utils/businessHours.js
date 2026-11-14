// 매장 영업시간 판단 (고객 메뉴 화면용)
// business_hours: { mon: { open: '11:00', close: '21:00', closed: false }, ... } 또는 그 JSON 문자열

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const toMinutes = (hhmm) => {
  if (typeof hhmm !== 'string') return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
};

export const parseBusinessHours = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

// 한국 시간 기준 요일·분 (기기 시간대가 달라도 매장 시간으로 판단)
export const getSeoulNow = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    dayIndex: DAY_KEYS.indexOf(get('weekday').toLowerCase().slice(0, 3)),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
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
 * @returns {boolean} 영업 중 여부. 시간이 설정되지 않은 매장은 항상 영업 중으로 본다.
 */
export const isStoreOpenAt = ({ businessHours, openTime, closeTime }, date = new Date()) => {
  const { dayIndex, minutes } = getSeoulNow(date);
  const hours = parseBusinessHours(businessHours);

  if (hours) {
    const todayKey = DAY_KEYS[dayIndex];
    const yesterdayKey = DAY_KEYS[(dayIndex + 6) % 7];
    // 전날 자정을 넘겨 이어지는 영업(예: 금 16:00~02:00의 토 01:30)
    const yesterday = rangeOf(hours[yesterdayKey]);
    if (yesterday && yesterday.close <= yesterday.open && minutes < yesterday.close) return true;
    if (hours[todayKey]) {
      const today = rangeOf(hours[todayKey]);
      if (!today) return false;
      return today.close <= today.open ? minutes >= today.open : isWithin(today, minutes);
    }
  }

  const fallback = rangeOf({ open: openTime, close: closeTime });
  if (!fallback) return true;
  return isWithin(fallback, minutes);
};

export const getTodayHoursAt = ({ businessHours, openTime, closeTime }, date = new Date()) => {
  const hours = parseBusinessHours(businessHours);
  const todayKey = DAY_KEYS[getSeoulNow(date).dayIndex];
  if (hours) {
    const today = hours[todayKey];
    return {
      open: today?.open || openTime || '09:00',
      close: today?.close || closeTime || '22:00',
      closed: Boolean(today?.closed),
    };
  }
  if (!openTime || !closeTime) return null;
  return { open: openTime, close: closeTime, closed: false };
};

/** 다음 영업 시작 시각을 반환합니다. 예약 시간 안내용이며, 영업 여부 판단을 대신하지 않습니다. */
export const getNextOpenAt = ({ businessHours, openTime, closeTime }, date = new Date()) => {
  const hours = parseBusinessHours(businessHours);
  const seoulParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => Number(seoulParts.find((item) => item.type === type)?.value);
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (![year, month, day].every(Number.isFinite)) return null;

  const seoulMidnightUtc = Date.UTC(year, month - 1, day);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateDay = new Date(seoulMidnightUtc + offset * 24 * 60 * 60 * 1000);
    const dayKey = DAY_KEYS[candidateDay.getUTCDay()];
    const configured =
      hours && Object.prototype.hasOwnProperty.call(hours, dayKey)
        ? hours[dayKey]
        : { open: openTime, close: closeTime, closed: false };
    const range = rangeOf(configured);
    if (!range) continue;

    const opening = new Date(
      seoulMidnightUtc + offset * 24 * 60 * 60 * 1000 + range.open * 60 * 1000 - 9 * 60 * 60 * 1000
    );
    if (opening > date) return opening;
  }
  return null;
};
