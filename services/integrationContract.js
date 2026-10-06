const crypto = require('crypto');
const { AppError } = require('../utils/errorHandler');

const CHANNELS = ['pos', 'table_order', 'point_device', 'card_terminal', 'baemin', 'online_order'];
const FIELDS = [
  'event_id',
  'record_id',
  'kind',
  'version',
  'occurred_at',
  'amount',
  'status',
  'currency',
  'refund_amount',
  'order_key',
  'native_order_id',
  'customer_reference',
  'marketing_consent',
  'consent_at',
  'consent_source',
];
const REQUIRED = ['event_id', 'record_id', 'kind', 'version', 'occurred_at', 'amount', 'status'];
function fail(message) {
  throw new AppError(message, 400, 'INTEGRATION_VALIDATION');
}
function identifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:#-]{1,128}$/.test(value))
    fail(`${label}: 1~128자의 영문·숫자 식별자를 입력하세요.`);
  return value;
}
function integer(value, label, min = 0, max = 1e12) {
  if (
    value === '' ||
    value == null ||
    !/^-?\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  )
    fail(`${label}: ${min}~${max} 범위의 정수가 필요합니다.`);
  return Number(value);
}
function timestamp(value, label) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(`${label}: 시간대가 있는 ISO 일시가 필요합니다.`);
  return new Date(value).toISOString();
}

// CSV is deliberately a normalized interchange contract, not an unofficial vendor API.
function parseCsv(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 1024 * 1024)
    fail('CSV는 UTF-8 1MB 이하로 입력하세요.');
  const rows = [],
    row = [];
  let cell = '',
    quoted = false,
    closed = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
        closed = true;
      } else cell += ch;
    } else if (ch === '"') {
      if (cell || closed) fail('잘못된 CSV 따옴표입니다.');
      quoted = true;
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(cell);
      cell = '';
      closed = false;
      if (ch !== ',') {
        if (ch === '\r' && source[i + 1] === '\n') i++;
        if (row.some((value) => value.trim())) rows.push([...row]);
        row.length = 0;
      }
    } else {
      if (closed) fail('닫힌 CSV 따옴표 뒤에 값이 있습니다.');
      cell += ch;
    }
    if (rows.length > 501) fail('한 번에 최대 500행을 수집할 수 있습니다.');
  }
  if (quoted) fail('CSV 따옴표가 닫히지 않았습니다.');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) fail('CSV 헤더와 거래 데이터가 필요합니다.');
  const headers = rows.shift().map((value) => value.trim());
  if (
    new Set(headers).size !== headers.length ||
    headers.some((header) => !FIELDS.includes(header)) ||
    REQUIRED.some((field) => !headers.includes(field))
  )
    fail('CSV 컬럼을 확인하세요. 카드번호·전화번호·비밀번호 등은 수집하지 않습니다.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) fail(`CSV ${index + 2}행의 컬럼 수가 맞지 않습니다.`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i].trim()]));
  });
}

function normalizeEvent(input, storeId, connectionId) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((field) => !FIELDS.includes(field))
  )
    fail('지원하지 않는 거래 필드입니다. 카드번호·인증정보·원문 고객 연락처는 수집하지 않습니다.');
  if (!['order', 'payment', 'refund', 'loyalty'].includes(input.kind))
    fail('kind는 order/payment/refund/loyalty 중 하나입니다.');
  if (!['pending', 'paid', 'cancelled', 'completed'].includes(input.status))
    fail('지원하지 않는 거래 상태입니다.');
  const kind = input.kind;
  const currency = input.currency || (kind === 'loyalty' ? 'POINT' : 'KRW');
  if (currency !== (kind === 'loyalty' ? 'POINT' : 'KRW'))
    fail('금액은 KRW, 포인트는 POINT 단위를 사용하세요.');
  const amount = integer(input.amount, 'amount', kind === 'loyalty' ? -1e12 : 0);
  const refundAmount = integer(input.refund_amount || 0, 'refund_amount');
  if ((kind === 'order' && refundAmount > amount) || (kind !== 'order' && refundAmount !== 0))
    fail('환불 누계는 주문 금액 이하여야 하며 order에만 지정합니다.');
  const nativeOrderId = input.native_order_id
    ? integer(input.native_order_id, 'native_order_id', 1, 2147483647)
    : null;
  if (nativeOrderId && kind !== 'order') fail('native_order_id는 order에만 연결할 수 있습니다.');
  const consent = input.marketing_consent || 'unknown';
  if (!['unknown', 'granted', 'withdrawn'].includes(consent))
    fail('마케팅 동의 상태를 확인하세요.');
  const consentAt = input.consent_at ? timestamp(input.consent_at, 'consent_at') : null;
  const consentSource = input.consent_source
    ? identifier(input.consent_source, 'consent_source')
    : null;
  if (consent !== 'unknown' && (!consentAt || !consentSource))
    fail('동의·철회에는 근거 식별자와 일시가 필요합니다.');
  const recordId = identifier(input.record_id, 'record_id');
  const customerKey = input.customer_reference
    ? crypto
        .createHash('sha256')
        .update(
          `${storeId}:${connectionId}:${identifier(input.customer_reference, 'customer_reference')}`
        )
        .digest('hex')
    : null;
  const event = {
    event_id: identifier(input.event_id, 'event_id'),
    record_id: recordId,
    kind,
    version: integer(input.version, 'version', 1, 2147483647),
    occurred_at: timestamp(input.occurred_at, 'occurred_at'),
    amount,
    refund_amount: refundAmount,
    status: input.status,
    currency,
    order_key: nativeOrderId
      ? `native:${nativeOrderId}`
      : input.order_key
        ? `merchant:${identifier(input.order_key, 'order_key')}`
        : `${connectionId}:${recordId}`,
    native_order_id: nativeOrderId,
    customer_key: customerKey,
    marketing_consent: consent,
    consent_at: consentAt,
    consent_source: consentSource,
  };
  const { event_id: _eventId, ...snapshot } = event;
  return {
    ...event,
    payload_hash: crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
  };
}

function normalizeBatch(body, storeId, connectionId) {
  if (
    !body ||
    Object.keys(body).some((key) => !['csv_text', 'events'].includes(key)) ||
    (body.csv_text != null && body.events != null)
  )
    fail('CSV 또는 events 중 하나만 제출하세요. 매장 ID는 인증 정보로 결정합니다.');
  const inputs = body.csv_text != null ? parseCsv(body.csv_text) : body.events;
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 500)
    fail('1~500개의 거래가 필요합니다.');
  return inputs.map((input, index) => {
    try {
      return normalizeEvent(input, storeId, connectionId);
    } catch (error) {
      throw new AppError(`${index + 1}행: ${error.message}`, 400, 'INTEGRATION_VALIDATION');
    }
  });
}

module.exports = {
  CHANNELS,
  FIELDS,
  REQUIRED,
  parseCsv,
  normalizeEvent,
  normalizeBatch,
  identifier,
};
