import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Bike, Lock, Save, ShoppingBag, Utensils } from 'lucide-react';
import { adminAPI } from '../../api';

/**
 * 주문 받는 방식 — 매장 식사 / 포장 / 배달 스위치와 직접 배달 설정.
 * 매장 식사 끄기(온라인 전용)와 배달은 '온라인 주문' 부가기능(무료)을 켠 매장만 쓸 수 있다.
 */
const CHANNELS = [
  { key: 'dine_in_enabled', title: '매장 식사', description: '테이블 QR로 매장 안에서 주문합니다.', icon: Utensils, needsAddon: 'off' },
  { key: 'takeout_enabled', title: '포장 픽업', description: '주문 링크로 주문하고 매장에서 받아 갑니다.', icon: ShoppingBag },
  { key: 'delivery_enabled', title: '배달', description: '직접 배달하거나 계약한 배달대행사로 보냅니다.', icon: Bike, needsAddon: 'on' },
];

const won = (n) => `${Number(n || 0).toLocaleString()}원`;

export default function OrderChannelsSettings({ storeId }) {
  const [form, setForm] = useState(null);
  const [addonActive, setAddonActive] = useState(false);
  const [areasText, setAreasText] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = (data) => {
    // 부가기능 켜기/끄기 응답에는 대행사 목록이 없으므로 이전 목록을 유지한다.
    setForm((prev) => ({ ...data, agency_providers: data.agency_providers || prev?.agency_providers || [] }));
    setAddonActive(!!data.online_addon_active);
    setAreasText((data.delivery_areas || []).join(', '));
  };

  useEffect(() => {
    if (!storeId) return;
    adminAPI
      .getOrderChannels(storeId)
      .then((res) => load(res.data || res))
      .catch(() => toast.error('주문 받는 방식을 불러오지 못했습니다.'));
  }, [storeId]);

  if (!form) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  // 테이블 없이 주문하는 매장 링크 (전단지·SNS·포장 스티커용)
  const orderLink = `${window.location.origin}/menu/${storeId}`;

  const locked = (channel) =>
    !addonActive &&
    ((channel.needsAddon === 'off' && form[channel.key]) || (channel.needsAddon === 'on' && !form[channel.key]));

  const toggleAddon = async () => {
    const next = !addonActive;
    if (!next && !window.confirm('온라인 주문을 끄면 배달 주문을 더 받지 않습니다. 매장 식사를 끈 매장은 포장만 받습니다. 끌까요?')) return;
    setToggling(true);
    try {
      const res = await adminAPI.setOnlineOrderingAddon(storeId, next);
      load((res.data || res).channels);
      toast.success(next ? '온라인 주문을 켰습니다.' : '온라인 주문을 껐습니다.');
    } catch (err) {
      toast.error(err?.response?.data?.error || '부가기능을 바꾸지 못했습니다.');
    } finally {
      setToggling(false);
    }
  };

  const save = async () => {
    if (!form.dine_in_enabled && !window.confirm('매장 식사를 끄면 테이블 QR 주문을 받지 않습니다. 진행 중인 매장 주문은 그대로 처리됩니다. 저장할까요?')) return;
    setSaving(true);
    try {
      const areas = areasText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      const res = await adminAPI.updateOrderChannels(storeId, {
        dine_in_enabled: form.dine_in_enabled,
        takeout_enabled: form.takeout_enabled,
        delivery_enabled: form.delivery_enabled,
        pickup_guide: form.pickup_guide || '',
        hide_exact_address: form.hide_exact_address,
        delivery_area_mode: form.delivery_area_mode,
        delivery_radius_km: Number(form.delivery_radius_km),
        delivery_areas: areas,
        min_order_amount: Number(form.min_order_amount) || 0,
        delivery_fee: Number(form.delivery_fee) || 0,
        delivery_est_minutes: Number(form.delivery_est_minutes) || 40,
        delivery_fulfillment: form.delivery_fulfillment || 'self',
        agency_provider: form.agency_provider || null,
        agency_auto_dispatch: !!form.agency_auto_dispatch,
      });
      load(res.data || res);
      toast.success('주문 받는 방식이 저장되었습니다.');
    } catch (err) {
      toast.error(err?.response?.data?.error || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400';

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" data-testid="order-channels-settings">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-orange-500">
            <ShoppingBag size={16} />
          </div>
          <span className="font-bold text-gray-900">주문 받는 방식</span>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="space-y-5 border-t border-gray-50 px-6 pb-6 pt-4">
        {/* 부가기능 */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
          <div>
            <p className="text-sm font-extrabold text-gray-900">온라인 주문 부가기능 <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-orange-600">무료</span></p>
            <p className="mt-0.5 text-xs leading-5 text-gray-600">켜면 매장 식사 없이 포장·배달만 받는 온라인 전용 운영과 직접 배달을 쓸 수 있습니다.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={addonActive}
            aria-label="온라인 주문 부가기능"
            onClick={toggleAddon}
            disabled={toggling}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${addonActive ? 'bg-orange-500' : 'bg-gray-300'} disabled:opacity-50`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${addonActive ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        {/* 주문 유형 스위치 */}
        <div className="grid gap-3 sm:grid-cols-3">
          {CHANNELS.map((channel) => {
            const ChannelIcon = channel.icon;
            const on = !!form[channel.key];
            const isLocked = locked(channel);
            return (
              <button
                key={channel.key}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={isLocked}
                onClick={() => set(channel.key, !on)}
                className={`rounded-2xl border-2 p-4 text-left transition ${on ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'} ${isLocked ? 'cursor-not-allowed opacity-60' : 'hover:border-orange-300'}`}
              >
                <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${on ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <ChannelIcon size={17} />
                </span>
                <span className="block text-sm font-extrabold text-gray-900">{channel.title}</span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">{channel.description}</span>
                <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${on ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                  {isLocked && <Lock size={11} />}
                  {on ? '받는 중' : '안 받음'}
                </span>
              </button>
            );
          })}
        </div>
        {!addonActive && (
          <p className="text-xs text-gray-500">매장 식사 끄기와 배달은 위의 온라인 주문 부가기능을 켜야 바꿀 수 있습니다.</p>
        )}
        {!form.dine_in_enabled && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
            온라인 전용 매장입니다. 테이블 QR을 스캔한 손님도 포장·배달 주문 화면으로 안내됩니다.
          </div>
        )}
        {(form.takeout_enabled || form.delivery_enabled) && (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-600">포장·배달 주문 링크</p>
              <p className="truncate font-mono text-xs text-gray-800">{orderLink}</p>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(orderLink).then(() => toast.success('주문 링크를 복사했습니다.')).catch(() => toast.error('복사하지 못했습니다.'))}
              className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              복사
            </button>
          </div>
        )}

        {form.takeout_enabled && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-600">픽업 장소 안내</span>
            <input
              className={inputClass}
              maxLength={200}
              placeholder="예: 건물 1층 수령대에서 주문번호를 말씀해 주세요"
              value={form.pickup_guide || ''}
              onChange={(e) => set('pickup_guide', e.target.value)}
            />
          </label>
        )}

        {!form.dine_in_enabled && (
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-orange-500"
              checked={!!form.hide_exact_address}
              onChange={(e) => set('hide_exact_address', e.target.checked)}
            />
            <span>
              <span className="block text-sm font-bold text-gray-900">고객에게 정확한 주소 숨기기</span>
              <span className="mt-0.5 block text-xs leading-5 text-gray-500">지도와 매장 정보에 구 단위 지역과 흐린 배달 권역만 보입니다. 자택에서 운영할 때 켜 주세요.</span>
            </span>
          </label>
        )}

        {form.delivery_enabled && (
          <div className="space-y-4 rounded-2xl border border-gray-200 p-4">
            <p className="text-sm font-extrabold text-gray-900">배달 설정</p>
            <div className="flex gap-2" role="radiogroup" aria-label="배달 방식">
              {[
                { value: 'self', label: '직접 배달' },
                { value: 'agency', label: '배달대행' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={(form.delivery_fulfillment || 'self') === value}
                  onClick={() => set('delivery_fulfillment', value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${(form.delivery_fulfillment || 'self') === value ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 text-gray-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.delivery_fulfillment === 'agency' && (
              <div className="space-y-3 rounded-xl bg-gray-50 p-3" data-testid="agency-settings">
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="배달대행사">
                  {(form.agency_providers || []).map((provider) => {
                    const selected = form.agency_provider === provider.key;
                    return (
                      <button
                        key={provider.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => set('agency_provider', provider.key)}
                        className={`rounded-xl border-2 px-3 py-2 text-left ${selected ? 'border-orange-500 bg-white' : 'border-gray-200 bg-white'}`}
                      >
                        <span className="block text-sm font-extrabold text-gray-900">{provider.label}</span>
                        <span className={`mt-0.5 block text-[11px] font-bold ${!provider.ready ? 'text-gray-400' : provider.connected ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {!provider.ready ? '연동 준비 중' : provider.connected ? '계정 연결됨' : '계정 연결 필요'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-orange-500"
                    checked={!!form.agency_auto_dispatch}
                    onChange={(e) => set('agency_auto_dispatch', e.target.checked)}
                  />
                  주문을 확인하면 자동으로 배차 요청
                </label>
                <p className="text-xs leading-5 text-gray-500">
                  대행사 계정(API 키·비밀값)은 아래 '외부 연동 인증정보'에서 매장 계약 정보로 연결해 주세요. 대행 수수료는 대행사와 매장이 직접 정산합니다. 바로고·부릉·생각대로는 제휴 API 연동이 끝나면 선택할 수 있어요.
                </p>
              </div>
            )}
            <div className="flex gap-2" role="radiogroup" aria-label="배달 권역 방식">
              {[
                { value: 'radius', label: '매장에서 반경' },
                { value: 'areas', label: '동네 목록' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.delivery_area_mode === value}
                  onClick={() => set('delivery_area_mode', value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${form.delivery_area_mode === value ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 text-gray-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.delivery_area_mode === 'radius' ? (
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">배달 반경 (km)</span>
                <input type="number" min="0.5" max="20" step="0.5" className={inputClass} value={form.delivery_radius_km} onChange={(e) => set('delivery_radius_km', e.target.value)} />
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">배달 동네 (쉼표로 구분)</span>
                <textarea rows={2} className={inputClass} placeholder="예: 역삼동, 논현동, 삼성동" value={areasText} onChange={(e) => setAreasText(e.target.value)} />
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">최소 주문 금액</span>
                <input type="number" min="0" step="1000" className={inputClass} value={form.min_order_amount} onChange={(e) => set('min_order_amount', e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">배달비</span>
                <input type="number" min="0" step="500" className={inputClass} value={form.delivery_fee} onChange={(e) => set('delivery_fee', e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">예상 배달 시간 (분)</span>
                <input type="number" min="5" max="240" step="5" className={inputClass} value={form.delivery_est_minutes} onChange={(e) => set('delivery_est_minutes', e.target.value)} />
              </label>
            </div>
            <p className="text-xs text-gray-500">
              손님에게는 “{won(form.min_order_amount)} 이상 · 배달비 {won(form.delivery_fee)} · 약 {form.delivery_est_minutes}분”으로 보입니다. 배달 주문은 온라인 결제로만 받습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
