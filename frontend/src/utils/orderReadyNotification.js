import { serverPushEnabled } from './orderServerPush';
const preferenceKey = 'wm_order_ready_notifications';
const delivering = new Set();
export const readyNotificationEnabled = () => {
  try {
    return localStorage.getItem(preferenceKey) === 'true';
  } catch {
    return false;
  }
};
export function setReadyNotificationEnabled(value) {
  try {
    localStorage.setItem(preferenceKey, String(value));
  } catch {
    /* session remains usable */
  }
}
export async function showOrderReadyNotification(order) {
  if (serverPushEnabled(order.id)) return false;
  if (
    !readyNotificationEnabled() ||
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted'
  )
    return false;
  const key = `wm_order_ready_delivered:${order.id}`;
  if (delivering.has(key)) return false;
  try {
    if (localStorage.getItem(key)) return false;
  } catch {
    /* use notification tag for deduplication */
  }
  delivering.add(key);
  const title = '주문이 준비됐어요';
  const options = {
    body: `${order.store_name || '매장'} · 주문 ${order.order_number || order.id}의 준비가 완료됐어요.`,
    tag: `wemarket-order-ready-${order.id}`,
    icon: '/icons/icon.svg',
    data: { type: 'ORDER_READY', orderId: order.id },
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.active) await registration.showNotification(title, options);
    else {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        window.location.assign(`/search?orderId=${order.id}`);
        notification.close();
      };
    }
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch {
      /* optional persistence */
    }
    return true;
  } catch {
    return false;
  } finally {
    delivering.delete(key);
  }
}
