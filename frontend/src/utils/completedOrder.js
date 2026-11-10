export function rememberCompletedOrder(order, capability) {
  if (!order?.id || !order?.store_id) return;
  try {
    sessionStorage.setItem(
      'wm_recent_order',
      JSON.stringify({
        id: order.id,
        store_id: order.store_id,
        order_number: order.order_number,
        store_name: order.store_name,
        capability,
        savedAt: Date.now(),
      })
    );
  } catch {
    /* 저장 공간이 없어도 주문 확인은 계속 제공한다. */
  }
}
