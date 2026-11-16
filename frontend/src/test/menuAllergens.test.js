import { describe, expect, it } from 'vitest';
import { collectMenuAllergens, filterMenuItems, normalizeAllergens } from '@/utils/menuMetadata';

describe('normalizeAllergens', () => {
  it('normalizes arrays and JSON-encoded arrays', () => {
    expect(normalizeAllergens(['우유', '대두'])).toEqual(['우유', '대두']);
    expect(normalizeAllergens('["밀", "계란"]')).toEqual(['밀', '계란']);
  });

  it('supports legacy comma-separated data and ignores empty/invalid values', () => {
    expect(normalizeAllergens('우유, 대두')).toEqual(['우유', '대두']);
    expect(normalizeAllergens('')).toEqual([]);
    expect(normalizeAllergens(null)).toEqual([]);
  });
});

describe('collectMenuAllergens', () => {
  it('returns unique allergen labels registered on the menu', () => {
    const items = [{ allergens: ['우유', '대두'] }, { allergens: '밀, 우유' }, { allergens: null }];
    expect(collectMenuAllergens(items)).toEqual(['대두', '밀', '우유']);
  });
});

describe('filterMenuItems', () => {
  const items = [
    { id: 1, name: '크림 파스타', description: '생크림 소스', allergens: ['우유', '밀'] },
    { id: 2, name: '토마토 파스타', description: '', allergens: ['밀'] },
    { id: 3, name: '그린 샐러드', description: 'Fresh salad', allergens: null },
  ];

  it('matches name or description ignoring spaces and case', () => {
    expect(filterMenuItems(items, { query: '크림파스타' }).map((i) => i.id)).toEqual([1]);
    expect(filterMenuItems(items, { query: 'SALAD' }).map((i) => i.id)).toEqual([3]);
  });

  it('hides items containing an excluded allergen but keeps items without allergen data', () => {
    expect(filterMenuItems(items, { excludedAllergens: ['우유'] }).map((i) => i.id)).toEqual([2, 3]);
    expect(filterMenuItems(items, { excludedAllergens: ['밀'] }).map((i) => i.id)).toEqual([3]);
  });

  it('returns everything when no filter is set', () => {
    expect(filterMenuItems(items)).toHaveLength(3);
  });
});
