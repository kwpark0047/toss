import { test, expect } from 'vitest';
import { canSeeAdminMenu } from '../utils/adminMenuAccess';
test.each([
  ['/admin/stores/3/kitchen', 'staff', 'kitchen', true],
  ['/admin/stores/3/settings', 'staff', 'kitchen', false],
  ['/admin/stores/3/customers', 'staff', 'kitchen', false],
  ['/admin/stores/3/orders', 'staff', 'manager', true],
  ['/admin/provider-settings', 'store_admin', 'owner', false],
  ['/admin/system-status', 'staff', 'manager', false],
  ['/admin/stores/3/plan', 'staff', 'manager', false],
  ['/admin/stores/3/plan', 'store_admin', 'owner', true],
  ['/admin/provider-settings', 'super_admin', null, true],
])('%s follows role %s/%s', (path, platformRole, storeRole, allowed) =>
  expect(canSeeAdminMenu(path, platformRole, storeRole)).toBe(allowed)
);
