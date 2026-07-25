/**
 * kstTime 단위 테스트
 * 리팩토링 동작 보존 검증: Order.js/weeklyReportService에 인라인돼 있던
 * KST 로직과 동일한 결과를 내는지 확인.
 */
const { KST_OFFSET_MS, kstNow, kstDayRange } = require('../../../utils/kstTime');

describe('kstTime', () => {
    test('KST_OFFSET_MS는 9시간(ms)', () => {
        expect(KST_OFFSET_MS).toBe(9 * 60 * 60 * 1000);
    });

    describe('kstDayRange', () => {
        test("'2026-07-05'(KST) → UTC 07-04 15:00 ~ 07-05 14:59:59.999", () => {
            const { startOfDay, endOfDay } = kstDayRange('2026-07-05');
            expect(startOfDay.toISOString()).toBe('2026-07-04T15:00:00.000Z');
            expect(endOfDay.toISOString()).toBe('2026-07-05T14:59:59.999Z');
        });

        test('범위 길이는 정확히 하루 - 1ms', () => {
            const { startOfDay, endOfDay } = kstDayRange('2026-01-01');
            expect(endOfDay.getTime() - startOfDay.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
        });

        test('기존 인라인 로직과 동일 결과 (동작 보존)', () => {
            const date = '2026-03-15';
            const K = 9 * 60 * 60 * 1000;
            const legacyStart = new Date(new Date(`${date}T00:00:00.000Z`).getTime() - K);
            const legacyEnd = new Date(legacyStart.getTime() + 24 * 60 * 60 * 1000 - 1);
            const { startOfDay, endOfDay } = kstDayRange(date);
            expect(startOfDay.getTime()).toBe(legacyStart.getTime());
            expect(endOfDay.getTime()).toBe(legacyEnd.getTime());
        });
    });

    describe('kstNow', () => {
        test('UTC now보다 9시간 앞선 시각 성분', () => {
            const before = Date.now();
            const k = kstNow();
            const after = Date.now();
            // kstNow의 내부 타임스탬프는 now + 9h 범위 안
            expect(k.getTime()).toBeGreaterThanOrEqual(before + KST_OFFSET_MS);
            expect(k.getTime()).toBeLessThanOrEqual(after + KST_OFFSET_MS);
        });
    });
});
