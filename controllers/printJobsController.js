/**
 * printJobsController.js — 주방 프린트 작업 (프린트 에이전트 전용)
 *
 * 보안 원칙:
 *  - 대상 매장은 **오직 API 키에 바인딩된 req.apiClient.storeId**로 결정한다.
 *    클라이언트가 보낸 store_id / :storeId 는 신뢰하지 않으며, 값이 있으면
 *    API 키 매장과 일치하는지 확인만 하고 불일치 시 403을 반환한다.
 *  - 모든 UPDATE 는 `WHERE ... AND store_id = $키매장` 으로 스코프를 강제해
 *    타 매장 작업 탈취/변조(IDOR)를 원천 차단한다.
 *
 * 상태 값은 Open API v1(v1Controller)과 동일한 어휘를 사용한다:
 *   pending → printing → done | failed
 */
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const orderEventService = require('../services/OrderEventService');
const alerting = require('../utils/alerting');

/** 최대 재시도 횟수 (초과 시 failed 확정) */
const MAX_ATTEMPTS = 3;

/**
 * API 키 매장과 요청에 실린 매장 식별자의 일치를 검증한다.
 * @returns {{ storeId:number }|{ error:{ status:number, body:object } }}
 */
function resolveStoreId(req) {
  const storeId = req.apiClient?.storeId;
  if (!storeId) {
    return {
      error: { status: 401, body: { success: false, message: 'API 키 인증이 필요합니다.' } },
    };
  }
  // 클라이언트가 매장을 명시했다면 "검증"만 한다 (권한 결정에는 사용하지 않음)
  const claimed = req.params?.storeId ?? req.query?.store_id;
  if (claimed !== undefined && claimed !== null && String(claimed).length > 0) {
    if (parseInt(claimed, 10) !== storeId) {
      logger.warn(
        `[PrintJobs] 매장 불일치 차단: key.store=${storeId} claimed=${claimed} ip=${req.ip}`
      );
      return {
        error: {
          status: 403,
          body: { success: false, message: '해당 매장에 대한 권한이 없습니다.' },
        },
      };
    }
  }
  return { storeId };
}

/** :jobId 파싱 (양의 정수만 허용) */
function parseJobId(req) {
  const id = parseInt(req.params.jobId, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const printJobsController = {
  /** [GET] 미처리(pending) 작업 목록 — API 키 매장 한정 */
  getPending: async (req, res) => {
    const resolved = resolveStoreId(req);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

    try {
      const jobs = await prisma.$queryRawUnsafe(
        `SELECT id, store_id, order_id, kind, status, payload_b64, attempts, created_at
                 FROM print_jobs
                 WHERE store_id = $1 AND status = 'pending'
                   AND (next_retry_at IS NULL OR next_retry_at <= NOW())
                 ORDER BY created_at ASC
                 LIMIT 20`,
        resolved.storeId
      );
      res.json({ success: true, data: jobs });
    } catch (err) {
      logger.error(`[PrintJobs] 조회 실패: ${err.message}`);
      res.status(500).json({ success: false, message: '조회 실패' });
    }
  },

  /** [PATCH] 작업 점유 — pending 상태이며 자기 매장 소유인 경우에만 성공 */
  claim: async (req, res) => {
    const resolved = resolveStoreId(req);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

    const jobId = parseJobId(req);
    if (!jobId) {
      return res.status(400).json({ success: false, message: '올바르지 않은 작업 ID 형식입니다.' });
    }

    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE print_jobs
                    SET status = 'printing', claimed_at = NOW(), attempts = attempts + 1
                  WHERE id = $1 AND store_id = $2 AND status = 'pending'`,
        jobId,
        resolved.storeId
      );
      if (result === 0) {
        // 소유자가 아니거나 이미 점유된 작업 — 존재 여부를 노출하지 않기 위해 동일 응답
        return res
          .status(409)
          .json({ success: false, message: '이미 처리 중이거나 완료된 작업입니다.' });
      }
      res.json({ success: true });
    } catch (err) {
      logger.error(`[PrintJobs] 클레임 실패: ${err.message}`);
      res.status(500).json({ success: false, message: '클레임 실패' });
    }
  },

  /** [PATCH] 인쇄 완료 처리 */
  complete: async (req, res) => {
    const resolved = resolveStoreId(req);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

    const jobId = parseJobId(req);
    if (!jobId) {
      return res.status(400).json({ success: false, message: '올바르지 않은 작업 ID 형식입니다.' });
    }

    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE print_jobs
                    SET status = 'done', printed_at = NOW(), error = NULL
                  WHERE id = $1 AND store_id = $2 AND status = 'printing'`,
        jobId,
        resolved.storeId
      );
      if (result === 0) {
        return res.status(409).json({ success: false, message: '점유 중인 작업이 아닙니다.' });
      }
      res.json({ success: true });
    } catch (err) {
      logger.error(`[PrintJobs] 완료 처리 실패: ${err.message}`);
      res.status(500).json({ success: false, message: '완료 처리 실패' });
    }
  },

  /** [PATCH] 인쇄 실패 보고 — MAX_ATTEMPTS 미만이면 pending 복귀, 이상이면 failed 확정 */
  fail: async (req, res) => {
    const resolved = resolveStoreId(req);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

    const jobId = parseJobId(req);
    if (!jobId) {
      return res.status(400).json({ success: false, message: '올바르지 않은 작업 ID 형식입니다.' });
    }

    const reason = String(req.body?.error || req.body?.reason || 'Unknown error').slice(0, 300);

    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT attempts, order_id FROM print_jobs
                  WHERE id = $1 AND store_id = $2 AND status IN ('pending', 'printing')`,
        jobId,
        resolved.storeId
      );
      if (!rows || rows.length === 0) {
        return res
          .status(409)
          .json({ success: false, message: '실패 처리할 수 있는 작업이 아닙니다.' });
      }

      const attempts = Number(rows[0].attempts || 0);
      const nextStatus = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

      const retryAt =
        attempts >= MAX_ATTEMPTS
          ? null
          : new Date(Date.now() + Math.pow(2, Math.max(0, attempts - 1)) * 60 * 1000);
      await prisma.$executeRawUnsafe(
        `UPDATE print_jobs SET status = $1, error = $2, next_retry_at = $5 WHERE id = $3 AND store_id = $4`,
        nextStatus,
        reason,
        jobId,
        resolved.storeId,
        retryAt
      );
      if (nextStatus === 'failed') {
        void alerting.send({
          level: 'critical',
          title: '프린트 작업 최종 실패',
          message: `store ${resolved.storeId} job ${jobId} failed after ${attempts} attempts`,
          meta: { storeId: resolved.storeId, jobId, orderId: rows[0].order_id, reason },
        });
        void orderEventService.record({
          orderId: rows[0].order_id,
          storeId: resolved.storeId,
          eventType: 'PRINT_FAILED',
          metadata: { job_id: jobId, attempts, reason },
        });
      }
      res.json({
        success: true,
        data: { id: jobId, status: nextStatus, attempts, next_retry_at: retryAt },
      });
    } catch (err) {
      logger.error(`[PrintJobs] 실패 처리 실패: ${err.message}`);
      res.status(500).json({ success: false, message: '실패 처리 실패' });
    }
  },
};

module.exports = printJobsController;
module.exports.MAX_ATTEMPTS = MAX_ATTEMPTS;
