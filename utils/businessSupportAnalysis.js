const { AppError } = require('./errorHandler');
const rules = {
  send: { role: 'platform', from: ['draft', 'changes_requested', 'deferred'], to: 'sent' },
  approve: { role: 'owner', from: ['sent'], to: 'approved' },
  changes: { role: 'owner', from: ['sent', 'approved'], to: 'changes_requested' },
  defer: { role: 'owner', from: ['sent', 'approved'], to: 'deferred' },
  reject: { role: 'owner', from: ['sent', 'approved', 'deferred'], to: 'rejected' },
  execute: { role: 'owner', from: ['approved'], to: 'running' },
  stop: { role: 'owner', from: ['running'], to: 'stopped' },
  resolve: { role: 'owner', from: ['sent'], to: 'completed' },
};
function nextState(state, event, role) {
  const rule = rules[event];
  if (!rule) throw new AppError('허용되지 않은 지원 작업입니다.', 400);
  if (rule.role !== role) throw new AppError('이 지원 작업의 승인 권한이 없습니다.', 403);
  if (!rule.from.includes(state)) throw new AppError('현재 상태에서 수행할 수 없습니다.', 409);
  return rule.to;
}
function summarize(snapshot, operations = {}) {
  const insights = Array.isArray(snapshot.insights) ? [...snapshot.insights] : [];
  const insufficient = insights.some((i) => i.key === 'insufficient');
  const delayed =
    Number(operations.oldest_minutes || 0) >= 15 && Number(operations.pending || 0) > 0;
  const stockAlerts = Array.isArray(operations.stock_alerts) ? operations.stock_alerts : [];
  if (delayed)
    insights.unshift({
      key: 'order_delay',
      title: '접수 대기 주문을 확인하세요',
      detail: `미접수 ${Number(operations.pending)}건, 최장 ${Math.floor(Number(operations.oldest_minutes))}분입니다. 주문 상태와 실제 영업 여부를 확인하세요.`,
    });
  if (stockAlerts.length)
    insights.push({
      key: 'stock',
      title: '품절·재고 설정을 확인하세요',
      detail: `등록 상품 ${stockAlerts.length}개에 품절 또는 0 이하 재고가 기록되어 있습니다. 실재고·입고 예정은 사업자가 확인해야 합니다.`,
    });
  return {
    version: 'business-support-rules-v1',
    as_of: snapshot.as_of,
    priority: delayed ? 1 : insights.some((i) => i.key === 'sales_drop') ? 2 : 3,
    quality: insufficient ? 'insufficient' : 'observed',
    insights,
    current: snapshot.current || null,
    comparison: snapshot.historical || null,
    clock: snapshot.clock || null,
    provenance: snapshot.provenance || { status: 'unavailable' },
    facts: {
      pending_orders: Number(operations.pending || 0),
      oldest_minutes: Number(operations.oldest_minutes || 0),
      stock_alerts: stockAlerts,
    },
    allowed_execution: 'qr_menu_visibility_only',
    margin: null,
    unavailable: ['원가 기반 이익', '발주 자동 실행', 'SMS 발송', '실제 업체 입금 대사'],
  };
}
module.exports = { nextState, summarize };
