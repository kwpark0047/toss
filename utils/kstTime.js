"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kstDayRange = exports.kstNow = exports.KST_OFFSET_MS = void 0;
/**
 * kstTime.ts — 한국 표준시(KST, UTC+9) 시간 처리 유틸리티
 */
exports.KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const kstNow = () => new Date(Date.now() + exports.KST_OFFSET_MS);
exports.kstNow = kstNow;
const kstDayRange = (dateStr) => {
    const startOfDay = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - exports.KST_OFFSET_MS);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startOfDay, endOfDay };
};
exports.kstDayRange = kstDayRange;
