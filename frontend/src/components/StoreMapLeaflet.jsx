import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Maximize2 } from 'lucide-react';
import { bizLabel, bizIcon } from '../utils/businessType';
import {
  loadMarkerCluster,
  TILE_LAYER,
  DEFAULT_CENTER,
  isValidKoreaCoord,
  externalMapLinks,
} from '../utils/leafletLoader';

/**
 * StoreMapLeaflet — API 키 없이 동작하는 OpenStreetMap(Leaflet) 지도.
 * Leaflet을 CDN에서 동적 로드하므로 npm 설치가 필요 없다.
 * props:
 *   stores(좌표 포함), coords(고객위치), onSelect(store)
 *   selectedStore — 지정 시 해당 매장으로 이동 + 팝업 열기 (리스트↔지도 동기화)
 *   className     — 지도 컨테이너 높이 등 (기본 h-[420px])
 *   onLocate({lat,lng}) — '내 위치' 버튼 결과 전달 (미지정 시 지도 이동만)
 */

/** 매장 팝업을 DOM API로 구성 — textContent로 매장 데이터를 자동 이스케이프(XSS 방지) */
function buildPopup(s) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'font-family:Pretendard,sans-serif;min-width:170px';

  const name = document.createElement('div');
  name.style.cssText = 'font-weight:900;font-size:14px;color:#0f172a';
  name.textContent = s.name || '';
  wrap.appendChild(name);

  if (s.business_type) {
    const bt = document.createElement('div');
    bt.style.cssText = 'font-size:11px;color:#f97316;font-weight:700;margin-top:2px';
    bt.textContent = bizLabel(s.business_type);
    wrap.appendChild(bt);
  }
  if (s.address) {
    const addr = document.createElement('div');
    addr.style.cssText = 'font-size:11px;color:#64748b;margin-top:3px';
    addr.textContent = s.address;
    wrap.appendChild(addr);
  }
  if (s.distance_km != null) {
    const d = document.createElement('div');
    d.style.cssText = 'font-size:11px;color:#2563eb;font-weight:700;margin-top:2px';
    d.textContent = `📍 ${s.distance_km}km`;
    wrap.appendChild(d);
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';

  const link = document.createElement('a');
  // id는 숫자만 허용 — href 인젝션 방지
  const safeId = /^\d+$/.test(String(s.id)) ? s.id : '';
  link.href = safeId ? `/menu/${safeId}` : '#';
  link.style.cssText = 'display:inline-block;background:#f97316;color:#fff;font-weight:800;font-size:12px;padding:6px 12px;border-radius:8px;text-decoration:none';
  link.textContent = '메뉴 보기 →';
  actions.appendChild(link);

  const nav = externalMapLinks(s.name, Number(s.latitude), Number(s.longitude));
  [['카카오맵 길찾기', nav.kakao], ['네이버 길찾기', nav.naver]].forEach(([label, href]) => {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.cssText = 'display:inline-block;background:#f1f5f9;color:#334155;font-weight:700;font-size:11px;padding:6px 8px;border-radius:8px;text-decoration:none';
    a.textContent = label;
    actions.appendChild(a);
  });
  wrap.appendChild(actions);

  return wrap;
}

const makeIcon = (L, biz, selected) => {
  const { e, c } = bizIcon(biz);
  const scale = selected ? 1.2 : 1;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:34px;height:42px;transform:scale(${scale});transform-origin:bottom center;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3))">`
      + `<div style="width:34px;height:34px;background:#fff;border:2.5px solid ${c};border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">`
      + `<span style="transform:rotate(45deg);font-size:16px;line-height:1;">${e}</span></div></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -38],
  });
};

function fitPoints(map, pts) {
  if (!map) return;
  if (pts.length === 1) map.setView(pts[0], 15);
  else if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
}

export default function StoreMapLeaflet({ stores = [], coords = null, onSelect, selectedStore = null, className = 'h-[420px]', onLocate }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const userLayerRef = useRef(null);
  const markersByIdRef = useRef(new Map());
  const boundsRef = useRef([]);
  // 콜백은 ref로 보관 — 부모가 인라인 함수를 넘겨도 마커를 다시 만들지 않는다
  const onSelectRef = useRef(onSelect);
  const onLocateRef = useRef(onLocate);
  useEffect(() => { onSelectRef.current = onSelect; onLocateRef.current = onLocate; });

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState('');

  // 좌표가 유효한 매장만 지도에 표시 (NaN·문자열·국외 좌표 제외)
  const { mappable, missingCount } = useMemo(() => {
    const ok = [];
    stores.forEach((s) => {
      if (isValidKoreaCoord(s.latitude, s.longitude)) ok.push({ ...s, latitude: Number(s.latitude), longitude: Number(s.longitude) });
    });
    return { mappable: ok, missingCount: stores.length - ok.length };
  }, [stores]);

  // 지도 초기화
  useEffect(() => {
    let cancelled = false;
    loadMarkerCluster()
      .then((L) => {
        if (cancelled || !elRef.current || mapRef.current) return;
        const map = L.map(elRef.current, { scrollWheelZoom: false, tap: true }).setView(DEFAULT_CENTER, 12);
        L.tileLayer(TILE_LAYER.url, TILE_LAYER.options).addTo(map);
        mapRef.current = map;
        layerRef.current = L.markerClusterGroup({
          chunkedLoading: true,
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          iconCreateFunction(cluster) {
            const count = cluster.getChildCount();
            const size = count < 10 ? 36 : count < 30 ? 42 : 50;
            return L.divIcon({
              className: '',
              html: `<div style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#f97316,#ea580c);border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:${size < 44 ? 13 : 14}px;font-weight:900;color:#fff">${count}</div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            });
          },
        });
        map.addLayer(layerRef.current);
        userLayerRef.current = L.layerGroup().addTo(map);
        // 클릭/터치로 지도에 포커스가 들어오면 휠 줌 허용, 벗어나면 해제 (페이지 스크롤 방해 방지)
        map.on('focus', () => map.scrollWheelZoom.enable());
        map.on('blur', () => map.scrollWheelZoom.disable());
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.off(); mapRef.current.remove(); mapRef.current = null; }
      layerRef.current = null;
      userLayerRef.current = null;
      markersByIdRef.current = new Map();
      // 재초기화(Fast Refresh·재마운트) 시 마커 effect가 다시 돌도록 상태를 되돌린다
      setStatus('loading');
    };
  }, []);

  // 컨테이너 크기 변화(반응형 레이아웃, 탭 전환) 시 타일 재계산
  useEffect(() => {
    if (status !== 'ready' || !elRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(elRef.current);
    return () => ro.disconnect();
  }, [status]);

  const fitAll = () => fitPoints(mapRef.current, boundsRef.current);

  // 마커 갱신 — 매장 목록/고객 위치가 바뀔 때만
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer || status !== 'ready') return;
    layer.clearLayers();
    userLayerRef.current?.clearLayers();
    markersByIdRef.current = new Map();

    const pts = [];
    const markers = [];
    mappable.forEach((s) => {
      const m = L.marker([s.latitude, s.longitude], { icon: makeIcon(L, s.business_type, false), title: s.name, alt: s.name, keyboard: true });
      m.bindPopup(buildPopup(s));
      m.on('click', () => onSelectRef.current?.(s));
      markers.push(m);
      markersByIdRef.current.set(String(s.id), { marker: m, store: s });
      pts.push([s.latitude, s.longitude]);
    });
    layer.addLayers(markers);

    if (coords && isValidKoreaCoord(coords.lat, coords.lng)) {
      const blueDot = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,.3)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
      userLayerRef.current?.addLayer(L.marker([coords.lat, coords.lng], { icon: blueDot, title: '내 위치', keyboard: false }));
      pts.push([coords.lat, coords.lng]);
    }

    boundsRef.current = pts;
    fitPoints(map, pts);
  }, [mappable, coords, status]);

  // 선택 매장 강조 + 이동 (리스트 → 지도 동기화)
  useEffect(() => {
    const layer = layerRef.current;
    const L = window.L;
    if (status !== 'ready' || !layer || !L) return;
    const entries = markersByIdRef.current;
    entries.forEach(({ marker, store }) => marker.setIcon(makeIcon(L, store.business_type, false)));
    if (!selectedStore) return;
    const hit = entries.get(String(selectedStore.id));
    if (!hit) return;
    hit.marker.setIcon(makeIcon(L, hit.store.business_type, true));
    // 클러스터 안에 있으면 펼친 뒤 팝업 열기
    layer.zoomToShowLayer(hit.marker, () => hit.marker.openPopup());
  }, [selectedStore, mappable, status]);

  const locateMe = () => {
    if (!navigator.geolocation) { setLocateMsg('이 브라우저는 위치 기능을 지원하지 않아요.'); return; }
    setLocating(true);
    setLocateMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (onLocateRef.current) onLocateRef.current(p);
        else mapRef.current?.setView([p.lat, p.lng], 15);
      },
      (err) => {
        setLocating(false);
        setLocateMsg(err.code === 1 ? '위치 권한이 거부되었어요.' : '현재 위치를 가져오지 못했어요.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  // 현재 표시 매장의 업종 범례(상위 6종)
  const legend = useMemo(() => {
    const counts = {};
    mappable.forEach(s => { if (s.business_type) counts[s.business_type] = (counts[s.business_type] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([code]) => ({ code, ...bizIcon(code), label: bizLabel(code) }));
  }, [mappable]);

  const ctrlBtn = 'w-10 h-10 flex items-center justify-center rounded-xl bg-white/95 text-gray-700 shadow-md border border-gray-100 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50';

  return (
    <div className="relative">
      <div
        ref={elRef}
        role="region"
        aria-label={`매장 지도, ${mappable.length}개 매장 표시`}
        className={`w-full ${className} rounded-3xl overflow-hidden border border-gray-100 shadow-sm bg-gray-100 z-0`}
      />
      {status === 'ready' && (
        <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
          <button type="button" onClick={locateMe} disabled={locating} className={ctrlBtn} aria-label="내 위치로 이동" title="내 위치로 이동">
            <LocateFixed size={18} className={locating ? 'animate-pulse' : ''} />
          </button>
          <button type="button" onClick={fitAll} disabled={mappable.length === 0 && !coords} className={ctrlBtn} aria-label="전체 매장 보기" title="전체 매장 보기">
            <Maximize2 size={18} />
          </button>
        </div>
      )}
      {status === 'ready' && (locateMsg || missingCount > 0) && (
        <div className="absolute top-3 left-14 z-[400] max-w-[calc(100%-120px)] bg-white/90 backdrop-blur rounded-xl shadow-md border border-gray-100 px-3 py-2 text-[11px] font-bold text-gray-600" role="status">
          {locateMsg || `위치 정보가 없는 매장 ${missingCount}곳은 지도에 표시되지 않아요.`}
        </div>
      )}
      {status === 'ready' && legend.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur rounded-xl shadow-md border border-gray-100 px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 max-w-[calc(100%-24px)]">
          {legend.map(l => (
            <span key={l.code} className="flex items-center gap-1 text-[11px] font-bold text-gray-600">
              <span aria-hidden="true">{l.e}</span> {l.label}
            </span>
          ))}
        </div>
      )}
      {status === 'ready' && stores.length > 0 && mappable.length === 0 && (
        <div className="absolute inset-0 z-[401] flex items-center justify-center pointer-events-none">
          <p className="bg-white/95 rounded-xl shadow px-4 py-2 text-sm text-gray-600 font-bold">지도에 표시할 위치 정보가 있는 매장이 없어요.</p>
        </div>
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-3xl" role="status">
          <p className="text-sm text-gray-500 font-bold">지도를 불러오는 중…</p>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-3xl" role="alert">
          <p className="text-sm text-gray-500 font-bold">지도를 불러오지 못했어요. 리스트/그리드로 확인해 주세요.</p>
        </div>
      )}
    </div>
  );
}
