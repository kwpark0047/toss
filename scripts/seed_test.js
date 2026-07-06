'use strict';
/**
 * WeMarket 종합 테스트 시드
 * node scripts/seed_test.js
 *
 * 생성: super_admin 1 + 업종별 store_owner 5
 * 각 매장: 카테고리·메뉴(옵션)·테이블·직원·60일 주문이력·정산·리뷰·예약·대기열
 */

const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
let _oc = 90000;
const newNum = (sid) => `WM${String(sid).padStart(2, '0')}${(++_oc).toString()}`;

const PW_TEST  = bcrypt.hashSync('test1234',  10);
const PW_ADMIN = bcrypt.hashSync('admin1234', 10);

// 날짜 생성: 기준일 2026-06-29
const BASE = new Date('2026-06-29T23:59:59Z');
function dAgo(days, h = 12, m = 0) {
  const d = new Date(BASE);
  d.setDate(d.getDate() - days);
  d.setHours(h, m, rnd(0, 59), 0);
  return d;
}

const CUSTOMERS = [
  { name: '김민준', phone: '01099990001' },
  { name: '이서연', phone: '01099990002' },
  { name: '박지우', phone: '01099990003' },
  { name: '최예진', phone: '01099990004' },
  { name: '정하늘', phone: '01099990005' },
  { name: '강도윤', phone: '01099990006' },
  { name: '조서현', phone: '01099990007' },
  { name: '윤지훈', phone: '01099990008' },
  { name: '임소연', phone: '01099990009' },
  { name: '한지민', phone: '01099990010' },
  { name: '오태양', phone: '01099990011' },
  { name: '신유진', phone: '01099990012' },
  { name: '백준호', phone: '01099990013' },
  { name: '문채원', phone: '01099990014' },
  { name: '노지수', phone: '01099990015' },
];

const METHODS = ['card','card','card','toss','card'];

// ── 옵션 프리셋 ───────────────────────────────────────────────────────────
const O = {
  temp: JSON.stringify([{
    id:'temp',name:'온도',is_required:true,max_choices:1,
    choices:[{id:'hot',name:'HOT',price_adjustment:0},{id:'iced',name:'ICED',price_adjustment:0}]
  }]),
  tempSize: JSON.stringify([
    {id:'temp',name:'온도',is_required:true,max_choices:1,choices:[{id:'hot',name:'HOT',price_adjustment:0},{id:'iced',name:'ICED',price_adjustment:0}]},
    {id:'size',name:'사이즈',is_required:false,max_choices:1,choices:[{id:'reg',name:'Regular',price_adjustment:0},{id:'lg',name:'Large',price_adjustment:500}]}
  ]),
  spicy: JSON.stringify([{
    id:'spicy',name:'매운맛',is_required:false,max_choices:1,
    choices:[{id:'mild',name:'순한맛',price_adjustment:0},{id:'med',name:'중간맛',price_adjustment:0},{id:'hot',name:'매운맛',price_adjustment:0}]
  }]),
  chicken: JSON.stringify([
    {id:'type',name:'종류',is_required:true,max_choices:1,choices:[{id:'ori',name:'후라이드',price_adjustment:0},{id:'yang',name:'양념',price_adjustment:0},{id:'half',name:'반반',price_adjustment:0}]},
    {id:'sauce',name:'소스',is_required:false,max_choices:1,choices:[{id:'none',name:'없음',price_adjustment:0},{id:'honey',name:'허니머스타드',price_adjustment:0}]}
  ]),
  done: JSON.stringify([{
    id:'done',name:'굽기',is_required:true,max_choices:1,
    choices:[{id:'rare',name:'Rare',price_adjustment:0},{id:'med',name:'Medium',price_adjustment:0},{id:'well',name:'Well Done',price_adjustment:0}]
  }]),
};

// ── 5개 매장 정의 ─────────────────────────────────────────────────────────
const STORES = [
  {
    owner: { name:'이지훈', email:'test_cafe@wemarket.kr', phone:'01012341001', role:'store_admin' },
    store: {
      name:'위마켓 시그니처 카페 강남점', business_type:'cafe',
      description:'직접 로스팅한 스페셜티 원두와 제철 재료로 만드는 프리미엄 음료',
      address:'서울 강남구 테헤란로 123 1층', phone:'02-555-1234',
      open_time:'08:00', close_time:'22:00', plan:'pro',
      theme: JSON.stringify({ primaryColor:'#f97316', secondaryColor:'#1e293b', backgroundColor:'#fff7ed', textColor:'#1e293b', cardColor:'#ffffff', announcement:'☕ 여름 시즌 한정! 오후 2-5시 해피아워 20% 할인', announcementActive:true }),
    },
    categories:['🌟 시그니처','☕ 커피','🍵 논커피','🍋 에이드·주스','🍰 디저트'],
    products:[
      { name:'위마켓 시그니처 라떼', price:6500, cat:'🌟 시그니처', desc:'달콤한 캐러멜과 직접 로스팅 에스프레소', opts:O.tempSize, is_popular:1, is_new:1 },
      { name:'오렌지 블라썸', price:7000, cat:'🌟 시그니처', desc:'오렌지 제스트와 얼그레이의 시그니처', opts:O.temp, is_popular:1 },
      { name:'흑임자 라떼', price:6800, cat:'🌟 시그니처', desc:'국내산 흑임자와 오트밀크', opts:O.tempSize, is_new:1 },
      { name:'아메리카노', price:4500, cat:'☕ 커피', desc:'직접 로스팅 원두의 깊은 맛', opts:O.tempSize, is_popular:1 },
      { name:'카페라떼', price:5000, cat:'☕ 커피', desc:'부드러운 우유와 에스프레소', opts:O.tempSize },
      { name:'콜드브루', price:5500, cat:'☕ 커피', desc:'12시간 냉침 추출' },
      { name:'말차 라떼', price:5500, cat:'🍵 논커피', desc:'교토산 말차', opts:O.tempSize, is_popular:1 },
      { name:'고구마 라떼', price:5500, cat:'🍵 논커피', desc:'국내산 고구마 퓨레', opts:O.temp },
      { name:'자몽 에이드', price:5500, cat:'🍋 에이드·주스', desc:'생자몽이 가득한 에이드', is_popular:1 },
      { name:'청포도 에이드', price:5500, cat:'🍋 에이드·주스', desc:'신선한 청포도 에이드', is_new:1 },
      { name:'크렘 브륄레 타르트', price:6500, cat:'🍰 디저트', desc:'바삭한 타르트 위 커스터드', is_popular:1 },
      { name:'뉴욕 치즈케이크', price:7500, cat:'🍰 디저트', desc:'진한 치즈케이크 한 조각' },
      { name:'크로아상', price:4500, cat:'🍰 디저트', desc:'버터향 가득한 수제 크로아상' },
    ],
    tableCount:12,
    staff:[
      { name:'김민수', role:'manager', email:'cafe_mgr@wemarket.kr', phone:'01012340001' },
      { name:'박지영', role:'kitchen', email:'cafe_kitchen@wemarket.kr', phone:'01012340002' },
      { name:'이수진', role:'staff', email:'cafe_staff1@wemarket.kr', phone:'01012340003' },
    ],
    peakHours:[9,10,13,14,16,17], avgDay:15,
    bank:{ code:'004', name:'국민은행', account:'123-456-789012', holder:'이지훈' },
  },
  {
    owner: { name:'마르코 김', email:'test_italian@wemarket.kr', phone:'01012341002', role:'store_admin' },
    store: {
      name:'라 피아짜 이탈리안', business_type:'restaurant',
      description:'정통 이탈리아 가정식의 풍미를 담은 파스타와 피자',
      address:'서울 마포구 연남동 227-45', phone:'02-333-8765',
      open_time:'11:30', close_time:'22:00', plan:'pro',
      theme: JSON.stringify({ primaryColor:'#dc2626', secondaryColor:'#1c1917', backgroundColor:'#fafaf9', textColor:'#1c1917', cardColor:'#ffffff', announcement:'🍝 금주 런치세트 2인 17,000원! 평일 11:30-14:00', announcementActive:true }),
    },
    categories:['🍝 파스타','🍕 피자','🥗 샐러드·에피타이저','🍷 와인·음료','🍰 디저트'],
    products:[
      { name:'까르보나라', price:16000, cat:'🍝 파스타', desc:'이탈리안 판체타와 계란노른자', is_popular:1 },
      { name:'알리오 올리오', price:14000, cat:'🍝 파스타', desc:'마늘향 가득한 정통 레시피', is_popular:1 },
      { name:'봉골레', price:17000, cat:'🍝 파스타', desc:'바지락이 듬뿍' },
      { name:'아라비아따', price:14000, cat:'🍝 파스타', desc:'매콤한 토마토 소스', opts:O.spicy },
      { name:'마르게리따', price:19000, cat:'🍕 피자', desc:'직접 만든 토마토 소스와 모짜렐라', is_popular:1 },
      { name:'콰트로 포르마지', price:22000, cat:'🍕 피자', desc:'4가지 치즈의 풍부한 맛' },
      { name:'루꼴라 살라미', price:23000, cat:'🍕 피자', desc:'살라미와 루꼴라', is_new:1 },
      { name:'카프레제 샐러드', price:13000, cat:'🥗 샐러드·에피타이저', desc:'모짜렐라·토마토·바질' },
      { name:'트러플 감자튀김', price:9000, cat:'🥗 샐러드·에피타이저', desc:'트러플 오일', is_new:1 },
      { name:'하우스 레드 와인', price:12000, cat:'🍷 와인·음료', desc:'150ml 글라스' },
      { name:'에스프레소', price:3500, cat:'🍷 와인·음료', desc:'풀바디 에스프레소', opts:O.temp },
      { name:'스파클링 워터', price:4000, cat:'🍷 와인·음료', desc:'이탈리안 탄산수' },
      { name:'판나코타', price:8000, cat:'🍰 디저트', desc:'바닐라 향의 부드러운 판나코타' },
      { name:'티라미수', price:9000, cat:'🍰 디저트', desc:'마스카포네 티라미수', is_popular:1 },
    ],
    tableCount:10,
    staff:[
      { name:'안소피아', role:'manager', email:'italian_mgr@wemarket.kr', phone:'01012340004' },
      { name:'이주방장', role:'kitchen', email:'italian_kitchen@wemarket.kr', phone:'01012340005' },
      { name:'최서빙', role:'staff', email:'italian_staff@wemarket.kr', phone:'01012340006' },
    ],
    peakHours:[12,13,18,19,20,21], avgDay:12,
    bank:{ code:'088', name:'신한은행', account:'234-567-890123', holder:'마르코 김' },
  },
  {
    owner: { name:'박순희', email:'test_korean@wemarket.kr', phone:'01012341003', role:'store_admin' },
    store: {
      name:'한옥마을 한식당', business_type:'restaurant',
      description:'어머니 손맛 그대로, 정통 한식의 깊은 맛을 전합니다',
      address:'서울 종로구 북촌로 91', phone:'02-722-5555',
      open_time:'10:30', close_time:'21:00', plan:'pro',
      theme: JSON.stringify({ primaryColor:'#92400e', secondaryColor:'#1c1917', backgroundColor:'#fefce8', textColor:'#1c1917', cardColor:'#ffffff', announcement:'🍱 정갈한 한정식 코스 1인 38,000원 — 예약 필수', announcementActive:false }),
    },
    categories:['🍲 메인','🥘 국·찌개','🥗 반찬·사이드','🍚 밥·면','🍵 음료'],
    products:[
      { name:'불고기', price:15000, cat:'🍲 메인', desc:'부드러운 국내산 한우 불고기', is_popular:1 },
      { name:'제육볶음', price:13000, cat:'🍲 메인', desc:'매콤달콤 돼지 제육볶음', opts:O.spicy, is_popular:1 },
      { name:'갈비찜', price:22000, cat:'🍲 메인', desc:'6시간 조리한 부드러운 갈비찜', is_new:1 },
      { name:'된장찌개', price:8000, cat:'🥘 국·찌개', desc:'구수한 전통 된장찌개', is_popular:1 },
      { name:'김치찌개', price:8000, cat:'🥘 국·찌개', desc:'잘 익은 포기김치 찌개' },
      { name:'육개장', price:10000, cat:'🥘 국·찌개', desc:'얼큰한 육개장' },
      { name:'파전', price:12000, cat:'🥗 반찬·사이드', desc:'바삭한 파전 한판', is_popular:1 },
      { name:'잡채', price:11000, cat:'🥗 반찬·사이드', desc:'당면과 여러 채소' },
      { name:'공기밥', price:1000, cat:'🍚 밥·면', desc:'갓 지은 공기밥' },
      { name:'냉면', price:11000, cat:'🍚 밥·면', desc:'시원한 평양냉면', is_new:1 },
      { name:'식혜', price:3000, cat:'🍵 음료', desc:'직접 담근 전통 식혜' },
      { name:'수정과', price:3000, cat:'🍵 음료', desc:'계피향 전통 수정과' },
    ],
    tableCount:14,
    staff:[
      { name:'김영수', role:'manager', email:'korean_mgr@wemarket.kr', phone:'01012340007' },
      { name:'이주방', role:'kitchen', email:'korean_kitchen@wemarket.kr', phone:'01012340008' },
      { name:'박홀', role:'staff', email:'korean_staff@wemarket.kr', phone:'01012340009' },
    ],
    peakHours:[11,12,13,18,19,20], avgDay:14,
    bank:{ code:'020', name:'우리은행', account:'345-678-901234', holder:'박순희' },
  },
  {
    owner: { name:'황금열', email:'test_chicken@wemarket.kr', phone:'01012341004', role:'store_admin' },
    store: {
      name:'황금치킨 포차', business_type:'bar',
      description:'황금빛 바삭함의 정석, 치킨과 함께하는 즐거운 포차',
      address:'서울 마포구 망원동 426-8', phone:'02-777-4444',
      open_time:'16:00', close_time:'02:00', plan:'pro',
      theme: JSON.stringify({ primaryColor:'#d97706', secondaryColor:'#1c1917', backgroundColor:'#fffbeb', textColor:'#1c1917', cardColor:'#ffffff', announcement:'🍺 화~목 오후 4-6시 생맥주 2+1 해피아워!', announcementActive:true }),
    },
    categories:['🍗 치킨','🥢 안주','🍺 맥주·주류','🥤 음료'],
    products:[
      { name:'황금 후라이드 치킨', price:18000, cat:'🍗 치킨', desc:'황금빛 바삭함의 클래식', opts:O.chicken, is_popular:1 },
      { name:'양념 치킨', price:19000, cat:'🍗 치킨', desc:'달콤매콤 황금 양념치킨', opts:O.chicken, is_popular:1 },
      { name:'간장 마늘 치킨', price:20000, cat:'🍗 치킨', desc:'간장 베이스 마늘치킨', is_new:1 },
      { name:'닭발', price:12000, cat:'🥢 안주', desc:'매콤한 닭발', opts:O.spicy },
      { name:'떡볶이', price:8000, cat:'🥢 안주', desc:'국물 떡볶이 (2인분)', opts:O.spicy, is_popular:1 },
      { name:'순대', price:7000, cat:'🥢 안주', desc:'당면 가득 찐 순대' },
      { name:'생맥주 (500ml)', price:4500, cat:'🍺 맥주·주류', desc:'시원한 생맥주', is_popular:1 },
      { name:'병맥주', price:5000, cat:'🍺 맥주·주류', desc:'레드락·하이네켄·기네스' },
      { name:'소주', price:5000, cat:'🍺 맥주·주류', desc:'참이슬·처음처럼' },
      { name:'하이볼', price:8000, cat:'🍺 맥주·주류', desc:'위스키 하이볼', is_new:1 },
      { name:'콜라·사이다', price:3000, cat:'🥤 음료', desc:'탄산음료 (캔)' },
    ],
    tableCount:8,
    staff:[
      { name:'장포차', role:'manager', email:'chicken_mgr@wemarket.kr', phone:'01012340010' },
      { name:'윤주방', role:'kitchen', email:'chicken_kitchen@wemarket.kr', phone:'01012340011' },
      { name:'송홀', role:'staff', email:'chicken_staff@wemarket.kr', phone:'01012340012' },
    ],
    peakHours:[17,18,19,20,21,22,23], avgDay:10,
    bank:{ code:'011', name:'농협은행', account:'456-789-012345', holder:'황금열' },
  },
  {
    owner: { name:'정스위트', email:'test_bakery@wemarket.kr', phone:'01012341005', role:'store_admin' },
    store: {
      name:'스위트 팩토리 베이커리', business_type:'bakery',
      description:'매일 새벽 4시부터 굽는 수제 빵과 케이크의 달콤한 공간',
      address:'서울 서초구 방배동 882-3', phone:'02-533-2222',
      open_time:'08:00', close_time:'20:00', plan:'pro',
      theme: JSON.stringify({ primaryColor:'#db2777', secondaryColor:'#1c1917', backgroundColor:'#fdf2f8', textColor:'#1c1917', cardColor:'#ffffff', announcement:'🥐 오늘의 빵: 크로아상·소금빵·말차 스콘 (매일 오전 8시 신선하게 구워집니다)', announcementActive:true }),
    },
    categories:['🥐 베이커리','🎂 케이크','☕ 커피·음료','🍫 초콜릿·쿠키'],
    products:[
      { name:'버터 크로아상', price:3500, cat:'🥐 베이커리', desc:'프랑스산 버터 크로아상', is_popular:1 },
      { name:'소금빵', price:2800, cat:'🥐 베이커리', desc:'겉바속촉 정통 소금빵', is_popular:1 },
      { name:'말차 스콘', price:3800, cat:'🥐 베이커리', desc:'교토산 말차와 화이트초코', is_new:1 },
      { name:'바게트', price:4500, cat:'🥐 베이커리', desc:'프랑스 스타일 정통 바게트' },
      { name:'시나몬 롤', price:4800, cat:'🥐 베이커리', desc:'크림치즈 아이싱 시나몬 롤', is_popular:1 },
      { name:'조각 케이크', price:7500, cat:'🎂 케이크', desc:'오늘의 케이크 한 조각', is_popular:1 },
      { name:'홀 생일 케이크 (4호)', price:45000, cat:'🎂 케이크', desc:'수제 생크림 (1일 전 예약)' },
      { name:'마카롱 세트 (6개)', price:12000, cat:'🍫 초콜릿·쿠키', desc:'프랑스식 마카롱 6종', is_popular:1 },
      { name:'수제 초콜릿 (8구)', price:15000, cat:'🍫 초콜릿·쿠키', desc:'벨기에 쿠베르튀르 봉봉', is_new:1 },
      { name:'아메리카노', price:4500, cat:'☕ 커피·음료', desc:'직접 로스팅 원두', opts:O.tempSize, is_popular:1 },
      { name:'카페라떼', price:5500, cat:'☕ 커피·음료', desc:'부드러운 라떼', opts:O.tempSize },
      { name:'애플 시나몬 티', price:5000, cat:'☕ 커피·음료', desc:'달콤한 허브티', opts:O.temp },
    ],
    tableCount:8,
    staff:[
      { name:'오파티세', role:'manager', email:'bakery_mgr@wemarket.kr', phone:'01012340013' },
      { name:'한주방', role:'kitchen', email:'bakery_kitchen@wemarket.kr', phone:'01012340014' },
      { name:'유홀', role:'staff', email:'bakery_staff@wemarket.kr', phone:'01012340015' },
    ],
    peakHours:[9,10,14,15,16], avgDay:18,
    bank:{ code:'081', name:'KEB하나은행', account:'567-890-123456', holder:'정스위트' },
  },
];

// ── 리뷰 텍스트 풀 ────────────────────────────────────────────────────────
const REVIEWS = [
  { rating:5, content:'정말 맛있어요! 다음에 또 올게요. 분위기도 너무 좋았습니다.' },
  { rating:5, content:'직원분들이 너무 친절하셔서 기분 좋게 식사했습니다. 강추!' },
  { rating:4, content:'음식이 전반적으로 맛있었어요. 가격 대비 만족스럽습니다.' },
  { rating:5, content:'여기 진짜 맛집이에요. 혼자서도 편하게 먹을 수 있어서 좋았어요.' },
  { rating:4, content:'QR 주문 시스템 너무 편리해요. 음식도 빨리 나오고 맛도 좋았습니다.' },
  { rating:5, content:'단골 매장입니다. 항상 퀄리티가 일정해서 믿고 갑니다!' },
  { rating:3, content:'음식은 맛있는데 조금 기다렸습니다. 그래도 괜찮았어요.' },
  { rating:5, content:'처음 와봤는데 완전 취향저격! 바로 단골됐어요 ㅎㅎ' },
  { rating:4, content:'재료가 신선한 게 느껴져요. 다음에 다른 메뉴도 먹어볼 예정입니다.' },
  { rating:5, content:'서비스도 음식도 완벽합니다. 특별한 날 오기 딱 좋은 곳이에요.' },
  { rating:4, content:'전반적으로 만족! 특히 시그니처 메뉴가 인상적이었어요.' },
  { rating:5, content:'친구들이랑 왔는데 모두 만족했어요. 분위기도 감성있고 맛도 최고!' },
];

// ── 예약 고객 ─────────────────────────────────────────────────────────────
const RES_CUSTOMERS = [
  { name:'이찬혁', phone:'01055550001' },
  { name:'권나라', phone:'01055550002' },
  { name:'장서윤', phone:'01055550003' },
  { name:'문준혁', phone:'01055550004' },
  { name:'서지현', phone:'01055550005' },
  { name:'홍성민', phone:'01055550006' },
  { name:'구민지', phone:'01055550007' },
  { name:'노재원', phone:'01055550008' },
];

// ── 단일 주문 생성 ────────────────────────────────────────────────────────
async function createOrder(storeId, tableId, products, orderDate, status, handled_by_staff_id) {
  const num = rnd(1, Math.min(4, products.length));
  const picked = [];
  const used = new Set();
  for (let i = 0; i < num; i++) {
    let idx;
    let tries = 0;
    do { idx = rnd(0, products.length - 1); tries++; } while (used.has(idx) && tries < 20);
    used.add(idx);
    picked.push(products[idx]);
  }

  const items = picked.map(p => {
    const qty = rnd(1, 3);
    return { product_id: p.id, product_name: p.name, price: p.price, quantity: qty, subtotal: p.price * qty };
  });
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const customer = pick(CUSTOMERS);
  const method = pick(METHODS);
  const isPaid = ['completed', 'ready'].includes(status);
  const isCompleted = status === 'completed';

  const completedAt = isCompleted
    ? new Date(orderDate.getTime() + rnd(8, 25) * 60000)
    : null;

  const order = await prisma.orders.create({
    data: {
      store_id: storeId,
      table_id: tableId,
      order_number: newNum(storeId),
      status,
      payment_status: isPaid ? 'paid' : 'pending',
      total_amount: total,
      method,
      customer_name: customer.name,
      customer_phone: customer.phone,
      created_at: orderDate,
      completed_at: completedAt,
      handled_by_staff_id: handled_by_staff_id || null,
      order_items: { create: items },
    },
  });

  if (isPaid) {
    await prisma.payments.create({
      data: {
        order_id: order.id,
        store_id: storeId,
        amount: total,
        status: 'DONE',
        method,
        payment_key: `demo_pay_${order.id}_${Date.now()}`,
        completed_at: completedAt || orderDate,
        created_at: orderDate,
      },
    });
    await prisma.ledger.create({
      data: {
        store_id: storeId,
        order_id: order.id,
        type: 'income',
        category: 'sales',
        amount: total,
        method,
        description: `주문 ${order.order_number}`,
        created_at: orderDate,
      },
    });
  }
  return { order, total, isPaid };
}

// ── 매장 전체 시딩 ────────────────────────────────────────────────────────
async function seedStore(def) {
  console.log(`\n  ▶ ${def.store.name} 생성 중...`);

  // 1. 오너 생성
  const owner = await prisma.users.upsert({
    where: { email: def.owner.email },
    update: { name: def.owner.name, password: PW_TEST, role: def.owner.role },
    create: { ...def.owner, password: PW_TEST },
  });

  // 기존 매장 이름 확인 후 생성
  let store = await prisma.stores.findFirst({ where: { user_id: owner.id, name: def.store.name } });
  if (!store) {
    store = await prisma.stores.create({ data: { ...def.store, user_id: owner.id } });
  }
  const sid = store.id;
  console.log(`    ✓ 매장 ID ${sid}: ${store.name}`);

  // 2. 카테고리 + 상품
  const catMap = {};
  for (const catName of def.categories) {
    let cat = await prisma.categories.findFirst({ where: { store_id: sid, name: catName } });
    if (!cat) cat = await prisma.categories.create({ data: { store_id: sid, name: catName, sort_order: def.categories.indexOf(catName) } });
    catMap[catName] = cat.id;
  }

  const products = [];
  for (const p of def.products) {
    let prod = await prisma.products.findFirst({ where: { store_id: sid, name: p.name } });
    if (!prod) {
      prod = await prisma.products.create({
        data: {
          store_id: sid,
          category_id: catMap[p.cat],
          name: p.name,
          description: p.desc,
          price: p.price,
          options: p.opts || null,
          is_popular: p.is_popular || 0,
          is_new: p.is_new || 0,
          is_active: true,
          cooking_time: rnd(5, 15),
        },
      });
    }
    products.push(prod);
  }
  console.log(`    ✓ 상품 ${products.length}개`);

  // 3. 테이블 (좌석 배치 포함)
  const tables = [];
  const existingTables = await prisma.tables.findMany({ where: { store_id: sid } });
  if (existingTables.length === 0) {
    const cols = 4;
    for (let i = 0; i < def.tableCount; i++) {
      const tableNum = `T${String(i + 1).padStart(2, '0')}`;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const status = i < 3 ? 'occupied' : (i < 5 ? 'reserved' : 'available');
      const t = await prisma.tables.create({
        data: {
          store_id: sid,
          table_number: tableNum,
          qr_code: `QR-${sid}-${i + 1}-${Math.random().toString(36).slice(2, 8)}`,
          capacity: (i % 3 === 0) ? 4 : 2,
          x: col * 160 + 40,
          y: row * 140 + 40,
          status,
          is_active: true,
        },
      });
      tables.push(t);
    }
  } else {
    tables.push(...existingTables);
  }
  console.log(`    ✓ 테이블 ${tables.length}개`);

  // 4. 직원 (staff 테이블)
  const staffIds = [];
  for (const s of def.staff) {
    const sUser = await prisma.users.upsert({
      where: { email: s.email },
      update: { name: s.name, password: PW_TEST, role: s.role },
      create: { name: s.name, email: s.email, phone: s.phone, password: PW_TEST, role: s.role },
    });
    let staffRec = await prisma.staff.findUnique({ where: { store_id_user_id: { store_id: sid, user_id: sUser.id } } });
    if (!staffRec) {
      staffRec = await prisma.staff.create({ data: { store_id: sid, user_id: sUser.id, role: s.role } });
    }
    staffIds.push(staffRec.id);

    // store_staff (PIN 기반)
    await prisma.store_staff.upsert({
      where: { id: (await prisma.store_staff.findFirst({ where: { store_id: sid, name: s.name } }))?.id ?? 0 },
      update: {},
      create: { store_id: sid, user_id: sUser.id, name: s.name, role: s.role, pin_code: String(rnd(1000, 9999)), is_active: 1 },
    }).catch(() => {});

    // 출퇴근 기록 (최근 7일)
    for (let d = 1; d <= 7; d++) {
      const clockIn = dAgo(d, rnd(8, 10));
      const clockOut = new Date(clockIn.getTime() + rnd(7, 9) * 3600000);
      await prisma.staff_attendance.create({
        data: { staff_id: staffRec.id, store_id: sid, clock_in: clockIn, clock_out: clockOut, work_hours: rnd(7, 9) },
      });
    }
  }
  console.log(`    ✓ 직원 ${staffIds.length}명 + 출퇴근 기록`);

  // 5. 주문 이력 (60일)
  let existingOrderCount = await prisma.orders.count({ where: { store_id: sid } });
  const totalSales = { apr:0, may:0, jun:0 };

  // 재실행 시 고아 주문 정리 (payment 없는 미완성 주문)
  if (existingOrderCount > 0 && existingOrderCount < 50) {
    const orphanIds = (await prisma.orders.findMany({ where: { store_id: sid }, select: { id: true } })).map(o => o.id);
    await prisma.payments.deleteMany({ where: { order_id: { in: orphanIds } } });
    await prisma.ledger.deleteMany({ where: { order_id: { in: orphanIds } } });
    await prisma.order_items.deleteMany({ where: { order_id: { in: orphanIds } } });
    await prisma.orders.deleteMany({ where: { id: { in: orphanIds } } });
    existingOrderCount = 0;
    console.log(`    ⚠ 고아 주문 ${orphanIds.length}개 정리 완료`);
  }

  if (existingOrderCount === 0) {
    let orderCount = 0;
    // connection_limit=1 환경: Promise.all 대신 순차 실행
    // April (days 89~60 ago)
    for (let d = 89; d >= 60; d--) {
      const date = new Date(BASE); date.setDate(date.getDate() - d);
      const isWeekend = [0,6].includes(date.getDay());
      const count = isWeekend ? rnd(4, 8) : rnd(2, 5);
      for (let o = 0; o < count; o++) {
        const hour = pick(def.peakHours);
        const od = new Date(date); od.setHours(hour, rnd(0, 59), 0, 0);
        const r = await createOrder(sid, pick(tables).id, products, od, 'completed', pick(staffIds));
        totalSales.apr += r.total;
        orderCount++;
      }
    }

    // May (days 59~30 ago)
    for (let d = 59; d >= 30; d--) {
      const date = new Date(BASE); date.setDate(date.getDate() - d);
      const isWeekend = [0,6].includes(date.getDay());
      const count = isWeekend ? rnd(5, 10) : rnd(3, 7);
      for (let o = 0; o < count; o++) {
        const hour = pick(def.peakHours);
        const od = new Date(date); od.setHours(hour, rnd(0, 59), 0, 0);
        const r = await createOrder(sid, pick(tables).id, products, od, 'completed', pick(staffIds));
        totalSales.may += r.total;
        orderCount++;
      }
    }

    // June 1~28 (days 28~1 ago)
    for (let d = 28; d >= 1; d--) {
      const date = new Date(BASE); date.setDate(date.getDate() - d);
      const isWeekend = [0,6].includes(date.getDay());
      const count = isWeekend ? rnd(6, 12) : rnd(4, 8);
      for (let o = 0; o < count; o++) {
        const hour = pick(def.peakHours);
        const od = new Date(date); od.setHours(hour, rnd(0, 59), 0, 0);
        const r = await createOrder(sid, pick(tables).id, products, od, 'completed', pick(staffIds));
        totalSales.jun += r.total;
        orderCount++;
      }
    }

    // 오늘 (진행 중)
    const todayStatuses = ['pending','pending','preparing','preparing','ready','completed'];
    for (let o = 0; o < rnd(4, 8); o++) {
      const hour = pick(def.peakHours);
      const od = new Date(BASE); od.setHours(hour, rnd(0, 59), 0, 0);
      const st = pick(todayStatuses);
      const r = await createOrder(sid, pick(tables).id, products, od, st, pick(staffIds));
      if (r.isPaid) totalSales.jun += r.total;
      orderCount++;
    }

    console.log(`    ✓ 주문 ${orderCount}건 (Apr·May·Jun 이력)`);
  } else {
    console.log(`    - 주문 이미 존재 (${existingOrderCount}건), 스킵`);
  }

  // 6. 정산
  const existingSettlements = await prisma.settlements.count({ where: { store_id: sid } });
  if (existingSettlements === 0) {
    const commission = 0.035; // 3.5%
    const vat = 0.1;

    // April
    const aprSales = totalSales.apr || rnd(8000000, 15000000);
    const aprComm = Math.floor(aprSales * commission);
    const aprVat  = Math.floor(aprSales * vat);
    await prisma.settlements.create({
      data: {
        store_id: sid,
        period_start: new Date('2026-04-01'),
        period_end:   new Date('2026-04-30'),
        total_sales: aprSales,
        total_refunds: Math.floor(aprSales * 0.005),
        commission_amount: aprComm,
        vat_amount: aprVat,
        net_amount: aprSales - aprComm - aprVat,
        status: 'PAID',
        paid_at: new Date('2026-05-10'),
      },
    });

    // May
    const maySales = totalSales.may || rnd(10000000, 18000000);
    const mayComm = Math.floor(maySales * commission);
    const mayVat  = Math.floor(maySales * vat);
    await prisma.settlements.create({
      data: {
        store_id: sid,
        period_start: new Date('2026-05-01'),
        period_end:   new Date('2026-05-31'),
        total_sales: maySales,
        total_refunds: Math.floor(maySales * 0.004),
        commission_amount: mayComm,
        vat_amount: mayVat,
        net_amount: maySales - mayComm - mayVat,
        status: 'PAID',
        paid_at: new Date('2026-06-10'),
      },
    });

    // June (진행 중)
    const junSales = totalSales.jun || rnd(12000000, 20000000);
    const junComm = Math.floor(junSales * commission);
    const junVat  = Math.floor(junSales * vat);
    await prisma.settlements.create({
      data: {
        store_id: sid,
        period_start: new Date('2026-06-01'),
        period_end:   new Date('2026-06-30'),
        total_sales: junSales,
        total_refunds: Math.floor(junSales * 0.003),
        commission_amount: junComm,
        vat_amount: junVat,
        net_amount: junSales - junComm - junVat,
        status: 'PENDING',
      },
    });
    console.log(`    ✓ 정산 3개월 (Apr·May·Jun)`);
  }

  // 7. 은행 계좌
  const acctExists = await prisma.store_accounts.findUnique({ where: { store_id: sid } });
  if (!acctExists) {
    await prisma.store_accounts.create({
      data: {
        store_id: sid,
        bank_code: def.bank.code,
        bank_name: def.bank.name,
        account_number: def.bank.account,
        account_holder: def.bank.holder,
        is_active: true,
      },
    });
  }

  // 8. 영수증 설정
  const rcptExists = await prisma.store_receipt_settings.findUnique({ where: { store_id: sid } });
  if (!rcptExists) {
    await prisma.store_receipt_settings.create({
      data: {
        store_id: sid,
        title: '영수증',
        greetings: `${def.store.name}을 이용해 주셔서 감사합니다.`,
        footer_text: '교환·환불은 영수증 지참 시 7일 이내 가능합니다.',
        show_order_number: true, show_item_details: true, show_store_address: true, show_points: true,
      },
    });
  }

  // 9. 포인트 설정
  const ptExists = await prisma.store_point_settings.findUnique({ where: { store_id: sid } });
  if (!ptExists) {
    await prisma.store_point_settings.create({
      data: {
        store_id: sid,
        is_enabled: true,
        earn_rate: 2.0,
        min_earn_amount: 5000,
        max_use_rate: 50,
        min_use_points: 500,
        expiry_days: 365,
      },
    });
  }

  // 10. 리뷰
  const revCount = await prisma.reviews.count({ where: { store_id: sid } });
  if (revCount === 0) {
    for (let i = 0; i < 12; i++) {
      const rv = REVIEWS[i % REVIEWS.length];
      const cust = pick(CUSTOMERS);
      await prisma.reviews.create({
        data: {
          store_id: sid,
          customer_name: cust.name,
          customer_phone: cust.phone,
          rating: rv.rating,
          content: rv.content,
          is_best: i < 2,
          created_at: dAgo(rnd(1, 45), rnd(10, 21)),
        },
      });
    }
    console.log(`    ✓ 리뷰 12개`);
  }

  // 11. 예약
  const resCount = await prisma.reservations.count({ where: { store_id: sid } });
  if (resCount === 0) {
    const resStatuses = ['CONFIRMED','CONFIRMED','PENDING','COMPLETED','COMPLETED','CANCELLED','NO_SHOW'];
    for (let i = 0; i < 8; i++) {
      const cust = RES_CUSTOMERS[i % RES_CUSTOMERS.length];
      const daysOffset = i < 3 ? -rnd(1, 5) : rnd(1, 14); // 음수=미래, 양수=과거
      const resDate = new Date(BASE);
      resDate.setDate(resDate.getDate() + (i < 3 ? daysOffset : 0) - (i >= 3 ? daysOffset : 0));
      resDate.setHours(pick(def.peakHours), 0, 0, 0);
      const status = i < 3 ? pick(['CONFIRMED','PENDING']) : pick(['COMPLETED','COMPLETED','CANCELLED','NO_SHOW']);
      await prisma.reservations.create({
        data: {
          store_id: sid,
          customer_name: cust.name,
          customer_phone: cust.phone,
          party_size: rnd(2, 6),
          reservation_time: resDate,
          status,
          notes: i % 3 === 0 ? '창가 자리 요청' : null,
        },
      });
    }
    console.log(`    ✓ 예약 8건`);
  }

  // 12. 대기열 (현재 대기 중)
  const waitCount = await prisma.waiting_list.count({ where: { store_id: sid } });
  if (waitCount === 0) {
    for (let i = 0; i < 4; i++) {
      const cust = pick(CUSTOMERS);
      await prisma.waiting_list.create({
        data: {
          store_id: sid,
          customer_name: cust.name,
          customer_phone: `0109999${String(2000 + sid * 10 + i).padStart(4,'0')}`,
          party_size: rnd(2, 5),
          status: i < 3 ? 'waiting' : 'called',
          queue_number: i + 1,
          created_at: dAgo(0, pick(def.peakHours)),
          called_at: i === 3 ? new Date(BASE) : null,
        },
      });
    }
    console.log(`    ✓ 대기열 4명`);
  }

  // 13. 알림
  const notifCount = await prisma.notifications.count({ where: { store_id: sid } });
  if (notifCount === 0) {
    const notifs = [
      { type:'NEW_ORDER', title:'새 주문', message:'T03 테이블에서 새 주문이 들어왔습니다.', priority:'high' },
      { type:'LOW_STOCK', title:'재고 부족', message:`${products[0].name} 재고가 5개 미만입니다.`, priority:'normal' },
      { type:'NEW_REVIEW', title:'새 리뷰', message:'별점 5점 리뷰가 등록되었습니다.', priority:'low' },
      { type:'SETTLEMENT', title:'정산 완료', message:'5월 정산금액이 입금되었습니다.', priority:'normal' },
      { type:'NEW_RESERVATION', title:'새 예약', message:'2명 예약이 접수되었습니다. 확인해 주세요.', priority:'normal' },
      { type:'SYSTEM', title:'업데이트 완료', message:'WeMarket v2.5.0 업데이트가 완료되었습니다.', priority:'low' },
    ];
    for (const n of notifs) {
      await prisma.notifications.create({
        data: { store_id: sid, ...n, is_read: false, created_at: dAgo(rnd(0, 3), rnd(9, 18)) },
      });
    }
    console.log(`    ✓ 알림 ${notifs.length}개`);
  }

  // 14. 단골 고객 등록
  const custCount = await prisma.store_customers.count({ where: { store_id: sid } });
  if (custCount === 0) {
    for (const c of CUSTOMERS.slice(0, 8)) {
      await prisma.store_customers.create({
        data: {
          store_id: sid,
          customer_name: c.name,
          customer_phone: c.phone,
          visit_count: rnd(2, 30),
          total_spent: rnd(15000, 350000),
          tier: pick(['GENERAL','SILVER','GOLD','VIP']),
          last_visit_at: dAgo(rnd(0, 14)),
        },
      }).catch(() => {});
    }
    console.log(`    ✓ 단골 고객 8명`);
  }

  console.log(`  ✅ ${def.store.name} 완료`);
  return store;
}

// ── MAIN ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 WeMarket 종합 테스트 시드 시작\n');
  console.log('='.repeat(50));

  // Super Admin
  const admin = await prisma.users.upsert({
    where: { email: 'admin@wemarket.kr' },
    update: { name: '최고관리자', password: PW_ADMIN, role: 'super_admin' },
    create: { name: '최고관리자', email: 'admin@wemarket.kr', phone: '01012340000', password: PW_ADMIN, role: 'super_admin' },
  });
  console.log(`✓ Super Admin: admin@wemarket.kr / admin1234 (ID: ${admin.id})`);

  // 5개 매장 순차 생성
  for (const def of STORES) {
    await seedStore(def);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 테스트 시드 완료!\n');
  console.log('📋 로그인 계정 목록:');
  console.log('  admin@wemarket.kr         / admin1234  (슈퍼 관리자)');
  console.log('  test_cafe@wemarket.kr     / test1234   (카페)');
  console.log('  test_italian@wemarket.kr  / test1234   (이탈리안)');
  console.log('  test_korean@wemarket.kr   / test1234   (한식당)');
  console.log('  test_chicken@wemarket.kr  / test1234   (치킨 포차)');
  console.log('  test_bakery@wemarket.kr   / test1234   (베이커리)');
  console.log('\n  직원 계정 예시:');
  console.log('  cafe_mgr@wemarket.kr      / test1234   (카페 매니저)');
  console.log('  cafe_kitchen@wemarket.kr  / test1234   (카페 주방)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
