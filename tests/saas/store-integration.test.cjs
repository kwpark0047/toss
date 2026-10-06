const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, normalizeEvent, normalizeBatch } = require('../../services/integrationContract');
const base = { event_id: 'event-1', record_id: 'order-1', kind: 'order', version: 1, occurred_at: '2026-10-07T12:00:00+09:00', amount: 5000, status: 'paid' };

test('CSV handles BOM, quoted cells and line endings without accepting confidential columns', () => {
  const text = '\uFEFFevent_id,record_id,kind,version,occurred_at,amount,status\r\n"event-1","order-1",order,1,2026-10-07T03:00:00Z,5000,paid\r\n';
  assert.equal(parseCsv(text)[0].record_id, 'order-1');
  assert.throws(() => parseCsv(text.replace('status', 'card_number')), /컬럼/);
  assert.throws(() => parseCsv(text.replace('"order-1"', '"order-1')), /따옴표/);
});
test('replays of the same snapshot share a hash, while corrected money requires a new version', () => {
  const a = normalizeEvent(base, 3, 'source-a');
  const replay = normalizeEvent({ ...base, event_id: 'event-other' }, 3, 'source-a');
  assert.equal(a.payload_hash, replay.payload_hash);
  assert.notEqual(a.payload_hash, normalizeEvent({ ...base, amount: 4000 }, 3, 'source-a').payload_hash);
  assert.equal(a.occurred_at, '2026-10-07T03:00:00.000Z');
});
test('tenant/customer references are scoped and native orders have an explicit canonical key', () => {
  const a = normalizeEvent({ ...base, customer_reference: 'member-1' }, 3, 'source-a');
  const b = normalizeEvent({ ...base, customer_reference: 'member-1' }, 4, 'source-a');
  assert.notEqual(a.customer_key, b.customer_key);
  assert.equal(a.customer_key.length, 64);
  assert.equal(normalizeEvent({ ...base, native_order_id: 123 }, 3, 'source-a').order_key, 'native:123');
  assert.throws(() => normalizeBatch({ events: [base], store_id: 4 }, 3, 'source-a'), /매장 ID/);
});
test('financial and consent validation rejects ambiguous or unsafe data', () => {
  for (const bad of [{ amount: 0.5 }, { amount: -1 }, { currency: 'USD' }, { refund_amount: 5001 }, { occurred_at: '2026-10-07 12:00' }, { marketing_consent: 'granted' }, { card_number: 'sensitive' }, { version: 0 }, { kind: 'charge' }]) {
    assert.throws(() => normalizeEvent({ ...base, ...bad }, 3, 'source-a'));
  }
  assert.equal(normalizeEvent({ ...base, kind: 'loyalty', amount: -100, currency: 'POINT' }, 3, 'source-a').amount, -100);
  assert.equal(normalizeEvent({ ...base, marketing_consent: 'withdrawn', consent_at: base.occurred_at, consent_source: 'consent-record-1' }, 3, 'source-a').marketing_consent, 'withdrawn');
});
test('a malformed row rejects the entire batch and reports its row', () => {
  assert.throws(() => normalizeBatch({ events: [base, { ...base, amount: 'bad' }] }, 3, 'source-a'), /2행/);
  assert.throws(() => normalizeBatch({ events: [] }, 3, 'source-a'), /1~500/);
  assert.throws(() => normalizeBatch({ events: Array(501).fill(base) }, 3, 'source-a'), /1~500/);
});
