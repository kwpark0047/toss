const axios = require('axios');

/**
 * 주소 → 좌표(WGS84) 지오코딩. 카카오 로컬 REST(1순위) 또는 네이버 NCP(대안).
 * env:
 *   KAKAO_REST_API_KEY               (카카오 developers REST 키)
 *   NCP_GEOCODE_KEY_ID / NCP_GEOCODE_KEY  (네이버 클라우드 플랫폼 Maps)
 */
const KAKAO_KEY = () => process.env.KAKAO_REST_API_KEY || '';
const NCP_ID = () => process.env.NCP_GEOCODE_KEY_ID || '';
const NCP_KEY = () => process.env.NCP_GEOCODE_KEY || '';

function provider() {
  if (KAKAO_KEY()) return 'kakao';
  if (NCP_ID() && NCP_KEY()) return 'ncp';
  return null;
}
function isConfigured() {
  return provider() !== null;
}

// 현재 환경변수 기준 설정 상태 진단 (관리자 상태 조회용)
function configStatus() {
  const kakao = !!KAKAO_KEY();
  const ncpId = !!NCP_ID();
  const ncpKey = !!NCP_KEY();
  const ncpConfigured = ncpId && ncpKey;
  const ncpIncomplete = (ncpId || ncpKey) && !ncpConfigured;
  const missing = [];
  if (!kakao && !ncpConfigured) {
    missing.push('KAKAO_REST_API_KEY');
    if (ncpIncomplete) missing.push('NCP_GEOCODE_KEY_ID', 'NCP_GEOCODE_KEY');
  }
  const p = provider();
  return {
    configured: isConfigured(),
    provider: p,
    availableProviders: p ? [p] : [],
    kakaoConfigured: kakao,
    ncpConfigured,
    ncpIncomplete,
    missing,
  };
}

// 지오코딩 정확도를 위해 주소 정제: 괄호(법정동/층) 먼저 제거 → 쉼표 이후(호/층) 제거
function cleanAddress(addr = '') {
  return String(addr)
    .replace(/\([^)]*\)/g, ' ') // "(교남동,지상1층)" 등 괄호 먼저 제거(내부 쉼표 보호)
    .split(',')[0] // "…30, 1층,2층" → "…30"
    .replace(/\s+/g, ' ')
    .trim();
}

const inSeoulish = (lat, lng) => lat > 33 && lat < 39 && lng > 124 && lng < 132; // 한국 대략 범위

async function kakaoGeocode(query) {
  const headers = { Authorization: `KakaoAK ${KAKAO_KEY()}` };
  // 1) 주소 검색
  try {
    const r = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
      params: { query, size: 1 },
      headers,
      timeout: 8000,
    });
    const doc = r.data?.documents?.[0];
    if (doc) return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch {
    /* 주소 검색 실패 시 키워드 폴백 */
  }
  // 2) 키워드 검색(건물명 포함 주소 대응)
  try {
    const r2 = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: { query, size: 1 },
      headers,
      timeout: 8000,
    });
    const doc2 = r2.data?.documents?.[0];
    if (doc2) return { lat: parseFloat(doc2.y), lng: parseFloat(doc2.x) };
  } catch {
    /* 카카오 전체 실패 → NCP 폴백 가능하도록 null 반환 */
  }
  return null;
}

async function ncpGeocode(query) {
  const r = await axios.get('https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode', {
    params: { query },
    headers: { 'X-NCP-APIGW-API-KEY-ID': NCP_ID(), 'X-NCP-APIGW-API-KEY': NCP_KEY() },
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
  let g = null;
  let p = null;
  // 카카오 우선 시도 → 실패 시 NCP로 폴백
  if (KAKAO_KEY()) {
    g = await kakaoGeocode(q);
    p = 'kakao';
  }
  if (!g && NCP_ID() && NCP_KEY()) {
    g = await ncpGeocode(q);
    p = 'ncp';
  }
  if (g && isFinite(g.lat) && isFinite(g.lng) && inSeoulish(g.lat, g.lng)) {
    return { lat: Math.round(g.lat * 1e6) / 1e6, lng: Math.round(g.lng * 1e6) / 1e6, provider: p };
  }
  return null;
}

// ── 주소 검색(후보 목록) — 사장님이 직접 고르는 용도라 도로명·지번·건물명 모두 허용 ──
const SEARCH_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX = 500;
const searchCache = new Map(); // query → { at, results } (반복 지오코딩 요청 최소화)

class GeocodeProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GeocodeProviderError';
    this.status = status; // 429 = 프로바이더 쿼터/속도 제한
  }
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

function toCandidate({ roadAddress, jibunAddress, placeName, zipCode, lat, lng, source }) {
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  if (!isFinite(la) || !isFinite(lo) || !inSeoulish(la, lo)) return null;
  return {
    roadAddress: roadAddress || null,
    jibunAddress: jibunAddress || null,
    placeName: placeName || null,
    zipCode: zipCode || null,
    lat: round6(la),
    lng: round6(lo),
    source,
  };
}

// Temporary auth diagnosis: never retain the Axios error, request headers, key,
// search text, or arbitrary response fields. Removed after the incident review.
function providerAuthDiagnostic(err, provider) {
  const credential = provider === 'kakao' ? KAKAO_KEY() : NCP_KEY();
  const secrets = [KAKAO_KEY(), NCP_ID(), NCP_KEY(), err?.config?.params?.query].filter(
    (value) => typeof value === 'string' && value.length > 0
  );
  const scrub = (value) => {
    if (typeof value !== 'string') return null;
    let text = value;
    for (const secret of secrets) {
      for (const form of new Set([secret, secret.trim(), encodeURIComponent(secret)])) {
        if (form) text = text.split(form).join('[REDACTED]');
      }
    }
    return require('../utils/logRedaction')
      .text(text)
      .replace(/\bKakaoAK\s+[^\s,;]+/gi, 'KakaoAK [REDACTED]')
      .replace(/\b[a-f0-9]{32,}\b/gi, '[REDACTED]')
      .replace(/[\r\n\t]/g, ' ')
      .slice(0, 400);
  };
  return {
    provider,
    upstreamStatus: err.response.status,
    errorType: scrub(err.response.data?.errorType || err.response.data?.error?.errorCode),
    upstreamMessage: scrub(err.response.data?.message || err.response.data?.error?.message),
    credential: {
      present: Boolean(credential),
      length: credential.length,
      surroundingWhitespace: credential !== credential.trim(),
      containsPrefix: credential.startsWith('KakaoAK'),
      fingerprint: credential
        ? require('node:crypto').createHash('sha256').update(credential).digest('hex').slice(0, 12)
        : null,
    },
  };
}

function rethrowProviderError(err, provider) {
  const status = err?.response?.status;
  if (status === 429)
    throw new GeocodeProviderError('주소 검색 요청이 많아요. 잠시 후 다시 시도해 주세요.', 429);
  if (status === 401 || status === 403) {
    const error = new GeocodeProviderError('주소 검색 서비스 인증에 실패했어요.', 503);
    Object.defineProperty(error, 'providerDiagnostic', {
      value: providerAuthDiagnostic(err, provider),
    });
    throw error;
  }
  throw new GeocodeProviderError('주소 검색 서비스에 연결하지 못했어요.', 502);
}

async function kakaoSearch(query, size) {
  const headers = { Authorization: `KakaoAK ${KAKAO_KEY()}` };
  const out = [];
  try {
    const r = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
      params: { query, size, analyze_type: 'similar' },
      headers,
      timeout: 8000,
    });
    for (const d of r.data?.documents || []) {
      out.push(
        toCandidate({
          roadAddress: d.road_address?.address_name,
          jibunAddress:
            d.address?.address_name || (d.address_type !== 'ROAD' ? d.address_name : null),
          placeName: d.road_address?.building_name,
          zipCode: d.road_address?.zone_no,
          lat: d.y,
          lng: d.x,
          source: 'kakao',
        })
      );
    }
  } catch (err) {
    rethrowProviderError(err, 'kakao');
  }
  // 주소 결과가 없으면 키워드(건물명·상호) 검색으로 보완
  if (out.filter(Boolean).length === 0) {
    try {
      const r2 = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
        params: { query, size },
        headers,
        timeout: 8000,
      });
      for (const d of r2.data?.documents || []) {
        out.push(
          toCandidate({
            roadAddress: d.road_address_name,
            jibunAddress: d.address_name,
            placeName: d.place_name,
            lat: d.y,
            lng: d.x,
            source: 'kakao',
          })
        );
      }
    } catch (err) {
      rethrowProviderError(err, 'kakao');
    }
  }
  return out.filter(Boolean);
}

async function ncpSearch(query, size) {
  try {
    const r = await axios.get('https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode', {
      params: { query, count: size },
      headers: { 'X-NCP-APIGW-API-KEY-ID': NCP_ID(), 'X-NCP-APIGW-API-KEY': NCP_KEY() },
      timeout: 8000,
    });
    return (r.data?.addresses || [])
      .map((a) =>
        toCandidate({
          roadAddress: a.roadAddress,
          jibunAddress: a.jibunAddress,
          zipCode: (a.addressElements || []).find((e) => e.types?.includes('POSTAL_CODE'))
            ?.longName,
          lat: a.y,
          lng: a.x,
          source: 'ncp',
        })
      )
      .filter(Boolean);
  } catch (err) {
    rethrowProviderError(err, 'ncp');
  }
}

/**
 * 주소/건물명 → 후보 목록. 카카오 우선, 결과 없음·오류 시 NCP 폴백.
 * @returns {Promise<Array<{roadAddress, jibunAddress, placeName, zipCode, lat, lng, source}>>}
 * @throws GeocodeProviderError (status 429/502/503)
 */
async function searchAddresses(rawQuery, { size = 10 } = {}) {
  const query = cleanAddress(rawQuery).slice(0, 100);
  if (query.length < 2) return [];
  const key = query.toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.results;

  let results = [];
  let lastError = null;
  if (KAKAO_KEY()) {
    try {
      results = await kakaoSearch(query, Math.min(size, 15));
    } catch (err) {
      lastError = err;
    }
  }
  if (results.length === 0 && NCP_ID() && NCP_KEY()) {
    try {
      results = await ncpSearch(query, Math.min(size, 15));
      lastError = null;
    } catch (err) {
      lastError = lastError || err;
    }
  }
  if (results.length === 0 && lastError) throw lastError;

  // 같은 좌표·주소 중복 제거
  const seen = new Set();
  results = results
    .filter((c) => {
      const k = `${c.roadAddress || c.jibunAddress}|${c.lat}|${c.lng}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, size);

  if (searchCache.size >= SEARCH_CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
  searchCache.set(key, { at: Date.now(), results });
  return results;
}

module.exports = {
  isConfigured,
  configStatus,
  provider,
  geocode,
  cleanAddress,
  searchAddresses,
  isKoreaCoord: inSeoulish,
  GeocodeProviderError,
  _searchCache: searchCache,
};
