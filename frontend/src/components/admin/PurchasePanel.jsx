import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, PackageCheck, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { inventoryAPI } from '../../api';

const won = (value) => `${Number(value || 0).toLocaleString('ko-KR')}원`;
const responseData = (response) => response?.data?.data ?? response?.data ?? response;
const statusText = { DRAFT: '초안', ORDERED: '발주 완료', PARTIALLY_RECEIVED: '일부 입고', RECEIVED: '입고 완료', CANCELLED: '취소' };
const emptyLine = () => ({ product_id: '', ordered_quantity: '', unit_cost: '' });

function PurchaseCard({ storeId, purchase, onChanged }) {
  const keyRef = useRef(null);
  const [receiving, setReceiving] = useState(false);
  const [quantities, setQuantities] = useState(() => Object.fromEntries((purchase.items || []).map((item) => [item.id, Math.max(0, item.ordered_quantity - item.received_quantity)])));

  const markOrdered = async () => {
    try { await inventoryAPI.markPurchaseOrdered(storeId, purchase.id); toast.success('발주 상태를 기록했습니다.'); onChanged(); }
    catch (error) { toast.error(error?.response?.data?.message || '발주 상태를 저장하지 못했습니다.'); }
  };

  const receive = async () => {
    if (receiving) return;
    const lines = (purchase.items || []).map((item) => ({
      purchase_order_item_id: item.id,
      quantity_received: Number(quantities[item.id] || 0),
      unit_cost: Number(item.unit_cost || 0),
    })).filter((item) => item.quantity_received > 0);
    if (!lines.length) { toast.error('입고할 수량을 입력해 주세요.'); return; }
    if (!keyRef.current) keyRef.current = globalThis.crypto?.randomUUID?.() || `${purchase.id}-${Date.now()}-${Math.random()}`;
    setReceiving(true);
    try {
      await inventoryAPI.receivePurchase(storeId, purchase.id, { items: lines }, keyRef.current);
      keyRef.current = null;
      toast.success('입고와 재고 반영을 완료했습니다.');
      onChanged();
    } catch (error) {
      toast.error(error?.response?.data?.message || '입고 결과를 확인하지 못했습니다. 같은 요청 키로 다시 시도해 주세요.');
    } finally { setReceiving(false); }
  };

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-white">{purchase.order_number}</p>
          <p className="mt-1 text-xs text-slate-400">{purchase.suppliers?.name || '공급처 미지정'} · {new Date(purchase.created_at).toLocaleDateString('ko-KR')}</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">{statusText[purchase.status] || purchase.status}</span>
      </div>
      <div className="mt-4 divide-y divide-white/10">
        {(purchase.items || []).map((item) => {
          const remaining = Math.max(0, item.ordered_quantity - item.received_quantity);
          return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-100">{item.product_name}</p>
              <p className="mt-0.5 text-xs text-slate-400">발주 {item.ordered_quantity}{item.unit} · 입고 {item.received_quantity}{item.unit} · 단가 {won(item.unit_cost)}</p>
            </div>
            {['ORDERED', 'PARTIALLY_RECEIVED'].includes(purchase.status) && remaining > 0 && <label className="flex items-center gap-2 text-xs text-slate-300">
              입고 수량
              <input aria-label={`${item.product_name} 입고 수량`} type="number" min="0" max={remaining} value={quantities[item.id] ?? remaining} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} className="w-20 rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-right text-white" />
            </label>}
          </div>;
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        <span className="text-sm font-black text-emerald-300">합계 {won(purchase.total_amount)}</span>
        <div className="flex gap-2">
          {purchase.status === 'DRAFT' && <button type="button" onClick={markOrdered} className="rounded-xl bg-indigo-500/15 px-3 py-2 text-xs font-bold text-indigo-200 hover:bg-indigo-500/25"><Send size={14} className="mr-1 inline" />발주 처리</button>}
          {['ORDERED', 'PARTIALLY_RECEIVED'].includes(purchase.status) && <button type="button" onClick={receive} disabled={receiving} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><PackageCheck size={14} className="mr-1 inline" />{receiving ? '저장 중' : '입고 반영'}</button>}
        </div>
      </div>
    </article>
  );
}

export default function PurchasePanel({ storeId, onBack }) {
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [supplierName, setSupplierName] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [productResponse, purchaseResponse] = await Promise.all([
        inventoryAPI.getInventory(storeId, { limit: 200 }),
        inventoryAPI.getPurchases(storeId),
      ]);
      const productData = responseData(productResponse);
      const purchaseData = responseData(purchaseResponse);
      setProducts(Array.isArray(productData?.products) ? productData.products : []);
      setPurchases(Array.isArray(purchaseData?.purchases) ? purchaseData.purchases : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || '매입 정보를 불러오지 못했습니다.');
    } finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const createDraft = async (event) => {
    event.preventDefault();
    const normalized = lines.map((line) => ({
      product: products.find((product) => String(product.id) === line.product_id),
      quantity: Number(line.ordered_quantity),
      cost: Number(line.unit_cost),
    }));
    if (!normalized.length || normalized.some((line) => !line.product || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.cost) || line.cost < 0)) {
      toast.error('상품, 수량, 매입 단가를 확인해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await inventoryAPI.createPurchaseDraft(storeId, {
        supplier_name: supplierName.trim() || undefined,
        items: normalized.map((line) => ({ product_id: line.product.id, ordered_quantity: line.quantity, unit_cost: line.cost, unit: '개' })),
      });
      setSupplierName(''); setLines([emptyLine()]);
      toast.success('매입 발주 초안을 저장했습니다.');
      await load();
    } catch (error) { toast.error(error?.response?.data?.message || '발주 초안을 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="재고 관리로 돌아가기" className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10"><ArrowLeft size={18} /></button>
        <div><h1 className="text-2xl font-black text-white">매입·입고 관리</h1><p className="mt-1 text-xs text-slate-400">발주를 기록하고 입고 확인 시 재고와 이력을 한 번에 반영합니다.</p></div>
      </div>
      <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />새로고침</button>
    </div>

    <form onSubmit={createDraft} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-300">공급처 이름<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="예: 동네 식자재마트" maxLength={120} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white" /></label>
        <div className="flex items-end justify-end"><button type="button" onClick={() => setLines((current) => current.length >= 100 ? current : [...current, emptyLine()])} disabled={lines.length >= 100} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 disabled:opacity-50"><Plus size={15} />품목 추가</button></div>
      </div>
      <div className="space-y-2">
        {lines.map((line, index) => <div key={index} className="grid gap-2 rounded-xl bg-slate-900/60 p-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(100px,0.7fr)_minmax(120px,0.8fr)_auto]">
          <label className="text-xs font-bold text-slate-300">상품<select required value={line.product_id} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, product_id: event.target.value } : item))} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"><option value="">상품 선택</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-300">수량<input required type="number" min="1" step="1" value={line.ordered_quantity} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ordered_quantity: event.target.value } : item))} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white" /></label>
          <label className="text-xs font-bold text-slate-300">개당 매입가(원)<input required type="number" min="0" step="1" value={line.unit_cost} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unit_cost: event.target.value } : item))} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white" /></label>
          <button type="button" aria-label={`${index + 1}번째 품목 삭제`} onClick={() => setLines((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current)} disabled={lines.length < 2} className="mt-5 rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"><Trash2 size={16} /></button>
        </div>)}
      </div>
      <div className="flex justify-end"><button disabled={saving || !products.length} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white disabled:opacity-50"><Plus size={16} />{saving ? '저장 중' : '발주 초안 저장'}</button></div>
    </form>

    <div className="space-y-3">
      {loading ? <p className="py-10 text-center text-sm text-slate-400">매입 내역을 불러오는 중입니다…</p>
        : purchases.length ? purchases.map((purchase) => <PurchaseCard key={purchase.id} storeId={storeId} purchase={purchase} onChanged={load} />)
          : <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-400">아직 매입 발주가 없습니다. 공급처·상품을 입력해 첫 발주 초안을 저장하세요.</div>}
    </div>
  </div>;
}
