import { expect, it } from 'vitest';
import { normalizeSalesSeries } from '../lib/dashboardData';

it('reads the real analytics summary/data envelope', () => {
  expect(
    normalizeSalesSeries({
      success: true,
      data: { summary: {}, data: [{ label: '10-06', sales: 32000, orders: 1 }] },
    })
  ).toEqual([{ label: '10-06', date: '10-06', sales: 32000, orders: 1 }]);
});
it('preserves array responses and handles empty results', () => {
  expect(normalizeSalesSeries({ data: [{ date: '2026-10-06', amount: '1200' }] })[0].sales).toBe(
    1200
  );
  expect(normalizeSalesSeries({ data: { summary: {} } })).toEqual([]);
});
