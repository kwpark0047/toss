const DAY = 86400000;
function localClock(now = new Date()) {
  const shifted = new Date(now.getTime() + 9 * 3600000);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
  };
}
const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
function analyze({ hourly, products, review, connections, overview }, now = new Date()) {
  const clock = localClock(now),
    since = localClock(new Date(now.getTime() - 28 * DAY)).date;
  const recent = hourly.filter((r) => r.date >= since && r.date < clock.date);
  const comparable = hourly.filter(
    (r) => r.date < clock.date && weekday(r.date) === clock.weekday && r.hour < clock.hour
  );
  const dates = [...new Set(comparable.map((r) => r.date))].sort().slice(-4);
  const baseline = dates.map((date) => comparable.filter((r) => r.date === date));
  const today = hourly.filter((r) => r.date === clock.date && r.hour < clock.hour);
  const current = {
    orders: sum(today, 'orders'),
    revenue: sum(today, 'revenue'),
    cancelled: sum(today, 'cancelled'),
  };
  const historical = {
    days: dates.length,
    orders: dates.length ? sum(baseline.flat(), 'orders') / dates.length : null,
    revenue: dates.length ? sum(baseline.flat(), 'revenue') / dates.length : null,
  };
  const insights = [];
  if (dates.length < 4 || sum(baseline.flat(), 'orders') < 30 || clock.hour === 0) {
    insights.push({
      key: 'insufficient',
      severity: 'info',
      title: '비교 데이터가 더 필요합니다',
      detail:
        '같은 요일·시간대의 과거 4개 구간과 주문 30건 이상이 확보되면 매출 변화를 분석합니다.',
    });
  } else if (historical.revenue > 0 && current.revenue < historical.revenue * 0.8) {
    insights.push({
      key: 'sales_drop',
      severity: 'warning',
      title: '자체 주문 매출이 비교 구간보다 낮습니다',
      detail: `오늘 ${clock.hour}시 이전 순매출은 ${current.revenue.toLocaleString('ko-KR')}원, 같은 요일 최근 4개 구간 평균은 ${Math.round(historical.revenue).toLocaleString('ko-KR')}원입니다. 휴점·영업시간·수집 상태를 먼저 확인하세요.`,
    });
  }
  if (
    current.orders + current.cancelled >= 20 &&
    current.cancelled / (current.orders + current.cancelled) >= 0.15
  )
    insights.push({
      key: 'cancel',
      severity: 'warning',
      title: '취소 주문 비율을 확인하세요',
      detail:
        '자체 주문의 취소 비율이 15% 이상입니다. 결제 실패와 고객 취소 사유를 주문 관리에서 확인하세요.',
    });
  if (Number(review?.count) >= 5 && Number(review?.low) / Number(review.count) >= 0.3)
    insights.push({
      key: 'reviews',
      severity: 'warning',
      title: '최근 낮은 평점 리뷰를 확인하세요',
      detail:
        '최근 28일 자체 리뷰 5건 이상 중 평점 2점 이하가 30% 이상입니다. 리뷰 내용을 확인한 후 대응하세요.',
    });
  const stale = connections.filter(
    (c) => c.enabled && (!c.last_ingested_at || now - new Date(c.last_ingested_at) > DAY)
  );
  if (stale.length)
    insights.unshift({
      key: 'stale',
      severity: 'warning',
      title: '외부 데이터 수집을 확인하세요',
      detail: `${stale.length}개 연결에 최근 24시간 수집 기록이 없습니다. 자체 주문 분석에 외부 매출 하락의 원인을 섞지 않습니다.`,
    });
  if (!insights.length)
    insights.push({
      key: 'healthy',
      severity: 'info',
      title: '현재 확인된 주요 이상은 없습니다',
      detail:
        '주문·리뷰의 초기 탐지 기준 안에서 확인한 결과입니다. 운영 상황 전체가 검증된 것은 아닙니다.',
    });
  const product = products
    .filter(
      (p) =>
        p.is_active &&
        !p.is_sold_out &&
        (p.stock_quantity == null || p.stock_quantity > 0) &&
        p.quantity >= 5
    )
    .sort((a, b) => b.quantity - a.quantity || a.id - b.id)[0];
  const proposals = [];
  if (product && sum(recent, 'orders') >= 30) {
    proposals.push({
      kind: 'menu_feature',
      product_id: product.id,
      product_name: product.name,
      hour: null,
      title: `${product.name}을 QR 추천 메뉴로 보여주세요`,
      reason: `최근 28일 결제된 자체 주문에서 ${product.quantity}개 판매되었습니다. 원가 정보가 없어 수익 증가는 예측하지 않습니다.`,
      duration_days: 7,
    });
    const hours = [...new Set(recent.map((r) => r.hour))]
      .map((hour) => {
        const rows = recent.filter((r) => r.hour === hour);
        return { hour, days: new Set(rows.map((r) => r.date)).size, orders: sum(rows, 'orders') };
      })
      .filter((r) => r.days >= 5 && r.orders >= 5);
    if (hours.length >= 2) {
      const quiet = hours.sort(
        (a, b) => a.orders / a.days - b.orders / b.days || a.hour - b.hour
      )[0];
      proposals.push({
        kind: 'time_promotion',
        product_id: product.id,
        product_name: product.name,
        hour: quiet.hour,
        title: `${quiet.hour}~${quiet.hour + 1}시 무할인 메뉴 노출을 시험하세요`,
        reason: `최근 28일 이 시간대에 주문이 관측된 ${quiet.days}일의 주문은 ${quiet.orders}건입니다. 영업 시간과 처리 여유는 사장님이 확인해야 합니다.`,
        duration_days: 7,
      });
    }
  }
  return {
    as_of: now.toISOString(),
    clock,
    current,
    historical,
    insights: insights.slice(0, 3),
    proposals,
    review,
    coverage: {
      native_orders: true,
      external_item_details: false,
      external_connections: connections.length,
      stale_connections: stale.length,
      recent_orders: sum(recent, 'orders'),
      matched_weekdays: dates.length,
    },
    integrated: overview,
    notes: [
      '문제·메뉴·시간대 분석은 자체 주문 기준입니다. 외부 거래는 통합 매출 요약만 제공합니다.',
      '오늘은 완료된 시간대까지만 비교합니다. 휴점·영업시간 변경은 자동 판별하지 못합니다.',
      '메뉴 품목별 환불 정보가 없어 판매 수량은 주문 기준 참고값입니다.',
    ],
  };
}
function compareEvaluation(before, after) {
  const sufficient = before.orders >= 30 && after.orders >= 30;
  return {
    verdict: sufficient
      ? after.share > before.share
        ? 'observed_improvement'
        : after.share < before.share
          ? 'observed_decline'
          : 'unchanged'
      : 'insufficient',
    before,
    after,
    delta_share_points: sufficient ? Math.round((after.share - before.share) * 10000) / 100 : null,
    causal: false,
    message: sufficient
      ? '동일한 요일 구성의 실행 전후 주문 비중 비교입니다. 대조군이 없어 인과효과를 확정할 수 없습니다. 동시 캠페인·가격·휴점 변화도 확인하세요.'
      : '비교 기간별 주문 30건이 필요합니다. 데이터가 부족해 효과 판단을 보류합니다.',
  };
}
module.exports = { analyze, localClock, compareEvaluation, DAY };
