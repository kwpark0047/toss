const axios = require('axios');

/**
 * 주소 → 좌표(WGS84) 지오코딩. 카카오 로컬 REST(1순위) 또는 네이버 NCP(대안).
 * env:
 *   KAKAO_REST_API_KEY               (카카오 developers REST 키)
 *   NCP_GEOCODE_KEY_ID / NCP_GEOCODE_KEY  (네이버 클라우드 플랫폼 Maps)
 */
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY || '';
const NCP_ID = process.env.NCP_GEOCODE_KEY_ID || '';
const NCP_KEY = process.env.NCP_GEOCODE_KEY || '';

function provider() {
  if (KAKAO_KEY) return 'kakao';
  if (NCP_ID && NCP_KEY) return 'ncp';
  return null;
}
function isConfigured() { return provider() !== null; }

// 지오코딩 정확도를 위해 주소 정제: 괄호(법정동/층) 먼저 제거 → 쉼표 이후(호/층) 제거
function cleanAddress(addr = '') {
  return String(addr)
    .replace(/\([^)]*\)/g, ' ')  // "(교남동,지상1층)" 등 괄호 먼저 제거(내부 쉼표 보호)
    .split(',')[0]               // "…30, 1층,2층" → "…30"
    .replace(/\s+/g, ' ')
    .trim();
}

const inSeoulish = (lat, lng) => lat > 33 && lat < 39 && lng > 124 && lng < 132; // 한국 대략 범위

async function kakaoGeocode(query) {
  const headers = { Authorization: `KakaoAK ${KAKAO_KEY}` };
  // 1) 주소 검색
  try {
    const r = await axios.get('https://dapi.kakao.com/v2/local/search/address.json',
      { params: { query, size: 1 }, headers, timeout: 8000 });
    const doc = r.data?.documents?.[0];
    if (doc) return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch { /* 주소 검색 실패 시 키워드 폴백 */ }
  // 2) 키워드 검색(건물명 포함 주소 대응)
  const r2 = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json',
    { params: { query, size: 1 }, headers, timeout: 8000 });
  const doc2 = r2.data?.documents?.[0];
  if (doc2) return { lat: parseFloat(doc2.y), lng: parseFloat(doc2.x) };
  return null;
}

async function ncpGeocode(query) {
  const r = await axios.get('https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode', {
    params: { query },
    headers: { 'X-NCP-APIGW-API-KEY-ID': NCP_ID, 'X-NCP-APIGW-API-KEY': NCP_KEY },
    timeout: 8000,
  });
  const a = r.data?.addresses?.[0];
  if (a) return { lat: parseFloat(a.y), lng: parseFloat(a.x) };
  return null;
}

// 도로명 주소 여부(로/길 + 번호). 카카오는 도로명만 신뢰성 있게 지오코딩됨.
const isRoadAddress = (q = '') => /(로|길)\s*\d/.test(q);

/** 주소 문자열 → {lat, lng} | null. 도로명 주소만 처리(지번은 오매칭 방지 위해 skip) */
async function geocode(address) {
  const q = cleanAddress(address);
  if (!q || !isRoadAddress(q)) return null; // 지번/불명확 주소는 건너뜀
  const p = provider();
  let g = null;
  if (p === 'kakao') g = await kakaoGeocode(q);
  else if (p === 'ncp') g = await ncpGeocode(q);
  if (g && isFinite(g.lat) && isFinite(g.lng) && inSeoulish(g.lat, g.lng)) {
    return { lat: Math.round(g.lat * 1e6) / 1e6, lng: Math.round(g.lng * 1e6) / 1e6 };
  }
  return null;
}

module.exports = { isConfigured, provider, geocode, cleanAddress };
