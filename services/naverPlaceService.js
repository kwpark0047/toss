const axios = require('axios');
const logger = require('../utils/logger');

/**
 * 네이버 플레이스 연동 서비스.
 * 기존 naverLocalService(지역검색)로 매장을 찾아 네이버 플레이스 URL/ID를 제공한다.
 * 리뷰 데이터는 네이버 공식 Open API로 제공되지 않으므로 플레이스 링크로
 * 사용자를 안내한다 (저작권·ToS 준수).
 *
 * 필요한 환경변수:
 *   NAVER_CLIENT_ID     (developers.naver.com 애플리케이션)
 *   NAVER_CLIENT_SECRET
 */
const CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const SEARCH_ENDPOINT = 'https://openapi.naver.com/v1/search/local';

function isConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

const stripTags = (s = '') => s.replace(/<[^>]+>/g, '').trim();
const normalize = (s = '') =>
  stripTags(s).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[\s·.,'"-]/g, '');

function regionHint(address = '') {
  const m = address.match(/([가-힣]+(시|도))?\s*([가-힣]+(시|군|구))?\s*([가-힣]+(동|읍|면|가|로|길))?/);
  return m ? m[0].trim() : '';
}

/**
 * 상호명 + 주소로 네이버 플레이스 정보 검색.
 * @param {string} name - 매장 상호명
 * @param {string} [address] - 매장 주소 (검색 정확도 향상)
 * @returns {Promise<{naverPlaceUrl: string, title: string, category: string, telephone: string, address: string, roadAddress: string}|null>}
 */
async function searchPlace(name, address) {
  if (!isConfigured()) {
    logger.warn('[naverPlace] NAVER_CLIENT_ID/SECRET 미설정');
    return null;
  }
  if (!name) return null;

  const query = [name, regionHint(address || '')].filter(Boolean).join(' ');

  try {
    const res = await axios.get(SEARCH_ENDPOINT, {
      params: { query, display: 5, sort: 'random' },
      headers: {
        'X-Naver-Client-Id': CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
      },
      timeout: 8000,
    });

    const items = res.data?.items || [];
    if (!items.length) return null;

    // 상호명 정규화 비교로 최적 후보 선택
    const target = normalize(name);
    const best = items.find(it => {
      const n = normalize(it.title);
      return n && (n === target || n.includes(target) || target.includes(n));
    }) || items[0]; // fallback to first result

    const title = stripTags(best.title);
    const link = best.link || '';

    return {
      naverPlaceUrl: link,
      title,
      category: best.category || '',
      telephone: best.telephone || '',
      address: best.address || '',
      roadAddress: best.roadAddress || '',
      mapx: best.mapx ? Number(best.mapx) / 1e7 : null,
      mapy: best.mapy ? Number(best.mapy) / 1e7 : null,
    };
  } catch (err) {
    logger.error({ error: err.message }, '[naverPlace] 검색 실패');
    return null;
  }
}

module.exports = { isConfigured, searchPlace };
