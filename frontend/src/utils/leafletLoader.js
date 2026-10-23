/**
 * Leaflet / MarkerCluster CDN 로더 — npm 의존성 없이 지도가 필요한 화면에서만 지연 로드한다.
 * SRI 해시로 변조된 CDN 파일 로드를 차단한다 (unpkg 원본에서 계산한 sha512).
 */
const ASSETS = {
  leafletCss: {
    href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    integrity:
      'sha512-Zcn6bjR/8RZbLEpLIeOwNtzREBAJnUKESxces60Mpoj+2okopSAcSUIUOseddDm0cxnGQzxIR7vJgsLZbdLE3w==',
  },
  leafletJs: {
    src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    integrity:
      'sha512-BwHfrr4c9kmRkLw6iXFdzcdWV/PGkVgiIyIWLLlTSXzWQzxuSg4DiQUCpauz/EWjgk5TYQqX/kvn9pG1NpYfqg==',
  },
  clusterCss: {
    href: 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    integrity:
      'sha512-mQ77VzAakzdpWdgfL/lM1ksNy89uFgibRQANsNneSTMD/bj0Y/8+94XMwYhnbzx8eki2hrbPpDm0vD0CiT2lcg==',
  },
  clusterDefaultCss: {
    href: 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    integrity:
      'sha512-6ZCLMiYwTeli2rVh3XAPxy3YoR5fVxGdH/pz+KMCzRY2M65Emgkw00Yqmhh8qLGeYQ3LbVZGdmOX9KUjSKr0TA==',
  },
  clusterJs: {
    src: 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
    integrity:
      'sha512-OFs3W4DIZ5ZkrDhBFtsCP6JXtMEDGmhl0QPlmWYBJay40TT1n3gt2Xuw8Pf/iezgW9CdabjkNChRqozl/YADmg==',
  },
};

/**
 * 타일 레이어 설정 — 제공자 교체 시 이 한 곳만 수정한다.
 * 주의: OSM 공식 타일은 대량 상업 트래픽용이 아니다(타일 사용 정책). 트래픽이 커지면 유료/자체 타일로 교체.
 */
const env = import.meta.env || {};
// 운영 타일 제공자는 빌드 환경변수로 교체한다 (예: VWorld·유료 OSM 타일). 미설정 시 OSM 공식 타일.
export const TILE_LAYER = {
  url: env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    attribution: env.VITE_MAP_TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors',
    maxZoom: Number(env.VITE_MAP_TILE_MAX_ZOOM) || 19,
    ...(env.VITE_MAP_TILE_SUBDOMAINS ? { subdomains: env.VITE_MAP_TILE_SUBDOMAINS } : {}),
  },
};

/** 좌표가 숫자이고 대한민국 대략 범위(제주·독도 포함) 안인지 */
export function isValidKoreaCoord(lat, lng) {
  const la = typeof lat === 'string' ? Number(lat) : lat;
  const lo = typeof lng === 'string' ? Number(lng) : lng;
  return Number.isFinite(la) && Number.isFinite(lo) && la > 33 && la < 39 && lo > 124 && lo < 132;
}

/** 외부 길찾기 링크 (카카오맵 / 네이버 지도) */
export function externalMapLinks(name, lat, lng) {
  const label = encodeURIComponent(name || '매장');
  return {
    kakao: `https://map.kakao.com/link/to/${label},${lat},${lng}`,
    naver: `https://map.naver.com/p/directions/-/${lng},${lat},${label},,/-/car`,
  };
}

export const DEFAULT_CENTER = [37.5665, 126.978]; // 서울시청

function injectCss({ href, integrity }) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.integrity = integrity;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

function loadScript({ src, integrity }) {
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${src}"]`);
    if (script) {
      if (script.dataset.loaded === 'true') return resolve();
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error(`load failed: ${src}`)), {
        once: true,
      });
      return;
    }
    script = document.createElement('script');
    script.src = src;
    script.integrity = integrity;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      () => {
        // 실패한 태그를 제거해 다음 마운트에서 재시도할 수 있게 한다
        script.remove();
        reject(new Error(`load failed: ${src}`));
      },
      { once: true }
    );
    document.head.appendChild(script);
  });
}

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  injectCss(ASSETS.leafletCss);
  return loadScript(ASSETS.leafletJs).then(() => window.L);
}

export function loadMarkerCluster() {
  return loadLeaflet().then((L) => {
    if (L.markerClusterGroup) return L;
    injectCss(ASSETS.clusterCss);
    injectCss(ASSETS.clusterDefaultCss);
    return loadScript(ASSETS.clusterJs).then(() => L);
  });
}
