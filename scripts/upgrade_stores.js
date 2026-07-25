/**
 * 공공데이터 stores 고도화 (전량 raw SQL)
 *
 * 1. business_type 한글→영문 표준화
 * 2. name 정제 + business_name 추출 (법인접두사 분리)
 * 3. null business_type 채움
 * 4. 전화번호 정리
 *
 * 실행: node scripts/upgrade_stores.js
 */

const prisma = require('../config/prisma');

async function main() {
  console.log('='.repeat(60));
  console.log('stores 데이터 고도화');
  console.log('='.repeat(60));

  const total = await prisma.stores.count({ where: { user_id: 1 } });
  console.log(`대상 stores(user_id=1): ${total}건\n`);

  // ───────── 1. business_type 한글→영문 ─────────
  console.log('[1] business_type 한글→영문 변환');
  // 언어코드 normalized_code로 매핑하고, 한글값은 영문코드로 변환
  const result1 = await prisma.$executeRawUnsafe(`
    UPDATE stores SET business_type = CASE business_type
      WHEN '한식' THEN 'korean'
      WHEN '기타' THEN 'etc'
      WHEN '커피숍' THEN 'cafe'
      WHEN '호프/통닭' THEN 'pub_chicken'
      WHEN '경양식' THEN 'western'
      WHEN '분식' THEN 'bunsik'
      WHEN '기타 휴게음식점' THEN 'etc_restaurant'
      WHEN '일식' THEN 'japanese'
      WHEN '편의점' THEN 'convenience'
      WHEN '중국식' THEN 'chinese'
      WHEN '일반조리판매' THEN 'general_cooking'
      WHEN '외국음식전문점(인도,태국등)' THEN 'foreign'
      WHEN '패스트푸드' THEN 'fast_food'
      WHEN '정종/대포집/소주방' THEN 'pub_alcohol'
      WHEN '통닭(치킨)' THEN 'chicken'
      WHEN '식육(숯불구이)' THEN 'bbq'
      WHEN '까페' THEN 'cafe'
      WHEN '다방' THEN 'tea_house'
      WHEN '횟집' THEN 'sashimi'
      WHEN '백화점' THEN 'department_store'
      WHEN '김밥(도시락)' THEN 'gimbap'
      WHEN '푸드트럭' THEN 'food_truck'
      WHEN '뷔페식' THEN 'buffet'
      WHEN '아이스크림' THEN 'ice_cream'
      WHEN '감성주점' THEN 'mood_pub'
      WHEN '냉면집' THEN 'naengmyeon'
      WHEN '패밀리레스트랑' THEN 'family_restaurant'
      WHEN '라이브카페' THEN 'live_cafe'
      WHEN '과자점' THEN 'snack_shop'
      WHEN '전통찻집' THEN 'traditional_tea'
      WHEN '떡카페' THEN 'tteok_cafe'
      WHEN '탕류(보신용)' THEN 'soup_health'
      WHEN '철도역구내' THEN 'station_area'
      WHEN '출장조리' THEN 'catering'
      WHEN '키즈카페' THEN 'kids_cafe'
      WHEN '복어취급' THEN 'blowfish'
      WHEN '극장' THEN 'theater'
      WHEN '유원지' THEN 'amusement_park'
      WHEN '관광호텔' THEN 'hotel'
      WHEN '이동조리' THEN 'mobile_cooking'
      WHEN '단란주점' THEN 'karaoke_pub'
      WHEN 'food_truck' THEN 'food_truck'
      WHEN '공항' THEN 'airport'
      WHEN '고속도로' THEN 'highway'
      ELSE business_type
    END
    WHERE user_id = 1 AND business_type IS NOT NULL
  `);
  console.log(`  영향받은 행: ${result1}`);

  // null → etc
  const rNull = await prisma.$executeRawUnsafe(
    `UPDATE stores SET business_type = 'etc' WHERE user_id = 1 AND business_type IS NULL`
  );
  if (rNull > 0) console.log(`  null→etc: ${rNull}건`);

  // ───────── 2. 법인접두사 분리 (SQL regex) ─────────
  console.log('\n[2] name 정제 + business_name 추출');

  // (주) 또는 (유) 로 시작하는 경우
  const rCorp = await prisma.$executeRawUnsafe(`
    UPDATE stores
    SET
      name = trim(substring(name FROM 4)),   -- "(주)" = 3자 + 공백
      business_name = CASE WHEN business_name IS NULL
        THEN substring(name FROM 1 FOR 100)
        ELSE business_name END
    WHERE user_id = 1
      AND (name LIKE '(주)%' OR name LIKE '(유)%')
      AND length(name) > 3
  `);
  if (rCorp > 0) console.log(`  (주)/(유) 접두사 분리: ${rCorp}건`);

  // "주식회사 " 로 시작하는 경우
  const rJk = await prisma.$executeRawUnsafe(`
    UPDATE stores
    SET
      name = trim(substring(name FROM 6)),   -- "주식회사 " = 5자 + 공백
      business_name = CASE WHEN business_name IS NULL
        THEN substring(name FROM 1 FOR 100)
        ELSE business_name END
    WHERE user_id = 1
      AND name LIKE '주식회사 %'
      AND length(name) > 5
  `);
  if (rJk > 0) console.log(`  주식회사 접두사 분리: ${rJk}건`);

  // ───────── 3. 전화번호 정리 ─────────────────────
  console.log('\n[3] 전화번호 포맷 정리');
  const rPhone = await prisma.$executeRawUnsafe(`
    UPDATE stores
    SET phone = regexp_replace(regexp_replace(
      phone, '[^0-9-]', '', 'g'
    ), '-{2,}', '-', 'g')
    WHERE user_id = 1 AND phone IS NOT NULL
      AND phone ~ '[^0-9-]'
  `);
  if (rPhone > 0) console.log(`  정리: ${rPhone}건`);

  // ───────── 4. 결과 검증 ─────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('고도화 결과');
  console.log('='.repeat(60));

  const afterMap = await prisma.stores.groupBy({
    by: ['business_type'],
    _count: true,
    where: { user_id: 1 },
    orderBy: { _count: { business_type: 'desc' } },
  });
  console.log('\n--- business_type 분포 ---');
  afterMap.forEach(b => console.log(`  ${b.business_type}: ${b._count}`));

  const withBizName = await prisma.stores.count({
    where: { user_id: 1, business_name: { not: null } },
  });
  console.log(`\nbusiness_name 있음: ${withBizName}건`);

  // 샘플
  const corpSamples = await prisma.stores.findMany({
    where: { user_id: 1, business_name: { not: null } },
    select: { id: true, name: true, business_name: true, business_type: true },
    take: 8,
  });
  console.log('\n--- 법인/상호 분리 샘플 ---');
  corpSamples.forEach(s =>
    console.log(`  [${s.id}] name='${s.name}' | 상호='${s.business_name}' | type=${s.business_type}`));

  // 전체 통계
  console.log(`\n--- 최종 stores 통계 ---`);
  const totalFinal = await prisma.stores.count();
  const user1Final = await prisma.stores.count({ where: { user_id: 1 } });
  const withCoord = await prisma.stores.count({ where: { latitude: { not: null } } });
  const withPhone = await prisma.stores.count({ where: { phone: { not: null } } });
  console.log(`  전체: ${totalFinal}`);
  console.log(`  공공데이터(user_id=1): ${user1Final}`);
  console.log(`  좌표: ${withCoord}`);
  console.log(`  전화: ${withPhone}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error('[오류]', e); prisma.$disconnect().catch(() => {}); process.exit(1); });
