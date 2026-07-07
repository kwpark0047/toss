/**
 * 한국 중부원점 TM(EPSG:2097/5174 계열) → WGS84(위경도) 역변환.
 * 서울 LOCALDATA X/Y 좌표 변환용. 외부 라이브러리 없이 표준 횡축메르카토르 역산.
 *
 * 파라미터(중부원점, FN=500000):
 *   lat0=38, lon0=127, k0=1, FE=200000, FN=500000
 * 타원체: GRS80 (a=6378137, 1/f=298.257222101)
 */
const A = 6378137.0;
const F = 1 / 298.257222101;
const K0 = 1.0;
const LAT0 = 38 * Math.PI / 180;
const LON0 = 127 * Math.PI / 180;
const FE = 200000;
const FN = 500000;

const E2 = F * (2 - F);          // 제1이심률^2
const EP2 = E2 / (1 - E2);       // 제2이심률^2

// 자오선호장 M(위도)
function meridian(lat) {
  return A * (
    (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 ** 3 / 256) * lat
    - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * lat)
    + (15 * E2 * E2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * lat)
    - (35 * E2 ** 3 / 3072) * Math.sin(6 * lat)
  );
}

/** TM(x=동거, y=북거) → { lat, lng } (도) */
function tmToWgs84(x, y) {
  const xx = Number(x); const yy = Number(y);
  if (!isFinite(xx) || !isFinite(yy)) return null;

  const M0 = meridian(LAT0);
  const M = M0 + (yy - FN) / K0;

  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 ** 3 / 256));

  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);

  const sinP = Math.sin(phi1), cosP = Math.cos(phi1), tanP = Math.tan(phi1);
  const N1 = A / Math.sqrt(1 - E2 * sinP * sinP);
  const T1 = tanP * tanP;
  const C1 = EP2 * cosP * cosP;
  const R1 = A * (1 - E2) / Math.pow(1 - E2 * sinP * sinP, 1.5);
  const D = (xx - FE) / (N1 * K0);

  const lat = phi1 - (N1 * tanP / R1) * (
    D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720
  );

  const lng = LON0 + (
    D
    - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120
  ) / cosP;

  return { lat: lat * 180 / Math.PI, lng: lng * 180 / Math.PI };
}

module.exports = { tmToWgs84 };
