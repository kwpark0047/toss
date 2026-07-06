import { useEffect, useRef, useState } from 'react';

/**
 * StoreMapLeaflet — API 키 없이 동작하는 OpenStreetMap(Leaflet) 지도.
 * Leaflet을 CDN에서 동적 로드하므로 npm 설치가 필요 없다.
 * props: stores(좌표 포함), coords(고객위치), onSelect(store)
 */
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
// leaflet@1.9.4 공식 배포 SRI 해시 (변조된 CDN 파일 로드 차단)
const LEAFLET_CSS_SRI = 'sha512-Zcn6bjR/8RZbLEpLIeOwNtzREBAJnUKESxces60Mpoj+2okopSAcSUIUOseddDm0cxnGQzxIR7vJgsLZbdLE3w==';
const LEAFLET_JS_SRI = 'sha512-BwHfrr4c9kmRkLw6iXFdzcdWV/PGkVgiIyIWLLlTSXzWQzxuSg4DiQUCpauz/EWjgk5TYQqX/kvn9pG1NpYfqg==';

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.integrity = LEAFLET_CSS_SRI;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
    let script = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (script && window.L) return resolve(window.L);
    if (!script) {
      script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.integrity = LEAFLET_JS_SRI;
      script.crossOrigin = 'anonymous';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => resolve(window.L));
    script.addEventListener('error', reject);
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
    bt.textContent = s.business_type;
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
    loadLeaflet()
      .then((L) => {
        if (cancelled || !elRef.current || mapRef.current) return;
        const map = L.map(elRef.current, { scrollWheelZoom: false }).setView([37.5665, 126.978], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
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

    // 매장 마커 (오렌지 핀)
    const orangeIcon = L.divIcon({
      className: '',
      html: `<div style="width:30px;height:30px;background:linear-gradient(135deg,#f97316,#e11d48);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:#fff;border-radius:50%;transform:rotate(45deg)"></div></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });

    stores.forEach((s) => {
      if (s.latitude == null || s.longitude == null) return;
      const m = L.marker([s.latitude, s.longitude], { icon: orangeIcon, title: s.name }).addTo(layer);
      // 팝업은 DOM API로 구성해 매장 데이터를 안전하게 이스케이프(XSS 방지)
      m.bindPopup(buildPopup(s));
      m.on('click', () => onSelect?.(s));
      pts.push([s.latitude, s.longitude]);
    });

    // 고객 위치 마커 (파란 점)
    if (coords) {
      const blueDot = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,.3)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
      L.marker([coords.lat, coords.lng], { icon: blueDot, title: '내 위치' }).addTo(layer);
      pts.push([coords.lat, coords.lng]);
    }

    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
  }, [stores, coords, status, onSelect]);

  return (
    <div className="relative">
      <div ref={elRef} className="w-full h-[420px] rounded-3xl overflow-hidden border border-gray-100 shadow-sm bg-gray-100 z-0" />
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
