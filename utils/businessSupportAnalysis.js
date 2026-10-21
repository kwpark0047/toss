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
const supportStatuses = [
  'draft',
  'sent',
  'changes_requested',
  'deferred',
  'rejected',
  'approved',
  'running',
  'stopped',
  'completed',
];
const hasControlCharacter = (value) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
function normalizeSupportFilters(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AppError('지원 조회 조건이 올바르지 않습니다.', 400);

  let status = null;
  if (input.status != null && input.status !== '') {
    if (typeof input.status !== 'string' || !supportStatuses.includes(input.status))
      throw new AppError('지원 상태 조회 조건이 올바르지 않습니다.', 400);
    status = input.status;
  }

  let priority = null;
  if (input.priority != null && input.priority !== '') {
    const value = Number(input.priority);
    if (!Number.isInteger(value) || value < 1 || value > 3)
      throw new AppError('우선순위는 1부터 3까지 선택할 수 있습니다.', 400);
    priority = value;
  }

  let quality = null;
  if (input.quality != null && input.quality !== '') {
    if (!['observed', 'insufficient'].includes(input.quality))
      throw new AppError('자료 품질 조회 조건이 올바르지 않습니다.', 400);
    quality = input.quality;
  }

  let search = '';
  if (input.search != null && input.search !== '') {
    if (typeof input.search !== 'string')
      throw new AppError('매장명 검색어가 올바르지 않습니다.', 400);
    search = input.search.trim();
    if (search.length > 80 || hasControlCharacter(search))
      throw new AppError('매장명 검색어는 80자 이내로 입력해 주세요.', 400);
  }
  return { status, priority, quality, search };
}
function normalizeSupportMessage(value) {
  if (typeof value !== 'string') throw new AppError('메시지를 입력해 주세요.', 400);
  const body = value.trim();
  if (!body || body.length > 2000 || hasControlCharacter(body))
    throw new AppError('메시지는 1자 이상 2000자 이하로 입력해 주세요.', 400);
  return body;
}
const supportPlaybooks = {
  order_delay: {
    title: '주문 처리 지연 확인',
    steps: [
      '미접수 주문 목록과 주문 상태를 확인합니다.',
      '주방 화면·담당자 알림·영업 상태를 확인합니다.',
      '실제 조치 결과가 확인된 뒤 주문 상태를 갱신합니다.',
    ],
    guardrail: '수금이나 결제 완료로 추정해 기록하지 마세요.',
  },
  stock: {
    title: '품절·재고 상태 확인',
    steps: [
      '상품별 재고 갱신 시각과 품절 설정을 확인합니다.',
      '실물 재고를 사업자가 확인합니다.',
      '확인된 수량만 메뉴 재고에 반영합니다.',
    ],
    guardrail: 'AI가 발주하거나 실제 재고를 추정하지 않습니다.',
  },
  sales_drop: {
    title: '매출 변화 원인 점검',
    steps: [
      '영업시간·휴무·메뉴 판매 가능 상태를 확인합니다.',
      '동일 요일·동일 영업 경과시간 비교인지 확인합니다.',
      '주문·결제·취소 원장과 데이터 수집 지연을 확인합니다.',
    ],
    guardrail: '원가·수수료 자료가 없으면 이익이나 할인 효과를 단정하지 않습니다.',
  },
  cancel: {
    title: '취소 증가 확인',
    steps: [
      '취소 건수·기간과 기록된 취소 사유를 확인합니다.',
      '주문 접수·대기 안내·메뉴 품절 상태를 점검합니다.',
      '환불 금액은 PG와 원장 기록으로 별도 대사합니다.',
    ],
    guardrail: 'AI가 주문·환불·원장 상태를 변경하지 않습니다.',
  },
  reviews: {
    title: '리뷰 응대 점검',
    steps: [
      '반복되는 주제를 집계 자료에서 확인합니다.',
      '개인 식별 정보가 포함되지 않았는지 확인합니다.',
      '사업자에게 응대 초안을 검토받고 직접 게시하도록 안내합니다.',
    ],
    guardrail: '리뷰 답변은 자동 게시하지 않습니다.',
  },
  stale: {
    title: '데이터 연결 상태 점검',
    steps: [
      '마지막 성공 동기화 시각과 실패 이력을 확인합니다.',
      '외부 계정 만료·매핑 누락·제공자 장애 여부를 확인합니다.',
      '재수집 후 원장 대사가 끝나기 전에는 분석을 확정하지 않습니다.',
    ],
    guardrail: '외부 업체 데이터가 연결되지 않았으면 그 매출을 추정하지 않습니다.',
  },
  insufficient: {
    title: '분석 자료 보강',
    steps: [
      '필요한 비교 기간과 최소 주문 표본을 확인합니다.',
      '누락된 영업일·주문·결제·재고 자료를 확인합니다.',
      '자료가 쌓인 뒤 다시 분석합니다.',
    ],
    guardrail: '근거가 부족하면 원인과 효과를 추측하지 않습니다.',
  },
  healthy: {
    title: '정상 운영 확인',
    steps: [
      '현재 기준 시각과 데이터 출처를 확인합니다.',
      '사업자가 요청한 항목이 있는지 확인합니다.',
    ],
    guardrail: '지원 필요가 확인되지 않으면 추가 조치를 만들지 않습니다.',
  },
};
function buildSupportPlaybooks(evidence = {}) {
  const keys = new Set(
    (Array.isArray(evidence.insights) ? evidence.insights : []).map((item) => item?.key)
  );
  const insufficient = evidence.quality === 'insufficient' || keys.has('insufficient');
  return Object.entries(supportPlaybooks)
    .filter(([key]) => keys.has(key))
    .map(([key, playbook]) => ({
      key,
      ...playbook,
      requires_human_review: true,
      data_warning: insufficient
        ? '비교 표본이 부족합니다. 매출 원인이나 효과를 확정하지 마세요.'
        : null,
      effect_claim: null,
    }));
}
module.exports = {
  nextState,
  summarize,
  normalizeSupportFilters,
  normalizeSupportMessage,
  buildSupportPlaybooks,
};
