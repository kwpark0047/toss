/**
 * 주방 화면·알림·출력물에 띄울 주문 위치 표시.
 * 매장 식사는 테이블 이름, 포장은 '포장', 배달은 '배달 · 동네'(주소의 동/읍/면/로/길 단위)로 보여 준다.
 */
function deliveryAreaName(address) {
  const parts = String(address || '')
    .trim()
    .split(/\s+/);
  const hit = parts.find((p) => /(동|읍|면|가|로|길)$/.test(p) && !/^\d/.test(p));
  return hit || '';
}

function orderPlaceLabel(order, tableName) {
  if (order?.order_type === 'delivery') {
    const area = deliveryAreaName(order.delivery_address);
    return area ? `배달 · ${area}` : '배달';
  }
  if (order?.order_type === 'takeout') return '포장';
  return tableName || null;
}

module.exports = { orderPlaceLabel, deliveryAreaName };
