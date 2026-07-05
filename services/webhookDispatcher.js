/**
 * webhookDispatcher.js — Open Commerce Hub 웹훅 디스패처
 *
 * 이벤트 발생 → 매장의 활성 엔드포인트 조회 → HMAC-SHA256 서명한 페이로드를
 * 각 URL로 POST → webhook_deliveries에 결과 기록. 실패 시 지수 백오프 재시도
 * (스케줄러가 next_retry_at 도래분을 재발송).
 *
 * 서명 검증(수신 측): HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
 *   헤더: X-WeMarket-Signature: t=<ts>,v1=<hex>
 */
const crypto = require('crypto');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const MAX_ATTEMPTS = 5;
const TIMEOUT_MS = 8000;
// 재시도 백오프(분): 1 → 5 → 30 → 120 → 360
const BACKOFF_MIN = [1, 5, 30, 120, 360];

const sign = (secret, timestamp, body) =>
    crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

/** 단일 delivery 전송 시도 */
async function attemptDelivery(delivery, endpoint) {
    const bodyStr = typeof delivery.payload === 'string' ? delivery.payload : JSON.stringify(delivery.payload);
    const ts = Math.floor(Date.now() / 1000);
    const signature = sign(endpoint.secret, ts, bodyStr);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let responseStatus = null, ok = false, errMsg = null;
    try {
        const res = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'WeMarket-Webhook/1.0',
                'X-WeMarket-Event': delivery.event_type,
                'X-WeMarket-Delivery': String(delivery.id),
                'X-WeMarket-Signature': `t=${ts},v1=${signature}`,
            },
            body: bodyStr,
            signal: controller.signal,
        });
        responseStatus = res.status;
        ok = res.status >= 200 && res.status < 300;
        if (!ok) errMsg = `HTTP ${res.status}`;
    } catch (e) {
        errMsg = e.name === 'AbortError' ? 'timeout' : e.message;
    } finally {
        clearTimeout(timer);
    }

    const attempts = delivery.attempts + 1;
    if (ok) {
        await prisma.webhook_deliveries.update({
            where: { id: delivery.id },
            data: { status: 'success', attempts, response_status: responseStatus, delivered_at: new Date(), next_retry_at: null }
        });
        return true;
    }

    const exhausted = attempts >= MAX_ATTEMPTS;
    const backoffMin = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)];
    const updateData = {
        status: exhausted ? 'failed' : 'pending',
        attempts,
        response_status: responseStatus,
        last_error: (errMsg || '').slice(0, 300)
    };
    if (!exhausted) {
        updateData.next_retry_at = new Date(Date.now() + backoffMin * 60 * 1000);
    }
    await prisma.webhook_deliveries.update({
        where: { id: delivery.id },
        data: updateData
    });
    return false;
}

/**
 * 이벤트 발행 — 매장의 구독 엔드포인트에 즉시 발송 시도(비동기).
 * 주문/결제 흐름을 막지 않도록 await 없이 호출해도 안전(내부에서 자체 처리).
 */
async function emitEvent(storeId, eventType, data) {
    try {
        const endpoints = await prisma.webhook_endpoints.findMany({
            where: { store_id: Number(storeId), active: true }
        });
        const targets = endpoints.filter(ep => {
            const evs = String(ep.events || '*').split(',').map(s => s.trim());
            return evs.includes('*') || evs.includes(eventType);
        });
        if (targets.length === 0) return;

        const payload = {
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: eventType,
            created: Math.floor(Date.now() / 1000),
            store_id: Number(storeId),
            data,
        };

        for (const ep of targets) {
            const delivery = await prisma.webhook_deliveries.create({
                data: { endpoint_id: ep.id, event_type: eventType, payload }
            });
            // 즉시 1차 발송 (실패해도 스케줄러가 재시도)
            attemptDelivery(delivery, ep).catch(err =>
                logger.warn(`[webhook] 발송 오류(ep ${ep.id}): ${err.message}`));
        }
    } catch (e) {
        logger.error(`[webhook] emitEvent 실패 (${eventType}): ${e.message}`);
    }
}

/** 재시도 스케줄러 — next_retry_at 도래한 pending 건 재발송 */
let timer = null;
function startRetryScheduler(intervalMs = 60_000) {
    if (timer) return;
    timer = setInterval(async () => {
        try {
            const due = await prisma.webhook_deliveries.findMany({
                where: { status: 'pending', next_retry_at: { not: null, lte: new Date() } },
                orderBy: { next_retry_at: 'asc' },
                take: 50
            });
            for (const d of due) {
                const ep = await prisma.webhook_endpoints.findUnique({ where: { id: d.endpoint_id } });
                if (ep && ep.active) await attemptDelivery(d, ep);
            }
            if (due.length) logger.info(`[webhook] 재시도 ${due.length}건 처리`);
        } catch (e) {
            logger.error(`[webhook] 재시도 스케줄러 오류: ${e.message}`);
        }
    }, intervalMs);
    timer.unref();
    logger.info('[webhook] 재시도 스케줄러 시작 (60초 간격)');
}

module.exports = { emitEvent, attemptDelivery, sign, startRetryScheduler, MAX_ATTEMPTS };
