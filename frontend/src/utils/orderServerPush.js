import api from '../api/client';
const key = (id) => `wm_order_server_push:${id}`;
export function serverPushEnabled(id) {
  try {
    return localStorage.getItem(key(id)) === 'true';
  } catch {
    return false;
  }
}
function headers(recent) {
  let history;
  try {
    history = localStorage.getItem('wm_customer_history_capability');
  } catch {
    /* optional */
  }
  return {
    ...(recent.capability ? { 'x-order-capability': recent.capability } : {}),
    ...(history ? { 'x-customer-history-capability': history } : {}),
  };
}
async function registration() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  let timer;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('서비스워커 준비를 기다리고 있어요. 잠시 후 다시 시도해 주세요.')),
          10000
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function enableServerPush(recent) {
  const sw = await registration();
  if (!sw) return false;
  const response = await api.get('/orders/push/config');
  const settings = response?.data || response;
  if (!settings.enabled || !settings.publicKey) return false;
  let subscription = await sw.pushManager.getSubscription();
  if (!subscription)
    subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: settings.publicKey,
    });
  await api.post(
    `/orders/${recent.id}/push-subscription`,
    { subscription: subscription.toJSON() },
    { headers: headers(recent) }
  );
  try {
    localStorage.setItem(key(recent.id), 'true');
  } catch {
    /* current page still receives */
  }
  return true;
}
export async function disableServerPush(recent) {
  const sw = await registration();
  const subscription = await sw?.pushManager.getSubscription();
  if (subscription)
    await api.delete(`/orders/${recent.id}/push-subscription`, {
      data: { endpoint: subscription.endpoint },
      headers: headers(recent),
    });
  try {
    localStorage.removeItem(key(recent.id));
  } catch {
    /* optional */
  }
}
