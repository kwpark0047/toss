import { describe, expect, it } from 'vitest';
import { canOrderFromMenuSnapshot } from '@/utils/customerMenuAvailability';

describe('canOrderFromMenuSnapshot', () => {
  it('allows ordering only when the store is open and all menu sections are fresh', () => {
    expect(canOrderFromMenuSnapshot(true, {})).toBe(true);
    expect(canOrderFromMenuSnapshot(false, {})).toBe(false);
    expect(canOrderFromMenuSnapshot(true, { menu: true })).toBe(false);
    expect(canOrderFromMenuSnapshot(true, { profile: true, categories: false })).toBe(false);
  });
});
