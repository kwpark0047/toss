/**
 * idempotency.js — 멱등성 키 미들웨어 (M-10)
 *
 * [배경]
 * 주문 생성·결제 승인 API 에 멱등성이 없어, 모바일 네트워크에서 흔한
 * "타임아웃 후 재시도" 상황에서 **중복 주문/중복 결제**가 발생할 수 있었다.
 * (기존에는 FoodTruck 오프라인 동기화에만 중복 방지 로직이 있었다)
 *
 * [동작]
 *   1. 클라이언트가 `Idempotency-Key` 헤더를 보낸다(UUID 권장).
 *   2. 동일 키로 이미 완료된 요청이 있으면 저장된 응답을 그대로 재생한다.
 *      이때 `Idempotency-Replayed: true` 헤더를 붙인다.
 *   3. 동일 키의 요청이 처리 중이면 409 Conflict 로 즉시 거절한다.
 *   4. 같은 키인데 요청 본문이 다르면 422 로 거절한다(키 재사용 오용 방지).
 *
 * [저장소]
 *   Redis 가 있으면 Redis(다중 인스턴스 안전), 없으면 NodeCache 로 폴백한다.
 *   폴백 모드는 단일 인스턴스에서만 유효하므로 운영에서는 REDIS_URL 설정을 권장한다.
 *
 * 성공(2xx) 응답만 저장한다. 4xx/5xx 는 재시도가 유효해야 하므로 캐시하지 않는다.
 */
const crypto = require('crypto');
const NodeCache = require('node-cache');
const redisCache = require('../utils/redisCache');
const logger = require('../utils/logger');

/** 저장 기간 — 결제 재시도 윈도우를 고려해 24시간 */
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

/** 처리 중(in-flight) 표시의 최대 수명 — 데드락 방지 */
const IN_FLIGHT_TTL_SECONDS = 120;

const STATE_IN_FLIGHT = 'in_flight';
const STATE_COMPLETED = 'completed';

// Redis 미가용 시 폴백 저장소
const memoryStore = new NodeCache({
  stdTTL: DEFAULT_TTL_SECONDS,
  checkperiod: 120,
  useClones: false,
});

/** 요청 본문 지문 — 같은 키로 다른 내용을 보내는 오용을 탐지 */
function fingerprint(req) {
  const payload = JSON.stringify({
    method: req.method,
    path: req.originalUrl ? req.originalUrl.split('?')[0] : req.path,
    body: req.body ?? null,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/** 요청 주체를 키에 포함해 타 사용자와의 키 충돌/추측을 방지 */
function scopeOf(req) {
  if (req.user?.id) return `u:${req.user.id}`;
  if (req.apiClient?.storeId) return `k:${req.apiClient.storeId}`;
  return `ip:${req.ip}`;
}

function buildStorageKey(namespace, req, key) {
  return `idem:${namespace}:${scopeOf(req)}:${key}`;
}

// ── 저장소 어댑터 ────────────────────────────────────────────────
const store = {
  async get(key) {
    if (redisCache.isConnected) {
      try {
        return await redisCache.get(key);
      } catch (e) {
        logger.warn(`[Idempotency] Redis get 실패, 메모리로 폴백: ${e.message}`);
      }
    }
    return memoryStore.get(key);
  },

  async set(key, value, ttlSeconds) {
    if (redisCache.isConnected) {
      try {
        await redisCache.set(key, value, ttlSeconds);
        return;
      } catch (e) {
        logger.warn(`[Idempotency] Redis set 실패, 메모리로 폴백: ${e.message}`);
      }
    }
    memoryStore.set(key, value, ttlSeconds);
  },

  async del(key) {
    if (redisCache.isConnected) {
      try {
        await redisCache.del(key);
      } catch {
        /* 폴백 삭제로 이어짐 */
      }
    }
    memoryStore.del(key);
  },
};

/**
 * @param {object} [options]
 * @param {string} [options.namespace='default']  키 네임스페이스 (라우트 그룹 구분)
 * @param {boolean} [options.required=false]      true 면 헤더 누락 시 400
 * @param {number} [options.ttlSeconds]           응답 보관 기간
 */
function idempotency(options = {}) {
  const { namespace = 'default', required = false, ttlSeconds = DEFAULT_TTL_SECONDS } = options;

  return async function idempotencyMiddleware(req, res, next) {
    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';

    if (!key) {
      if (required) {
        return res.status(400).json({
          success: false,
          error: 'Idempotency-Key 헤더가 필요합니다.',
        });
      }
      return next(); // 하위 호환: 키가 없으면 기존 동작 그대로
    }

    if (key.length > 200) {
      return res.status(400).json({ success: false, error: 'Idempotency-Key가 너무 깁니다.' });
    }

    const storageKey = buildStorageKey(namespace, req, key);
    const requestHash = fingerprint(req);

    let record;
    try {
      record = await store.get(storageKey);
    } catch (e) {
      // 저장소 장애로 요청을 막지는 않는다(가용성 우선)
      logger.error(`[Idempotency] 조회 실패, 멱등 보장 없이 진행: ${e.message}`);
      return next();
    }

    if (record) {
      if (record.requestHash !== requestHash) {
        return res.status(422).json({
          success: false,
          error: '동일한 Idempotency-Key로 다른 요청이 전송되었습니다.',
        });
      }

      if (record.state === STATE_IN_FLIGHT) {
        res.set('Retry-After', '2');
        return res.status(409).json({
          success: false,
          error: '동일한 요청이 처리 중입니다. 잠시 후 결과를 확인해주세요.',
        });
      }

      if (record.state === STATE_COMPLETED) {
        logger.info(`[Idempotency] 재생: ${namespace}/${key}`);
        res.set('Idempotency-Replayed', 'true');
        return res.status(record.statusCode).json(record.body);
      }
    }

    // 처리 중 표시 선점
    await store.set(
      storageKey,
      { state: STATE_IN_FLIGHT, requestHash, startedAt: Date.now() },
      IN_FLIGHT_TTL_SECONDS
    );

    // res.json 을 감싸 성공 응답만 저장
    const originalJson = res.json.bind(res);
    let settled = false;

    res.json = (body) => {
      if (!settled) {
        settled = true;
        const statusCode = res.statusCode || 200;
        if (statusCode >= 200 && statusCode < 300) {
          store
            .set(storageKey, { state: STATE_COMPLETED, requestHash, statusCode, body }, ttlSeconds)
            .catch((e) => logger.error(`[Idempotency] 결과 저장 실패: ${e.message}`));
        } else {
          // 실패 응답은 재시도 가능해야 하므로 표시를 지운다
          store.del(storageKey).catch(() => {});
        }
      }
      return originalJson(body);
    };

    // 응답 없이 종료되는 경우(에러 핸들러, 커넥션 종료)에도 잠금을 해제한다
    res.on('finish', () => {
      if (!settled) {
        settled = true;
        store.del(storageKey).catch(() => {});
      }
    });
    res.on('close', () => {
      if (!settled) {
        settled = true;
        store.del(storageKey).catch(() => {});
      }
    });

    next();
  };
}

/** 테스트 전용 */
function _clearMemoryStore() {
  memoryStore.flushAll();
}

module.exports = idempotency;
module.exports.idempotency = idempotency;
module.exports.DEFAULT_TTL_SECONDS = DEFAULT_TTL_SECONDS;
module.exports._clearMemoryStore = _clearMemoryStore;
module.exports._fingerprint = fingerprint;
