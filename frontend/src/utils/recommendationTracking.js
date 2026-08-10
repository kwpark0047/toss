import { recommendationAPI } from '@/api';

/**
 * AI 추천 성과 추적 헬퍼 (프론트엔드)
 *
 * - 세션 시작 시 최초 노출을 localStorage 에 보관하여 주문 전환 시 어트리뷰션을 기록
 * - 노출(impression) 시 impression ID 를 저장 → 클릭(click) 시 click 기록
 * - 주문 성공 시 해당 세션의 추천 메뉴가 장바구니에 포함되어 있으면 conversion 기록
 */
const STORAGE_KEY = 'wm_rec_session';

let sessionInitialized = false;

function getSession() {
  let session = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) session = JSON.parse(raw);
  } catch {
    /* 무시 */
  }
  if (!session || !session.id) {
    session = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      impressions: {}, // menuId -> { id: impressionId, clicked: bool }
      createdAt: Date.now(),
    };
  }
  return session;
}

function persist(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* 무시 */
  }
}

function getPhone() {
  try {
    return localStorage.getItem('wm_customer_phone') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 세션 시작 — 추천 노출을 기록하고 impression id 를 세션에 저장한다.
 * @param {number} storeId
 * @param {Array<{id:number}>} recommendations
 * @param {string} recommendationType
 * @param {string} source
 * @param {object} [weatherContext]
 * @param {string} [timePeriod]
 */
export async function trackImpressions(
  storeId,
  recommendations,
  recommendationType,
  source,
  weatherContext,
  timePeriod
) {
  if (!recommendations?.length || !storeId) return;
  const session = getSession();
  sessionInitialized = true;
  persist(session);

  await Promise.allSettled(
    recommendations.map((rec, position) =>
      recommendationAPI
        .recordImpression({
          storeId: Number(storeId),
          sessionId: session.id,
          phone: getPhone(),
          menuId: rec.id,
          recommendationType,
          source,
          position,
          weatherContext,
          timePeriod,
        })
        .then((res) => {
          const imp = res?.data || res;
          if (imp?.id) {
            session.impressions[rec.id] = { id: imp.id, clicked: false };
            persist(session);
          }
        })
    )
  );
}

/**
 * 추천 메뉴 클릭 — 노출된 메뉴에 대해 클릭을 기록한다.
 */
export async function trackRecommendationClick(storeId, menuId, recommendationType) {
  const session = getSession();
  const imp = session.impressions?.[menuId];
  if (!imp?.id || imp.clicked) return;
  const res = await recommendationAPI
    .recordClick({
      impressionId: imp.id,
      storeId: Number(storeId),
      sessionId: session.id,
      phone: getPhone(),
      menuId,
      recommendationType,
    })
    .catch(() => null);
  if (res) {
    session.impressions[menuId] = { ...imp, clicked: true };
    persist(session);
  }
}

/**
 * 주문 성공 — 세션 내 추천 메뉴가 주문 항목에 포함되어 있으면 전환(conversion)을 기록한다.
 * @param {number} storeId
 * @param {number} orderId
 * @param {Array<{id:number, name?:string}>} orderedItems
 * @param {string} recommendationType
 */
export async function trackOrderConversion(storeId, orderId, orderedItems, recommendationType) {
  if (!storeId || !orderId || !orderedItems?.length) return;
  const session = getSession();
  if (sessionInitialized) sessionInitialized = false;
  const impressions = session.impressions || {};

  await Promise.allSettled(
    orderedItems.map(async (item) => {
      const imp = impressions[item.id];
      if (!imp?.id) return;
      await recommendationAPI
        .recordConversion({
          impressionId: imp.id,
          storeId: Number(storeId),
          sessionId: session.id,
          phone: getPhone(),
          orderId: Number(orderId),
          menuId: item.id,
          recommendationType,
        })
        .catch(() => {
          /* 추적 실패는 무시 */
        });
    })
  );

  // 세션 초기화 (다음 방문 퍼널과 격리)
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 무시 */
  }
}
