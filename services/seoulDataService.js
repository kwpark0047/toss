const axios = require('axios');

/**
 * 서울 열린데이터광장 LOCALDATA(일반음식점 인허가) 연동.
 * 공식 오픈데이터로 상호(교정)·업종·전화·영업상태를 보강한다.
 * 여러 인증키를 로테이션해 일일 요청 한도를 분산한다.
 *
 * env: SEOUL_OPENAPI_KEYS (콤마 구분 다중 키)
 */
const SERVICE = 'LOCALDATA_072404'; // 일반음식점
const KEYS = (process.env.SEOUL_OPENAPI_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let keyIdx = 0;
const nextKey = () => { const k = KEYS[keyIdx % KEYS.length]; keyIdx++; return k; };

function isConfigured() { return KEYS.length > 0; }

// 페이지 조회 (start~end, 1-base). 최대 1000행/요청.
async function fetchPage(start, end) {
  if (!isConfigured()) throw new Error('SEOUL_OPENAPI_KEYS 미설정');
  const key = nextKey();
  const url = `http://openapi.seoul.go.kr:8088/${key}/json/${SERVICE}/${start}/${end}/`;
  const res = await axios.get(url, { timeout: 15000 });
  const body = res.data?.[SERVICE];
  if (!body) {
    const result = res.data?.RESULT || Object.values(res.data || {})[0]?.RESULT;
    throw new Error(`서울 API 오류: ${result?.CODE || '?'} ${result?.MESSAGE || ''}`);
  }
  return { total: body.list_total_count || 0, rows: body.row || [] };
}

// ── 정규화 헬퍼 ──────────────────────────────────────────────────────────
const clean = (s = '') => String(s).replace(/\s+/g, ' ').trim();

// 이름 정규화(비교용): 괄호영문·공백·특수문자 제거
function normName(s = '') {
  return clean(s).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[\s·.,'"\-()]/g, '');
}

// 주소에서 매칭 코어 추출: "동/가 + 지번" 또는 "로/길 + 건물번호"
function addrCore(addr = '') {
  const a = clean(addr).replace(/\([^)]*\)/g, ''); // 괄호(층/동) 제거
  // 지번: 역삼동 123-45
  const jibun = a.match(/([가-힣0-9]+(?:동|가|리))\s*(\d+(?:-\d+)?)/);
  if (jibun) return `${jibun[1]} ${jibun[2]}`;
  // 도로명: 상일로 131
  const road = a.match(/([가-힣0-9]+(?:로|길))\s*(\d+(?:-\d+)?)/);
  if (road) return `${road[1]} ${road[2]}`;
  return '';
}

const hasCorruptName = (s = '') => s.includes('?') || s.includes('�');

// 주소에서 법정동(동/가/리) 추출 — 우리 매장(도로명+"(동)")과 서울(지번) 공통 매칭키
function dongOf(addr = '') {
  const a = clean(addr).replace(/\([^)]*\)/g, ' ') + ' ' + clean(addr); // 괄호 안/밖 모두 탐색
  const m = a.match(/([가-힣]{1,10}(?:\d가|동|리))(?![가-힣])/);
  return m ? m[1] : '';
}

/** 서울 LOCALDATA 행 → 표준화 */
function mapRow(row) {
  return {
    name: clean(row.BPLCNM || ''),
    address: clean(row.RDNWHLADDR || row.SITEWHLADDR || ''),
    jibunAddr: clean(row.SITEWHLADDR || ''),
    roadAddr: clean(row.RDNWHLADDR || ''),
    businessType: clean(row.UPTAENM || ''),
    phone: clean(row.SITETEL || ''),
    state: clean(row.TRDSTATENM || ''), // 영업/폐업
    x: (row.X || '').trim(), // TM 동거
    y: (row.Y || '').trim(), // TM 북거
  };
}

module.exports = { isConfigured, fetchPage, mapRow, normName, addrCore, dongOf, hasCorruptName, keyCount: () => KEYS.length };
