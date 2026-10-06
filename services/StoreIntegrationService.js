const crypto = require('crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { CHANNELS, normalizeBatch } = require('./integrationContract');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function connectionId(value) {
  if (!UUID.test(String(value))) throw new AppError('연결 ID가 올바르지 않습니다.', 400);
  return value;
}
function number(value) {
  const converted = Number(value || 0);
  if (!Number.isSafeInteger(converted)) throw new AppError('통계 금액 범위를 초과했습니다.', 422);
  return converted;
}
class StoreIntegrationService {
  constructor(db = prisma) {
    this.db = db;
  }
  async guard(work) {
    try {
      return await work();
    } catch (error) {
      if (error.code === 'P2010' && error.meta?.code === '42P01')
        throw new AppError(
          '데이터 통합 DB 마이그레이션 적용이 필요합니다.',
          503,
          'INTEGRATION_MIGRATION_REQUIRED'
        );
      throw error;
    }
  }
  async listConnections(storeId) {
    return this.guard(() =>
      this.db.$queryRawUnsafe(
        `SELECT id, channel, provider, name, method, enabled, created_at, last_ingested_at
      FROM integration_connections WHERE store_id=$1 ORDER BY created_at DESC`,
        storeId
      )
    );
  }
  async createConnection(storeId, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new AppError('연결 설정을 입력하세요.', 400);
    if (!CHANNELS.includes(input.channel) || !['csv', 'api'].includes(input.method))
      throw new AppError('연동 채널과 수집 방식을 확인하세요.', 400);
    const name = String(input.name || '').trim(),
      provider = String(input.provider || '').trim();
    if (!name || name.length > 80 || !provider || provider.length > 80)
      throw new AppError('연결명과 업체명을 1~80자로 입력하세요.', 400);
    return this.guard(async () => {
      const rows = await this.db.$queryRawUnsafe(
        `INSERT INTO integration_connections (id,store_id,channel,provider,name,method)
        VALUES ($1::uuid,$2,$3,$4,$5,$6) RETURNING id,channel,provider,name,method,enabled,created_at,last_ingested_at`,
        crypto.randomUUID(),
        storeId,
        input.channel,
        provider,
        name,
        input.method
      );
      return rows[0];
    });
  }
  async findConnection(db, storeId, id, lock = false) {
    const rows = await db.$queryRawUnsafe(
      `SELECT id, store_id, channel, method, enabled FROM integration_connections WHERE id=$1::uuid AND store_id=$2 ${lock ? 'FOR UPDATE' : ''}`,
      connectionId(id),
      storeId
    );
    if (!rows.length) throw new AppError('해당 매장의 데이터 연결을 찾을 수 없습니다.', 404);
    if (!rows[0].enabled) throw new AppError('중지된 데이터 연결입니다.', 409);
    return rows[0];
  }
  async setEnabled(storeId, id, enabled) {
    if (typeof enabled !== 'boolean') throw new AppError('enabled는 true/false입니다.', 400);
    return this.guard(async () => {
      const rows = await this.db.$queryRawUnsafe(
        'UPDATE integration_connections SET enabled=$1 WHERE id=$2::uuid AND store_id=$3 RETURNING id,enabled',
        enabled,
        connectionId(id),
        storeId
      );
      if (!rows.length) throw new AppError('데이터 연결을 찾을 수 없습니다.', 404);
      return rows[0];
    });
  }
  async validateNativeOrders(db, storeId, events) {
    const ids = [...new Set(events.map((event) => event.native_order_id).filter(Boolean))];
    if (!ids.length) return;
    const rows = await db.$queryRawUnsafe(
      'SELECT id FROM orders WHERE store_id=$1 AND id IN (SELECT jsonb_array_elements_text($2::jsonb)::int)',
      storeId,
      JSON.stringify(ids)
    );
    if (rows.length !== ids.length)
      throw new AppError('연결된 QR 주문이 없거나 다른 매장 주문입니다.', 400);
  }
  validateChannel(connection, events) {
    const allowed = { card_terminal: ['payment', 'refund'], point_device: ['loyalty'] }[
      connection.channel
    ];
    if (allowed && events.some((event) => !allowed.includes(event.kind)))
      throw new AppError(
        '카드단말기는 payment/refund, 포인트기기는 loyalty 기록만 수집합니다. 주문 매출을 중복 생성하지 마세요.',
        400
      );
  }
  async preview(storeId, id, body) {
    return this.guard(async () => {
      const connection = await this.findConnection(this.db, storeId, id);
      const events = normalizeBatch(body, storeId, id);
      this.validateChannel(connection, events);
      await this.validateNativeOrders(this.db, storeId, events);
      const byKind = Object.fromEntries(
        ['order', 'payment', 'refund', 'loyalty'].map((kind) => [
          kind,
          events.filter((event) => event.kind === kind).length,
        ])
      );
      return {
        count: events.length,
        by_kind: byKind,
        samples: events
          .slice(0, 20)
          .map(({ customer_key: _customer, payload_hash: _hash, ...event }) => event),
        warnings: [
          '수집은 분석용 기록입니다. 기존 주문 생성·카드 승인·포인트 적립·문자 발송을 실행하지 않습니다.',
          '같은 거래의 여러 채널 기록에는 동일 order_key 또는 native_order_id를 지정하세요.',
          '환불 기록만으로 매출을 변경하지 않습니다. order의 refund_amount 누계를 갱신한 새 버전을 함께 보내세요.',
        ],
      };
    });
  }
  async ingest(storeId, id, body, expectedMethod) {
    const events = normalizeBatch(body, storeId, connectionId(id));
    return this.guard(() =>
      this.db.$transaction(async (tx) => {
        // A per-store lock also protects canonical orders arriving through different channels.
        await tx.$queryRawUnsafe(
          'SELECT pg_advisory_xact_lock(146468,$1::int)::text AS locked',
          storeId
        );
        const connection = await this.findConnection(tx, storeId, id, true);
        this.validateChannel(connection, events);
        if (expectedMethod && connection.method !== expectedMethod)
          throw new AppError('설정된 수집 방식과 요청 방식이 다릅니다.', 409);
        await this.validateNativeOrders(tx, storeId, events);
        let duplicates = 0;
        const seen = new Map(),
          unique = [],
          canonical = new Map();
        const conflict = () =>
          new AppError(
            '동일 이벤트 또는 주문 버전에 다른 내용이 있습니다. 매핑을 확인하고 수정 거래는 version을 높여 제출하세요.',
            409,
            'INTEGRATION_CONFLICT'
          );
        for (const event of events) {
          const keys = [
            `event:${event.event_id}`,
            `snapshot:${event.kind}:${event.record_id}:${event.version}`,
          ];
          const previous = keys.map((key) => seen.get(key)).filter(Boolean);
          if (previous.some((hash) => hash !== event.payload_hash)) throw conflict();
          if (previous.length) {
            duplicates++;
            continue;
          }
          keys.forEach((key) => seen.set(key, event.payload_hash));
          if (event.kind === 'order') {
            const key = `${event.order_key}:${event.version}`,
              value = JSON.stringify([
                event.amount,
                event.refund_amount,
                event.status,
                event.currency,
              ]);
            if (canonical.has(key) && canonical.get(key) !== value) throw conflict();
            canonical.set(key, value);
          }
          unique.push(event);
        }
        const existing = await tx.$queryRawUnsafe(
          `SELECT i.event_id AS incoming_id,e.payload_hash FROM integration_events e
        JOIN jsonb_to_recordset($2::jsonb) AS i(event_id text,kind text,record_id text,version int)
        ON e.event_id=i.event_id OR (e.kind=i.kind AND e.record_id=i.record_id AND e.version=i.version)
        WHERE e.connection_id=$1::uuid`,
          id,
          JSON.stringify(unique)
        );
        const retained = unique.filter((event) => {
          const matches = existing.filter((row) => row.incoming_id === event.event_id);
          if (matches.some((row) => row.payload_hash !== event.payload_hash)) throw conflict();
          if (matches.length) {
            duplicates++;
            return false;
          }
          return true;
        });
        const conflicts = await tx.$queryRawUnsafe(
          `SELECT 1 FROM integration_events e
        JOIN jsonb_to_recordset($2::jsonb) AS i(kind text,order_key text,version int,amount bigint,refund_amount bigint,status text,currency text)
        ON e.order_key=i.order_key AND e.version=i.version
        WHERE e.store_id=$1 AND e.kind='order' AND i.kind='order'
        AND (e.amount!=i.amount OR e.refund_amount!=i.refund_amount OR e.status!=i.status OR e.currency!=i.currency) LIMIT 1`,
          storeId,
          JSON.stringify(retained)
        );
        if (conflicts.length) throw conflict();
        if (retained.length) {
          await tx.$executeRawUnsafe(
            `INSERT INTO integration_events
          (id,store_id,connection_id,event_id,record_id,kind,version,occurred_at,amount,refund_amount,status,currency,order_key,native_order_id,customer_key,marketing_consent,consent_at,consent_source,payload_hash)
          SELECT i.id,$1,$2::uuid,i.event_id,i.record_id,i.kind,i.version,i.occurred_at,i.amount,i.refund_amount,i.status,i.currency,i.order_key,i.native_order_id,i.customer_key,i.marketing_consent,i.consent_at,i.consent_source,i.payload_hash
          FROM jsonb_to_recordset($3::jsonb) AS i(id uuid,event_id text,record_id text,kind text,version int,occurred_at timestamptz,amount bigint,refund_amount bigint,status text,currency text,order_key text,native_order_id int,customer_key text,marketing_consent text,consent_at timestamptz,consent_source text,payload_hash text)`,
            storeId,
            id,
            JSON.stringify(retained.map((event) => ({ ...event, id: crypto.randomUUID() })))
          );
          await tx.$executeRawUnsafe(
            'UPDATE integration_connections SET last_ingested_at=NOW() WHERE id=$1::uuid AND store_id=$2',
            id,
            storeId
          );
        }
        return { accepted: retained.length, duplicates, received: events.length };
      })
    );
  }
  async overview(storeId, days = 30) {
    days = Number(days);
    if (![7, 30, 90].includes(days)) throw new AppError('조회 기간은 7/30/90일입니다.', 400);
    return this.guard(async () => {
      const connections = await this.listConnections(storeId);
      // Pick the latest version BEFORE filtering by date, so late cancellations cannot revive old sales.
      const rows = await this.db.$queryRawUnsafe(
        `WITH latest AS (
        SELECT DISTINCT ON (connection_id,kind,record_id) * FROM integration_events WHERE store_id=$1
        ORDER BY connection_id,kind,record_id,version DESC
      ), canonical AS (
        SELECT DISTINCT ON (order_key) * FROM latest WHERE kind='order' AND native_order_id IS NULL
        ORDER BY order_key,version DESC,occurred_at DESC,created_at DESC,id DESC
      ), sales AS (
        SELECT c.channel,COUNT(*)::text AS orders,COALESCE(SUM(e.amount-e.refund_amount),0)::text AS revenue
        FROM canonical e JOIN integration_connections c ON c.id=e.connection_id AND c.store_id=e.store_id
        WHERE e.status IN ('paid','completed') AND e.occurred_at>=NOW()-($2::int*INTERVAL '1 day')
        GROUP BY c.channel
      ), native AS (
        SELECT 'qr' AS channel,COUNT(*)::text AS orders,COALESCE(SUM(GREATEST(0,total_amount-
          ABS(COALESCE((SELECT SUM(l.amount) FROM ledger l WHERE l.order_id=o.id AND l.store_id=o.store_id AND l.type='REFUND'),0)))),0)::text AS revenue
        FROM orders o WHERE store_id=$1 AND payment_status='paid' AND status::text!='cancelled'
        AND created_at>=NOW()-($2::int*INTERVAL '1 day')
      ) SELECT * FROM native UNION ALL SELECT * FROM sales`,
        storeId,
        days
      );
      const channels = rows.map((row) => ({
        channel: row.channel,
        orders: number(row.orders),
        revenue: number(row.revenue),
      }));
      const diagnostics = await this.db.$queryRawUnsafe(
        `SELECT kind,COUNT(*)::text AS events FROM integration_events WHERE store_id=$1
        AND created_at>=NOW()-($2::int*INTERVAL '1 day') GROUP BY kind`,
        storeId,
        days
      );
      const customers = await this.db.$queryRawUnsafe(
        `SELECT COUNT(*)::text AS customers FROM store_customers WHERE store_id=$1`,
        storeId
      );
      return {
        days,
        connections,
        channels,
        total_orders: number(channels.reduce((sum, row) => sum + row.orders, 0)),
        total_revenue: number(channels.reduce((sum, row) => sum + row.revenue, 0)),
        crm_customers: number(customers[0]?.customers),
        ingested_events: diagnostics.map((row) => ({ kind: row.kind, count: number(row.events) })),
        vendor_api_connected: false,
        notes: [
          '카드·환불·포인트 이벤트는 주문 매출에 다시 더하지 않습니다.',
          '업체 API 자동 수집은 업체별 승인과 별도 어댑터 연결이 필요합니다.',
          '외부 고객 식별자는 채널별 가명값이며 CRM 고객 자동 병합·마케팅 발송은 수행하지 않습니다.',
        ],
      };
    });
  }
}
module.exports = StoreIntegrationService;
