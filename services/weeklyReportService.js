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
const https = require('https');
const notificationService = require('./notificationService');
const { kstNow, KST_OFFSET_MS } = require('../utils/kstTime');
const { fmtWon } = require('../utils/format');

const EMAIL_WEBHOOK_URL = process.env.REPORT_EMAIL_WEBHOOK_URL || '';
const EMAIL_RECIPIENT = process.env.REPORT_EMAIL_TO || '';

async function _sendEmail(subject, htmlBody) {
    if (!EMAIL_WEBHOOK_URL || !EMAIL_RECIPIENT) return;
    try {
        const { hostname, pathname, search } = new URL(EMAIL_WEBHOOK_URL);
        const payload = JSON.stringify({ to: EMAIL_RECIPIENT, subject, html: htmlBody });
        await new Promise((resolve, reject) => {
            const req = https.request(
                { hostname, path: pathname + (search || ''), method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
                (res) => { res.resume(); res.on('end', resolve); }
            );
            req.on('error', reject);
            req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
            req.write(payload);
            req.end();
        });
        logger.info(`[리포트] 이메일 발송 완료 → ${EMAIL_RECIPIENT}`);
    } catch (err) {
        logger.warn(`[리포트] 이메일 발송 실패: ${err.message}`);
    }
}

const POLL_INTERVAL_MS = 10 * 60 * 1000;

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
    const storeSummaries = [];
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
                title: '주간 매출 리포트',
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
            storeSummaries.push(`<tr><td>store#${store_id}</td><td>${report.orderCount}</td><td>${fmtWon(report.revenue)}</td><td>${fmtWon(report.avgOrder)}</td></tr>`);
            sent++;
        } catch (err) {
            logger.warn(`[주간리포트] store ${store_id} 발송 실패: ${err.message}`);
        }
    }
    if (sent > 0) {
        logger.info(`[주간리포트] ${sent}개 매장 발송 완료`);
        const tableRows = storeSummaries.join('');
        await _sendEmail(
            `[WeMarket] 주간 리포트 요약 (${from.toLocaleDateString()}~${now.toLocaleDateString()})`,
            `<h2>주간 매출 리포트 요약</h2><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><tr><th>매장</th><th>주문</th><th>매출</th><th>객단가</th></tr>${tableRows}</table><p><small>전체 ${sent}개 매장</small></p>`
        );
    }
    return sent;
}

/** 전체 매장 월간 리포트 발송 (지난 달력월 기준, 수동 트리거에서도 재사용) */
async function sendMonthlyReports() {
    const k = kstNow();
    // 지난 달 1일 00:00 ~ 이번 달 1일 00:00 (KST 기준을 UTC로 환산)
    const KST = KST_OFFSET_MS;
    const thisMonthStartUtc = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - KST);
    const lastMonthStartUtc = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() - 1, 1) - KST);

    const activeStores = await prisma.orders.groupBy({
        by: ['store_id'],
        where: { created_at: { gte: lastMonthStartUtc, lt: thisMonthStartUtc } },
    });

    let sent = 0;
    for (const { store_id } of activeStores) {
        try {
            // 중복 방지: 최근 25일 내 이미 발송했으면 스킵
            const dup = await prisma.notifications.findFirst({
                where: {
                    store_id,
                    type: 'MONTHLY_REPORT',
                    created_at: { gte: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
                },
            });
            if (dup) continue;

            const report = await buildStoreReport(store_id, lastMonthStartUtc, thisMonthStartUtc);
            if (!report) continue;

            const top = report.topItems.length ? ` 인기 메뉴: ${report.topItems.join(', ')}` : '';
            await notificationService.createNotification({
                store_id,
                type: 'MONTHLY_REPORT',
                title: '📈 월간 매출 리포트',
                message: `지난 달 주문 ${report.orderCount}건 · 매출 ${fmtWon(report.revenue)} · 객단가 ${fmtWon(report.avgOrder)}.${top}`,
                data: {
                    period: { from: lastMonthStartUtc.toISOString(), to: thisMonthStartUtc.toISOString() },
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
            logger.warn(`[월간리포트] store ${store_id} 발송 실패: ${err.message}`);
        }
    }
    if (sent > 0) {
        logger.info(`[월간리포트] ${sent}개 매장 발송 완료`);
        await _sendEmail(
            `[WeMarket] 월간 리포트 요약 (${lastMonthStartUtc.toLocaleDateString()}~${thisMonthStartUtc.toLocaleDateString()})`,
            `<h2>월간 매출 리포트 요약</h2><p>전체 ${sent}개 매장에서 리포트를 생성했습니다.</p>`
        );
    }
    return sent;
}

let timer = null;

/** 스케줄러 시작 — index.js에서 호출 */
function start() {
    if (timer) return;
    timer = setInterval(async () => {
        try {
            const k = kstNow();
            // KST 월요일 09시대 → 주간 리포트
            if (k.getUTCDay() === 1 && k.getUTCHours() === 9) {
                await sendWeeklyReports();
            }
            // KST 매월 1일 09시대 → 월간 리포트
            if (k.getUTCDate() === 1 && k.getUTCHours() === 9) {
                await sendMonthlyReports();
            }
        } catch (err) {
            logger.error(`[리포트] 스케줄러 오류: ${err.message}`);
        }
    }, POLL_INTERVAL_MS);
    timer.unref(); // 프로세스 종료를 막지 않음
    logger.info('[리포트] 스케줄러 시작 (주간: 월요일 09:00 · 월간: 매월 1일 09:00 KST)');
}

function stop() {
    if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { start, stop, sendWeeklyReports, sendMonthlyReports, buildStoreReport };
