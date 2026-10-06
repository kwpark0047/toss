import { useCallback, useEffect, useRef, useState } from 'react';
import { subscriptionsAPI as api } from '../../api/subscriptions';
const statuses = {
  active: '이용 중',
  incomplete: '결제 대기',
  past_due: '결제 확인 필요',
  canceled: '해지됨',
  expired: '만료됨',
  trialing: '체험 중',
  pending: '청구 대기',
  processing: '처리 중',
  paid: '결제 완료',
  failed: '결제 실패',
  manual_review: '운영자 확인 필요',
};
const money = (v) => new Intl.NumberFormat('ko-KR').format(v || 0);
const date = (v) => (v ? new Date(v).toLocaleDateString('ko-KR') : '—');
let sdkPromise;
function loadSDK() {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  sdkPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.onload = () =>
      window.TossPayments
        ? resolve(window.TossPayments)
        : reject(new Error('결제 화면을 불러오지 못했습니다.'));
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('결제 화면 연결에 실패했습니다.'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
export default function SubscriptionBilling({ storeId, plans = [] }) {
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [cycle, setCycle] = useState('MONTHLY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const callbackHandled = useRef(false);
  const reload = useCallback(async () => {
    const [result, bills] = await Promise.all([api.get(storeId), api.invoices(storeId)]);
    setSummary(result.data);
    setInvoices(bills.data || []);
  }, [storeId]);
  useEffect(() => {
    reload().catch((e) => setError(e.message || '구독 정보를 조회하지 못했습니다.'));
  }, [reload]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authKey = params.get('authKey');
    if (!authKey || callbackHandled.current) return;
    callbackHandled.current = true;
    const storageKey = `wm-sub-checkout-${storeId}`;
    let session;
    try {
      session = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch {
      /* Reject invalid session below. */
    }
    window.history.replaceState({}, '', window.location.pathname);
    if (!session || session.customerKey !== params.get('customerKey')) {
      setError('결제 세션이 일치하지 않습니다. 다시 시작해 주세요.');
      return;
    }
    setBusy(true);
    api
      .activate(storeId, { auth_key: authKey, checkout_token: session.token }, session.key)
      .then(() => {
        sessionStorage.removeItem(storageKey);
        setMessage('구독 정보가 갱신되었습니다.');
        return reload();
      })
      .catch((e) => {
        setError(e.message || '결제를 확인하지 못했습니다. 청구 내역을 확인해 주세요.');
        reload().catch(() => {});
      })
      .finally(() => setBusy(false));
  }, [storeId, reload]);
  const run = async (action, success) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await reload();
      setMessage(success);
    } catch (e) {
      setError(e.message || '요청을 완료하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const start = async (plan, mode = 'subscribe') => {
    if (!consent) {
      setError('자동 결제 안내에 동의해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.checkout(
        storeId,
        plan.id,
        mode === 'payment_method' ? summary.subscription.billing_cycle : cycle,
        mode
      );
      const checkout = result.data;
      sessionStorage.setItem(
        `wm-sub-checkout-${storeId}`,
        JSON.stringify({
          token: checkout.checkout_token,
          customerKey: checkout.customer_key,
          key: crypto.randomUUID(),
        })
      );
      const TossPayments = await loadSDK();
      const url = `${window.location.origin}${window.location.pathname}`;
      await TossPayments(checkout.client_key).requestBillingAuth('카드', {
        customerKey: checkout.customer_key,
        successUrl: url,
        failUrl: `${url}?billing_failed=1`,
      });
    } catch (e) {
      setError(e.message || '결제를 시작하지 못했습니다.');
      setBusy(false);
    }
  };
  const sub = summary?.subscription;
  const paid = summary?.effective_plan && summary.effective_plan !== 'free';
  const button = 'min-h-11 rounded-lg border border-white/30 px-4 text-white disabled:opacity-50';
  return (
    <section
      aria-labelledby="subscription-billing-title"
      className="mb-8 rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6 space-y-5"
    >
      <div>
        <h2 id="subscription-billing-title" className="text-xl font-bold text-white">
          구독과 청구
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          결제 완료 후 플랜이 적용됩니다. 해지해도 결제한 이용 기간은 유지됩니다.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-emerald-950 p-3 text-emerald-200">
          {message}
        </p>
      )}
      {new URLSearchParams(window.location.search).has('billing_failed') && (
        <p role="alert" className="text-amber-200">
          카드 등록이 완료되지 않았습니다. 다시 시도해 주세요.
        </p>
      )}
      {!summary && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(reload, '구독 정보를 갱신했습니다.')}
          className={button}
        >
          구독 정보 다시 조회
        </button>
      )}
      {summary && (
        <>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              ['현재 플랜', summary.effective_plan.toUpperCase()],
              ['상태', statuses[sub?.status] || '무료 이용'],
              ['이용 종료', date(sub?.current_period_end)],
              ['다음 결제', sub?.auto_renew ? date(sub.next_payment_at) : '자동 갱신 꺼짐'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="mt-1 font-semibold text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-4 text-sm text-slate-200">
            <span>메뉴 {summary.usage.maxMenus}개</span>
            <span>직원 {summary.usage.maxStaff}명</span>
            <span>이번 달 주문 {summary.usage.ordersPerMonth}건</span>
          </div>
          <label className="flex items-center gap-3 text-white">
            결제 주기
            <select
              aria-label="구독 결제 주기"
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              disabled={busy}
              className="min-h-11 rounded-lg border border-slate-500 bg-slate-800 px-3"
            >
              <option value="MONTHLY">월간</option>
              <option value="YEARLY">연간</option>
            </select>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5"
            />
            <span>
              선택한 요금이 매 결제 주기마다 자동 청구되는 데 동의합니다. 변경 요금은 다음
              결제일부터 적용되며, 해지하면 이후 자동 청구가 중단됩니다.
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans
              .filter((p) => p.price_monthly > 0)
              .map((plan) => (
                <div key={plan.id} className="rounded-xl border border-slate-600 p-4">
                  <h3 className="font-bold text-white">{plan.display_name}</h3>
                  <p className="my-2 text-slate-200">
                    {money(cycle === 'YEARLY' ? plan.price_yearly : plan.price_monthly)}원 /{' '}
                    {cycle === 'YEARLY' ? '년' : '월'}
                  </p>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !consent ||
                      !(cycle === 'YEARLY' ? plan.price_yearly : plan.price_monthly)
                    }
                    onClick={() =>
                      paid
                        ? run(
                            () => api.changePlan(storeId, plan.id, cycle),
                            '다음 결제일부터 플랜이 변경됩니다.'
                          )
                        : start(plan)
                    }
                    className="min-h-11 w-full rounded-lg bg-orange-500 px-4 font-bold text-slate-950 disabled:opacity-50"
                  >
                    {paid ? '다음 결제일에 변경' : '구독 시작'}
                  </button>
                </div>
              ))}
          </div>
          {sub && (
            <div className="flex flex-wrap gap-3">
              {sub.has_payment_method && (
                <button
                  disabled={busy || !consent}
                  type="button"
                  onClick={() => start(sub.plan, 'payment_method')}
                  className={button}
                >
                  결제수단 변경
                </button>
              )}
              {sub.auto_renew ? (
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => setCancelConfirm(true)}
                  className={button}
                >
                  자동 갱신 해지
                </button>
              ) : (
                paid && (
                  <button
                    disabled={busy || !consent}
                    type="button"
                    onClick={() => run(() => api.resume(storeId), '자동 갱신을 다시 켰습니다.')}
                    className={button}
                  >
                    자동 갱신 재개
                  </button>
                )
              )}
            </div>
          )}
          {cancelConfirm && (
            <div className="rounded-lg border border-amber-400 p-4 text-white">
              <p>{date(sub?.current_period_end)}까지 이용한 뒤 자동 갱신을 종료하시겠습니까?</p>
              <div className="mt-3 flex gap-3">
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() => api.cancel(storeId), '자동 갱신이 해지되었습니다.').then(() =>
                      setCancelConfirm(false)
                    )
                  }
                  className="min-h-11 rounded-lg bg-amber-300 px-4 text-slate-950"
                >
                  해지 확정
                </button>
                <button onClick={() => setCancelConfirm(false)} className={button}>
                  계속 이용
                </button>
              </div>
            </div>
          )}
          <div>
            <h3 className="mb-3 font-semibold text-white">최근 청구 내역</h3>
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-400">청구 내역이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {invoices.map((bill) => (
                  <li
                    key={bill.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 pt-3 text-sm text-slate-200"
                  >
                    <span>
                      {date(bill.period_start)} · {money(bill.amount)}원 ·{' '}
                      {statuses[bill.status] || bill.status}
                    </span>
                    {bill.status === 'failed' && bill.attempts < 3 && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => api.retry(storeId, bill.id, crypto.randomUUID()),
                            '청구 결제가 확인되었습니다.'
                          )
                        }
                        className={button}
                      >
                        다시 결제
                      </button>
                    )}
                    {bill.receipt_url?.startsWith('https://') && (
                      <a
                        href={bill.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-11 inline-flex items-center text-orange-300 underline"
                      >
                        영수증
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
