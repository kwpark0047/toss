import { useState } from 'react';
import { Bell, Check, Clock, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import OrderStatusModal from '../menu/OrderStatusModal';
import useRecentOrderProgress from '../../hooks/useRecentOrderProgress';
import {
  readyNotificationEnabled,
  setReadyNotificationEnabled,
  showOrderReadyNotification,
} from '../../utils/orderReadyNotification';
import './recentOrder.css';

const steps = ['접수 대기', '주문 확인', '조리 중', '준비 완료', '수령 완료'];
const statusIndex = { pending: 0, paid: 0, confirmed: 1, preparing: 2, ready: 3, completed: 4 };
const descriptions = {
  pending: '매장에서 주문을 확인하고 있어요.',
  paid: '매장에서 주문을 확인하고 있어요.',
  confirmed: '매장에서 주문을 확인했어요.',
  preparing: '정성껏 조리하고 있어요.',
  ready: '주문이 준비됐어요.',
  completed: '수령이 완료됐어요. 이용해 주셔서 감사합니다.',
  cancelled: '주문이 취소됐어요. 자세한 내용은 주문 내역을 확인해 주세요.',
};

export default function RecentOrderBanner() {
  const { recent, order, loading, error, updatedAt, connection, refresh } =
    useRecentOrderProgress();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(readyNotificationEnabled);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(() => {
    try {
      return !!sessionStorage.getItem(`wm_order_ready_ack:${recent?.id}`);
    } catch {
      return false;
    }
  });
  if (!recent) return null;
  const index = statusIndex[order?.status];
  const ready = order?.status === 'ready';
  const terminal = ['completed', 'cancelled'].includes(order?.status);
  const toggleNotifications = async () => {
    if (enabled) {
      setEnabled(false);
      setReadyNotificationEnabled(false);
      return;
    }
    if (typeof Notification === 'undefined' || !window.isSecureContext) {
      setPermissionMessage(
        '이 브라우저는 시스템 알림을 지원하지 않아요. 화면에서 준비 완료를 안내해 드릴게요.'
      );
      return;
    }
    setRequesting(true);
    try {
      const permission =
        Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission === 'granted') {
        setReadyNotificationEnabled(true);
        setEnabled(true);
        setPermissionMessage('');
        if (ready) await showOrderReadyNotification(order);
      } else
        setPermissionMessage(
          '브라우저 알림이 차단돼 있어요. 화면 알림은 계속 제공됩니다. 브라우저 설정에서 알림을 허용해 주세요.'
        );
    } catch {
      setPermissionMessage('알림을 켜지 못했어요. 화면에서 준비 완료를 안내해 드릴게요.');
    } finally {
      setRequesting(false);
    }
  };
  const acknowledge = () => {
    setAcknowledged(true);
    try {
      sessionStorage.setItem(`wm_order_ready_ack:${recent.id}`, 'true');
    } catch {
      /* session only */
    }
  };
  return (
    <>
      <aside
        className={`recent-order ${ready ? 'recent-order-ready' : ''}`}
        aria-label="실시간 주문 진행"
      >
        <div className="ro-top">
          <span className="ro-eyebrow">내 주문</span>
          <span className="ro-connection">
            {error ? '상태 확인 필요' : connection === 'live' ? '실시간 연결' : '자동 갱신'}
          </span>
        </div>
        <h2>{order?.store_name || recent.store_name || '주문한 매장'}</h2>
        <p className="ro-number">
          주문 {order?.order_number || recent.order_number || recent.id}
          {order?.total_amount != null && (
            <span>{Number(order.total_amount).toLocaleString('ko-KR')}원</span>
          )}
        </p>
        <div className="ro-status" aria-live="polite" aria-atomic="true">
          <span className="ro-status-title">
            {loading
              ? '주문 상태 확인 중'
              : order?.status === 'cancelled'
                ? '주문 취소'
                : steps[index] || '상태 확인 필요'}
          </span>
          {order && (
            <p>{descriptions[order.status] || '주문 상세에서 진행 상황을 확인해 주세요.'}</p>
          )}
        </div>
        {index !== undefined && (
          <ol className="ro-steps" aria-label="주문 진행 단계">
            {steps.map((step, i) => (
              <li
                key={step}
                aria-current={i === index ? 'step' : undefined}
                className={i <= index ? 'ro-step-active' : ''}
              >
                <span aria-hidden="true">{i < index ? <Check size={13} /> : i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        )}
        {ready && !acknowledged && (
          <div className="ro-ready-alert" role="alert">
            <Bell size={20} aria-hidden="true" />
            <div>
              <strong>주문이 준비됐어요</strong>
              <p>
                {order.order_type === 'delivery'
                  ? '배달 진행은 주문 상세에서 확인해 주세요.'
                  : order.order_type === 'dine_in'
                    ? '직원의 안내를 확인해 주세요.'
                    : '매장에서 주문번호를 보여주고 수령해 주세요.'}
              </p>
              <button onClick={acknowledge}>확인했어요</button>
            </div>
          </div>
        )}
        {error && (
          <p className="ro-error" role="status">
            {error}
          </p>
        )}
        <div className="ro-updated">
          <Clock size={12} aria-hidden="true" />
          {updatedAt
            ? `${updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 확인`
            : '연결 확인 중'}
          <button onClick={refresh} aria-label="주문 상태 새로고침">
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>
        <button className="ro-detail" onClick={() => setOpen(true)}>
          내 주문 진행 확인 <span aria-hidden="true">→</span>
        </button>
        {!terminal && (
          <>
            <button
              className="ro-notifications"
              disabled={requesting}
              onClick={toggleNotifications}
            >
              <Bell size={15} aria-hidden="true" />
              {requesting
                ? '알림 설정 중…'
                : enabled
                  ? '브라우저 알림 끄기'
                  : '준비 완료 알림 켜기'}
            </button>
            <p className="ro-hint">
              이 페이지를 열어 둔 동안 준비 완료를 알려드려요. 알림을 켜면 다른 탭에서도 확인할 수
              있어요.
            </p>
            {permissionMessage && (
              <p className="ro-error" role="status">
                {permissionMessage}
              </p>
            )}
          </>
        )}
        {error && (
          <Link className="ro-history" to="/order-history">
            전체 주문 내역 보기
          </Link>
        )}
      </aside>
      <OrderStatusModal
        isOpen={open}
        onClose={() => setOpen(false)}
        orderId={recent.id}
        storeId={order?.store_id || recent.store_id}
        capability={recent.capability}
      />
    </>
  );
}
