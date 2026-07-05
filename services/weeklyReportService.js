/**
 * weeklyReportService.js
 * 매주 월요일 오전 9시(KST)에 매장별 지난 7일 매출 요약을 알림으로 발송한다.
 *
 * - 스케줄: 10분 간격 폴링 → KST 월요일 09:00~09:59 사이 1회 실행
 * - 중복 방지: notifications 테이블에서 최근 6일 내 WEEKLY_REPORT 존재 여부 확인
 *   (프로세스 재시작·다중 인스턴스에도 안전)
 */
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const { kstNow } = require('../utils/kstTime');

const POLL_INTERVAL_MS = 10 * 60 * 1000;

const fmtWon = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n)) + '원';

/** 매장 1곳의 지난 7일 통계 집계 */
async function buildStoreReport(storeId, from, to) {
    const orders = await prisma.orders.findMany({
        where: {
            store_id: storeId,
            created_at: { gte: from, lt: to },
            status: { notIn: ['cancelled'] },
        },
        include: { order_items: true },
    });
    if (orders.length === 0) return null;

    const revenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const avgOrder = revenue / orders.length;

    // 메뉴별 판매량 집계 → 상위 3개
    const itemCount = {};
    for (const o of orders) {
        for (const it of o.order_items || []) {
            const name = it.item_name || it.product_name || '기타';
            itemCount[name] = (itemCount[name] || 0) + (it.quantity || 1);
        }
    }
    const topItems = Object.entries(itemCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, qty]) => `${name}(${qty})`);

    return { orderCount: orders.length, revenue, avgOrder, topItems };
}

/** 전체 매장 리포트 발송 (수동 트리거에서도 재사용) */
async function sendWeeklyReports() {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 지난 7일간 주문이 있었던 매장만 대상
    const activeStores = await prisma.orders.groupBy({
        by: ['store_id'],
        where: { created_at: { gte: from, lt: now } },
    });

    let sent = 0;
    for (const { store_id } of activeStores) {
        try {
            // 중복 방지: 최근 6일 내 이미 발송했으면 스킵
            const dup = await prisma.notifications.findFirst({
                where: {
                    store_id,
                    type: 'WEEKLY_REPORT',
                    created_at: { gte: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },
                },
            });
            if (dup) continue;

            const report = await buildStoreReport(store_id, from, now);
            if (!report) continue;

            const top = report.topItems.length ? ` 인기 메뉴: ${report.topItems.join(', ')}` : '';
            await notificationService.createNotification({
                store_id,
                type: 'WEEKLY_REPORT',
                title: '📊 주간 매출 리포트',
                message: `지난 7일 주문 ${report.orderCount}건 · 매출 ${fmtWon(report.revenue)} · 객단가 ${fmtWon(report.avgOrder)}.${top}`,
                data: {
                    period: { from: from.toISOString(), to: now.toISOString() },
                    order_count: report.orderCount,
                    revenue: report.revenue,
                    avg_order: Math.round(report.avgOrder),
                    top_items: report.topItems,
                },
                priority: 'normal',
                link: `/admin/stores/${store_id}/stats`,
            });
            sent++;
        } catch (err) {
            logger.warn(`[주간리포트] store ${store_id} 발송 실패: ${err.message}`);
        }
    }
    if (sent > 0) logger.info(`[주간리포트] ${sent}개 매장 발송 완료`);
    return sent;
}

let timer = null;

/** 스케줄러 시작 — index.js에서 호출 */
function start() {
    if (timer) return;
    timer = setInterval(async () => {
        try {
            const k = kstNow();
            // KST 월요일(getUTCDay on shifted date) 09시대에만 실행
            if (k.getUTCDay() === 1 && k.getUTCHours() === 9) {
                await sendWeeklyReports();
            }
        } catch (err) {
            logger.error(`[주간리포트] 스케줄러 오류: ${err.message}`);
        }
    }, POLL_INTERVAL_MS);
    timer.unref(); // 프로세스 종료를 막지 않음
    logger.info('[주간리포트] 스케줄러 시작 (매주 월요일 09:00 KST)');
}

function stop() {
    if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { start, stop, sendWeeklyReports, buildStoreReport };
