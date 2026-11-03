const crypto = require('crypto');
const { AppError } = require('../../utils/errorHandler');

/**
 * 배달대행 어댑터 모음.
 *
 * 어댑터 계약 (모든 메서드는 매장 인증정보 credentials.values를 받는다):
 *   requestDispatch({ credentials, order, store, callbackUrl }) → { externalId, status, fee?, trackingUrl? }
 *   cancelDispatch({ credentials, dispatch, reason })            → { status: 'canceled' }
 *   verifyWebhook({ credentials, rawBody, headers })             → boolean
 *   parseWebhook({ body })  → { eventId, externalId, status, riderName?, riderPhone?, trackingUrl?, fee?, reason? }
 * status는 requested | assigned | picked_up | delivered | canceled | failed 중 하나로 맞춘다.
 *
 * 바로고·부릉·생각대로는 제휴 API 문서와 테스트 계정을 받은 뒤 실제 호출을 채운다.
 * 그 전에는 ready=false라 매장이 배달대행을 선택할 수는 있어도 배차 요청은 막힌다.
 */

const STATUSES = ['requested', 'assigned', 'picked_up', 'delivered', 'canceled', 'failed'];

// 공통 서명: 매장 인증정보의 api_secret으로 원본 바디에 HMAC-SHA256 (헤더 x-delivery-signature, hex)
function verifyHmac({ credentials, rawBody, headers }) {
  const secret = credentials?.values?.api_secret;
  const given = String(headers?.['x-delivery-signature'] || '');
  if (!secret || !rawBody || !/^[0-9a-f]{64}$/i.test(given)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(given.toLowerCase(), 'hex')
  );
}

function pendingAdapter(key, label) {
  const notReady = () => {
    throw new AppError(
      `${label} 연동은 준비 중입니다. 제휴 API 문서와 테스트 계정을 받은 뒤 사용할 수 있습니다.`,
      501
    );
  };
  return {
    key,
    label,
    ready: false,
    requestDispatch: notReady,
    cancelDispatch: notReady,
    verifyWebhook: () => false,
    parseWebhook: notReady,
  };
}

/**
 * 테스트용 가짜 대행사. 운영에서는 DELIVERY_MOCK_AGENCY=1일 때만 켜진다(테스트 환경은 항상).
 * 외부 호출 없이 바로 'requested'로 접수하고, 웹훅은 공통 HMAC 서명으로 받는다.
 */
const mockAdapter = {
  key: 'mock',
  label: '테스트 대행사',
  ready: true,
  async requestDispatch({ order }) {
    return {
      externalId: `mock-${order.id}-${crypto.randomBytes(4).toString('hex')}`,
      status: 'requested',
      fee: 3500,
      trackingUrl: null,
    };
  },
  async cancelDispatch() {
    return { status: 'canceled' };
  },
  verifyWebhook: verifyHmac,
  parseWebhook({ body }) {
    return {
      eventId: String(body?.event_id || ''),
      externalId: String(body?.dispatch_id || ''),
      status: body?.status,
      riderName: body?.rider?.name || null,
      riderPhone: body?.rider?.phone || null,
      trackingUrl: body?.tracking_url || null,
      fee: Number.isInteger(body?.fee) ? body.fee : null,
      reason: body?.reason || null,
    };
  },
};

const ADAPTERS = {
  barogo: pendingAdapter('barogo', '바로고'),
  vroong: pendingAdapter('vroong', '부릉'),
  saenggakdaero: pendingAdapter('saenggakdaero', '생각대로'),
};

const mockEnabled = () =>
  process.env.NODE_ENV === 'test' || process.env.DELIVERY_MOCK_AGENCY === '1';

// 매장이 고를 수 있는 대행사 (테스트 대행사는 켜진 환경에서만)
function providerKeys() {
  return [...Object.keys(ADAPTERS), ...(mockEnabled() ? ['mock'] : [])];
}

function getAdapter(key) {
  if (key === 'mock') return mockEnabled() ? mockAdapter : null;
  return Object.hasOwn(ADAPTERS, key) ? ADAPTERS[key] : null;
}

function listProviders() {
  return providerKeys().map((key) => {
    const adapter = getAdapter(key);
    return { key, label: adapter.label, ready: adapter.ready };
  });
}

module.exports = { STATUSES, getAdapter, listProviders, providerKeys, verifyHmac };
