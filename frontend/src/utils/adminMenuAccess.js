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
  if (platformRole === 'staff' && !storeRole) return path === '/admin';
  if (storeRole === 'kitchen') return path === '/admin' || /\/kitchen$|\/profile$/.test(path);
  if (storeRole === 'manager' && /\/plan$|\/legal$/.test(path)) return false;
  return true;
}
