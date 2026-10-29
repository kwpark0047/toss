import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Clock3, MapPin, Phone, RefreshCw, Store, Utensils, WifiOff } from 'lucide-react';
import { storesAPI } from '@/api/stores';
import { useSEO } from '@/lib/useSEO';

const won = (value) => `${Number(value || 0).toLocaleString('ko-KR')}원`;

export default function StoreIntroPage() {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const table = searchParams.get('table');
  const menuUrl = `/menu/${storeId}${table ? `?table=${encodeURIComponent(table)}` : ''}`;

  useSEO({
    title: store?.name ? `${store.name} 매장 소개 | 위마켓` : '매장 소개 | 위마켓',
    description: store?.description || `${store?.name || '매장'}의 소개와 추천 메뉴를 확인해 보세요.`,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    storesAPI.getPublicIntro(storeId)
      .then((response) => {
        if (active) setStore(response?.data || response);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId]);

  const goToMenu = () => navigate(menuUrl, { replace: false });

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f5f0] flex items-center justify-center px-5" aria-live="polite">
        <div className="text-center text-stone-600">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-orange-500" />
          <p className="font-semibold">매장 정보를 불러오는 중입니다</p>
        </div>
      </main>
    );
  }

  if (error || !store) {
    return (
      <main className="min-h-screen bg-[#f7f5f0] flex items-center justify-center px-5">
        <section className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-sm">
          <WifiOff className="mx-auto mb-4 text-orange-500" size={30} />
          <h1 className="text-lg font-black text-stone-900">매장 정보를 불러오지 못했어요</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">연결 상태를 확인하고 다시 시도해 주세요.</p>
          <button onClick={() => window.location.reload()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-900 px-5 font-bold text-white">
            <RefreshCw size={16} /> 다시 시도
          </button>
        </section>
      </main>
    );
  }

  const hours = store.operating_hours;
  const products = Array.isArray(store.products) ? store.products : [];
  const phone = String(store.phone || '').replace(/[^0-9+]/g, '');

  return (
    <main className="min-h-screen bg-[#f7f5f0] pb-28 text-stone-900">
      <div className="mx-auto max-w-2xl overflow-hidden bg-white shadow-sm sm:my-6 sm:rounded-[2rem] sm:shadow-xl">
        <header className="relative isolate overflow-hidden bg-[#202821] px-6 pb-9 pt-8 text-white sm:px-10 sm:pt-10">
          <div className="absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="absolute -bottom-24 left-12 -z-10 h-48 w-48 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="mb-8 flex items-center gap-2 text-sm font-bold text-orange-200">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white"><Store size={18} /></span>
            WeMarket · 매장 소개
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">어서 오세요</p>
          <h1 className="break-keep text-3xl font-black leading-tight tracking-tight sm:text-4xl">{store.name}</h1>
          {store.description ? (
            <p className="mt-4 whitespace-pre-line break-keep text-[15px] leading-7 text-white/80">{store.description}</p>
          ) : (
            <p className="mt-4 text-sm leading-6 text-white/65">매장 소개를 준비하고 있습니다. 추천 메뉴를 먼저 확인해 보세요.</p>
          )}
          {table && <p className="mt-5 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">테이블 {table}</p>}
        </header>

        <div className="space-y-8 px-5 py-7 sm:px-10 sm:py-9">
          {(store.address || phone || hours) && (
            <section aria-label="매장 정보" className="grid gap-3 sm:grid-cols-2">
              {store.address && <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-stone-50 p-4"><MapPin className="mt-0.5 shrink-0 text-orange-600" size={18} /><div className="min-w-0"><p className="text-xs font-bold text-stone-500">매장 위치</p><p className="mt-1 break-keep text-sm font-semibold leading-6">{store.address}</p></div></div>}
              {hours && <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-stone-50 p-4"><Clock3 className="mt-0.5 shrink-0 text-orange-600" size={18} /><div><p className="text-xs font-bold text-stone-500">영업시간</p><p className="mt-1 text-sm font-semibold">{hours.open_time || '영업시간 확인'}{hours.close_time ? ` – ${hours.close_time}` : ''}</p></div></div>}
              {phone && <a href={`tel:${phone}`} className="flex min-w-0 items-center gap-3 rounded-2xl bg-stone-50 p-4 transition hover:bg-orange-50"><Phone className="shrink-0 text-orange-600" size={18} /><div><p className="text-xs font-bold text-stone-500">매장 문의</p><p className="mt-1 text-sm font-semibold">{store.phone}</p></div></a>}
            </section>
          )}

          {products.length > 0 && (
            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div><p className="text-xs font-bold tracking-wide text-orange-600">TODAY'S PICKS</p><h2 className="mt-1 text-xl font-black">이런 메뉴는 어떠세요?</h2></div>
                <span className="pb-0.5 text-xs text-stone-400">인기 메뉴</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {products.map((product) => (
                  <article key={product.id} className="flex min-w-0 overflow-hidden rounded-2xl border border-stone-100 bg-white sm:block">
                    {product.image_url ? <img src={product.image_url} alt="" loading="lazy" className="h-28 w-28 shrink-0 object-cover sm:h-32 sm:w-full" /> : <div className="flex h-28 w-28 shrink-0 items-center justify-center bg-orange-50 text-orange-300 sm:h-32 sm:w-full"><Utensils size={25} /></div>}
                    <div className="flex min-w-0 flex-1 flex-col justify-center p-3 sm:p-3.5">
                      <h3 className="truncate text-sm font-extrabold">{product.name}</h3>
                      {product.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{product.description}</p>}
                      <p className="mt-2 text-sm font-black text-orange-700">{won(product.price)}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-orange-100 bg-orange-50/70 p-5 sm:p-6">
            <h2 className="text-base font-black">주문은 간편하게</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">메뉴와 옵션을 확인한 뒤 원하는 메뉴를 주문할 수 있습니다.</p>
            <button onClick={goToMenu} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-base font-extrabold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300">
              메뉴판 보기 <ArrowRight size={18} />
            </button>
            <Link to={menuUrl} className="mt-3 block text-center text-xs font-semibold text-stone-500 underline decoration-stone-300 underline-offset-4">바로 메뉴판으로 이동</Link>
          </section>
        </div>
      </div>
      <p className="mx-auto mt-5 max-w-2xl px-4 text-center text-[11px] text-stone-400">위마켓 QR 주문 · 테이블 정보는 메뉴판으로 안전하게 이어집니다</p>
    </main>
  );
}
