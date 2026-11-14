export function resolveAdminStoreId(path, platformRole, selectedStoreId) {
  const match = path.match(/^\/admin\/stores\/(\d+)(?:\/|$)/);
  return match ? match[1] : platformRole === 'super_admin' ? undefined : selectedStoreId;
}
export function canSeeAdminMenu(path, platformRole, storeRole) {
  if (platformRole === 'super_admin') return true;
  if (
    [
      '/admin/provider-settings',
      '/admin/system-status',
      '/admin/bulk-sms',
      '/admin/enrich-stores',
      '/admin/plan-requests',
    ].includes(path)
  )
    return false;

  if (platformRole === 'customer') return path === '/admin/profile';
  if (storeRole === 'kitchen') return path === '/admin' || path === '/admin/profile' || /\/kitchen$/.test(path);
  if (storeRole === 'staff') {
    return path === '/admin' || path === '/admin/profile' || /^\/admin\/stores\/\d+\/orders$/.test(path);
  }
  if (storeRole === 'manager') {
    return !(
      path === '/admin/supervisor' ||
      /\/plan$|\/legal$/.test(path)
    );
  }
  if (storeRole === 'owner') return true;

  // Accounts without a store membership may open the dashboard for onboarding,
  // but must not see a store-scoped management link.
  if (platformRole === 'staff' && !storeRole) return path === '/admin' || path === '/admin/profile';
  return path === '/admin' || path === '/admin/profile';
}

export function getAdminQuickNavItems(filteredNavItems, storeRole, storeId) {
  if (storeRole === 'kitchen') return filteredNavItems.slice(0, 2);
  if (!storeId) return filteredNavItems.slice(0, 4);

  const preferredPaths = [
    '/admin',
    `/admin/stores/${storeId}/orders`,
    `/admin/stores/${storeId}/menu`,
    `/admin/stores/${storeId}/tinkerbell`,
  ];
  return preferredPaths
    .map(path => filteredNavItems.find(item => item.path === path))
    .filter(Boolean);
}
