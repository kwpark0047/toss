import { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Loader2, Check, X, Undo2 } from 'lucide-react';
import { storesAPI } from '../../api/stores';
import { loadLeaflet, TILE_LAYER, DEFAULT_CENTER, isValidKoreaCoord } from '../../utils/leafletLoader';

/**
 * StoreLocationEditor — 매장 주소 검색 → 후보 선택 → 지도에서 핀 미세 조정 → 변경 전/후 확인 → 저장.
 * 서버(PUT /stores/:id)가 store:update 권한과 좌표 범위를 다시 검증한다.
 * props: storeId, initial({ address, latitude, longitude }), onSaved(updatedStore)
 */
const SEARCH_DEBOUNCE_MS = 400;
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const fmt = (lat, lng) => (isValidKoreaCoord(lat, lng) ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` : '미지정');

const pinIcon = (L) => L.divIcon({
  className: '',
  html: '<div style="width:30px;height:30px;background:#f97316;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.35)"></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

export default function StoreLocationEditor({ storeId, initial = {}, onSaved }) {
  const saved = {
    address: initial.address || '',
    lat: isValidKoreaCoord(initial.latitude, initial.longitude) ? Number(initial.latitude) : null,
    lng: isValidKoreaCoord(initial.latitude, initial.longitude) ? Number(initial.longitude) : null,
  };

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchState, setSearchState] = useState('idle'); // idle | loading | done | error
  const [searchError, setSearchError] = useState('');
  const [draft, setDraft] = useState(null); // { address, lat, lng } — 저장 전 미리보기
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok'|'error', text }
  const [mapStatus, setMapStatus] = useState('loading');
  const [current, setCurrent] = useState(saved);

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const setDraftRef = useRef(null);

  // 지도에서 움직인 위치를 draft에 반영 (주소 텍스트는 유지) — 지도 이벤트 핸들러가 최신 상태를 보도록 ref로 보관
  useEffect(() => {
    setDraftRef.current = (lat, lng) => {
      setConfirming(false);
      setDraft((d) => ({ address: d?.address ?? current.address, lat: round6(lat), lng: round6(lng) }));
    };
  }, [current.address]);

  // ── 주소 검색 (디바운스 + 이전 요청 취소) ──
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearchState('idle'); setSearchError(''); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearchState('loading');
      setSearchError('');
      try {
        const res = await storesAPI.searchLocation(storeId, q, { signal: ctrl.signal });
        setResults(res?.data?.results || []);
        setSearchState('done');
      } catch (err) {
        if (ctrl.signal.aborted || err?.code === 'ERR_CANCELED') return;
        const status = err?.response?.status;
        setSearchError(
          status === 429 ? '검색 요청이 많아요. 잠시 후 다시 시도해 주세요.'
            : status === 403 ? '이 매장의 위치를 변경할 권한이 없어요.'
              : err?.response?.data?.error || '주소 검색에 실패했어요.'
        );
        setResults([]);
        setSearchState('error');
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, storeId]);

  // ── 지도 초기화 (한 번) ──
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapElRef.current || mapRef.current) return;
        const start = saved.lat != null ? [saved.lat, saved.lng] : DEFAULT_CENTER;
        const map = L.map(mapElRef.current, { scrollWheelZoom: false }).setView(start, saved.lat != null ? 17 : 12);
        L.tileLayer(TILE_LAYER.url, TILE_LAYER.options).addTo(map);
        const marker = L.marker(start, { icon: pinIcon(L), draggable: true, keyboard: true, title: '매장 위치 (드래그해서 조정)' });
        if (saved.lat != null) marker.addTo(map);
        marker.on('dragend', () => { const p = marker.getLatLng(); setDraftRef.current?.(p.lat, p.lng); });
        map.on('click', (e) => { marker.setLatLng(e.latlng); if (!map.hasLayer(marker)) marker.addTo(map); setDraftRef.current?.(e.latlng.lat, e.latlng.lng); });
        mapRef.current = map;
        markerRef.current = marker;
        setMapStatus('ready');
      })
      .catch(() => !cancelled && setMapStatus('error'));
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.off(); mapRef.current.remove(); mapRef.current = null; }
      markerRef.current = null;
      setMapStatus('loading');
    };
    // 초기 좌표는 마운트 시점 값만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // draft/저장값이 바뀌면 핀과 지도 위치 동기화
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || mapStatus !== 'ready') return;
    const target = draft || (current.lat != null ? current : null);
    if (!target || target.lat == null) return;
    marker.setLatLng([target.lat, target.lng]);
    if (!map.hasLayer(marker)) marker.addTo(map);
    if (!map.getBounds().pad(-0.2).contains([target.lat, target.lng])) map.setView([target.lat, target.lng], Math.max(map.getZoom(), 16));
  }, [draft, current, mapStatus]);

  const pick = (c) => {
    setConfirming(false);
    setMessage(null);
    setDraft({ address: c.roadAddress || c.jibunAddress || '', lat: c.lat, lng: c.lng });
    setResults([]);
    setSearchState('idle');
    setQuery('');
    mapRef.current?.setView([c.lat, c.lng], 17);
  };

  const reset = () => { setDraft(null); setConfirming(false); setMessage(null); };

  const save = async () => {
    if (!draft || !isValidKoreaCoord(draft.lat, draft.lng)) {
      setMessage({ type: 'error', text: '대한민국 범위 안의 위치를 선택해 주세요.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = { address: draft.address.trim() || null, latitude: draft.lat, longitude: draft.lng };
      const res = await storesAPI.update(storeId, payload);
      const next = { address: payload.address || '', lat: draft.lat, lng: draft.lng };
      setCurrent(next);
      setDraft(null);
      setConfirming(false);
      setMessage({ type: 'ok', text: '매장 위치가 저장되었어요.' });
      onSaved?.(res?.data, next);
    } catch (err) {
      const status = err?.response?.status;
      setMessage({
        type: 'error',
        text: status === 403 ? '이 매장의 위치를 변경할 권한이 없어요.' : err?.response?.data?.error || '위치 저장에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  };

  const changed = draft && (draft.lat !== current.lat || draft.lng !== current.lng || draft.address.trim() !== current.address);
  const inputCls = 'w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-600 outline-none focus:border-orange-500/50 transition-all';

  return (
    <section className="space-y-4" aria-labelledby="store-location-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="store-location-title" className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <MapPin size={14} className="text-orange-500" /> 지도 위치
        </h3>
        <span className="text-[11px] font-bold text-slate-500">현재: {fmt(current.lat, current.lng)}</span>
      </div>

      {/* 주소 검색 */}
      <div className="relative">
        <label htmlFor="store-location-search" className="sr-only">주소 또는 건물명 검색</label>
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" aria-hidden="true" />
        <input
          id="store-location-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          className={`${inputCls} pl-11`}
          placeholder="도로명·지번 주소 또는 건물명 (예: 세종대로 110, 태평로1가 31)"
          autoComplete="off"
          aria-describedby="store-location-search-status"
        />
        {searchState === 'loading' && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-400 animate-spin" aria-hidden="true" />}
      </div>
      <div id="store-location-search-status" aria-live="polite" className="text-[11px] font-bold">
        {searchState === 'error' && <p className="text-rose-400">{searchError}</p>}
        {searchState === 'done' && results.length === 0 && <p className="text-slate-500">검색 결과가 없어요. 도로명 주소나 건물명으로 다시 검색하거나 지도를 눌러 직접 지정해 주세요.</p>}
      </div>
      {results.length > 0 && (
        <ul className="max-h-64 overflow-y-auto rounded-2xl border border-white/10 divide-y divide-white/5 bg-slate-900/80" role="listbox" aria-label="주소 검색 결과">
          {results.map((c, i) => (
            <li key={`${c.lat},${c.lng},${i}`} role="option" aria-selected="false">
              <button type="button" onClick={() => pick(c)} className="w-full text-left px-5 py-3 hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline-none min-h-[48px]">
                {c.placeName && <span className="block text-xs font-black text-orange-400">{c.placeName}</span>}
                <span className="block text-sm font-bold text-white">{c.roadAddress || c.jibunAddress}</span>
                {c.roadAddress && c.jibunAddress && <span className="block text-[11px] text-slate-500">지번 {c.jibunAddress}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 지도 미리보기 */}
      <div className="relative">
        <div ref={mapElRef} className="w-full h-[280px] sm:h-[340px] rounded-3xl overflow-hidden border border-white/10 bg-slate-800 z-0" role="region" aria-label="매장 위치 지도. 지도를 누르거나 핀을 드래그해 위치를 조정할 수 있어요." />
        {mapStatus === 'loading' && <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-400" role="status">지도를 불러오는 중…</div>}
        {mapStatus === 'error' && <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-400" role="alert">지도를 불러오지 못했어요. 주소 검색 결과로 위치를 지정할 수 있어요.</div>}
        {mapStatus === 'ready' && <p className="pointer-events-none absolute bottom-3 left-3 right-3 z-[400] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold leading-relaxed text-slate-900 shadow-sm">지도를 누르거나 핀을 끌어 정확한 위치로 옮기세요</p>}
      </div>

      {/* 변경 미리보기 + 확인 */}
      {changed && (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5 space-y-4">
          <div>
            <label htmlFor="store-location-address" className="text-[10px] font-black text-slate-500 uppercase tracking-widest">저장할 주소</label>
            <input
              id="store-location-address"
              type="text"
              value={draft.address}
              onChange={(e) => { setConfirming(false); setDraft((d) => ({ ...d, address: e.target.value })); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              className={`${inputCls} mt-2`}
              maxLength={500}
              placeholder="상세주소(층·호수)는 쉼표 뒤에 덧붙일 수 있어요"
            />
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-white/5 p-3">
              <dt className="font-black text-slate-500 mb-1">변경 전</dt>
              <dd className="text-slate-300 font-bold break-words">{current.address || '주소 없음'}</dd>
              <dd className="text-slate-500">{fmt(current.lat, current.lng)}</dd>
            </div>
            <div className="rounded-xl bg-white/5 p-3 border border-orange-500/30">
              <dt className="font-black text-orange-400 mb-1">변경 후</dt>
              <dd className="text-white font-bold break-words">{draft.address || '주소 없음'}</dd>
              <dd className="text-slate-400">{fmt(draft.lat, draft.lng)}</dd>
            </div>
          </dl>
          {!confirming ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setConfirming(true)} className="px-5 py-3 rounded-2xl bg-orange-500 text-white font-black text-sm hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 min-h-[44px]">
                이 위치로 변경
              </button>
              <button type="button" onClick={reset} className="px-5 py-3 rounded-2xl bg-white/5 text-slate-300 font-bold text-sm hover:bg-white/10 flex items-center gap-2 min-h-[44px]">
                <Undo2 size={16} /> 되돌리기
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-900/80 p-4 space-y-3" role="alertdialog" aria-labelledby="store-location-confirm">
              <p id="store-location-confirm" className="text-sm font-bold text-white">매장 위치를 변경할까요? 고객 지도와 거리 계산에 바로 반영돼요.</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={save} disabled={saving} className="px-5 py-3 rounded-2xl bg-orange-500 text-white font-black text-sm hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2 min-h-[44px]">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 변경 확정
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="px-5 py-3 rounded-2xl bg-white/5 text-slate-300 font-bold text-sm hover:bg-white/10 flex items-center gap-2 min-h-[44px]">
                  <X size={16} /> 취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {message && (
        <p role={message.type === 'error' ? 'alert' : 'status'} className={`text-xs font-bold ${message.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
