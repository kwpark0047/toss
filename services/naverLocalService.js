const axios = require('axios');

/**
 * 네이버 지역검색 API 연동 (공식 Open API).
 * 상호 + 주소로 좌표·전화·업종·도로명주소 등 "공개 사업자 정보"만 보강한다.
 * 메뉴·사진·리뷰 등 UGC는 API로 제공되지 않으며 수집하지 않는다.
 *
 * 필요한 환경변수:
 *   NAVER_CLIENT_ID     (developers.naver.com 애플리케이션)
 *   NAVER_CLIENT_SECRET
 * 요청 한도: 지역검색 25,000 회/일 — 배치는 소량·지연으로 준수한다.
 */
// 자격증명은 환경변수로만 주입(하드코딩 금지). 둘 다 설정돼야 isConfigured()가 true.
const CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const ENDPOINT = 'https://openapi.naver.com/v1/search/local';

const stripTags = (s = '') => s.replace(/<[^>]+>/g, '').trim();

// 이름 정규화(공백·괄호영문·특수문자 제거)로 매칭 비교
const normalize = (s = '') =>
  stripTags(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s·.,'"-]/g, '');

// 주소에서 시/구/동 등 지역 토큰 추출 (검색 정확도 향상용)
function regionHint(address = '') {
  const m = address.match(
    /([가-힣]+(시|도))?\s*([가-힣]+(시|군|구))?\s*([가-힣]+(동|읍|면|가|로|길))?/
  );
  return m ? m[0].trim() : '';
}

function isConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

// 현재 환경변수 기준 설정 상태 진단 (관리자 상태 조회용)
function configStatus() {
  const id = process.env.NAVER_CLIENT_ID || '';
  const secret = process.env.NAVER_CLIENT_SECRET || '';
  const missing = [];
  if (!id) missing.push('NAVER_CLIENT_ID');
  if (!secret) missing.push('NAVER_CLIENT_SECRET');
  return { configured: missing.length === 0, missing };
}

/** 지역검색 호출 → items 배열(정규화 필드 포함) 반환 */
async function searchLocal(query) {
  if (!isConfigured())
    throw new Error('NAVER_CLIENT_SECRET 미설정 — 네이버 API 키를 환경변수에 설정하세요.');
  const res = await axios.get(ENDPOINT, {
    params: { query, display: 5, sort: 'random' },
    headers: { 'X-Naver-Client-Id': CLIENT_ID, 'X-Naver-Client-Secret': CLIENT_SECRET },
    timeout: 8000,
  });
  return (res.data?.items || []).map((it) => ({
    name: stripTags(it.title),
    category: it.category || '',
    telephone: it.telephone || '',
    address: it.address || '',
    roadAddress: it.roadAddress || '',
    // 지역검색 mapx/mapy: WGS84 좌표 × 1e7
    longitude: it.mapx ? Number(it.mapx) / 1e7 : null,
    latitude: it.mapy ? Number(it.mapy) / 1e7 : null,
  }));
}

/**
 * 매장 1건 보강 patch 계산 (기존 값은 덮어쓰지 않음).
 * 상호명이 충분히 일치하는 후보만 채택하여 오매칭을 방지한다.
 * @returns {Promise<{patch:object, matched:object}|null>}
 */
async function enrichStore(store) {
  const name = store.name || '';
  if (!name || /[?�]/.test(name)) return null; // 손상 이름은 스킵

  const query = [name, regionHint(store.address || '')].filter(Boolean).join(' ');
  const items = await searchLocal(query);
  if (!items.length) return null;

  // 상호명 정규화 비교로 최적 후보 선택
  const target = normalize(name);
  const best = items.find((it) => {
    const n = normalize(it.name);
    return n && (n === target || n.includes(target) || target.includes(n));
  });
  if (!best) return null;

  // 빈 필드만 채움
  const patch = {};
  if (store.latitude == null && best.latitude != null) patch.latitude = best.latitude;
  if (store.longitude == null && best.longitude != null) patch.longitude = best.longitude;
  if (!store.phone && best.telephone) patch.phone = best.telephone;
  if (!store.business_type && best.category)
    patch.business_type = best.category.split('>').pop().trim();
  if (Object.keys(patch).length === 0) return null;
  return { patch, matched: best };
}

module.exports = { isConfigured, configStatus, searchLocal, enrichStore, normalize, regionHint };
