import { useCallback, useEffect, useRef, useState } from 'react';
import { ordersAPI } from '../api';
import { subscribeCustomerOrder } from '../utils/socket';
import { showOrderReadyNotification } from '../utils/orderReadyNotification';

export default function useRecentOrderProgress() {
  const [recent] = useState(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem('wm_recent_order') || localStorage.getItem('wm_recent_order_ref')
      );
      const requestedId = Number(new URLSearchParams(window.location.search).get('orderId'));
      if (
        Number.isSafeInteger(requestedId) &&
        requestedId > 0 &&
        (requestedId !== Number(value?.id) || Date.now() - value?.savedAt >= 86400000)
      )
        return { id: requestedId };
      return value?.id && value?.store_id && Date.now() - value.savedAt < 86400000 ? value : null;
    } catch {
      return null;
    }
  });
  const [state, setState] = useState({
    order: null,
    loading: !!recent,
    error: '',
    updatedAt: null,
  });
  const [connection, setConnection] = useState('polling');
  const refreshRef = useRef(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    if (!recent) return;
    let active = true;
    let sequence = 0;
    let history;
    try {
      history = localStorage.getItem('wm_customer_history_capability');
    } catch {
      /* permission errors are shown below */
    }
    const fetchOrder = async () => {
      const request = ++sequence;
      if (!navigator.onLine) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: '오프라인이에요. 마지막으로 확인한 상태입니다.',
        }));
        return;
      }
      try {
        let order;
        if (recent.capability) {
          try {
            const result = await ordersAPI.getById(recent.id, recent.capability);
            order = result?.data || result;
          } catch (error) {
            if (error.response?.status !== 403 || !history) throw error;
          }
        }
        if (!order && history) {
          const result = await ordersAPI.getCustomerHistory(history);
          order = result?.data?.find((item) => Number(item.id) === Number(recent.id));
        }
        if (
          !order ||
          Number(order.id) !== Number(recent.id) ||
          (recent.store_id && Number(order.store_id) !== Number(recent.store_id))
        ) {
          const error = new Error('권한 만료');
          error.expired = true;
          throw error;
        }
        if (!active || request !== sequence) return;
        setState({ order, loading: false, error: '', updatedAt: new Date() });
        if (order.status === 'ready') await showOrderReadyNotification(order);
      } catch (error) {
        if (!active || request !== sequence) return;
        const expired = error.expired || [401, 403].includes(error.response?.status);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: expired
            ? '주문 조회 권한이 만료됐어요. 주문 내역에서 다시 확인해 주세요.'
            : '연결이 지연되고 있어요. 마지막으로 확인한 상태입니다.',
        }));
      }
    };
    refreshRef.current = fetchOrder;
    void fetchOrder();
    const off = subscribeCustomerOrder(
      recent.id,
      recent.capability,
      history,
      fetchOrder,
      setConnection
    );
    const timer = setInterval(fetchOrder, 15000);
    const resume = () => {
      if (document.visibilityState !== 'hidden') void fetchOrder();
    };
    window.addEventListener('online', fetchOrder);
    window.addEventListener('offline', fetchOrder);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      ++sequence;
      refreshRef.current = () => {};
      off();
      clearInterval(timer);
      window.removeEventListener('online', fetchOrder);
      window.removeEventListener('offline', fetchOrder);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [recent]);
  return { recent, ...state, connection, refresh };
}
