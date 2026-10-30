import { describe, expect, it } from 'vitest';
import { normalizeAllergens } from '@/utils/menuMetadata';

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
