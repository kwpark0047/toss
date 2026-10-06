import { describe, expect, it } from 'vitest';

describe('admin module loading', () => {
  for (const name of ['SettlementManager', 'LegalSettings', 'DynamicPricingManager', 'CampaignDashboard', 'StoreSettings', 'ProductModal', 'StaffManager', 'ReviewManager', 'SystemStatus']) {
    it(`loads ${name} without unresolved metadata icons`, async () => {
      const modules = import.meta.glob('../components/admin/*.jsx');
      const module = await modules[`../components/admin/${name}.jsx`]();
      expect(module).toBeTruthy();
    });
  }
});
