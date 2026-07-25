/**
 * kstTime.ts — 한국 표준시(KST, UTC+9) 시간 처리 유틸리티
 */
export const KST_OFFSET_MS: number = 9 * 60 * 60 * 1000;

export const kstNow = (): Date => new Date(Date.now() + KST_OFFSET_MS);

export interface KstDayRange {
    startOfDay: Date;
    endOfDay: Date;
}

export const kstDayRange = (dateStr: string): KstDayRange => {
    const startOfDay = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - KST_OFFSET_MS);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startOfDay, endOfDay };
};
