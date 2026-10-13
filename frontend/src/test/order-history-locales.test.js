import { describe, it, expect } from 'vitest';
import i18next from 'i18next';
import ko from '../locales/ko/translation.json';
import en from '../locales/en/translation.json';
import ja from '../locales/ja/translation.json';
import zh from '../locales/zh/translation.json';
describe('customer order history labels', () => {
  for (const [lng, translation] of Object.entries({ ko, en, ja, zh }))
    it(`resolves customer labels in ${lng}`, async () => {
      const instance = i18next.createInstance();
      await instance.init({ lng, fallbackLng: false, resources: { [lng]: { translation } } });
      for (const key of [
        'common.history',
        'common.call_manager',
        'common.search_placeholder',
        'common.and_others',
        'order.active_status',
        'order.total_amount',
        'order.summary',
        'order.past_history',
        'review.completed',
        'review.write',
        'menu.no_items',
        ...['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].map(
          (status) => `status.${status}`
        ),
      ]) {
        expect(instance.exists(key), key).toBe(true);
        expect(typeof instance.t(key)).toBe('string');
        expect(instance.t(key)).not.toBe(key);
      }
    });
});
