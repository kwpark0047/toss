/**
 * kstTime.ts — 한국 표준시(KST, UTC+9) 시간 처리 유틸리티
 */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const kstNow = (): Date => new Date(Date.now() + KST_OFFSET_MS);
export const kstDayRange = (dateStr: string): { startOfDay: Date; endOfDay: Date } => {
  const startOfDay = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - KST_OFFSET_MS);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startOfDay, endOfDay };
};

export default { KST_OFFSET_MS, kstNow, kstDayRange };