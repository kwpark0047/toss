import { test, expect } from 'vitest';
import { canSeeAdminMenu, getAdminQuickNavItems, resolveAdminStoreId } from '../utils/adminMenuAccess';

test('super admin global navigation never inherits the automatically selected store', () => {
  expect(resolveAdminStoreId('/admin/system-status', 'super_admin', 3)).toBeUndefined();
  expect(resolveAdminStoreId('/admin', 'super_admin', 3)).toBeUndefined();
  expect(resolveAdminStoreId('/admin/stores/5/orders', 'super_admin', 3)).toBe('5');
  expect(resolveAdminStoreId('/admin', 'store_admin', 3)).toBe(3);
});
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

test.each([
  ['/admin', 'staff', 'staff', true],
  ['/admin/stores/3/orders', 'staff', 'staff', true],
  ['/admin/profile', 'staff', 'staff', true],
  ['/admin/stores/3/menu', 'staff', 'staff', false],
  ['/admin/stores/3/sales', 'staff', 'staff', false],
  ['/admin/stores/3/staff', 'staff', 'staff', false],
  ['/admin/supervisor', 'staff', 'manager', false],
  ['/admin/stores/3/plan', 'staff', 'manager', false],
  ['/admin/stores/3/legal', 'staff', 'manager', false],
  ['/admin/stores/3/menu', 'store_admin', 'owner', true],
  ['/admin/stores/3/sales', 'store_admin', 'owner', true],
  ['/admin/stores/3/kitchen', 'staff', 'kitchen', true],
  ['/admin/stores/3/menu', 'staff', 'kitchen', false],
  ['/admin/stores/3/orders', 'customer', null, false],
  ['/admin/profile', 'customer', null, true],
])('%s menu visibility matches %s/%s role capabilities', (path, platformRole, storeRole, allowed) =>
  expect(canSeeAdminMenu(path, platformRole, storeRole)).toBe(allowed)
);

test('mobile quick navigation uses the filtered role menu', () => {
  const menu = [
    { label: '대시보드', path: '/admin' },
    { label: '주문', path: '/admin/stores/3/orders' },
    { label: '상품', path: '/admin/stores/3/menu' },
    { label: 'AI', path: '/admin/stores/3/tinkerbell' },
    { label: '주방', path: '/admin/stores/3/kitchen' },
  ];
  const staffMenu = menu.filter(item => canSeeAdminMenu(item.path, 'staff', 'staff'));
  const kitchenMenu = menu.filter(item => canSeeAdminMenu(item.path, 'staff', 'kitchen'));

  expect(getAdminQuickNavItems(staffMenu, 'staff', '3').map(item => item.path)).toEqual([
    '/admin',
    '/admin/stores/3/orders',
  ]);
  expect(getAdminQuickNavItems(kitchenMenu, 'kitchen', '3').map(item => item.path)).toEqual([
    '/admin',
    '/admin/stores/3/kitchen',
  ]);
});
