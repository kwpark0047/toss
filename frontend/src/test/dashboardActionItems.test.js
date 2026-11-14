import { describe, expect, it } from 'vitest';
import { getLowStockCount } from '@/utils/dashboardActionItems';

describe('getLowStockCount', () => {
  it('reads the count from standard and nested API envelopes', () => {
    expect(getLowStockCount({ count: 3, alerts: [] })).toBe(3);
    expect(getLowStockCount({ data: { alerts: [{ id: 1 }, { id: 2 }] } })).toBe(2);
    expect(getLowStockCount([{ id: 1 }])).toBe(1);
  });

  it('treats malformed or missing data as no known alerts', () => {
    expect(getLowStockCount(null)).toBe(0);
    expect(getLowStockCount({ alerts: null })).toBe(0);
  });
});
