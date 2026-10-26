import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clipboard, Loader2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { paymentsAPI } from '@/api/orders';
import { formatWon } from '@/utils/format';

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;

export default function SplitPaymentSheet({ isOpen, onClose, session }) {
  const [status, setStatus] = useState(null);
  const [method, setMethod] = useState('cash');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [participant, setParticipant] = useState(null);
  const hasStatusRef = useRef(false);
  const accessErrorShown = useRef(false);

  useEffect(() => {
    hasStatusRef.current = Boolean(status);
  }, [status]);

  useEffect(() => {
    if (!session?.order_id) return;
    setStatus(null);
    setParticipant(null);
    hasStatusRef.current = false;
    const storageKey = `wm_split_participant_${session.order_id}`;
    try {
      const existing = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (existing?.participantKey && existing?.idempotencyKey) {
        if (!existing.idempotencyKeys) existing.idempotencyKeys = { cash: existing.idempotencyKey, transfer: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` };
        setParticipant(existing);
        try { localStorage.setItem(storageKey, JSON.stringify(existing)); } catch { /* continue in memory */ }
        return;
      }
      const created = {
        participantKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        idempotencyKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        idempotencyKeys: {
          cash: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          transfer: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        },
        registered: false,
      };
      localStorage.setItem(storageKey, JSON.stringify(created));
      setParticipant(created);
    } catch {
      setParticipant({
        participantKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        idempotencyKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        idempotencyKeys: {
          cash: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          transfer: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        },
        registered: false,
      });
    }
  }, [session?.order_id]);

  const refresh = useCallback(async () => {
    if (!session?.order_id || !session?.capability) return;
    if (!hasStatusRef.current) setIsLoading(true);
    try {
      const response = await paymentsAPI.splitStatus(session.order_id, session.capability);
      setStatus(unwrap(response));
      accessErrorShown.current = false;
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error;
      if (!accessErrorShown.current && (error?.response?.status === 403 || error?.response?.status === 404)) {
        accessErrorShown.current = true;
        toast.error(message || '분할 주문 조회 권한이 만료되었습니다. 주문자에게 새 링크를 요청해 주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [session?.order_id, session?.capability]);

  useEffect(() => {
    if (!isOpen || !session?.order_id) return undefined;
    refresh();
    const interval = window.setInterval(refresh, 4000);
    return () => window.clearInterval(interval);
  }, [isOpen, session?.order_id, refresh]);

  const shareUrl = useMemo(() => {
    if (!session?.capability || !session?.order_id) return '';
    const table = session.tableNumber ? `?table=${encodeURIComponent(session.tableNumber)}` : '';
    return `${window.location.origin}/menu/${session.store_id}${table}#wm_split=${session.order_id}.${encodeURIComponent(session.capability)}`;
  }, [session]);

  const copyInvite = async () => {
    try {
      if (navigator.share) await navigator.share({ title: '위마켓 분할 주문', text: '주문 금액을 나누어 확인해 주세요.', url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('분할 결제 링크를 복사했습니다. 함께 결제할 분에게 공유해 주세요.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('링크를 공유하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  const submitShare = async () => {
    if (!status?.next_amount || !session?.capability || !participant || participant.registered || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await paymentsAPI.splitPay({
        order_id: session.order_id,
        amount: status.next_amount,
        payment_method: method,
        participant_key: participant.participantKey,
      }, session.capability, participant.idempotencyKeys?.[method] || participant.idempotencyKey);
      const result = unwrap(response);
      const registered = { ...participant, registered: true };
      setParticipant(registered);
      try { localStorage.setItem(`wm_split_participant_${session.order_id}`, JSON.stringify(registered)); } catch { /* session state remains available */ }
      await refresh();
      if (result?.status === 'READY') toast.success(`${formatWon(result.amount)} 몫을 등록했습니다. 매장 확인을 기다려 주세요.`);
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error;
      toast.error(message || '분할 몫을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      await refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = Number(status?.total_amount ?? session?.total_amount ?? 0);
  const paid = Number(status?.total_paid || 0);
  const pending = Number(status?.pending_count || 0);
  const people = Number(status?.split_people_count || session?.split_people_count || 0);
  const paidCount = Number(status?.paid_count || 0);
  const completed = Boolean(status?.is_completed);
  const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return <AnimatePresence>
    {isOpen && <>
      <motion.button aria-label="분할 결제 닫기" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm" />
      <motion.section role="dialog" aria-modal="true" aria-labelledby="split-payment-title" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 26, stiffness: 220 }} className="fixed inset-x-0 bottom-0 z-[71] mx-auto flex max-h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2"><Users size={20} className="text-blue-600" /><div><h2 id="split-payment-title" className="font-black text-slate-900 dark:text-white">친구와 나누어 결제</h2><p className="text-xs text-slate-500">주문 {status?.order_number || session?.order_number || session?.order_id}</p></div></div>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/40">
            <div className="flex items-end justify-between"><span className="text-sm font-bold text-slate-600 dark:text-slate-300">전체 주문 금액</span><strong className="text-xl font-black text-slate-900 dark:text-white">{formatWon(total)}</strong></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="mt-2 flex justify-between text-xs text-slate-600 dark:text-slate-300"><span>입금 확인 {formatWon(paid)} / {people ? `${paidCount}/${people}명` : ''}</span><span>확인 대기 {pending}건</span></div>
            {pending > 0 && <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">현금·이체는 매장에서 입금을 확인한 뒤 합계에 반영됩니다.</p>}
          </div>

          {isLoading && !status ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div> : <>
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-center justify-between"><span className="font-bold text-slate-800 dark:text-slate-100">분할 인원</span><span className="font-black text-slate-900 dark:text-white">{people || '—'}명</span></div>
              <p className="mt-1 text-sm text-slate-500">이번 몫 <strong className="text-slate-900 dark:text-white">{formatWon(status?.next_amount || 0)}</strong></p>
            </div>

            {status?.payments?.length > 0 && <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">분할 진행 내역</h3>
              {status.payments.map((payment, index) => <div key={payment.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800">
                <span className="text-slate-600 dark:text-slate-300">{index + 1}번째 몫 · {String(payment.method).toUpperCase() === 'TRANSFER' ? '계좌이체' : '현금'}</span>
                <span className="text-right"><strong className="mr-2 text-slate-900 dark:text-white">{formatWon(payment.amount)}</strong><span className={payment.status === 'DONE' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>{payment.status === 'DONE' ? '확인 완료' : '입금 확인 대기'}</span></span>
              </div>)}
            </div>}

            {completed ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="mb-2" /><strong>모든 분할 금액의 입금 확인이 끝났습니다.</strong><p className="mt-1 text-sm">매장에 주문이 전달되었습니다.</p></div> : <>
              <fieldset className="space-y-2"><legend className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">이 몫의 결제 방법</legend>
                {[['cash', '현금'], ['transfer', '계좌이체']].map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${method === value ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-200 dark:border-slate-700'}`}><input type="radio" name="split-payment-method" value={value} checked={method === value} onChange={() => setMethod(value)} /><span className="font-bold text-slate-800 dark:text-slate-100">{label}</span></label>)}
              </fieldset>
              {participant?.registered ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">이 기기에서 분할 몫을 등록했습니다. 매장 입금 확인을 기다려 주세요.</p> : status?.next_amount > 0 ? <button type="button" disabled={isSubmitting || !status?.unassigned_amount || !participant} onClick={submitShare} className="w-full rounded-xl bg-blue-700 px-4 py-3.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? '몫 등록 중…' : `${formatWon(status.next_amount)} 몫 등록`}</button> : <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">남은 분할 자리가 모두 등록되었습니다. 매장 입금 확인을 기다려 주세요.</p>}
            </>}
          </>}

          {!completed && <button type="button" onClick={copyInvite} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"><Clipboard size={17} />친구에게 분할 링크 공유</button>}
          <p className="text-center text-xs leading-relaxed text-slate-500">분할 링크는 주문 결제 권한을 가진 초대 링크입니다. 함께 결제할 사람에게만 전달해 주세요. 카드·간편결제 분할은 현재 지원하지 않습니다.</p>
          <button type="button" onClick={refresh} className="block w-full py-2 text-sm font-bold text-blue-700 dark:text-blue-300">상태 새로고침</button>
        </div>
      </motion.section>
    </>}
  </AnimatePresence>;
}

