/**
 * kstTime.js — 한국 표준시(KST, UTC+9) 시간 처리 유틸리티
 *
 * 서버는 UTC로 동작하지만 매장 운영·통계·스케줄은 KST 기준이어야 한다.
 * KST 오프셋과 "YYYY-MM-DD → KST 하루 범위" 변환이 여러 모듈에 중복되어
 * 있던 것을 단일 소스로 통합했다 (DRY).
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 현재 시각을 KST 벽시계 기준으로 이동한 Date (getUTC* 로 KST 성분 읽기용) */
const kstNow = () => new Date(Date.now() + KST_OFFSET_MS);

/**
 * 'YYYY-MM-DD'(KST 기준 날짜)를 해당 일의 UTC 시작/끝 경계로 변환.
 * 예: '2026-07-05' → KST 07-05 00:00:00 ~ 23:59:59.999 에 대응하는 UTC 범위.
 * Prisma `created_at: { gte, lte }` 필터에 그대로 사용.
 */
const kstDayRange = (dateStr) => {
    const startOfDay = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - KST_OFFSET_MS);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startOfDay, endOfDay };
};

module.exports = { KST_OFFSET_MS, kstNow, kstDayRange };
