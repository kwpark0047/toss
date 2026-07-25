/**
 * CircuitBreaker — 외부 API 장애 격리
 *
 * CLOSED  → 정상 운영. 임계치 이상 실패 시 OPEN 전환
 * OPEN    → 즉시 실패 반환 (외부 API 호출 차단). cooldown 후 HALF_OPEN
 * HALF_OPEN → 탐색 요청 1개 허용. 성공 시 CLOSED, 실패 시 OPEN 복귀
 */
const logger = require('./logger');
const alerting = require('./alerting');

const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.failureThreshold  = options.failureThreshold  ?? 5;   // 연속 실패 허용 횟수
        this.successThreshold  = options.successThreshold  ?? 2;   // HALF_OPEN → CLOSED 기준
        this.cooldownMs        = options.cooldownMs        ?? 30_000; // OPEN 유지 시간(ms)
        this.timeoutMs         = options.timeoutMs         ?? 10_000; // 단일 요청 타임아웃

        this._state         = STATE.CLOSED;
        this._failureCount  = 0;
        this._successCount  = 0;
        this._lastFailureAt = null;
        this._nextAttemptAt = null;
    }

    get state() { return this._state; }

    get stats() {
        return {
            name: this.name,
            state: this._state,
            failureCount: this._failureCount,
            lastFailureAt: this._lastFailureAt,
            nextAttemptAt: this._nextAttemptAt,
        };
    }

    async call(fn) {
        if (this._state === STATE.OPEN) {
            if (Date.now() < this._nextAttemptAt) {
                const err = new Error(`[CircuitBreaker:${this.name}] OPEN — 서비스 일시 차단 중`);
                err.isCircuitBreakerOpen = true;
                throw err;
            }
            // 쿨다운 만료 → HALF_OPEN 시도
            this._setState(STATE.HALF_OPEN);
        }

        try {
            const result = await Promise.race([
                fn(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`[CircuitBreaker:${this.name}] 요청 타임아웃 (${this.timeoutMs}ms)`)), this.timeoutMs)
                )
            ]);
            this._onSuccess();
            return result;
        } catch (err) {
            this._onFailure(err);
            throw err;
        }
    }

    _onSuccess() {
        this._failureCount = 0;
        if (this._state === STATE.HALF_OPEN) {
            this._successCount++;
            if (this._successCount >= this.successThreshold) {
                this._setState(STATE.CLOSED);
            }
        }
    }

    _onFailure(err) {
        this._lastFailureAt = new Date().toISOString();
        this._failureCount++;
        this._successCount = 0;

        if (this._state === STATE.HALF_OPEN || this._failureCount >= this.failureThreshold) {
            this._setState(STATE.OPEN);
        }
        logger.warn(`[CircuitBreaker:${this.name}] 실패 #${this._failureCount}: ${err.message}`);
    }

    _setState(newState) {
        const prev = this._state;
        this._state = newState;
        if (newState === STATE.OPEN) {
            this._nextAttemptAt = Date.now() + this.cooldownMs;
            logger.error(`[CircuitBreaker:${this.name}] OPEN 전환 (${this.cooldownMs / 1000}초 차단)`);
            alerting.send({
                level: 'critical',
                title: `🔴 Circuit Breaker OPEN: ${this.name}`,
                message: `외부 서비스 장애 감지 — ${this.failureThreshold}회 연속 실패. ${this.cooldownMs / 1000}초 동안 자동 차단.`,
                meta: { service: this.name, failures: this._failureCount }
            });
        } else if (newState === STATE.CLOSED && prev !== STATE.CLOSED) {
            logger.info(`[CircuitBreaker:${this.name}] CLOSED 복구`);
            alerting.send({
                level: 'info',
                title: `✅ Circuit Breaker 복구: ${this.name}`,
                message: '외부 서비스가 정상 응답을 재개했습니다.',
                meta: { service: this.name }
            });
        }
    }
}

// 싱글턴 인스턴스 레지스트리
const registry = new Map();

const get = (name, options) => {
    if (!registry.has(name)) registry.set(name, new CircuitBreaker(name, options));
    return registry.get(name);
};

const allStats = () => [...registry.values()].map(cb => cb.stats);

module.exports = { get, allStats, CircuitBreaker };
