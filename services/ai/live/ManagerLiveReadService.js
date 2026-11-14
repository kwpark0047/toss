const text = (value, limit = 400) => String(value || '').slice(0, limit);
const numbers = (source, keys) =>
  Object.fromEntries(
    keys.map((key) => [
      key,
      source?.[key] == null
        ? null
        : Number.isFinite(Number(source[key]))
          ? Number(source[key])
          : null,
    ])
  );
class ManagerLiveReadService {
  constructor(service) {
    this.service = service || new (require('../../StoreManagerService'))();
  }
  async briefing(storeId) {
    // collect is read-only. briefing/chat/evaluate also persist snapshots/actions and are not used.
    const facts = await this.service.collect(storeId, new Date());
    if (Number(facts.store?.id) !== storeId) throw Error('Store facts scope mismatch');
    return {
      store: { id: storeId, name: text(facts.store.name, 120) },
      as_of: facts.as_of || null,
      basis:
        '자체 결제 주문의 환불 차감 순매출, 오늘 완료된 시간대 기준. 미래·인과효과·미제공 기간은 추측하지 않습니다.',
      current: numbers(facts.current, ['orders', 'revenue', 'cancelled']),
      historical: numbers(facts.historical, ['days', 'orders', 'revenue']),
      review: numbers(facts.review, ['count', 'low', 'average']),
      insights: (facts.insights || [])
        .slice(0, 3)
        .map((i) => ({ title: text(i.title, 120), detail: text(i.detail) })),
      notes: (facts.notes || []).slice(0, 4).map((n) => text(n)),
    };
  }
  async actions(storeId) {
    const actions = await this.service.actions(storeId);
    return actions
      .filter((a) => Number(a.store_id) === storeId)
      .slice(0, 40)
      .map((a) => ({
        id: text(a.id, 80),
        status: text(a.status, 30),
        title: text(a.payload?.title, 160),
        kind: text(a.kind, 50),
        created_at: a.created_at || null,
        ends_at: a.ends_at || null,
      }));
  }
}
module.exports = { ManagerLiveReadService };
