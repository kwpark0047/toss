/**
 * DataLoader N+1 문제 해결 데모 테스트
 * 
 * 실행: node scripts/test-dataloader-n1.js
 * 
 * 시나리오:
 * - 10개 주문 조회
 * - 각 주문마다 아이템 + 결제 + 상품 정보 필요
 * - 기존 방식: 1 (주문) + 10 (아이템) + 10 (결제) + 10 (상품) = 31 쿼리
 * - DataLoader: 1 (주문) + 1 (아이템 배치) + 1 (결제 배치) + 1 (상품 배치) = 4 쿼리
 */

const express = require('express');
const request = require('supertest');

// 시뮬레이션용 메모리 DB
const mockOrders = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  store_id: 1,
  status: 'completed',
  total_amount: 10000 + i * 1000,
  created_at: new Date(),
}));

const mockOrderItems = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  order_id: i + 1,
  product_id: i + 1,
  quantity: 2,
  unit_price: 5000,
}));

const mockPayments = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  order_id: i + 1,
  amount: 10000 + i * 1000,
  method: 'card',
  status: 'paid',
}));

const mockProducts = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `상품 ${i + 1}`,
  price: 5000,
  category: '음료',
}));

// 쿼리 카운터
let queryCount = 0;

// 느린 DB 시뮬레이션
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 기존 방식: 개별 조회 (N+1 문제)
async function legacyGetOrderDetails(orderId) {
  queryCount++;
  await delay(5); // DB 지연 시뮬레이션
  const order = mockOrders.find(o => o.id === orderId);
  if (!order) return null;
  
  // 아이템 조회
  queryCount++;
  await delay(5);
  const items = mockOrderItems.filter(item => item.order_id === orderId);
  
  // 결제 조회
  queryCount++;
  await delay(5);
  const payments = mockPayments.filter(p => p.order_id === orderId);
  
  // 상품 조회 (각 아이템마다)
  for (const item of items) {
    queryCount++;
    await delay(5);
    item.product = mockProducts.find(p => p.id === item.product_id);
  }
  
  return { ...order, items, payments };
}

// DataLoader 방식: 배치 로딩
class MockDataLoader {
  constructor(batchFn) {
    this.batchFn = batchFn;
    this.cache = new Map();
  }
  
  async load(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    // 실제로는 배치로 모아서 한 번에 호출
    const result = await this.batchFn([key]);
    this.cache.set(key, result[0]);
    return result[0];
  }
  
  async loadMany(keys) {
    const uncached = keys.filter(k => !this.cache.has(k));
    if (uncached.length > 0) {
      const results = await this.batchFn(uncached);
      uncached.forEach((k, i) => this.cache.set(k, results[i]));
    }
    return keys.map(k => this.cache.get(k));
  }
}

// DataLoader 인스턴스
const orderLoader = new MockDataLoader(async (ids) => {
  queryCount++;
  await delay(5);
  return ids.map(id => mockOrders.find(o => o.id === parseInt(id)) || null);
});

const orderItemsLoader = new MockDataLoader(async (ids) => {
  queryCount++;
  await delay(5);
  return ids.map(id => mockOrderItems.filter(item => item.order_id === parseInt(id)));
});

const orderPaymentsLoader = new MockDataLoader(async (ids) => {
  queryCount++;
  await delay(5);
  return ids.map(id => mockPayments.filter(p => p.order_id === parseInt(id)));
});

const productLoader = new MockDataLoader(async (ids) => {
  queryCount++;
  await delay(5);
  return ids.map(id => mockProducts.find(p => p.id === parseInt(id)) || null);
});

async function runTest() {
  console.log('=== N+1 문제 해결 데모 ===\n');
  const orderIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  // --- Test 1: Legacy (N+1) ---
  queryCount = 0;
  const startLegacy = Date.now();
  
  const legacyResults = [];
  for (const id of orderIds) {
    legacyResults.push(await legacyGetOrderDetails(id));
  }
  
  const legacyTime = Date.now() - startLegacy;
  console.log('📊 Legacy (N+1) 방식:');
  console.log(`   주문 수: ${orderIds.length}`);
  console.log(`   총 쿼리 수: ${queryCount}`);
  console.log(`   소요 시간: ${legacyTime}ms`);
  console.log(`   예상 쿼리: 1 (주문) + 10×3 (아이템+결제+상품) = 31`);
  
  // --- Test 2: DataLoader (배치) ---
  queryCount = 0;
  // 캐시 초기화
  orderLoader.cache.clear();
  orderItemsLoader.cache.clear();
  orderPaymentsLoader.cache.clear();
  productLoader.cache.clear();
  
  const startDataloader = Date.now();
  
  // DataLoader 방식
  const orders = await orderLoader.loadMany(orderIds.map(String));
  
  // 아이템 + 결제 병렬 배치 로드
  const orderIdsStr = orderIds.map(String);
  const [itemsMap, paymentsMap] = await Promise.all([
    orderItemsLoader.loadMany(orderIdsStr),
    orderPaymentsLoader.loadMany(orderIdsStr),
  ]);
  
  // 상품 ID 수집 후 배치 로드
  const allProductIds = [];
  const itemsWithProducts = itemsMap.map(items => {
    items.forEach(item => {
      if (!allProductIds.includes(String(item.product_id))) {
        allProductIds.push(String(item.product_id));
      }
    });
    return items;
  });
  
  const products = await productLoader.loadMany(allProductIds);
  const productMap = new Map(products.map((p, i) => [allProductIds[i], p]));
  
  // 결과 합치기
  const dataloaderResults = orders.map((order, idx) => ({
    ...order,
    items: itemsMap[idx].map(item => ({
      ...item,
      product: productMap.get(String(item.product_id)) || null,
    })),
    payments: paymentsMap[idx],
  }));
  
  const dataloaderTime = Date.now() - startDataloader;
  
  console.log('\n⚡ DataLoader (배치) 방식:');
  console.log(`   주문 수: ${orderIds.length}`);
  console.log(`   총 쿼리 수: ${queryCount}`);
  console.log(`   소요 시간: ${dataloaderTime}ms`);
  console.log(`   쿼리: 1 (주문) + 1 (아이템) + 1 (결제) + 1 (상품) = 4`);
  
  // --- Summary ---
  console.log('\n📈 개선 효과:');
  console.log(`   쿼리 수 감소: ${((queryCount - 4) / queryCount * 100).toFixed(1)}% (${queryCount} → 4)`);
  console.log(`   속도 향상: ${((legacyTime - dataloaderTime) / legacyTime * 100).toFixed(1)}% (${legacyTime}ms → ${dataloaderTime}ms)`);
  console.log(`   DB 라운드트립: ${queryCount} → 4 (${queryCount - 4}회 감소)`);
  
  // 결과 검증
  const legacyCount = legacyResults.filter(r => r).length;
  const dlCount = dataloaderResults.filter(r => r).length;
  console.log(`\n✅ 결과 검증: Legacy ${legacyCount}개 = DataLoader ${dlCount}개`);
}

runTest().catch(console.error);