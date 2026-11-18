const { AppError } = require('../../utils/errorHandler');
const MINUTE = 60000;
const KST = 9 * 60 * MINUTE;
const invalid = () => new AppError('예약 배달 시간 정보를 확인해 주세요.', 400);

// Calendar months in Korea, clamping month-end (e.g. Dec 31 -> Feb 28).
function twoMonthsLaterKst(now) {
  const local = new Date(now + KST);
  const year = local.getUTCFullYear(),
    month = local.getUTCMonth() + 2;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return (
    Date.UTC(
      year,
      month,
      Math.min(local.getUTCDate(), lastDay),
      local.getUTCHours(),
      local.getUTCMinutes(),
      local.getUTCSeconds(),
      local.getUTCMilliseconds()
    ) - KST
  );
}
function validateBarogoSchedule(body, now) {
  if (
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(body?.pickupWishAt) ||
    typeof body.isReservation !== 'boolean'
  )
    throw invalid();
  if (!body.isReservation) {
    if (
      body.dropWishAt !== undefined ||
      body.reservedOrderDisplayTime !== undefined ||
      body.pickupWishAt < now ||
      body.pickupWishAt > now + 90 * MINUTE
    )
      throw invalid();
    return { isReservation: false, pickupWishAt: body.pickupWishAt };
  }
  const { dropWishAt, pickupWishAt, reservedOrderDisplayTime: display } = body;
  if (
    !Number.isSafeInteger(dropWishAt) ||
    dropWishAt < now + 90 * MINUTE ||
    dropWishAt > twoMonthsLaterKst(now) ||
    !Number.isInteger(display) ||
    display < 20 ||
    display > 90 ||
    pickupWishAt < now ||
    pickupWishAt < dropWishAt - display * MINUTE ||
    pickupWishAt > dropWishAt - 20 * MINUTE
  )
    throw invalid();
  return { isReservation: true, dropWishAt, pickupWishAt, reservedOrderDisplayTime: display };
}
function normalizeDeliveryReservation(data, now = Date.now()) {
  if (data.delivery_reservation == null) return null;
  const value = data.delivery_reservation;
  if (
    data.order_type !== 'delivery' ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !['dropWishAt', 'pickupWishAt', 'reservedOrderDisplayTime'].includes(key)
    )
  )
    throw invalid();
  const { isReservation: _isReservation, ...schedule } = validateBarogoSchedule(
    { ...value, isReservation: true },
    now
  );
  return schedule;
}
module.exports = { validateBarogoSchedule, normalizeDeliveryReservation, twoMonthsLaterKst };
