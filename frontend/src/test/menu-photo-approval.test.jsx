import { expect, it } from 'vitest';
import { initialMenuDraft, menuDraftApproved } from '../utils/menuPhotoDraft';
it('prefills only editable text and never AI price/allergen or remote image claims', () => {
  const d = initialMenuDraft({
    name: 'QA',
    price: 9999,
    allergens: '없음',
    image_url: 'https://evil.invalid/x',
    description: '초안',
  });
  expect(d.name).toBe('QA');
  expect(d.price).toBe('');
  expect(d.allergens).toBe('');
  expect(d.image_url).toBe('');
});
it('requires manual price, allergen review and explicit final approval; zero is allowed only when explicitly entered', () => {
  expect(
    menuDraftApproved(
      { price: '', allergens: '' },
      { price: true, allergens: true, approve: true, none: true }
    )
  ).toBe(false);
  expect(
    menuDraftApproved(
      { price: '1000', allergens: '우유' },
      { price: true, allergens: true, approve: false }
    )
  ).toBe(false);
  expect(
    menuDraftApproved(
      { price: '0', allergens: '' },
      { price: true, allergens: true, approve: true, none: true }
    )
  ).toBe(true);
  expect(
    menuDraftApproved(
      { price: '1000', allergens: '' },
      { price: true, allergens: true, approve: true }
    )
  ).toBe(false);
});
