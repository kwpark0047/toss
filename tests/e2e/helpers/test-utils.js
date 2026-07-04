/**
 * E2E 테스트 공통 유틸리티
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const API_URL  = process.env.PLAYWRIGHT_API_URL  || 'http://localhost:3000';
const TEST_STORE_ID = process.env.TEST_STORE_ID || '1';

// ── 성능 지표 수집 ─────────────────────────────────────────────────────────
const collectPerfMetrics = async (page) => {
    return page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        return {
            domContentLoaded: nav?.domContentLoadedEventEnd - nav?.startTime,
            loadComplete:     nav?.loadEventEnd - nav?.startTime,
            fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
            lcp: null, // PerformanceObserver 필요
            resources: performance.getEntriesByType('resource').length,
        };
    });
};

// ── reduced-motion 감지 ────────────────────────────────────────────────────
const checkReducedMotion = async (page) => {
    return page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
};

// ── 저사양 기기 신호 감지 ─────────────────────────────────────────────────
const checkLowSpecSignals = async (page) => {
    return page.evaluate(() => ({
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,        // GB, 일부 브라우저만 지원
        connection: navigator.connection?.effectiveType, // '2g'|'3g'|'4g'
        isLowSpec: (navigator.hardwareConcurrency <= 2) ||
                   (navigator.deviceMemory && navigator.deviceMemory <= 2),
    }));
};

// ── 애니메이션 실행 여부 확인 ──────────────────────────────────────────────
const checkAnimationsRunning = async (page, selector) => {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { found: false };
        const anims = el.getAnimations ? el.getAnimations() : [];
        const computed = window.getComputedStyle(el);
        return {
            found: true,
            animationCount: anims.length,
            animationName: computed.animationName,
            animationDuration: computed.animationDuration,
            transition: computed.transition,
            // CSS 변수로 폴백 여부 확인
            isStaticFallback: computed.animationName === 'none' || computed.animationDuration === '0s',
        };
    }, selector);
};

// ── 콘솔 에러 수집기 ──────────────────────────────────────────────────────
const setupConsoleCapture = (page) => {
    const errors = [];
    const warnings = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
        if (msg.type() === 'warning') warnings.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    return { errors, warnings };
};

// ── 네트워크 응답 속도 측정 ───────────────────────────────────────────────
const measureApiLatency = async (page, apiPath) => {
    const start = Date.now();
    const res = await page.request.get(`${API_URL}${apiPath}`);
    const latency = Date.now() - start;
    return { status: res.status(), latency, ok: res.ok() };
};

module.exports = {
    BASE_URL, API_URL, TEST_STORE_ID,
    collectPerfMetrics, checkReducedMotion, checkLowSpecSignals,
    checkAnimationsRunning, setupConsoleCapture, measureApiLatency,
};
