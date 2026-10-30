export const getLowStockCount = (value) => {
  const payload = value?.data?.data ?? value?.data ?? value;
  const count = Number(payload?.count);
  if (Number.isFinite(count) && count >= 0) return count;
  return Array.isArray(payload?.alerts)
    ? payload.alerts.length
    : Array.isArray(payload)
      ? payload.length
      : 0;
};
