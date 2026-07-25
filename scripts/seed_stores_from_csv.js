/**
 * 서울시 휴게음식점 인허가 CSV → stores 테이블 배치 등록
 *
 * 실행: node scripts/seed_stores_from_csv.js
 *
 * CSV 출처: 서울시 휴게음식점 인허가 정보 (공공데이터)
 * 좌표계: Korean TM (EPSG:5186) → WGS84 변환 (proj4)
 *
 * 매핑:
 *   사업장명        → stores.name
 *   도로명주소       → stores.address (fallback: 지번주소)
 *   전화번호        → stores.phone
 *   업태구분명       → stores.business_type
 *   좌표정보(Y,X)   → stores.latitude, stores.longitude (WGS84 변환)
 *
 * VARCHAR(20) 컬럼(business_number)에는 관리번호(24자)가 들어가지 않으므로 미사용.
 * VARCHAR(100) 컬럼(business_name)에도 사업장명 길이가 초과할 수 있어 미사용.
 * 추후 필요시 마이그레이션으로 컬럼 확장 후 매핑 가능.
 */

const prisma = require('../config/prisma');
const fs = require('fs');
const iconv = require('iconv-lite');
const proj4 = require('proj4');

// ── 좌표계 정의 ──────────────────────────────────────────────
// EPSG:5186 (Korea 2000 / Central Belt 2010) → WGS84
const TM_CENTRAL = '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs';
const WGS84 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';

// ── CSV 파서 (따옴표 처리) ──────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── 한국 TM → WGS84 변환 ──────────────────────────────────
function tmToWgs84(x, y) {
  try {
    const nx = parseFloat(x);
    const ny = parseFloat(y);
    if (isNaN(nx) || isNaN(ny)) return null;
    const [lng, lat] = proj4(TM_CENTRAL, WGS84, [nx, ny]);
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
}

// ── 전화번호 정리 ──────────────────────────────────────────
function cleanPhone(raw) {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/[^\d-]/g, '').trim();
  if (cleaned.length < 9) return null;
  return cleaned;
}

// ── 메인 ──────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  const defaultPath = 'D:\\Downloads\\서울시 휴게음식점 인허가 정보_수정260707.csv';
  const csvPath = process.argv[2] || defaultPath;
  const csvName = csvPath.split('\\').pop() || csvPath;
  console.log(`파일: ${csvName}`);
  console.log('='.repeat(60));

  // 1. CSV 읽기 (CP949 → UTF-8)
  if (!fs.existsSync(csvPath)) {
    console.error(`[오류] CSV 파일을 찾을 수 없음: ${csvPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(csvPath);
  const text = iconv.decode(raw, 'euc-kr');
  const lines = text.split('\n').filter(l => l.trim());
  console.log(`\n[1] CSV 로드 완료: ${lines.length - 1}행`);

  // 2. 파싱
  const rows = lines.slice(1);
  console.log(`[2] 파싱 완료: ${rows.length}행`);

  // 관리번호 중복 제거
  const seenMgmt = new Set();
  const uniqueRows = [];
  let dupCount = 0;
  for (const line of rows) {
    const cols = parseCSVLine(line);
    const mgmtNo = cols[1]?.trim() || '';
    if (seenMgmt.has(mgmtNo)) { dupCount++; continue; }
    seenMgmt.add(mgmtNo);
    uniqueRows.push(cols);
  }
  console.log(`     중복 관리번호 제거: ${dupCount}건`);
  console.log(`     등록 대상: ${uniqueRows.length}건`);

  // 3. 데이터 변환
  const BATCH_SIZE = 1000;
  let inserted = 0;
  let skipped = 0;
  let coordOk = 0;
  let coordNone = 0;
  const toInsert = [];

  for (const cols of uniqueRows) {
    const name     = cols[14]?.trim() || '';
    const roadAddr = cols[12]?.trim() || '';
    const lotAddr  = cols[11]?.trim() || '';
    const phoneRaw = cols[8]?.trim() || '';
    const bizType  = cols[18]?.trim() || '';
    const xRaw     = cols[19]?.trim();
    const yRaw     = cols[20]?.trim();

    if (!name) continue;

    let latitude = null, longitude = null;
    if (xRaw && yRaw) {
      const c = tmToWgs84(xRaw, yRaw);
      if (c) { latitude = c.latitude; longitude = c.longitude; coordOk++; }
      else { coordNone++; }
    } else { coordNone++; }

    toInsert.push({
      user_id: 1,
      name,
      address: roadAddr || lotAddr || null,
      phone: cleanPhone(phoneRaw),
      business_type: bizType || null,
      latitude,
      longitude,
      is_active: true,
    });

    if (toInsert.length >= BATCH_SIZE) {
      await flushBatch(toInsert);
      inserted += toInsert.length;
      toInsert.length = 0;
    }
  }
  if (toInsert.length > 0) {
    await flushBatch(toInsert);
    inserted += toInsert.length;
  }

  // 4. 요약
  console.log('\n' + '='.repeat(60));
  console.log('등록 완료');
  console.log('='.repeat(60));
  console.log(`  전체 CSV 행:        ${rows.length}`);
  console.log(`  중복 스킵(관리번호): ${dupCount}`);
  console.log(`  신규 등록:          ${inserted}`);
  console.log(`  좌표 변환 성공:     ${coordOk}`);
  console.log(`  좌표 없음:          ${coordNone}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

async function flushBatch(batch) {
  try {
    await prisma.stores.createMany({ data: batch, skipDuplicates: true });
  } catch (err) {
    console.error(`  [오류] 배치 실패 (${batch.length}건): ${err.message}`);
    for (const item of batch) {
      try {
        await prisma.stores.create({ data: item });
      } catch (singleErr) {
        console.error(`    → ${item.name}: ${singleErr.message}`);
      }
    }
  }
}

main().catch(err => {
  console.error('[치명적 오류]', err);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
