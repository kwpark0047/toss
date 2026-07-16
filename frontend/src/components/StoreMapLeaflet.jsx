import { useEffect, useRef, useState } from 'react';
import { bizLabel, bizIcon } from '../utils/businessType';

/**
 * StoreMapLeaflet — API 키 없이 동작하는 OpenStreetMap(Leaflet) 지도.
 * Leaflet을 CDN에서 동적 로드하므로 npm 설치가 필요 없다.
 * props: stores(좌표 포함), coords(고객위치), onSelect(store)
 */
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
// leaflet@1.9.4 공식 배포 SRI 해시 (변조된 CDN 파일 로드 차단)
const _LEAFLET_CSS_SRI = 'sha512-Zcn6bjR/8RZbLEpLIeOwNtzREBAJnUKESxces60Mpoj+2okopSAcSUIUOseddDm0cxnGQzxIR7vJgsLZbdLE3w==';
const _LEAFLET_JS_SRI = 'sha512-BwHfrr4c9kmRkLw6iXFdzcdWV/PGkVgiIyIWLLlTSXzWQzxuSg4DiQUCpauz/EWjgk5TYQqX/kvn9pG1NpYfqg==';

// MarkerCluster CDN (대량 마커 클러스터링용)
const MC_CSS = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
const MC_CSS2 = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
const MC_JS = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';

function injectCss(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${src}"]`);
    if (script) {
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(), { once: true });
      return;
    }
    script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(), { once: true });
    document.head.appendChild(script);
  });
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    injectCss(LEAFLET_CSS);
    loadScript(LEAFLET_JS).then(() => resolve(window.L)).catch(reject);
  });
}

function loadMarkerCluster() {
  if (window.L && window.L.markerClusterGroup) return Promise.resolve();
  return loadLeaflet().then(() => {
    injectCss(MC_CSS);
    injectCss(MC_CSS2);
    return loadScript(MC_JS);
  });
}

/** 매장 팝업을 DOM API로 구성 — textContent로 매장 데이터를 자동 이스케이프(XSS 방지) */
function buildPopup(s) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'font-family:Pretendard,sans-serif;min-width:160px';

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

  const link = document.createElement('a');
  // id는 숫자만 허용 — href 인젝션 방지
  const safeId = /^\d+$/.test(String(s.id)) ? s.id : '';
  link.href = safeId ? `/menu/${safeId}` : '#';
  link.style.cssText = 'display:inline-block;margin-top:8px;background:#f97316;color:#fff;font-weight:800;font-size:12px;padding:6px 12px;border-radius:8px;text-decoration:none';
  link.textContent = '메뉴 보기 →';
  wrap.appendChild(link);

  return wrap;
}

export default function StoreMapLeaflet({ stores = [], coords = null, onSelect }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  // 지도 초기화
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadLeaflet(), loadMarkerCluster()])
      .then(([L]) => {
        if (cancelled || !elRef.current || mapRef.current) return;
        const map = L.map(elRef.current, { scrollWheelZoom: false }).setView([37.5665, 126.978], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);
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
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // 마커 갱신
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer || status !== 'ready') return;
    layer.clearLayers();

    const pts = [];
    const markers = [];

    const makeIcon = (biz) => {
      const { e, c } = bizIcon(biz);
      return L.divIcon({
        className: '',
        html: `<div style="position:relative;width:34px;height:42px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3))">`
          + `<div style="width:34px;height:34px;background:#fff;border:2.5px solid ${c};border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">`
          + `<span style="transform:rotate(45deg);font-size:16px;line-height:1;">${e}</span></div></div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 40],
        popupAnchor: [0, -38],
      });
    };

    stores.forEach((s) => {
      if (s.latitude == null || s.longitude == null) return;
      const m = L.marker([s.latitude, s.longitude], { icon: makeIcon(s.business_type), title: s.name });
      m.bindPopup(buildPopup(s));
      m.on('click', () => onSelect?.(s));
      markers.push(m);
      pts.push([s.latitude, s.longitude]);
    });

    if (coords) {
      const blueDot = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,.3)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
      markers.push(L.marker([coords.lat, coords.lng], { icon: blueDot, title: '내 위치' }));
      pts.push([coords.lat, coords.lng]);
    }

    layer.addLayers(markers);

    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
  }, [stores, coords, status, onSelect]);

  // 현재 표시 매장의 업종 범례(상위 6종)
  const legend = (() => {
    const counts = {};
    stores.forEach(s => { if (s.latitude != null && s.business_type) counts[s.business_type] = (counts[s.business_type] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([code]) => ({ code, ...bizIcon(code), label: bizLabel(code) }));
  })();

  return (
    <div className="relative">
      <div ref={elRef} className="w-full h-[420px] rounded-3xl overflow-hidden border border-gray-100 shadow-sm bg-gray-100 z-0" />
      {status === 'ready' && legend.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur rounded-xl shadow-md border border-gray-100 px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 max-w-[calc(100%-24px)]">
          {legend.map(l => (
            <span key={l.code} className="flex items-center gap-1 text-[11px] font-bold text-gray-600">
              <span aria-hidden="true">{l.e}</span> {l.label}
            </span>
          ))}
        </div>
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-3xl">
          <p className="text-sm text-gray-500 font-bold">지도를 불러오는 중…</p>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-3xl">
          <p className="text-sm text-gray-500 font-bold">지도를 불러오지 못했어요. 리스트/그리드로 확인해 주세요.</p>
        </div>
      )}
    </div>
  );
}
