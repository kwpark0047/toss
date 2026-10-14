const crypto = require('crypto');
const prisma = require('../config/prisma');
const StoreManagerService = require('./StoreManagerService');
const { AppError } = require('../utils/errorHandler');
const { nextState, summarize } = require('../utils/businessSupportAnalysis');
const identifier = (value) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value)))
    throw new AppError('유효한 작업 ID가 필요합니다.', 400);
  return value;
};
const noteText = (value) => {
  if (typeof value !== 'string' || value.length > 1000)
    throw new AppError('지원 설명은 1000자 이하로 입력하세요.', 400);
  return value.trim();
};
class BusinessSupportService {
  constructor(db = prisma) {
    this.db = db;
    this.manager = new StoreManagerService(db);
  }
  async context(tx, storeId, actor, lock = false) {
    const rows = await tx.$queryRawUnsafe(
      `SELECT id,user_id,is_active FROM stores WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
      storeId
    );
    if (!rows.length) throw new AppError('매장을 찾을 수 없습니다.', 404);
    const owner = rows[0].user_id === actor.id;
    if (!owner && actor.role !== 'super_admin')
      throw new AppError('지원 접근 권한이 없습니다.', 403);
    return { ...rows[0], owner };
  }
  async enrollment(storeId, actor) {
    const store = await this.context(this.db, storeId, actor);
    const rows = await this.db.$queryRawUnsafe(
      'SELECT enabled,consent_version,consented_at,owner_id FROM business_support_enrollments WHERE store_id=$1',
      storeId
    );
    return {
      enabled: !!rows[0]?.enabled && rows[0].owner_id === store.user_id,
      can_consent: store.owner,
      consent_version: rows[0]?.consent_version || '2026-10-14-v1',
    };
  }
  async enroll(storeId, actor, enabled) {
    if (typeof enabled !== 'boolean') throw new AppError('지원 동의 여부가 필요합니다.', 400);
    return this.db.$transaction(async (tx) => {
      const store = await this.context(tx, storeId, actor, true);
      if (!store.owner) throw new AppError('실제 매장 소유자만 동의할 수 있습니다.', 403);
      if (enabled && !store.is_active)
        throw new AppError('운영 중인 매장만 지원에 등록할 수 있습니다.', 409);
      await tx.$executeRawUnsafe(
        `INSERT INTO business_support_enrollments(store_id,owner_id,enabled) VALUES($1,$2,$3)
        ON CONFLICT(store_id) DO UPDATE SET owner_id=$2,enabled=$3,consented_at=now(),updated_at=now()`,
        storeId,
        actor.id,
        enabled
      );
      if (enabled) await this.markDirty(storeId, tx);
      else
        await tx.$executeRawUnsafe(
          "UPDATE business_support_jobs SET status='done',lease_id=NULL,lease_until=NULL,updated_at=now() WHERE store_id=$1",
          storeId
        );
      return { enabled };
    });
  }
  async eligible(tx, storeId) {
    const rows = await tx.$queryRawUnsafe(
      `SELECT e.store_id FROM business_support_enrollments e JOIN stores s ON s.id=e.store_id
      WHERE e.store_id=$1 AND e.enabled AND s.is_active=true AND e.owner_id=s.user_id`,
      storeId
    );
    if (!rows.length) throw new AppError('현재 소유자의 지원 동의가 필요합니다.', 409);
  }
  async markDirty(storeId, tx = this.db) {
    await this.eligible(tx, storeId);
    return tx.$executeRawUnsafe(
      `INSERT INTO business_support_jobs(store_id) VALUES($1) ON CONFLICT(store_id) DO UPDATE
      SET generation=business_support_jobs.generation+1,status=CASE WHEN business_support_jobs.status='running' THEN 'running' ELSE 'pending' END,
      attempts=CASE WHEN business_support_jobs.status='running' THEN business_support_jobs.attempts ELSE 0 END,available_at=now(),updated_at=now()`,
      storeId
    );
  }
  async list(actor, storeId, cursor = '0:0', limit = 30) {
    if (storeId) await this.context(this.db, storeId, actor);
    else if (actor.role !== 'super_admin') throw new AppError('최고관리자 권한이 필요합니다.', 403);
    const [priority, sequence] = String(cursor).split(':').map(Number);
    // Priority plus sequence keyset: bounded pages without per-store analysis.
    const rows = await this.db.$queryRawUnsafe(
      `SELECT c.*,s.name AS store_name FROM business_support_cases c JOIN stores s ON s.id=c.store_id
      WHERE ($1::int IS NULL OR c.store_id=$1) AND (c.priority,c.sequence)>($2::int,$3::bigint) AND ($4::boolean OR c.status!='draft')
      ORDER BY c.priority,c.sequence LIMIT $5`,
      storeId || null,
      priority,
      sequence,
      actor.role === 'super_admin',
      limit + 1
    );
    const items = rows.slice(0, limit).map((r) => ({ ...r, sequence: String(r.sequence) }));
    return {
      items,
      next_cursor: rows.length > limit ? `${items.at(-1).priority}:${items.at(-1).sequence}` : null,
    };
  }
  async overview(actor) {
    if (actor.role !== 'super_admin') throw new AppError('최고관리자 권한이 필요합니다.', 403);
    const [counts, jobs, failedJobs] = await Promise.all([
      this.db.$queryRawUnsafe(
        `SELECT status,COUNT(*)::int AS count FROM business_support_cases GROUP BY status`
      ),
      this.db.$queryRawUnsafe(
        `SELECT status,COUNT(*)::int AS count FROM business_support_jobs GROUP BY status`
      ),
      this.db.$queryRawUnsafe(
        `SELECT j.store_id,s.name,j.attempts,j.last_error,j.updated_at FROM business_support_jobs j JOIN stores s ON s.id=j.store_id WHERE j.status='dead' ORDER BY j.updated_at LIMIT 20`
      ),
    ]);
    const eligible = await this.db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM business_support_enrollments e JOIN stores s ON s.id=e.store_id WHERE e.enabled AND e.owner_id=s.user_id AND s.is_active=true`
    );
    return {
      enrolled_stores: eligible[0].count,
      cases: counts,
      jobs,
      failed_jobs: failedJobs,
      scope: 'owner_consented_stores_only',
      external_execution: false,
    };
  }
  async detail(storeId, id, actor) {
    await this.context(this.db, storeId, actor);
    identifier(id);
    const rows = await this.db.$queryRawUnsafe(
      'SELECT * FROM business_support_cases WHERE store_id=$1 AND id=$2::uuid',
      storeId,
      id
    );
    if (!rows.length || (actor.role !== 'super_admin' && rows[0].status === 'draft'))
      throw new AppError('지원안을 찾을 수 없습니다.', 404);
    const events = await this.db.$queryRawUnsafe(
      'SELECT event,actor_id,from_status,to_status,note,created_at FROM business_support_events WHERE store_id=$1 AND case_id=$2::uuid ORDER BY created_at,id',
      storeId,
      id
    );
    return { ...rows[0], sequence: String(rows[0].sequence), events };
  }
  async createFromSnapshot(storeId, snapshot, operations = {}, tx = this.db) {
    await this.eligible(tx, storeId);
    const evidence = summarize(snapshot, operations);
    const proposed = await tx.$queryRawUnsafe(
      `SELECT a.*,s.payload AS source_payload,s.created_at AS source_created_at
      FROM manager_actions a JOIN manager_snapshots s ON s.store_id=a.store_id AND s.id=a.snapshot_id
      JOIN products p ON p.store_id=a.store_id AND p.id=a.product_id
      WHERE a.store_id=$1 AND a.status='proposed' AND a.created_at>now()-interval '1 day'
      AND p.is_active=true AND COALESCE(p.is_sold_out,false)=false AND (p.stock_quantity IS NULL OR p.stock_quantity>0)
      AND NOT EXISTS(SELECT 1 FROM business_support_cases c WHERE c.store_id=a.store_id AND c.action_id=a.id)
      ORDER BY a.created_at DESC,a.id LIMIT 1`,
      storeId
    );
    const action = proposed[0];
    evidence.action = action
      ? { id: action.id, kind: action.kind, product_id: action.product_id, ...action.payload }
      : null;
    if (action) {
      const source = action.snapshot_id === snapshot.snapshot_id ? snapshot : action.source_payload;
      evidence.action_source = {
        snapshot_id: action.snapshot_id,
        as_of: source.as_of || action.source_created_at,
        provenance: source.provenance || { status: 'unavailable' },
        rules_version: source.rules_version || 'legacy_unversioned',
      };
    }
    const active = await tx.$queryRawUnsafe(
      `SELECT id,status,priority,action_id,evidence FROM business_support_cases
      WHERE store_id=$1 AND status IN ('draft','sent','changes_requested','deferred','approved','running')
      AND created_at>now()-interval '1 day' ORDER BY created_at DESC,id DESC LIMIT 1`,
      storeId
    );
    if (active.length && active[0].priority <= evidence.priority) {
      // Refresh unreviewed drafts instead of creating another inbox item every five minutes.
      // Once sent, evidence is immutable; a higher-priority issue may create a separate case.
      if (active[0].status === 'draft' && !active[0].action_id) {
        await tx.$executeRawUnsafe(
          'UPDATE business_support_cases SET snapshot_id=$1::uuid,evidence=$2::jsonb,action_id=$5::uuid,updated_at=now() WHERE store_id=$3 AND id=$4::uuid',
          snapshot.snapshot_id,
          JSON.stringify(evidence),
          storeId,
          active[0].id,
          action?.id || null
        );
      }
      return [];
    }
    return tx.$queryRawUnsafe(
      `INSERT INTO business_support_cases(id,store_id,snapshot_id,action_id,priority,evidence)
      VALUES($1::uuid,$2,$3::uuid,$4::uuid,$5,$6::jsonb) ON CONFLICT(store_id,snapshot_id) DO NOTHING RETURNING id`,
      crypto.randomUUID(),
      storeId,
      snapshot.snapshot_id,
      action?.id || null,
      evidence.priority,
      JSON.stringify(evidence)
    );
  }
  async transition(storeId, id, event, actor, operationId, note = '') {
    identifier(id);
    identifier(operationId);
    note = noteText(note);
    return this.db.$transaction(async (tx) => {
      const store = await this.context(tx, storeId, actor, true);
      const old = await tx.$queryRawUnsafe(
        'SELECT * FROM business_support_events WHERE operation_id=$1::uuid',
        operationId
      );
      if (old.length) {
        if (
          old[0].actor_id !== actor.id ||
          old[0].case_id !== id ||
          old[0].store_id !== storeId ||
          old[0].event !== event ||
          old[0].note !== note
        )
          throw new AppError('다른 요청에 사용된 작업 ID입니다.', 409);
        return { status: old[0].to_status, already_applied: true };
      }
      const rows = await tx.$queryRawUnsafe(
        'SELECT * FROM business_support_cases WHERE store_id=$1 AND id=$2::uuid FOR UPDATE',
        storeId,
        id
      );
      const c = rows[0];
      if (!c) throw new AppError('지원안을 찾을 수 없습니다.', 404);
      // Stop remains available after consent withdrawal; other mutations require current consent.
      if (event !== 'stop') await this.eligible(tx, storeId);
      const role =
        event === 'send' || event === 'assign'
          ? actor.role === 'super_admin'
            ? 'platform'
            : 'owner'
          : store.owner
            ? 'owner'
            : 'platform';
      let status;
      if (event === 'assign') {
        if (role !== 'platform') throw new AppError('최고관리자 권한이 필요합니다.', 403);
        status = c.status;
        await tx.$executeRawUnsafe(
          'UPDATE business_support_cases SET assignee_id=$1 WHERE store_id=$2 AND id=$3::uuid',
          actor.id,
          storeId,
          id
        );
      } else status = nextState(c.status, event, role);
      if (
        ['send', 'approve', 'execute'].includes(event) &&
        Date.now() - new Date(c.created_at).getTime() > 86400000
      )
        throw new AppError('근거가 만료되었습니다. 최신 분석을 요청하세요.', 409);
      if (['approve', 'execute', 'stop'].includes(event)) {
        if (!c.action_id)
          throw new AppError('자료 확인 지원안입니다. 실행 가능한 QR 제안이 없습니다.', 409);
        if (event === 'execute')
          await this.manager.transition(storeId, c.action_id, 'approve', actor.id, new Date(), tx);
        if (event !== 'approve')
          await this.manager.transition(storeId, c.action_id, event, actor.id, new Date(), tx);
      }
      await tx.$executeRawUnsafe(
        'UPDATE business_support_cases SET status=$1,note=$2,updated_at=now() WHERE store_id=$3 AND id=$4::uuid',
        status,
        note || c.note,
        storeId,
        id
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO business_support_events(id,store_id,case_id,actor_id,operation_id,event,from_status,to_status,note)
        VALUES($1::uuid,$2,$3::uuid,$4,$5::uuid,$6,$7,$8,$9)`,
        crypto.randomUUID(),
        storeId,
        id,
        actor.id,
        operationId,
        event,
        c.status,
        status,
        note
      );
      return { status };
    });
  }
  async evaluate(storeId, id, actor) {
    const detail = await this.detail(storeId, id, actor);
    if (!detail.action_id || !['running', 'completed'].includes(detail.status))
      throw new AppError('실행한 QR 제안만 평가할 수 있습니다.', 409);
    const result = await this.manager.evaluate(storeId, detail.action_id);
    if (!['pending', 'stopped'].includes(result.verdict))
      await this.db.$transaction(async (tx) => {
        await this.context(tx, storeId, actor, true);
        const changed = await tx.$queryRawUnsafe(
          "UPDATE business_support_cases SET status='completed',updated_at=now() WHERE store_id=$1 AND id=$2::uuid AND status='running' RETURNING id",
          storeId,
          id
        );
        if (changed.length)
          await tx.$executeRawUnsafe(
            `INSERT INTO business_support_events(id,store_id,case_id,actor_id,operation_id,event,from_status,to_status,note)
          VALUES($1::uuid,$2,$3::uuid,$4,$5::uuid,'evaluate','running','completed',$6)`,
            crypto.randomUUID(),
            storeId,
            id,
            actor.id,
            crypto.randomUUID(),
            `성과 관측: ${result.verdict}; 인과 효과 아님`
          );
      });
    return result;
  }
}
module.exports = BusinessSupportService;
