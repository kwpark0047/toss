/**
 * kstTime.js — 한국 표준시(KST, UTC+9) 시간 처리 유틸리티
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const kstNow = () => new Date(Date.now() + KST_OFFSET_MS);
const kstDayRange = (dateStr) => {
    const startOfDay = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - KST_OFFSET_MS);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startOfDay, endOfDay };
};

module.exports = { KST_OFFSET_MS, kstNow, kstDayRange };