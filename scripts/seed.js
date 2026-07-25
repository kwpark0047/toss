/**
 * 샘플 데이터 시딩 스크립트
 * 실행: node scripts/seed.js
 */

const db = require('../config/database');
const bcrypt = require('bcryptjs');

console.log('🌱 데이터베이스 시딩 시작...\n');

// 기존 데이터 삭제
console.log('기존 데이터 정리 중...');
db.exec('DELETE FROM order_items');
db.exec('DELETE FROM orders');
db.exec('DELETE FROM products');
db.exec('DELETE FROM categories');
db.exec('DELETE FROM tables');
db.exec('DELETE FROM stores');
db.exec('DELETE FROM users');

// 시퀀스 리셋
db.exec('DELETE FROM sqlite_sequence');

// 1. 사용자 생성
console.log('\n👤 사용자 생성 중...');
const password = bcrypt.hashSync('password123', 10);

const users = [
  { name: '김사장', email: 'owner@wemarket.kr', password },
  { name: '이매니저', email: 'manager@wemarket.kr', password },
  { name: '박테스터', email: 'test@wemarket.kr', password }
];

const userStmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
users.forEach(user => {
  userStmt.run(user.name, user.email, user.password);
  console.log(`  ✓ ${user.name} (${user.email})`);
});

// 2. 매장 생성
console.log('\n🏪 매장 생성 중...');
const stores = [
  {
    name: '위마켓 카페 강남점',
    description: '프리미엄 스페셜티 커피 전문점',
    address: '서울시 강남구 테헤란로 123',
    phone: '02-1234-5678',
    owner_id: 1,
    business_type: 'cafe',
    theme: JSON.stringify({
      primaryColor: '#f97316',
      secondaryColor: '#1e3a5f',
      fontFamily: 'Pretendard',
      logoText: '위마켓 카페'
    })
  },
  {
    name: '맛있는 분식',
    description: '엄마 손맛 그대로, 추억의 분식집',
    address: '서울시 마포구 홍대입구역 5번출구',
    phone: '02-9876-5432',
    owner_id: 1,
    business_type: 'restaurant',
    theme: JSON.stringify({
      primaryColor: '#ef4444',
      secondaryColor: '#1f2937',
      fontFamily: 'Noto Sans KR',
      logoText: '맛있는 분식'
    })
  },
  {
    name: '청년치킨 홍대점',
    description: '바삭바삭 청년들의 치킨',
    address: '서울시 마포구 와우산로 94',
    phone: '02-5555-1234',
    owner_id: 2,
    business_type: 'restaurant',
    theme: JSON.stringify({
      primaryColor: '#eab308',
      secondaryColor: '#292524',
      fontFamily: 'Pretendard',
      logoText: '청년치킨'
    })
  }
];

// 매장 테이블에 theme 컬럼 추가 (없으면)
try {
  db.exec('ALTER TABLE stores ADD COLUMN theme TEXT');
} catch {
  // 이미 존재하면 무시
}
try {
  db.exec('ALTER TABLE stores ADD COLUMN business_type TEXT');
} catch {
  // 이미 존재하면 무시
}

const storeStmt = db.prepare('INSERT INTO stores (name, description, address, phone, owner_id, business_type, theme, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
stores.forEach(store => {
  storeStmt.run(store.name, store.description, store.address, store.phone, store.owner_id, store.business_type, store.theme);
  console.log(`  ✓ ${store.name}`);
});

// 3. 카테고리 생성
console.log('\n📁 카테고리 생성 중...');
const categories = [
  // 카페 (store_id: 1)
  { store_id: 1, name: '시그니처', sort_order: 1 },
  { store_id: 1, name: '커피', sort_order: 2 },
  { store_id: 1, name: '논커피', sort_order: 3 },
  { store_id: 1, name: '에이드/스무디', sort_order: 4 },
  { store_id: 1, name: '디저트', sort_order: 5 },
  // 분식집 (store_id: 2)
  { store_id: 2, name: '떡볶이', sort_order: 1 },
  { store_id: 2, name: '튀김', sort_order: 2 },
  { store_id: 2, name: '김밥/만두', sort_order: 3 },
  { store_id: 2, name: '라면', sort_order: 4 },
  { store_id: 2, name: '음료', sort_order: 5 },
  // 치킨집 (store_id: 3)
  { store_id: 3, name: '후라이드', sort_order: 1 },
  { store_id: 3, name: '양념', sort_order: 2 },
  { store_id: 3, name: '순살', sort_order: 3 },
  { store_id: 3, name: '사이드', sort_order: 4 },
  { store_id: 3, name: '음료/주류', sort_order: 5 }
];

const catStmt = db.prepare('INSERT INTO categories (store_id, name, sort_order) VALUES (?, ?, ?)');
categories.forEach(cat => {
  catStmt.run(cat.store_id, cat.name, cat.sort_order);
});
console.log(`  ✓ ${categories.length}개 카테고리 생성됨`);

// 4. 상품 생성
console.log('\n🍽️ 상품 생성 중...');
const products = [
  // 카페 - 시그니처 (cat 1)
  { store_id: 1, category_id: 1, name: '위마켓 시그니처 라떼', price: 6500, description: '달콤한 캐러멜과 에스프레소의 완벽한 조화' },
  { store_id: 1, category_id: 1, name: '오렌지 블라썸', price: 7000, description: '상큼한 오렌지와 꽃향기가 어우러진 시그니처 음료' },
  { store_id: 1, category_id: 1, name: '로즈 라떼', price: 6800, description: '은은한 장미향이 가득한 프리미엄 라떼' },
  // 카페 - 커피 (cat 2)
  { store_id: 1, category_id: 2, name: '아메리카노', price: 4500, description: '깊고 진한 에스프레소의 풍미 (HOT/ICE)' },
  { store_id: 1, category_id: 2, name: '카페라떼', price: 5000, description: '부드러운 우유와 에스프레소의 조화' },
  { store_id: 1, category_id: 2, name: '바닐라 라떼', price: 5500, description: '달콤한 바닐라 시럽이 들어간 라떼' },
  { store_id: 1, category_id: 2, name: '카푸치노', price: 5000, description: '풍성한 우유 거품과 에스프레소' },
  { store_id: 1, category_id: 2, name: '카라멜 마끼아또', price: 5800, description: '카라멜 드리즐이 올라간 달콤한 라떼' },
  // 카페 - 논커피 (cat 3)
  { store_id: 1, category_id: 3, name: '초코 라떼', price: 5500, description: '진한 초콜릿과 우유의 달콤한 조화' },
  { store_id: 1, category_id: 3, name: '그린티 라떼', price: 5500, description: '녹차의 깊은 풍미를 담은 라떼' },
  { store_id: 1, category_id: 3, name: '고구마 라떼', price: 5800, description: '달콤한 고구마가 들어간 라떼' },
  // 카페 - 에이드 (cat 4)
  { store_id: 1, category_id: 4, name: '자몽 에이드', price: 5500, description: '상큼한 자몽이 가득한 에이드' },
  { store_id: 1, category_id: 4, name: '레몬 에이드', price: 5000, description: '시원하고 상큼한 레몬 에이드' },
  { store_id: 1, category_id: 4, name: '청포도 에이드', price: 5500, description: '달콤한 청포도 에이드' },
  { store_id: 1, category_id: 4, name: '망고 스무디', price: 6000, description: '신선한 망고로 만든 스무디' },
  // 카페 - 디저트 (cat 5)
  { store_id: 1, category_id: 5, name: '티라미수', price: 6500, description: '부드럽고 진한 마스카포네 티라미수' },
  { store_id: 1, category_id: 5, name: '치즈케이크', price: 6000, description: '뉴욕 스타일의 진한 치즈케이크' },
  { store_id: 1, category_id: 5, name: '크로플', price: 5500, description: '바삭한 크로와상 와플' },
  { store_id: 1, category_id: 5, name: '마카롱 세트', price: 8000, description: '다양한 맛의 마카롱 5개 세트' },

  // 분식집 - 떡볶이 (cat 6)
  { store_id: 2, category_id: 6, name: '오리지널 떡볶이', price: 4500, description: '매콤달콤 전통 떡볶이' },
  { store_id: 2, category_id: 6, name: '치즈 떡볶이', price: 6000, description: '치즈가 듬뿍 올라간 떡볶이' },
  { store_id: 2, category_id: 6, name: '로제 떡볶이', price: 6500, description: '크리미한 로제 소스 떡볶이' },
  { store_id: 2, category_id: 6, name: '짜장 떡볶이', price: 5500, description: '짜장 소스로 맛을 낸 떡볶이' },
  // 분식집 - 튀김 (cat 7)
  { store_id: 2, category_id: 7, name: '모듬 튀김', price: 5000, description: '야채, 고구마, 오징어 모듬' },
  { store_id: 2, category_id: 7, name: '김말이', price: 3500, description: '바삭한 당면 김말이 5개' },
  { store_id: 2, category_id: 7, name: '오징어 튀김', price: 4000, description: '통오징어 튀김' },
  // 분식집 - 김밥/만두 (cat 8)
  { store_id: 2, category_id: 8, name: '참치 김밥', price: 4000, description: '참치마요가 듬뿍' },
  { store_id: 2, category_id: 8, name: '소고기 김밥', price: 4500, description: '불고기 소고기 김밥' },
  { store_id: 2, category_id: 8, name: '군만두', price: 4000, description: '바삭하게 구운 만두 6개' },
  { store_id: 2, category_id: 8, name: '찐만두', price: 3500, description: '쫄깃한 찐만두 6개' },
  // 분식집 - 라면 (cat 9)
  { store_id: 2, category_id: 9, name: '라면', price: 3500, description: '기본 라면' },
  { store_id: 2, category_id: 9, name: '치즈라면', price: 4500, description: '치즈 토핑 라면' },
  { store_id: 2, category_id: 9, name: '만두라면', price: 5000, description: '만두가 들어간 라면' },
  // 분식집 - 음료 (cat 10)
  { store_id: 2, category_id: 10, name: '콜라', price: 2000, description: '코카콜라 500ml' },
  { store_id: 2, category_id: 10, name: '사이다', price: 2000, description: '칠성사이다 500ml' },

  // 치킨집 - 후라이드 (cat 11)
  { store_id: 3, category_id: 11, name: '후라이드 치킨', price: 18000, description: '바삭바삭 기본 후라이드' },
  { store_id: 3, category_id: 11, name: '반반 치킨', price: 19000, description: '후라이드 + 양념 반반' },
  // 치킨집 - 양념 (cat 12)
  { store_id: 3, category_id: 12, name: '양념 치킨', price: 19000, description: '달콤 매콤 양념 치킨' },
  { store_id: 3, category_id: 12, name: '간장 치킨', price: 19000, description: '짭조름한 간장 치킨' },
  { store_id: 3, category_id: 12, name: '매운 양념 치킨', price: 19000, description: '화끈하게 매운 양념' },
  // 치킨집 - 순살 (cat 13)
  { store_id: 3, category_id: 13, name: '순살 후라이드', price: 19000, description: '뼈 없는 후라이드' },
  { store_id: 3, category_id: 13, name: '순살 양념', price: 20000, description: '뼈 없는 양념 치킨' },
  { store_id: 3, category_id: 13, name: '치킨 텐더', price: 12000, description: '바삭한 치킨 텐더 10조각' },
  // 치킨집 - 사이드 (cat 14)
  { store_id: 3, category_id: 14, name: '치즈볼', price: 5000, description: '쭉쭉 늘어나는 치즈볼 8개' },
  { store_id: 3, category_id: 14, name: '감자튀김', price: 4000, description: '바삭한 감자튀김' },
  { store_id: 3, category_id: 14, name: '치킨무', price: 1000, description: '시원한 치킨무 추가' },
  // 치킨집 - 음료/주류 (cat 15)
  { store_id: 3, category_id: 15, name: '콜라 1.5L', price: 3000, description: '코카콜라 1.5L' },
  { store_id: 3, category_id: 15, name: '맥주 카스', price: 4000, description: '카스 500ml' },
  { store_id: 3, category_id: 15, name: '소주', price: 4000, description: '참이슬 360ml' }
];

const prodStmt = db.prepare('INSERT INTO products (store_id, category_id, name, price, description, is_active) VALUES (?, ?, ?, ?, ?, 1)');
products.forEach(prod => {
  prodStmt.run(prod.store_id, prod.category_id, prod.name, prod.price, prod.description);
});
console.log(`  ✓ ${products.length}개 상품 생성됨`);

// 5. 테이블 생성
console.log('\n🪑 테이블 생성 중...');
const tables = [];
// 카페 테이블 10개
for (let i = 1; i <= 10; i++) {
  tables.push({ store_id: 1, name: `테이블 ${i}`, qr_code: `CAFE-${String(i).padStart(3, '0')}` });
}
// 분식집 테이블 8개
for (let i = 1; i <= 8; i++) {
  tables.push({ store_id: 2, name: `${i}번 테이블`, qr_code: `BUNSIK-${String(i).padStart(3, '0')}` });
}
// 치킨집 테이블 12개
for (let i = 1; i <= 12; i++) {
  tables.push({ store_id: 3, name: `${i}번`, qr_code: `CHICKEN-${String(i).padStart(3, '0')}` });
}

const tableStmt = db.prepare('INSERT INTO tables (store_id, name, qr_code, is_active) VALUES (?, ?, ?, 1)');
tables.forEach(table => {
  tableStmt.run(table.store_id, table.name, table.qr_code);
});
console.log(`  ✓ ${tables.length}개 테이블 생성됨`);

// 6. 샘플 주문 생성
console.log('\n📦 샘플 주문 생성 중...');

function generateOrders(storeId, productIds, tableIds, count) {
  const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'completed', 'completed'];
  const paymentMethods = ['card', 'card', 'card', 'cash', 'kakao', 'naver'];
  const customerNames = ['김철수', '이영희', '박민수', '최지연', '정현우', '강서윤', '조민준', '윤서아', null, null];

  const orderStmt = db.prepare(`
    INSERT INTO orders (store_id, table_id, order_number, customer_name, status, total_amount, payment_method, payment_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ? || ' hours'))
  `);

  const itemStmt = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < count; i++) {
    const hoursAgo = -Math.floor(Math.random() * 168); // 최근 7일
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const tableId = tableIds[Math.floor(Math.random() * tableIds.length)];
    const customerName = customerNames[Math.floor(Math.random() * customerNames.length)];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const paymentStatus = status === 'completed' ? 'paid' : (Math.random() > 0.3 ? 'paid' : 'unpaid');

    // 1-4개 상품 선택
    const itemCount = Math.floor(Math.random() * 4) + 1;
    const selectedProducts = [];
    let totalAmount = 0;

    for (let j = 0; j < itemCount; j++) {
      const prodId = productIds[Math.floor(Math.random() * productIds.length)];
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
      if (prod) {
        const qty = Math.floor(Math.random() * 3) + 1;
        selectedProducts.push({ ...prod, quantity: qty });
        totalAmount += prod.price * qty;
      }
    }

    if (selectedProducts.length === 0) continue;

    const orderNumber = `${new Date(Date.now() + hoursAgo * 3600000).toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`;

    const result = orderStmt.run(storeId, tableId, orderNumber, customerName, status, totalAmount, paymentMethod, paymentStatus, hoursAgo);
    const orderId = result.lastInsertRowid;

    selectedProducts.forEach(prod => {
      itemStmt.run(orderId, prod.id, prod.name, prod.price, prod.quantity, prod.price * prod.quantity);
    });
  }
}

// 각 매장별 주문 생성
const store1Products = db.prepare('SELECT id FROM products WHERE store_id = 1').all().map(p => p.id);
const store1Tables = db.prepare('SELECT id FROM tables WHERE store_id = 1').all().map(t => t.id);
generateOrders(1, store1Products, store1Tables, 50);

const store2Products = db.prepare('SELECT id FROM products WHERE store_id = 2').all().map(p => p.id);
const store2Tables = db.prepare('SELECT id FROM tables WHERE store_id = 2').all().map(t => t.id);
generateOrders(2, store2Products, store2Tables, 40);

const store3Products = db.prepare('SELECT id FROM products WHERE store_id = 3').all().map(p => p.id);
const store3Tables = db.prepare('SELECT id FROM tables WHERE store_id = 3').all().map(t => t.id);
generateOrders(3, store3Products, store3Tables, 35);

console.log('  ✓ 125개 샘플 주문 생성됨');

console.log('\n✅ 데이터베이스 시딩 완료!\n');
console.log('='.repeat(50));
console.log('테스트 계정 정보:');
console.log('='.repeat(50));
console.log('📧 이메일: owner@wemarket.kr');
console.log('🔑 비밀번호: password123');
console.log('');
console.log('📧 이메일: manager@wemarket.kr');
console.log('🔑 비밀번호: password123');
console.log('='.repeat(50));
console.log('\nQR 코드 예시:');
console.log('  - 카페: CAFE-001 ~ CAFE-010');
console.log('  - 분식: BUNSIK-001 ~ BUNSIK-008');
console.log('  - 치킨: CHICKEN-001 ~ CHICKEN-012');
console.log('='.repeat(50));
