/**
 * 강남역 테스트 사업자 계정 10개 + 실제 강남역 맛집을 본뜬 매장 시드
 *
 * 계정 (i = 1..10)
 *   전화번호  0101234567{0+i} → 01012345671 ~ 01012345680
 *   이메일    test{i}@wemarket.kr
 *   비밀번호  test + 전화번호 → test01012345671 ~ test01012345680
 *
 * 매장 데이터: scripts/seed-data/gangnam-test-stores.js
 *   매장 정보, 요일별 영업시간, 테이블, 카테고리/메뉴, 쿠폰, 소식, 리뷰, 예약
 * 사진: scripts/seed-data/gangnam-test-images.json (네이버 플레이스 이미지, 네이버 리사이즈 URL로 링크)
 *
 * 사용법
 *   node scripts/seed_gangnam_test_owners.js                 # 대상 DB와 계획만 출력 (쓰기 없음)
 *   node scripts/seed_gangnam_test_owners.js --apply         # 로컬 DB에 적용
 *   node scripts/seed_gangnam_test_owners.js --apply --reset # 이미 있는 테스트 매장을 지우고 다시 생성
 *   원격 DB(Supabase 등)는 --allow-remote 를 함께 줘야 실행된다.
 *
 * 전화번호는 실행 환경의 PHONE_ENC_KEY/JWT_SECRET 으로 암호화된다. 원격 DB에 넣을 때 키가
 * 운영 서버와 다르면 --plain-phone 으로 평문(숫자만) 저장하라. 로그인 시 서버가 현행 키로 재암호화한다.
 */
// SEED_ENV_FILE=.env.production 처럼 다른 env 파일을 지정할 수 있다
require('dotenv').config({ path: process.env.SEED_ENV_FILE || '.env', quiet: true });

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const STORES = require('./seed-data/gangnam-test-stores');
const IMAGES = require('./seed-data/gangnam-test-images.json');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const RESET = args.has('--reset');
const ALLOW_REMOTE = args.has('--allow-remote');
const PLAIN_PHONE = args.has('--plain-phone');

const DAY_LABELS = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };

const accountFor = (i) => ({
  name: `강남테스트사장${i}`,
  email: `test${i}@wemarket.kr`,
  phone: `010123456${70 + i}`,
  password: `test010123456${70 + i}`,
});

const targetHost = () => {
  try {
    return new URL(process.env.DATABASE_URL).hostname;
  } catch {
    return '(DATABASE_URL 없음)';
  }
};
const isLocalHost = (host) => ['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(host);

// 원본(수 MB)을 그대로 쓰지 않고 네이버 이미지 리사이즈 프록시로 링크한다
const naverImage = (url, width = 560) =>
  url
    ? `https://search.pstatic.net/common/?autoRotate=true&type=w${width}_sharpen&src=${encodeURIComponent(url)}`
    : null;

const hoursSummary = (hours) =>
  Object.entries(hours)
    .map(([d, h]) => `${DAY_LABELS[d]} ${h.closed ? '휴무' : `${h.open}~${h.close}`}`)
    .join(', ');

function buildTables(storeIdx, spec) {
  const rows = [];
  const add = (label, capacity) => {
    const n = rows.length;
    rows.push({
      table_number: label,
      capacity,
      qr_code: `SEED-GN${storeIdx}-${n + 1}-${crypto.randomBytes(4).toString('hex')}`,
      x: (n % 4) * 150,
      y: Math.floor(n / 4) * 150,
    });
  };
  for (let i = 1; i <= (spec.hall || 0); i++) add(`${i}번`, i % 3 === 0 ? 6 : 4);
  for (let i = 1; i <= (spec.rooms || 0); i++) add(`룸${i}`, spec.roomCapacity || 6);
  for (let i = 1; i <= (spec.bar || 0); i++) add(`바${i}`, 1);
  return rows;
}

async function seedStore(prisma, encryptPhone, userId, idx, data) {
  const s = data.store;
  const images = IMAGES[s.naverPlaceId] || { store: [], menu: {} };
  const testPhone = accountFor(idx).phone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
  const theme = {
    primaryColor: s.theme.primaryColor,
    logoText: s.name,
    bannerImageUrl: naverImage(images.store[0], 1080),
    announcementActive: true,
    announcement: s.hoursNote,
  };

  return prisma.$transaction(async (tx) => {
    const store = await tx.stores.create({
      data: {
        user_id: userId,
        name: s.name,
        description: `${s.description}\n\n영업시간: ${hoursSummary(s.hours)}\n${s.hoursNote}`,
        address: s.address,
        phone: testPhone, // 실제 매장 번호 대신 계정 테스트 번호
        latitude: s.latitude,
        longitude: s.longitude,
        theme: JSON.stringify(theme),
        plan: 'free',
        is_active: true,
        store_operating_hours: {
          create: {
            open_time: s.hours.mon.closed ? '11:00' : s.hours.mon.open,
            close_time: s.hours.mon.closed ? '21:00' : s.hours.mon.close,
            business_hours: JSON.stringify(s.hours),
          },
        },
        store_business_info: {
          create: {
            business_type: s.category,
            business_name: s.name,
            ceo_name: `강남테스트사장${idx}`,
            business_address: s.address,
            customer_service_phone: testPhone,
          },
        },
      },
    });

    await tx.tables.createMany({
      data: buildTables(idx, data.tables).map((t) => ({ ...t, store_id: store.id })),
    });

    let productNo = 0;
    for (const [ci, cat] of data.categories.entries()) {
      const category = await tx.categories.create({
        data: { store_id: store.id, name: cat.name, sort_order: ci + 1 },
      });
      await tx.products.createMany({
        data: cat.items.map(([name, price, description, opts = {}], pi) => {
          productNo += 1;
          return {
            store_id: store.id,
            category_id: category.id,
            name,
            price,
            description: description || null,
            image_url: naverImage(images.menu[name]),
            sort_order: pi + 1,
            is_popular: opts.popular ? 1 : 0,
            spicy_level: opts.spicy || 0,
            cooking_time: opts.cookingTime || 10,
          };
        }),
      });
    }

    await tx.coupons.createMany({
      data: data.coupons.map((c) => ({ ...c, store_id: store.id, valid_days: 30, is_active: 1 })),
    });

    await tx.community_posts.createMany({
      data: data.news.map(([title, content, type], n) => ({
        store_id: store.id,
        type,
        title,
        content,
        district: '강남역',
        created_at: new Date(Date.now() - (n + 1) * 2 * 86400000),
      })),
    });

    const reviewers = ['김*진', '이*수', '박*연', '최*호', '정*아'];
    await tx.reviews.createMany({
      data: data.reviews.map(([rating, content], n) => ({
        store_id: store.id,
        customer_name: reviewers[n % reviewers.length],
        rating,
        content,
        created_at: new Date(Date.now() - (n + 1) * 5 * 86400000),
      })),
    });

    // 예약: 영업하는 날 저녁 시간대로 3건
    const reservations = [];
    for (let d = 1; reservations.length < 3 && d <= 14; d++) {
      const date = new Date(Date.now() + d * 86400000);
      const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
      const h = s.hours[dayKey];
      if (h.closed) continue;
      const [oh] = h.open.split(':').map(Number);
      date.setHours(Math.max(oh + 1, 18), 0, 0, 0);
      const n = reservations.length;
      reservations.push({
        store_id: store.id,
        customer_name: ['홍*동', '강*민', '윤*서'][n],
        customer_phone: encryptPhone(`0100000${String(idx).padStart(2, '0')}${n + 1}${n + 1}`),
        party_size: [2, 4, 6][n],
        reservation_time: date,
        status: n === 0 ? 'CONFIRMED' : 'PENDING',
        notes: n === 2 ? '단체 모임입니다. 자리를 붙여주세요.' : null,
      });
    }
    await tx.reservations.createMany({ data: reservations });

    return { store, productCount: productNo, tableCount: buildTables(idx, data.tables).length };
  });
}

async function main() {
  const host = targetHost();
  console.log(`[SEED] 대상 DB 호스트: ${host}`);
  console.log(
    `[SEED] 모드: ${APPLY ? '적용' : '계획만 출력(--apply 없음)'}${RESET ? ' + 기존 테스트 매장 재생성' : ''}`
  );

  STORES.forEach((d, n) => {
    const a = accountFor(n + 1);
    console.log(`  ${n + 1}. ${a.phone} / ${a.email} → ${d.store.name}`);
  });

  if (!APPLY) return;
  if (!isLocalHost(host) && !ALLOW_REMOTE) {
    console.error('[SEED] 원격 DB입니다. 정말 넣으려면 --allow-remote 를 추가하세요.');
    process.exitCode = 1;
    return;
  }

  const prisma = require('../config/prisma');
  const { encryptPhone: encrypt, phoneSearchCandidates } = require('../utils/phoneEncryption');
  const encryptPhone = PLAIN_PHONE ? (p) => p : encrypt;

  try {
    for (const [n, data] of STORES.entries()) {
      const idx = n + 1;
      const a = accountFor(idx);

      const phoneOwner = await prisma.users.findFirst({
        where: { phone: { in: phoneSearchCandidates(a.phone) } },
        select: { id: true, email: true },
      });
      if (phoneOwner && phoneOwner.email?.toLowerCase() !== a.email) {
        console.error(
          `[SEED] ${a.phone} 는 이미 다른 계정(${phoneOwner.email || phoneOwner.id})이 사용 중이라 건너뜁니다.`
        );
        continue;
      }

      const passwordHash = await bcrypt.hash(a.password, 12);
      const now = new Date();
      const user = await prisma.users.upsert({
        where: { email: a.email },
        update: { name: a.name, phone: encryptPhone(a.phone), password: passwordHash },
        create: {
          name: a.name,
          email: a.email,
          phone: encryptPhone(a.phone),
          password: passwordHash,
          role: 'user',
          profile_step: 1,
          password_login_enabled: true,
          email_verified_at: now,
          business_access_status: 'approved',
          business_approved_at: now,
        },
      });

      const existing = await prisma.stores.findFirst({
        where: { user_id: user.id, name: data.store.name },
        select: { id: true },
      });
      if (existing && !RESET) {
        console.log(`[SEED] ${idx}. ${data.store.name} 이미 존재 (store #${existing.id}) — 건너뜀`);
        continue;
      }
      if (existing) await prisma.stores.delete({ where: { id: existing.id } });

      const { store, productCount, tableCount } = await seedStore(
        prisma,
        encryptPhone,
        user.id,
        idx,
        data
      );
      console.log(
        `[SEED] ${idx}. ${store.name} (store #${store.id}, user #${user.id}) 메뉴 ${productCount}개, 테이블 ${tableCount}개`
      );
    }
    console.log('[SEED] 완료');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[SEED] 실패:', err);
  process.exit(1);
});
